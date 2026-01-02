import os
import time
from typing import List, Dict, Any
import requests
import json

GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gpt-4o")
GEMINI_API_URL = os.getenv("GEMINI_API_URL", "https://api.openai.com/v1/chat/completions")

class GeminiClient:
    def __init__(self):
        self.api_key = GEMINI_KEY
        self.model = GEMINI_MODEL
        self.api_url = GEMINI_API_URL
        self._last_tokens = {}

    def _call_model(self, messages: List[Dict[str,str]], max_tokens: int = 512) -> Dict[str,Any]:
        if not self.api_key:
            # fallback deterministic stub
            text = " ".join([m["content"] for m in messages[-1:]])
            return {"choices":[{"message":{"content":f"[stubbed response] {text}"}}], "usage": {"total_tokens": 1}}
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"model": self.model, "messages": messages, "max_tokens": max_tokens, "temperature": 0.0}
        resp = requests.post(self.api_url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def rewrite_intent(self, message: str, chat_history: List[Dict[str,str]], strict_mode: bool):
        start = time.time()
        system = "You are a concise rewriter. Produce a short self-contained question from the user's message and relevant chat history. If strict_mode is true do not add new facts."
        history_text = "\n".join([f"{c['role']}: {c['content']}" for c in chat_history[-6:]]) if chat_history else ""
        prompt = f"{system}\n\nUser message: {message}\n\nChat history (relevant):\n{history_text}\n\nReturn a single-line rewritten question."
        messages = [{"role":"system","content":system},{"role":"user","content":prompt}]
        res = self._call_model(messages, max_tokens=128)
        content = res["choices"][0]["message"]["content"].strip()
        self._last_tokens = res.get("usage", {})
        return content

    def generate_tutoring(self, rewritten_question: str, retrieved_docs: List[Dict[str,str]], selected_nodes: List[Dict[str,Any]],
                          lab_artifacts: Dict[str,Any], highlights: List[Dict[str,Any]], strict_mode: bool, topic: str) -> Dict[str,Any]:
        # Build compact grounding inputs
        sys_msg = "You are a diagram-first cybersecurity tutor. Ground answers only in the provided course snippets and artifacts. If strict_mode is true, every step and final answer must cite evidence (kb doc ids or artifact highlight refs). If not enough evidence, say 'not enough course evidence' and ask a follow up question."
        docs_text = "\n".join([f"{d['id']}: {d['quote']}" for d in retrieved_docs])
        nodes_text = "\n".join([f"{n['id']}: {n.get('label')} - {n.get('description','')}" for n in selected_nodes])
        artifacts_text = ""
        for a in lab_artifacts.get("artifacts", []) if lab_artifacts else []:
            artifacts_text += f"{a.get('artifact_id', a.get('id',''))}: {a.get('text','')}\n"
        highlights_text = "\n".join([f"{h['artifact_id']}[{h['span']['start']}:{h['span']['end']}] -> {h['concept_id']}: {h['excerpt']}" for h in highlights])
        user_prompt = f"""Question: {rewritten_question}\n\nCourse snippets:\n{docs_text}\n\nSelected concepts:\n{nodes_text}\n\nLab artifacts:\n{artifacts_text}\n\nHighlights:\n{highlights_text}\n\nProduce:\n1) A short final answer (one paragraph) with inline evidence references.\n2) A step-by-step checklist (each step with evidence id).\n3) One multiple choice practice question with 4 choices, correct index, and evidence ids and an explanation.\nIf the user asked for disallowed content (offensive/harmful hacking instructions), refuse and provide defensive learning and a safe practice question.\n"""
        messages = [{"role":"system","content":sys_msg},{"role":"user","content":user_prompt}]
        res = self._call_model(messages, max_tokens=512)
        content = res["choices"][0]["message"]["content"].strip()
        # Very simple parser: split by sections
        out = {"final_answer": content, "steps": [], "practice": {}}
        # naive extraction: attempt to detect MCQ block
        # In production you'd parse JSON from model
        # Here we return a basic wrapper that includes the raw content and a very simple auto-generated practice if missing
        out["final_answer"] = content
        out["steps"] = [{"step": "Review the diagram nodes and course snippets.", "evidence": [d["id"] for d in retrieved_docs][:1]}]
        out["practice"] = {
            "question": f"Practice: based on {topic}, what is recommended?",
            "choices": ["Option A","Option B","Option C","Option D"],
            "correct_index": 0,
            "evidence_ids": [retrieved_docs[0]["id"]] if retrieved_docs else [],
            "explanation": "See course snippet(s)."
        }
        self._last_tokens = res.get("usage", {})
        # If strict_mode true but no evidence, adjust
        if strict_mode and not retrieved_docs and not highlights:
            out["final_answer"] = "not enough course evidence"
            out["steps"] = []
            out["practice"] = {
                "question": "Not enough evidence to make a practice question.",
                "choices": [],
                "correct_index": -1,
                "evidence_ids": [],
                "explanation": ""
            }
        return out

    def last_token_info(self):
        return {"tokens": self._last_tokens}
