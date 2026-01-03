from __future__ import annotations

import time
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.db import init_db, get_db_session, create_user_if_missing, start_or_get_session_for_user, Interaction
from app.librarian import Librarian
from app.ontology_mapper import OntologyMapper
from app.diagram_builder import DiagramBuilder
from app.lab_coach import LabCoach
from app.gemini_client import GeminiClient


router = APIRouter(prefix="/api", tags=["api"])

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

KB_PATH = str(DATA_DIR / "kb.json")
ONTOLOGY_PATH = str(DATA_DIR / "ontology.json")
CASES_PATH = str(DATA_DIR / "cases.json")


# Singletons (load once)
llm = GeminiClient()
librarian = Librarian(KB_PATH)
ontology = OntologyMapper(ONTOLOGY_PATH)
diagram_builder = DiagramBuilder()
lab_coach = LabCoach(CASES_PATH, ontology)


class ChatTurn(BaseModel):
    role: str
    content: str


class AskRequest(BaseModel):
    message: str
    chat_history: List[ChatTurn] = Field(default_factory=list)
    strict_mode: bool = True
    user_id: str = "anon"
    optional_artifacts: Optional[List[Dict[str, Any]]] = None


def detect_topic(text: str) -> str:
    t = (text or "").lower()
    if "phish" in t or "email" in t or "verify" in t or "link" in t:
        return "phishing"
    if "lateral" in t or "smb" in t or "pivot" in t or "credential" in t:
        return "lateral_movement"
    return "unknown"


def _to_history_dicts(chat_history: List[ChatTurn]) -> List[Dict[str, str]]:
    return [{"role": c.role, "content": c.content} for c in chat_history]


def _normalize_tutoring_payload(tutoring: Dict[str, Any]) -> Dict[str, Any]:
    """
    Accept both shapes:
    - Old: {"final_answer": "...", "steps": [...], "practice": {...}}
    - New: {"final_answer_text": "...", "steps": [...], "practice": {...}}
    And return the response fields the UI expects:
    - tutor: {"final_answer_text": str, "steps": list}
    - practice: dict
    """
    final_answer_text = (
        tutoring.get("final_answer_text")
        or tutoring.get("final_answer")
        or ""
    )

    steps = tutoring.get("steps") or []
    # steps may be list of {"text":..., "evidence_ids":...} or {"step":..., "evidence":...}
    normalized_steps: List[Dict[str, Any]] = []
    if isinstance(steps, list):
        for s in steps:
            if not isinstance(s, dict):
                continue
            step_text = s.get("step") or s.get("text") or ""
            evidence = s.get("evidence") or s.get("evidence_ids") or []
            normalized_steps.append({"step": step_text, "evidence": evidence})

    practice = tutoring.get("practice") or {}
    if not isinstance(practice, dict):
        practice = {}

    # normalize practice keys
    practice_out = {
        "question": practice.get("question", "") or "",
        "choices": practice.get("choices", []) or [],
        "correct_index": practice.get("correct_index", 0) if isinstance(practice.get("correct_index", 0), int) else 0,
        "evidence_ids": practice.get("evidence_ids", []) or [],
        "explanation": practice.get("explanation", "") or "",
    }

    return {
        "tutor": {
            "final_answer_text": final_answer_text,
            "steps": normalized_steps,
        },
        "practice": practice_out,
    }


@router.post("/ask")
def ask(req: AskRequest) -> Dict[str, Any]:
    t0 = time.time()

    # Ensure DB exists
    init_db()

    # DB session
    db = get_db_session()
    try:
        create_user_if_missing(db, req.user_id)
        session = start_or_get_session_for_user(db, req.user_id)

        topic_guess = detect_topic(req.message)

        # Rewrite intent
        rewritten = llm.rewrite_intent(
            message=req.message,
            chat_history=_to_history_dicts(req.chat_history),
            strict_mode=req.strict_mode,
        )

        # Retrieve docs
        retrieved_docs = librarian.retrieve(rewritten, top_k=3)

        # Ontology map
        selected_nodes, selected_edges = ontology.map(rewritten, retrieved_docs)

        # Diagram
        diagram = diagram_builder.build(selected_nodes, selected_edges)

        # Lab selection + highlights
        case, highlights = lab_coach.select_and_highlight(
            optional_artifacts=req.optional_artifacts,
            topic=topic_guess if topic_guess != "unknown" else "phishing",
            selected_nodes=selected_nodes,
        )

        # Tutor generation
        tutoring = llm.generate_tutoring(
            rewritten_question=rewritten,
            retrieved_docs=retrieved_docs,
            selected_nodes=selected_nodes,
            lab_artifacts=case,
            highlights=highlights,
            strict_mode=req.strict_mode,
            topic=topic_guess,
        )

        normalized = _normalize_tutoring_payload(tutoring)

        # Save interaction
        inter = Interaction(
            session_id=session.id,
            user_message=req.message,
            rewritten_question=rewritten,
            topic_detected=topic_guess,
            retrieved_doc_ids=json.dumps([d.get("id") for d in retrieved_docs]),
            selected_concepts=json.dumps([n.get("id") for n in selected_nodes]),
            case_id=case.get("case_id") if isinstance(case, dict) else None,
            strict_mode=req.strict_mode,
            final_answer_text=normalized["tutor"]["final_answer_text"],
            practice_question=normalized["practice"]["question"],
            latency_ms=int((time.time() - t0) * 1000),
            token_usage=json.dumps(llm.last_token_info()),
        )
        db.add(inter)
        db.commit()

        return {
            "rewritten_question": rewritten,
            "topic_detected": topic_guess,
            "retrieved_docs": retrieved_docs,
            "selected_concepts": [n.get("id") for n in selected_nodes],
            "diagram": diagram,
            "lab": {
                "case_id": case.get("case_id") if isinstance(case, dict) else "none",
                "artifacts": (case.get("artifacts") if isinstance(case, dict) else []) or [],
                "highlights": highlights,
            },
            "tutor": normalized["tutor"],
            "practice": normalized["practice"],
            "telemetry": {
                "latency_ms": int((time.time() - t0) * 1000),
                "token_usage": llm.last_token_info(),
            },
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
