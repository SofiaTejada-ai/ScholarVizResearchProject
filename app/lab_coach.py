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
        # output includes both line-based (for citations) and span-based (for UI overlays)
        highlights: List[Dict[str, Any]] = []
        artifacts = case.get("artifacts", [])

        for art in artifacts:
            raw_text = art.get("text", "") or ""
            art_id = art.get("artifact_id", art.get("id", "artifact-unknown"))

            lines = raw_text.splitlines() if raw_text else []
            lowered_lines = [ln.lower() for ln in lines]
            full_lower = raw_text.lower()

            for node in selected_nodes:
                node_id = node.get("id")
                tags = node.get("tags", []) or []

                for tag in tags:
                    tag_l = str(tag).lower()
                    if not tag_l:
                        continue

                    # line-based highlight(s)
                    for i, ln in enumerate(lowered_lines):
                        if tag_l in ln:
                            highlights.append(
                                {
                                    "artifact_id": art_id,
                                    "line": i + 1,
                                    "concept_id": node_id,
                                    "reason": f"Matched concept tag '{tag}'.",
                                    "line_text": lines[i],
                                }
                            )

                    # span-based highlight (first occurrence)
                    if tag_l in full_lower:
                        idx = full_lower.find(tag_l)
                        if idx >= 0:
                            span = {"start": idx, "end": idx + len(tag_l)}
                            excerpt = raw_text[max(0, idx - 30) : idx + len(tag_l) + 30]
                            highlights.append(
                                {
                                    "artifact_id": art_id,
                                    "span": span,
                                    "concept_id": node_id,
                                    "excerpt": excerpt,
                                }
                            )

        return case, highlights
