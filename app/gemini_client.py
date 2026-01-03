import os
import json
import re
from typing import List, Dict, Any, Optional, Tuple
import requests


class GeminiClient:
    def __init__(self) -> None:
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()

        # Primary model
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.5-pro").strip()

        # Optional fallback model (if you set it). If not set, we auto-discover.
        self.fallback_model = os.getenv("GEMINI_FALLBACK_MODEL", "").strip()

        # Optional thinking budget. Some models reject thinkingConfig.
        tb = os.getenv("GEMINI_THINKING_BUDGET", "").strip()
        self.thinking_budget: Optional[int] = int(tb) if tb.isdigit() else None

        self._last_usage: Dict[str, Any] = {}
        self._last_raw: Dict[str, Any] = {}
        self._models_cache: List[Dict[str, Any]] = []
        self._last_model_used: str = self.model

        if self.api_key and not self.fallback_model:
            self.fallback_model = self._discover_fallback_model()

    def _models_url(self) -> str:
        return f"https://generativelanguage.googleapis.com/v1beta/models?key={self.api_key}"

    def _url(self, model: str) -> str:
        return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"

    def _discover_fallback_model(self) -> str:
        """
        Pick a model that supports generateContent.
        Preference: flash models first, then pro, then anything.
        """
        try:
            resp = requests.get(self._models_url(), timeout=15)
            resp.raise_for_status()
            data = resp.json()
            models = data.get("models") or []
            self._models_cache = models

            candidates: List[str] = []
            for m in models:
                name = (m.get("name") or "").replace("models/", "")
                methods = m.get("supportedGenerationMethods") or []
                if "generateContent" not in methods:
                    continue
                low = name.lower()
                if "embed" in low:
                    continue
                if name == self.model:
                    continue
                candidates.append(name)

            if not candidates:
                return ""

            flash = [c for c in candidates if "flash" in c.lower()]
            if flash:
                return flash[0]

            pro = [c for c in candidates if "pro" in c.lower()]
            if pro:
                return pro[0]

            return candidates[0]
        except Exception:
            return ""

    def _extract_text(self, data: Dict[str, Any]) -> Tuple[str, Optional[str]]:
        candidates = data.get("candidates") or []
        if not candidates:
            return "", None

        cand0 = candidates[0] or {}
        finish_reason = cand0.get("finishReason")

        content = cand0.get("content") or {}
        parts = content.get("parts") or []

        texts: List[str] = []
        if isinstance(parts, list):
            for p in parts:
                if isinstance(p, dict):
                    t = p.get("text")
                    if isinstance(t, str) and t.strip():
                        texts.append(t.strip())

        return "\n".join(texts).strip(), finish_reason

    def _post(self, model: str, prompt: str, max_output_tokens: int, thinking_budget: Optional[int]) -> Dict[str, Any]:
        generation_config: Dict[str, Any] = {
            "temperature": 0.0,
            "maxOutputTokens": max_output_tokens,
        }

        # Try helpful fields first; retry minimal if 400
        generation_config["responseMimeType"] = "text/plain"
        if thinking_budget is not None:
            generation_config["thinkingConfig"] = {"thinkingBudget": thinking_budget}

        payload: Dict[str, Any] = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": generation_config,
        }

        resp = requests.post(self._url(model), json=payload, timeout=45)

        if resp.status_code == 400:
            generation_config.pop("thinkingConfig", None)
            generation_config.pop("responseMimeType", None)
            payload["generationConfig"] = generation_config
            resp = requests.post(self._url(model), json=payload, timeout=45)

        if resp.status_code >= 400:
            raise requests.HTTPError(f"{resp.status_code} {resp.text}")

        return resp.json()

    def _call_model_on(
        self, model: str, prompt: str, max_output_tokens: int, thinking_budget: Optional[int]
    ) -> Tuple[str, Optional[str], Dict[str, Any]]:
        data = self._post(model, prompt, max_output_tokens, thinking_budget)
        text, finish_reason = self._extract_text(data)
        usage = data.get("usageMetadata", {}) or {}
        return text, finish_reason, {"raw": data, "usage": usage, "model": model}

    def _call_model(self, prompt: str, max_output_tokens: int = 512) -> str:
        if not self.api_key:
            return f"[stubbed response] {prompt[:200]}"

        # Attempt 1: primary
        text, _, info = self._call_model_on(self.model, prompt, max_output_tokens, self.thinking_budget)
        self._last_raw = info["raw"]
        self._last_usage = info["usage"]
        self._last_model_used = info["model"]
        if text:
            return text

        # Attempt 2: primary with thinkingBudget=0
        try:
            text2, _, info2 = self._call_model_on(self.model, prompt, max_output_tokens, 0)
            self._last_raw = info2["raw"]
            self._last_usage = info2["usage"]
            self._last_model_used = info2["model"]
            if text2:
                return text2
        except Exception:
            pass

        # Attempt 3: fallback
        if self.fallback_model:
            try:
                text3, _, info3 = self._call_model_on(self.fallback_model, prompt, max_output_tokens, None)
                self._last_raw = info3["raw"]
                self._last_usage = info3["usage"]
                self._last_model_used = info3["model"]
                if text3:
                    return text3
            except Exception as e:
                return f"[gemini_fallback_error] {str(e)}"

        pf = self._last_raw.get("promptFeedback")
        return f"[gemini_empty_text] promptFeedback={pf}"

    # --------------------------
    # JSON parsing + recovery
    # --------------------------

    def _extract_json_candidate(self, s: str) -> str:
        if not s:
            return ""
        start = s.find("{")
        end = s.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return ""
        return s[start:end + 1].strip()

    def _safe_json_obj(self, s: str) -> Optional[Dict[str, Any]]:
        if not s:
            return None
        cand = self._extract_json_candidate(s) or s
        try:
            obj = json.loads(cand)
            return obj if isinstance(obj, dict) else None
        except Exception:
            return None

    def _recover_partial_final_answer(self, raw: str) -> str:
        """
        Extract the value of final_answer from a truncated JSON-like string.
        """
        if not raw or "final_answer" not in raw:
            return ""

        key_idx = raw.find('"final_answer"')
        if key_idx == -1:
            key_idx = raw.find("'final_answer'")
        if key_idx == -1:
            return ""

        colon_idx = raw.find(":", key_idx)
        if colon_idx == -1:
            return ""

        q1 = raw.find('"', colon_idx + 1)
        if q1 == -1:
            return ""

        q2 = raw.find('"', q1 + 1)
        if q2 == -1:
            val = raw[q1 + 1:].strip()
        else:
            val = raw[q1 + 1:q2].strip()

        val = val.replace("\\n", " ").replace("\n", " ").strip()
        return val

    def _sanitize_short_answer(self, s: str) -> str:
        if not s:
            return ""

        # If it ends in an open bracket like "[kb_" or "[email", cut it off safely.
        s = re.sub(r"\[[^\]]*$", "", s).strip()

        # Remove any trailing escape fragments
        s = s.replace("\\.", ".").strip()

        # Make it end nicely
        if s and s[-1] not in ".!?":
            s = s.rstrip() + "."

        # Keep it reasonably short for UI summary
        if len(s) > 280:
            s = s[:277].rstrip() + "..."
        return s

    def _default_steps_practice(
        self,
        topic: str,
        retrieved_docs: List[Dict[str, Any]],
        lab_artifacts: Optional[Dict[str, Any]],
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        kb_id = (retrieved_docs[0]["id"] if retrieved_docs else "kb_unknown")
        art_id = ""
        if lab_artifacts and isinstance(lab_artifacts, dict):
            arts = lab_artifacts.get("artifacts", []) or []
            if arts:
                art_id = arts[0].get("artifact_id") or arts[0].get("id") or ""
        ev = [kb_id] + ([art_id] if art_id else [])

        if topic == "phishing":
            steps = [
                {"step": "Do not click the link. Verify the sender and URL using a trusted method.", "evidence": ev},
                {"step": "Check for urgent language and mismatched domains, then report or delete the message.", "evidence": ev},
            ]
            practice = {
                "question": "What is the safest first action when an email urges you to verify an account via a link?",
                "choices": ["Click the link quickly", "Reply asking for details", "Verify via official site or phone, do not click", "Forward to friends to warn them"],
                "correct_index": 2,
                "evidence_ids": ev,
                "explanation": "Course guidance recommends verifying links and avoiding clicking suspicious URLs.",
            }
            return steps, practice

        steps = [
            {"step": "Identify the key indicator in the artifact that matches the concept diagram.", "evidence": ev},
            {"step": "Choose the next defensive action based on course guidance and document evidence.", "evidence": ev},
        ]
        practice = {
            "question": "Which action best follows the course guidance for this scenario?",
            "choices": ["Ignore it", "Take an action supported by the course snippet evidence", "Share it publicly", "Disable all security tools"],
            "correct_index": 1,
            "evidence_ids": [kb_id],
            "explanation": "Use the retrieved course snippet as the grounding evidence for the recommended action.",
        }
        return steps, practice

    # --------------------------
    # Public methods
    # --------------------------

    def rewrite_intent(self, message: str, chat_history: List[Dict[str, str]], strict_mode: bool) -> str:
        history_text = ""
        if chat_history:
            recent = chat_history[-6:]
            history_text = "\n".join([f"{c.get('role','')}: {c.get('content','')}" for c in recent])

        strict_line = "Strict mode is true. Do not add any new facts." if strict_mode else "Strict mode is false."

        prompt = (
            "You are a concise rewriter.\n"
            "Rewrite the user message into one short self-contained question.\n\n"
            f"{strict_line}\n\n"
            f"User message:\n{message}\n\n"
            f"Recent chat history:\n{history_text}\n\n"
            "Return only the rewritten question on one line."
        )

        out = self._call_model(prompt, max_output_tokens=96).strip()
        if not out or out.startswith("[gemini_"):
            return message.strip()
        return out.splitlines()[0].strip()

    def generate_tutoring(
        self,
        rewritten_question: str,
        retrieved_docs: List[Dict[str, str]],
        selected_nodes: List[Dict[str, Any]],
        lab_artifacts: Optional[Dict[str, Any]],
        highlights: List[Dict[str, Any]],
        strict_mode: bool,
        topic: str,
    ) -> Dict[str, Any]:
        # Keep prompt small so JSON completes.
        docs_text = "\n".join([f"{d['id']}: {d.get('quote','')[:140]}" for d in retrieved_docs[:2]])
        artifacts_text = ""
        art_id = ""
        if lab_artifacts and isinstance(lab_artifacts, dict):
            arts = lab_artifacts.get("artifacts", []) or []
            if arts:
                a0 = arts[0]
                art_id = a0.get("artifact_id") or a0.get("id") or "artifact"
                txt = (a0.get("text") or "")[:320]
                artifacts_text = f"{art_id}: {txt}"

        grounding_rule = (
            "Strict mode: every sentence must include evidence ids in brackets like [kb_phish_001] or [email_1001]."
            if strict_mode
            else
            "Prefer course snippets and artifacts. Label any extra knowledge as Extra context."
        )

        prompt1 = (
            "Return ONLY valid JSON on ONE LINE. No markdown. No extra text.\n\n"
            f"{grounding_rule}\n\n"
            f"Topic: {topic}\n"
            f"Question: {rewritten_question}\n\n"
            f"Course snippets:\n{docs_text}\n\n"
            f"Artifact:\n{artifacts_text}\n\n"
            "Schema:\n"
            "{\"final_answer\":\"max 220 chars and must end with a period.\","
            "\"steps\":[{\"step\":\"max 120 chars\",\"evidence\":[\"id\"]},{\"step\":\"max 120 chars\",\"evidence\":[\"id\"]}],"
            "\"practice\":{\"question\":\"max 160 chars\",\"choices\":[\"A\",\"B\",\"C\",\"D\"],\"correct_index\":0,\"evidence_ids\":[\"id\"],\"explanation\":\"max 200 chars\"}}"
        )

        raw1 = self._call_model(prompt1, max_output_tokens=420).strip()
        parsed1 = self._safe_json_obj(raw1)

        final_answer = ""
        steps_out: List[Dict[str, Any]] = []
        practice_out: Dict[str, Any] = {
            "question": "",
            "choices": ["A", "B", "C", "D"],
            "correct_index": 0,
            "evidence_ids": [],
            "explanation": "",
        }

        if parsed1:
            final_answer = str(parsed1.get("final_answer", "")).strip()

            steps_in = parsed1.get("steps", []) or []
            if isinstance(steps_in, list):
                for s in steps_in[:5]:
                    if isinstance(s, dict):
                        steps_out.append(
                            {"step": str(s.get("step", "")).strip(), "evidence": s.get("evidence", []) or []}
                        )

            p = parsed1.get("practice", {}) or {}
            if isinstance(p, dict):
                practice_out = {
                    "question": str(p.get("question", "")).strip(),
                    "choices": p.get("choices", []) or ["A", "B", "C", "D"],
                    "correct_index": p.get("correct_index", 0) if isinstance(p.get("correct_index", 0), int) else 0,
                    "evidence_ids": p.get("evidence_ids", []) or [],
                    "explanation": str(p.get("explanation", "")).strip(),
                }
        else:
            final_answer = self._recover_partial_final_answer(raw1)

        # Fill missing via deterministic fallback
        if not steps_out or not practice_out.get("question"):
            d_steps, d_practice = self._default_steps_practice(topic, retrieved_docs=retrieved_docs, lab_artifacts=lab_artifacts)
            if not steps_out:
                steps_out = d_steps
            if not practice_out.get("question"):
                practice_out = d_practice

        # Final answer fallback
        if not final_answer:
            final_answer = "Not enough course evidence."

        final_answer = self._sanitize_short_answer(final_answer)

        # Long answer: separate call as plain text (much more reliable than embedding in JSON)
        # This is what the UI chat should display.
        ev_hint = []
        if retrieved_docs[:2]:
            ev_hint.extend([retrieved_docs[0]["id"], retrieved_docs[1]["id"]] if len(retrieved_docs) > 1 else [retrieved_docs[0]["id"]])
        if art_id:
            ev_hint.append(art_id)

        long_prompt = (
            "Write a helpful, complete explanation.\n"
            "Constraints:\n"
            "- 4 to 8 sentences.\n"
            "- Use the provided course snippets and artifact.\n"
            + ( "- Strict mode: EVERY sentence must end with evidence brackets, e.g. [kb_phish_001] or [email_1001].\n" if strict_mode else "" )
            + "\n"
            f"Topic: {topic}\n"
            f"Question: {rewritten_question}\n\n"
            f"Course snippets:\n{docs_text}\n\n"
            f"Artifact:\n{artifacts_text}\n\n"
            f"Evidence ids you can use: {', '.join([e for e in ev_hint if e])}\n"
            "Return only plain text."
        )

        long_answer = self._call_model(long_prompt, max_output_tokens=700).strip()
        if not long_answer or long_answer.startswith("[gemini_"):
            long_answer = final_answer

        # cap to keep UI sane
        if len(long_answer) > 2400:
            long_answer = long_answer[:2397].rstrip() + "..."

        return {
            "final_answer_text": final_answer,
            "long_answer_text": long_answer,
            "steps": steps_out,
            "practice": practice_out,
        }

    def last_token_info(self) -> Dict[str, Any]:
        return {"usageMetadata": self._last_usage, "model_used": self._last_model_used}

    def last_raw(self) -> Dict[str, Any]:
        return self._last_raw
