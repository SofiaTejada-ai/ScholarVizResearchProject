import json
from pathlib import Path
from typing import List, Dict, Any

class LabCoach:
    def __init__(self, cases_path: str, ontology_mapper):
        self.cases_path = cases_path
        self.cases = self._load_cases()
        self.ontology = ontology_mapper

    def _load_cases(self):
        p = Path(self.cases_path)
        if not p.exists():
            return []
        with p.open("r", encoding="utf-8") as f:
            return json.load(f)

    def select_and_highlight(self, optional_artifacts: List[Dict[str,Any]], topic: str, selected_nodes: List[Dict[str,Any]]):
        if optional_artifacts:
            # use provided artifacts as "active lab"
            case = {"case_id": "provided", "artifacts": optional_artifacts}
        else:
            # pick the first case matching the topic
            case = next((c for c in self.cases if c.get("topic")==topic), None)
            if case is None:
                case = self.cases[0] if self.cases else {"case_id":"none","artifacts": []}
        # highlights: naive mapping - match node tags against artifact text
        highlights = []
        artifacts = case.get("artifacts", [])
        for art in artifacts:
            art_text = art.get("text","" ).lower()
            art_id = art.get("artifact_id", art.get("id","artifact-unknown"))
            for node in selected_nodes:
                for tag in node.get("tags",[]):
                    if tag.lower() in art_text:
                        # find span index (first occurrence)
                        idx = art_text.find(tag.lower())
                        if idx >= 0:
                            span = {"start": idx, "end": idx+len(tag)}
                            excerpt = art.get("text")[max(0, idx-30): idx+len(tag)+30]
                            highlights.append({
                                "artifact_id": art_id,
                                "span": span,
                                "concept_id": node["id"],
                                "excerpt": excerpt
                            })
        return case, highlights
