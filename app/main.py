from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import os
import time
import json

from app.db import init_db, get_db_session, User, Session as DBSess, Interaction, create_user_if_missing, start_or_get_session_for_user
from app.librarian import Librarian
from app.ontology_mapper import OntologyMapper
from app.diagram_builder import DiagramBuilder
from app.lab_coach import LabCoach
from app.gemini_client import GeminiClient

# Config
SESSION_TIMEOUT_SECONDS = int(os.getenv("SESSION_TIMEOUT_SECONDS", "1800"))  # 30 minutes
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "30"))

# Initialize app and components
app = FastAPI(title="ScholarViz Backend")
init_db()  # ensure DB and tables

librarian = Librarian("data/kb.json")
ontology_mapper = OntologyMapper("data/ontology.json")
diagram_builder = DiagramBuilder()
lab_coach = LabCoach("data/cases.json", ontology_mapper)
gemini = GeminiClient()

# Simple in-memory rate limiting: {user_id: [(timestamp), ...]}
rate_limits: Dict[str, List[float]] = {}

# Request/Response models
class ChatItem(BaseModel):
    role: str
    content: str

class AskRequest(BaseModel):
    message: str
    chat_history: List[ChatItem]
    strict_mode: bool
    user_id: str
    optional_artifacts: Optional[List[Dict[str, Any]]] = None

class RetrievedDoc(BaseModel):
    id: str
    title: str
    quote: str

class DiagramNode(BaseModel):
    id: str
    label: str
    type: str

class DiagramEdge(BaseModel):
    source: str
    target: str
    relation: str
    label: Optional[str] = None

class LabHighlight(BaseModel):
    artifact_id: str
    span: Dict[str,int]
    concept_id: str
    excerpt: str

class PracticeQuestion(BaseModel):
    question: str
    choices: List[str]
    correct_index: int
    evidence_ids: List[str]
    explanation: str

class AskResponse(BaseModel):
    rewritten_question: str
    topic_detected: str
    retrieved_docs: List[RetrievedDoc]
    selected_concepts: List[str]
    diagram: Dict[str, List[Dict[str,Any]]]
    lab: Dict[str, Any]
    tutor: Dict[str, Any]
    practice: PracticeQuestion
    telemetry: Dict[str, Any]

# Helper: rate limit
def check_rate_limit(user_id: str):
    now = time.time()
    window_start = now - 60
    hits = rate_limits.setdefault(user_id, [])
    # remove old
    hits[:] = [t for t in hits if t >= window_start]
    if len(hits) >= RATE_LIMIT_PER_MIN:
        return False
    hits.append(now)
    return True

@app.post("/api/ask", response_model=AskResponse)
async def api_ask(req: AskRequest, request: Request):
    start_total = time.time()
    if not check_rate_limit(req.user_id):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    # Create user if missing and start session
    db = get_db_session()
    try:
        create_user_if_missing(db, req.user_id)
        session_row = start_or_get_session_for_user(db, req.user_id, SESSION_TIMEOUT_SECONDS)
    finally:
        db.close()

    telemetry = {}
    # Step A: intent rewrite using Gemini
    t0 = time.time()
    rewritten = gemini.rewrite_intent(req.message, req.chat_history, strict_mode=req.strict_mode)
    telemetry['rewrite_ms'] = int((time.time() - t0)*1000)

    # detect topic naive
    lowered = rewritten.lower()
    if "phish" in lowered or "phishing" in lowered:
        topic = "phishing"
    elif "lateral" in lowered or "lateral movement" in lowered or "move laterally" in lowered:
        topic = "lateral_movement"
    else:
        topic = "unknown"

    # Step B: retrieval
    t0 = time.time()
    retrieved = librarian.retrieve(rewritten, top_k=3)
    telemetry['retrieval_ms'] = int((time.time() - t0)*1000)

    # Step C: ontology mapping
    t0 = time.time()
    selected_nodes, selected_edges = ontology_mapper.map(rewritten, retrieved)
    telemetry['ontology_ms'] = int((time.time() - t0)*1000)

    # Step D: diagram assembly
    t0 = time.time()
    diagram = diagram_builder.build(selected_nodes, selected_edges)
    telemetry['diagram_ms'] = int((time.time() - t0)*1000)

    # Step E: lab selection / highlights
    t0 = time.time()
    lab_choice, highlights = lab_coach.select_and_highlight(req.optional_artifacts, topic, selected_nodes)
    telemetry['lab_ms'] = int((time.time() - t0)*1000)

    # Step F: tutoring output using Gemini with strict grounding
    t0 = time.time()
    tutoring_result = gemini.generate_tutoring(
        rewritten_question=rewritten,
        retrieved_docs=retrieved,
        selected_nodes=selected_nodes,
        lab_artifacts=lab_choice,
        highlights=highlights,
        strict_mode=req.strict_mode,
        topic=topic
    )
    telemetry['gemini_ms'] = int((time.time() - t0)*1000)
    telemetry['total_ms'] = int((time.time() - start_total)*1000)
    telemetry.update(gemini.last_token_info())

    # Persist interaction
    db = get_db_session()
    try:
        interaction = Interaction(
            session_id=session_row.id,
            created_at=datetime.utcnow(),
            user_message=req.message,
            rewritten_question=rewritten,
            topic_detected=topic,
            retrieved_doc_ids=json.dumps([d["id"] for d in retrieved]),
            selected_concepts=json.dumps([n["id"] for n in selected_nodes]),
            case_id=lab_choice.get("case_id"),
            strict_mode=req.strict_mode,
            final_answer_text=tutoring_result.get("final_answer", ""),
            practice_question=json.dumps(tutoring_result.get("practice", {})),
            latency_ms=telemetry['total_ms'],
            token_usage=json.dumps(telemetry.get("tokens", {}))
        )
        db.add(interaction)
        db.commit()
    finally:
        db.close()

    # Build response
    response = {
        "rewritten_question": rewritten,
        "topic_detected": topic,
        "retrieved_docs": [{"id": d["id"], "title": d["title"], "quote": d["quote"]} for d in retrieved],
        "selected_concepts": [n["id"] for n in selected_nodes],
        "diagram": diagram,
        "lab": {
            "case_id": lab_choice.get("case_id"),
            "artifacts": lab_choice.get("artifacts"),
            "highlights": highlights
        },
        "tutor": {
            "steps": tutoring_result.get("steps", []),
            "final_answer": tutoring_result.get("final_answer", "")
        },
        "practice": tutoring_result.get("practice", {}),
        "telemetry": telemetry
    }
    return JSONResponse(content=response)

@app.get("/api/history")
async def api_history(user_id: str, limit: int = 10):
    db = get_db_session()
    try:
        rows = db.query(Interaction).join(DBSess, Interaction.session_id == DBSess.id).filter(DBSess.user_id == user_id).order_by(Interaction.created_at.desc()).limit(limit).all()
        out = []
        for r in rows:
            out.append({
                "id": r.id,
                "created_at": r.created_at.isoformat(),
                "user_message": r.user_message,
                "rewritten_question": r.rewritten_question,
                "topic_detected": r.topic_detected,
                "retrieved_doc_ids": json.loads(r.retrieved_doc_ids or "[]"),
                "selected_concepts": json.loads(r.selected_concepts or "[]"),
                "case_id": r.case_id,
                "strict_mode": bool(r.strict_mode),
                "final_answer_text": r.final_answer_text,
                "practice_question": json.loads(r.practice_question or "{}"),
                "latency_ms": r.latency_ms
            })
        return {"user_id": user_id, "history": out}
    finally:
        db.close()
