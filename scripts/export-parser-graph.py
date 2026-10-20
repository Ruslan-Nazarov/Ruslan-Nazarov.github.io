"""Explicit, offline adapter for a trusted Python OPERATIONS_GRAPH module.

Never executes on GitHub Pages. Review the parser module before running it:
runpy executes that local module. No parser repository is searched or changed.
Unknown types/statuses and missing translations stop export rather than inventing data.
"""
import argparse
import json
import runpy
import uuid
from pathlib import Path

TYPES = {"кризис-разрешение", "противоречие", "частный_случай", "качество"}
STATUSES = {"подтверждено", "черновик", "не выведено"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--module", required=True, help="Absolute path to a trusted graph_data.py")
    parser.add_argument("--id-map", default="src/data/graph/id-map.json")
    parser.add_argument("--output", default=".local/parser-export.json")
    args = parser.parse_args()
    module = Path(args.module).resolve()
    if not module.is_file():
        parser.error("Parser module unavailable. Demo data is not a live export.")
    mapping_path = Path(args.id_map)
    mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
    graph = runpy.run_path(str(module)).get("OPERATIONS_GRAPH")
    if not isinstance(graph, dict):
        parser.error("Expected OPERATIONS_GRAPH dictionary. Adapt field mappings to the actual parser schema.")
    # Generate IDs once; persist the proposed mapping alongside the export, not into live data.
    for key in graph:
        mapping.setdefault(key, f"node-{uuid.uuid4().hex}")
    nodes = []
    for key, item in graph.items():
        node_type = item.get("type", item.get("тип"))
        status = item.get("researchStatus", item.get("статус"))
        if node_type not in TYPES or status not in STATUSES:
            parser.error(f"Explicit type/status mapping required for {key!r}. No inferred defaults.")
        predecessors = item.get("predecessors", item.get("предшественники", []))
        if not isinstance(predecessors, list) or any(p not in graph for p in predecessors):
            parser.error(f"Unknown predecessor or unsupported predecessor schema in {key!r}")
        required = ("title_ru", "title_en", "explanation_ru", "explanation_en")
        if any(not isinstance(item.get(field), str) or not item[field].strip() for field in required):
            parser.error(f"Explicit bilingual fields required for {key!r}: {', '.join(required)}")
        nodes.append({
            "id": mapping[key], "originalKey": key,
            "type": node_type, "researchStatus": status,
            **{field: item[field] for field in required},
            "formula": item.get("formula", ""),
            "predecessors": [mapping[p] for p in predecessors],
        })
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    edges = [{"id": f"{p}-to-{n['id']}", "source": p, "target": n["id"]}
             for n in nodes for p in n["predecessors"]]
    output.write_text(json.dumps({"schemaVersion": 1, "nodes": nodes, "edges": edges},
                                ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    output.with_suffix(".id-map.json").write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # Persist new identities independently of source publication, so a repeated
    # export before import still uses exactly the same public IDs.
    temporary_map = mapping_path.with_suffix(".json.tmp")
    temporary_map.write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary_map.replace(mapping_path)
    print(f"Exported {len(nodes)} nodes to {output}. No publication permissions were set.")
    print("Next: npm run graph:import -- " + str(output))


if __name__ == "__main__":
    main()
