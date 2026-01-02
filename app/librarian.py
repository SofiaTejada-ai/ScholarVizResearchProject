import json
from typing import List, Dict, Any
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
from functools import lru_cache

class Librarian:
    def __init__(self, kb_path: str):
        self.kb_path = kb_path
        self.kb = self._load_kb()
        texts = [item.get("text", "") for item in self.kb]
        self.vectorizer = TfidfVectorizer(stop_words="english")
        if texts:
            self.tfidf = self.vectorizer.fit_transform(texts)
        else:
            self.tfidf = None

    def _load_kb(self):
        p = Path(self.kb_path)
        if not p.exists():
            return []
        with p.open("r", encoding="utf-8") as f:
            return json.load(f)

    @lru_cache(maxsize=1024)
    def retrieve(self, rewritten_question: str, top_k: int = 3) -> List[Dict[str,Any]]:
        if not self.tfidf or not rewritten_question.strip():
            # fallback: empty
            return []
        q_vec = self.vectorizer.transform([rewritten_question])
        scores = (self.tfidf @ q_vec.T).toarray().ravel()
        top_idx = list(np.argsort(scores)[::-1][:top_k])
        results = []
        for i in top_idx:
            item = self.kb[i]
            # produce a short quote: first 200 chars that share any token
            text = item.get("text", "")
            quote = text[:200]
            results.append({"id": item.get("id"), "title": item.get("title"), "quote": quote})
        return results
