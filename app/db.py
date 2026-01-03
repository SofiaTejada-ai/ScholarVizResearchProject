from sqlalchemy import create_engine, Column, String, Integer, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from datetime import datetime, timedelta
import os
from pathlib import Path

_default_db_path = str((Path(__file__).resolve().parent.parent / "data" / "scholarviz.db"))
DB_PATH = os.getenv("SCHOLARVIZ_DB_PATH", _default_db_path)
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
ENGINE = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=ENGINE)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    risk_profile = Column(String, nullable=True)
    learning_style = Column(String, nullable=True)
    sessions = relationship("Session", back_populates="user")

class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"))
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    user = relationship("User", back_populates="sessions")
    interactions = relationship("Interaction", back_populates="session")

class Interaction(Base):
    __tablename__ = "interactions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    user_message = Column(Text)
    rewritten_question = Column(Text)
    topic_detected = Column(String)
    retrieved_doc_ids = Column(Text)
    selected_concepts = Column(Text)
    case_id = Column(String, nullable=True)
    strict_mode = Column(Boolean, default=False)
    final_answer_text = Column(Text)
    practice_question = Column(Text)
    latency_ms = Column(Integer)
    token_usage = Column(Text, nullable=True)
    session = relationship("Session", back_populates="interactions")

def init_db():
    Base.metadata.create_all(bind=ENGINE)

def get_db_session():
    return SessionLocal()

# Helper utilities used in main
def create_user_if_missing(db, user_id: str):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        u = User(id=user_id)
        db.add(u)
        db.commit()
        db.refresh(u)
    return u

def start_or_get_session_for_user(db, user_id: str, timeout_seconds: int = 1800):
    # Find last session for user without ended_at
    s = db.query(Session).filter(Session.user_id == user_id).order_by(Session.started_at.desc()).first()
    now = datetime.utcnow()
    if not s or (s.started_at and (now - s.started_at).total_seconds() > timeout_seconds) or s.ended_at is not None:
        s = Session(user_id=user_id, started_at=now)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s
