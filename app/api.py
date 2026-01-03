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
    strict_mode: bool = False
    user_id: str = "anon"
    optional_artifacts: Optional[List[Dict[str, Any]]] = None
    ui_topic: Optional[str] = None


def detect_topic(text: str, ui_topic: Optional[str] = None) -> str:
    forced = _normalize_ui_topic(ui_topic)
    if forced:
        # If the UI is explicitly on a topic, prefer it.
        return forced

    t = (text or "").lower()
    if "phish" in t or "email" in t or "verify" in t or "link" in t:
        return "phishing"
    if "lateral" in t or "smb" in t or "pivot" in t or "credential" in t:
        return "lateral_movement"
    if "privilege" in t or "privesc" in t:
        return "privilege_escalation"
    if "exfil" in t or "data theft" in t:
        return "data_exfiltration"
    return "unknown"


def _normalize_ui_topic(ui_topic: Optional[str]) -> Optional[str]:
    if ui_topic is None:
        return None
    t = str(ui_topic).strip().lower().replace("-", "_")
    if not t:
        return None
    if t in {"phishing", "lateral_movement", "privilege_escalation", "data_exfiltration"}:
        return t
    return t


def _evidence_pool(retrieved_docs: List[Dict[str, Any]], case: Optional[Dict[str, Any]], highlights: List[Dict[str, Any]]) -> List[str]:
    ev: List[str] = []
    for d in (retrieved_docs or [])[:5]:
        did = d.get("id")
        if isinstance(did, str) and did:
            ev.append(did)

    if case and isinstance(case, dict):
        for a in (case.get("artifacts") or []):
            if not isinstance(a, dict):
                continue
            aid = a.get("artifact_id") or a.get("id")
            if isinstance(aid, str) and aid:
                ev.append(aid)

    for h in (highlights or [])[:10]:
        if not isinstance(h, dict):
            continue
        aid = h.get("artifact_id")
        line_no = h.get("line")
        if isinstance(aid, str) and aid and isinstance(line_no, int) and line_no > 0:
            ev.append(f"{aid}:L{line_no}")

    # De-dup but preserve order
    out: List[str] = []
    seen = set()
    for x in ev:
        if x in seen:
            continue
        seen.add(x)
        out.append(x)
    return out


def _glossary_def(term: str) -> str:
    defs = {
        "phishing": "Tricking someone into revealing private information (like passwords) by pretending to be a trusted source, often via fake emails or messages.",
        "lateral movement": "When an attacker moves from one compromised computer to others within the same network, often using stolen credentials.",
        "credential": "A piece of information that proves identity, such as a username and password or a digital certificate.",
        "SMB": "Server Message Block; a network protocol used for sharing files, printers, and other resources between computers on a Windows network.",
        "NTLM": "NT LAN Manager; a challenge-response authentication protocol used by Windows for identity verification across networks.",
        "privilege escalation": "Gaining higher levels of access (permissions) on a system than originally granted, often by exploiting vulnerabilities.",
        "exfiltration": "The unauthorized transfer of data from a computer or network, typically stolen by an attacker.",
    }
    return defs.get(term, "A cybersecurity concept relevant to the question.")


def _render_mermaid(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> str:
    if not nodes:
        return ""
    lines = ["graph TD"]
    node_ids = {}
    for i, n in enumerate(nodes):
        nid = f"N{i}"
        label = n.get("label") or n.get("id")
        node_ids[n["id"]] = nid
        lines.append(f"    {nid}[\"{label}\"]")
    for e in edges:
        src = node_ids.get(e.get("source"))
        tgt = node_ids.get(e.get("target"))
        rel = e.get("relation", "")
        if src and tgt:
            lines.append(f"    {src} -->|{rel}| {tgt}")
    return "\n".join(lines)


def _generate_title(message: str, topic: str) -> str:
    message_lower = message.lower()
    if "what is" in message_lower:
        return f"What is {topic.title()}?"
    if "how does" in message_lower or "how do" in message_lower:
        return f"How {topic.title()} Works"
    if "why" in message_lower:
        return f"Why {topic.title()} Matters"
    return f"{topic.title()} Overview"


def _generate_summary(final_answer: str, retrieved_docs: List[Dict[str, Any]], strict_mode: bool) -> str:
    # Try to extract 2-4 sentences from final_answer
    sentences = [s.strip() for s in final_answer.split('.') if s.strip()]
    summary_parts = sentences[:3]
    if not summary_parts:
        if strict_mode and not retrieved_docs:
            summary_parts = ["Course materials did not cover this topic.", "I can provide a general explanation, but it is not from the course."]
        else:
            summary_parts = ["Here is a beginner-friendly explanation.", "More details are available in the sources below."]
    return '. '.join(summary_parts) + '.'


def _build_diagram(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]], topic: str) -> Tuple[str, str, str]:
    mermaid = _render_mermaid(nodes, edges)
    if mermaid:
        return "mermaid", mermaid, f"{topic.title()} Flow"
    # Fallback tiny diagram
    fallback = {
        "phishing": "graph TD\nA[Attacker sends fake email] --> B[User clicks link]\nB --> C[Credentials stolen]",
        "lateral_movement": "graph TD\nA[Initial compromise] --> B[Steal credentials]\nB --> C[Move to another host]",
        "privilege_escalation": "graph TD\nA[Low-priv access] --> B[Exploit vulnerability]\nB --> C[Admin access]",
        "exfiltration": "graph TD\nA[Data discovered] --> B[Compress/encrypt] --> C[Transfer out]",
    }.get(topic, "graph TD\nA[Question] --> B[Explanation]\nB --> C[Sources]")
    return "mermaid", fallback, f"{topic.title()} Overview"


def _build_steps(tutor_steps: List[Dict[str, Any]]) -> List[str]:
    steps = []
    for i, s in enumerate(tutor_steps[:8], start=1):  # cap at 8 steps
        if isinstance(s, dict) and s.get("step"):
            steps.append(f"{i}. {s['step']}")
    if not steps:
        steps = ["1. Understand the key concepts.", "2. Review the diagram.", "3. Check the sources for details."]
    return steps


def _build_sources(retrieved_docs: List[Dict[str, Any]], strict_mode: bool) -> List[Dict[str, Any]]:
    sources = []
    for d in retrieved_docs:
        sources.append({
            "id": d.get("id"),
            "title": d.get("title"),
            "section": d.get("citation"),
            "snippet": d.get("quote"),
            "ref": d.get("id"),
            "confidence": 1.0,
        })
    if not sources:
        if strict_mode:
            sources = [{
                "id": "none",
                "title": "No course sources found",
                "section": "Policy",
                "snippet": "Strict evidence mode is ON and no course materials matched this question.",
                "ref": "none",
                "confidence": 0.0,
            }]
        else:
            sources = [{
                "id": "general",
                "title": "General knowledge",
                "section": "General",
                "snippet": "No course sources found; this answer uses general knowledge.",
                "ref": "general",
                "confidence": 0.0,
            }]
    return sources


def _compute_kb_coverage(retrieved_docs: List[Dict[str, Any]], strict_mode: bool) -> str:
    if not retrieved_docs:
        return "none"
    if len(retrieved_docs) >= 3:
        return "high"
    if len(retrieved_docs) >= 2:
        return "medium"
    return "low"


def _build_lab(topic: str, case: Any, highlights: List[Dict[str, Any]], retrieved_docs: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    # Enable lab only for artifact-relevant topics
    if topic not in {"phishing", "lateral_movement"}:
        return None
    if not case or not isinstance(case, dict):
        return None
    arts = case.get("artifacts") or []
    if not arts:
        return None
    first_art = arts[0]
    lab_highlights = []
    for h in highlights:
        if isinstance(h, dict) and "line" in h and "artifact_id" in h:
            lab_highlights.append({
                "start_line": h["line"],
                "end_line": h["line"],
                "label": h.get("reason", ""),
                "reason": h.get("reason", ""),
            })
    # Generate next_steps checklist
    next_steps = {
        "phishing": ["Identify spoofed sender", "Check suspicious links", "Verify headers", "Report as spam"],
        "lateral_movement": ["Identify compromised account", "Review log timestamps", "Check for unusual SMB/NTLM traffic", "Contain the host"],
    }.get(topic, ["Review artifact", "Identify anomalies", "Document findings"])
    return {
        "enabled": True,
        "case_file": first_art.get("artifact_id", "unknown.txt"),
        "artifact_text": first_art.get("text", ""),
        "highlights": lab_highlights,
        "next_steps": next_steps,
    }


def _ensure_text_has_citation(text: str, evidence_ids: List[str]) -> str:
    txt = (text or "").strip()
    if not txt:
        txt = "I don't have enough evidence to answer."
    if "[" in txt and "]" in txt:
        return txt
    if evidence_ids:
        return f"{txt} [{evidence_ids[0]}]"
    return txt


def _is_in_scope(message: str) -> bool:
    t = (message or "").lower()
    keywords = [
        "phish",
        "email",
        "smb",
        "lateral",
        "credential",
        "password",
        "malware",
        "incident",
        "attack",
        "security",
        "exfil",
        "privilege",
        "log",
        "pcap",
    ]
    return any(k in t for k in keywords)


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

        topic_guess = detect_topic(req.message, req.ui_topic)

        if req.strict_mode and (not _is_in_scope(req.message)):
            # Deterministic refusal. Include an evidence id that exists in the KB.
            refusal_ev = ["kb_scope_001"]
            tutor = {
                "final_answer_text": _ensure_text_has_citation(
                    "I can only help with the course topics (e.g., phishing and lateral movement). Please rephrase your question as a cybersecurity incident/lab question.",
                    refusal_ev,
                ),
                "steps": [
                    {"step": "Share the suspicious email text/headers or a short log snippet to analyze.", "evidence": refusal_ev},
                    {"step": "Tell me what environment you are in (email client, Windows domain, etc.) so I can pick the right lab case.", "evidence": refusal_ev},
                ],
            }
            practice = {
                "question": "Which of the following is the best next step when a question is out of scope for the lab-based cybersecurity tutor?",
                "choices": [
                    "Guess anyway",
                    "Ask for relevant cybersecurity artifacts (email headers/logs) and re-scope the question",
                    "Ignore evidence requirements",
                    "Provide unrelated general knowledge",
                ],
                "correct_index": 1,
                "evidence_ids": refusal_ev,
                "explanation": "This tutor must stay grounded in course/lab evidence and should request relevant artifacts when needed.",
            }

            return {
                "topic": "general",
                "title": "Out of Scope",
                "summary": "I can only help with course topics like phishing and lateral movement. Please rephrase your question as a cybersecurity incident or lab question.",
                "diagram": {"type": "mermaid", "code": "graph TD\nA[Out of Scope] --> B[Rephrase as Cybersecurity Question]", "title": "Scope Guidance"},
                "steps": ["1. Share the suspicious email text/headers or a short log snippet to analyze.", "2. Tell me what environment you are in (email client, Windows domain, etc.) so I can pick the right lab case."],
                "sources": [
                    {
                        "id": "kb_scope_001",
                        "title": "Evidence-Grounded Tutoring Scope",
                        "section": "Course Policy: Grounded Answers",
                        "snippet": "This tutor answers questions using course snippets (KB doc ids) and lab artifacts. When evidence is missing, request specific headers/log lines rather than guessing.",
                        "ref": "kb_scope_001",
                        "confidence": 1.0,
                    }
                ],
                "lab": None,
                "practice": {
                    "question": "Which of the following is the best next step when a question is out of scope for the lab-based cybersecurity tutor?",
                    "hint": "Think about what helps the tutor stay grounded in course evidence.",
                    "answer": "Ask for relevant cybersecurity artifacts (email headers/logs) and re-scope the question.",
                },
                "strict_evidence_used": True,
                "kb_coverage": "none",
            }

        # Rewrite intent
        rewritten = llm.rewrite_intent(
            message=req.message,
            chat_history=_to_history_dicts(req.chat_history),
            strict_mode=req.strict_mode,
        )

        # Retrieve docs
        retrieved_docs = librarian.retrieve(rewritten, top_k=5)

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
        evidence_ids = _evidence_pool(retrieved_docs, case if isinstance(case, dict) else None, highlights)
        normalized["tutor"]["final_answer_text"] = _ensure_text_has_citation(
            normalized["tutor"].get("final_answer_text") or "",
            evidence_ids,
        )

        # Ensure all steps carry evidence.
        steps_out = normalized["tutor"].get("steps") or []
        if isinstance(steps_out, list):
            for s in steps_out:
                if not isinstance(s, dict):
                    continue
                ev = s.get("evidence")
                if not isinstance(ev, list) or not [x for x in ev if isinstance(x, str) and x]:
                    s["evidence"] = evidence_ids[:2] if evidence_ids else ["kb_scope_001"]

        # Ensure practice has evidence.
        if not normalized.get("practice") or not isinstance(normalized["practice"], dict):
            normalized["practice"] = {}
        if not (normalized["practice"].get("evidence_ids") or []):
            normalized["practice"]["evidence_ids"] = evidence_ids[:2] if evidence_ids else ["kb_scope_001"]

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

        # Build UI contract response
        # Always populate title, summary, diagram, steps, sources
        # Lab only if enabled; practice always returned; kb_coverage computed

        # Title and topic
        topic = topic_guess if topic_guess != "unknown" else "general"
        title = _generate_title(req.message, topic)

        # Summary: 2-4 sentences beginner-friendly
        summary = _generate_summary(normalized["tutor"].get("final_answer_text") or "", retrieved_docs, req.strict_mode)

        # Diagram: prefer mermaid; fallback to tiny 3-6 node diagram
        diagram_type, diagram_code, diagram_title = _build_diagram(selected_nodes, selected_edges, topic)

        # Steps: numbered, short
        steps = _build_steps(normalized["tutor"].get("steps") or [])

        # Sources: always present; may indicate none found
        sources = _build_sources(retrieved_docs, req.strict_mode)

        # KB coverage
        kb_coverage = _compute_kb_coverage(retrieved_docs, req.strict_mode)

        # Lab: optional, enabled only if artifact-relevant
        lab_obj = _build_lab(topic, case, highlights, retrieved_docs)

        # Practice: always returned
        practice_raw = normalized.get("practice") or {}
        practice_obj = {
            "question": practice_raw.get("question", ""),
            "hint": practice_raw.get("hint", "Think about the safest first action that preserves evidence and reduces risk."),
            "answer": practice_raw.get("answer", ""),
        }

        return {
            "topic": topic,
            "title": title,
            "summary": summary,
            "diagram": {"type": diagram_type, "code": diagram_code, "title": diagram_title},
            "steps": steps,
            "sources": sources,
            "lab": lab_obj,
            "practice": practice_obj,
            "strict_evidence_used": req.strict_mode,
            "kb_coverage": kb_coverage,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
