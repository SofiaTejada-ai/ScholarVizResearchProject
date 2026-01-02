from typing import List, Dict, Any

class DiagramBuilder:
    def build(self, nodes: List[Dict[str,Any]], edges: List[Dict[str,Any]]) -> Dict[str,Any]:
        nds = []
        for n in nodes:
            nds.append({
                "id": n["id"],
                "label": n.get("label"),
                "type": n.get("topic", "concept")
            })
        eds = []
        for e in edges:
            eds.append({
                "source": e.get("source"),
                "target": e.get("target"),
                "relation": e.get("relation", ""),
                "label": e.get("description", "")
            })
        return {"nodes": nds, "edges": eds}
