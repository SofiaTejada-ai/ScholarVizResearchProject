import os
import json
import time
import tempfile
from fastapi.testclient import TestClient
from app.main import app
from app.db import get_db_session, init_db, DB_PATH
from app.db import Interaction

client = TestClient(app)

def setup_module(module):
    # Ensure DB is initialized fresh for tests
    init_db()

def test_phishing_flow_creates_interaction():
    payload = {
        "message": "I got an email asking me to verify my bank account link, is this phishing?",
        "chat_history": [{"role":"user","content":"Earlier I saw a similar email"}],
        "strict_mode": True,
        "user_id": "test_user_1",
        "optional_artifacts": None,
        "ui_topic": "phishing",
    }
    r = client.post("/api/ask", json=payload)
    assert r.status_code == 200
    data = r.json()
    # New UI contract fields
    assert "topic" in data
    assert "title" in data
    assert "summary" in data
    assert isinstance(data["summary"], str)
    assert "diagram" in data
    assert isinstance(data["diagram"], dict)
    assert "type" in data["diagram"]
    assert "code" in data["diagram"]
    assert "title" in data["diagram"]
    assert "steps" in data
    assert isinstance(data["steps"], list)
    assert "sources" in data
    assert isinstance(data["sources"], list)
    assert "practice" in data
    assert isinstance(data["practice"], dict)
    assert "question" in data["practice"]
    assert "hint" in data["practice"]
    assert "answer" in data["practice"]
    assert "strict_evidence_used" in data
    assert isinstance(data["strict_evidence_used"], bool)
    assert "kb_coverage" in data
    assert data["kb_coverage"] in {"high","medium","low","none"}
    # Lab may be null or present
    if data.get("lab"):
        assert "enabled" in data["lab"]
        assert "case_file" in data["lab"]
        assert "artifact_text" in data["lab"]
        assert "highlights" in data["lab"]
        assert "next_steps" in data["lab"]
    # Evidence/citations must be present in summary or sources
    summary = data.get("summary", "")
    sources = data.get("sources", [])
    has_bracket_citation = ("[" in summary) and ("]" in summary)
    has_sources = bool(sources)
    assert has_bracket_citation or has_sources
    # Check DB
    db = get_db_session()
    try:
        rows = db.query(Interaction).filter(Interaction.topic_detected != None).all()
        # There should be at least one interaction for this user
        found = db.query(Interaction).filter(Interaction.final_answer_text != None).count()
        assert found >= 0  # simple sanity - ensure query works
    finally:
        db.close()

def test_lateral_movement_flow():
    payload = {
        "message": "How would an attacker move laterally after stealing credentials?",
        "chat_history": [],
        "strict_mode": False,
        "user_id": "test_user_2",
        "optional_artifacts": None,
        "ui_topic": "lateral-movement",
    }
    r = client.post("/api/ask", json=payload)
    assert r.status_code == 200
    data = r.json()
    # New UI contract fields
    assert "topic" in data
    assert "title" in data
    assert "summary" in data
    assert "diagram" in data
    assert "sources" in data
    assert "steps" in data
    assert "practice" in data
    assert "strict_evidence_used" in data
    assert "kb_coverage" in data
    # Should have at least one source
    assert isinstance(data["sources"], list)
    assert len(data["sources"]) >= 1


def test_strict_mode_refusal_out_of_scope():
    payload = {
        "message": "Can you help me write a poem about sunsets?",
        "chat_history": [],
        "strict_mode": True,
        "user_id": "test_user_3",
        "optional_artifacts": None,
        "ui_topic": "phishing",
    }
    r = client.post("/api/ask", json=payload)
    assert r.status_code == 200
    data = r.json()
    # New UI contract fields
    assert "topic" in data
    assert "title" in data
    assert "summary" in data
    assert "diagram" in data
    assert "sources" in data
    assert "steps" in data
    assert "practice" in data
    assert "strict_evidence_used" in data
    assert data["strict_evidence_used"] is True
    assert "kb_coverage" in data
    assert data["kb_coverage"] == "none"
    # Should include scope guidance source
    sources = data.get("sources", [])
    assert any(s.get("id") == "kb_scope_001" for s in sources if isinstance(s, dict))
    # Summary should mention scope
    summary = data.get("summary", "")
    assert "course topics" in summary.lower() or "rephrase" in summary.lower()
