import json
from typing import List, Dict, Any
from pathlib import Path
from collections import defaultdict

class OntologyMapper:
    def __init__(self, ontology_path: str):
        self.ontology_path = ontology_path
        self.nodes, self.edges = self._load_ontology()
        # Build tag index
        self.tag_index = defaultdict(list)
        for n in self.nodes:
            for t in n.get("tags", []):
                self.tag_index[t.lower()].append(n)

    def _load_ontology(self):
        p = Path(self.ontology_path)
        if not p.exists():
            return [], []
        with p.open("r", encoding="utf-8") as f:
            data = json.load(f)
        nodes = data.get("nodes", [])
        edges = data.get("edges", [])
        return nodes, edges

    def map(self, rewritten_question: str, retrieved_docs: List[Dict[str,Any]]) -> (List[Dict[str,Any]], List[Dict[str,Any]]):
        text = " ".join([rewritten_question] + [d.get("quote","") for d in retrieved_docs]).lower()
        scores = {}
        for n in self.nodes:
            score = 0
            label = n.get("label","").lower()
            desc = n.get("description","").lower()
            tags = " ".join(n.get("tags",[])).lower()
            # simple heuristics
            if any(tok in text for tok in label.split()):
                score += 2
            if any(tok in text for tok in desc.split()):
                score += 1
            for t in n.get("tags",[]):
                if t.lower() in text:
                    score += 1
            scores[n["id"]] = score
        # select top 3-7 nodes with nonzero score
        selected = sorted([n for n in self.nodes], key=lambda n: scores.get(n["id"],0), reverse=True)
        selected = [n for n in selected if scores.get(n["id"],0) > 0][:7]
        # If none, pick ones by topic keyword fallback
        if not selected:
            for n in self.nodes:
                if n.get("topic") and n["topic"] in text:
                    selected.append(n)
                    if len(selected) >= 3:
                        break
        # pick edges that connect selected nodes
        selected_ids = set([n["id"] for n in selected])
        sel_edges = [e for e in self.edges if e.get("source") in selected_ids and e.get("target") in selected_ids]
        return selected, sel_edges
