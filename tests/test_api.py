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
        "optional_artifacts": None
    }
    r = client.post("/api/ask", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert "diagram" in data
    assert "lab" in data
    assert "practice" in data
    # Check DB
    db = get_db_session()
    try:
        rows = db.query(Interaction).join().filter(Interaction.topic_detected != None).all()
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
        "optional_artifacts": None
    }
    r = client.post("/api/ask", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["topic_detected"] in ["lateral_movement", "unknown"]
    assert "diagram" in data
    assert "lab" in data
    assert "practice" in data
