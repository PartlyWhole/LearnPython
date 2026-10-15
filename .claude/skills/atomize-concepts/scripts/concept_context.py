#!/usr/bin/env python3
"""Print everything the course graphs say about one or more concepts.

Usage:
  python3 concept_context.py <project_root> <concept_id> [<concept_id> ...]
  python3 concept_context.py <project_root> --batch B05

For each concept: label, category, which courses teach it and how deeply, every
module that covers it (with that module's section titles and projects), and the
graph edges that touch it. This is the evidence a decomposition should be built from.
"""
import json
import sys
from collections import defaultdict
from pathlib import Path


def load(root):
    agg = json.loads((root / "aggregate" / "aggregate.json").read_text())
    courses = {c["id"]: c for c in agg["courses"]}
    concepts = {c["id"]: c for c in agg["concepts"]}
    covering = defaultdict(list)
    for m in agg["modules"]:
        for k in m.get("concepts", []):
            covering[k].append(m)
    edges = [e for e in agg["edges"] if e["type"] not in ("covers", "has_module", "precedes")]
    return courses, concepts, covering, edges


def batch_concepts(root, batch_id):
    plan = json.loads((root / "topics" / "plan.json").read_text())
    for w in plan["waves"]:
        for b in w["batches"]:
            if b["id"] == batch_id:
                return w["wave"], b
    sys.exit(f"batch {batch_id} not in plan.json")


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    root = Path(sys.argv[1]).resolve()
    courses, concepts, covering, edges = load(root)
    if sys.argv[2] == "--batch":
        wave, b = batch_concepts(root, sys.argv[3])
        ids = b["concepts"]
        print(f"# Batch {b['id']} ({b['title']}), wave {wave}: {len(ids)} concepts\n")
    else:
        ids = sys.argv[2:]

    for cid in ids:
        c = concepts.get(cid)
        if not c:
            print(f"## {cid}: NOT IN AGGREGATE\n")
            continue
        print(f"## {cid}: {c['label']}  [{c['category']}]")
        print(f"Taught by {c['course_count']}/{len(courses)} courses, max depth {c['max_depth']}")
        for course_id, depth in sorted(c["courses"].items()):
            alias = c.get("course_labels", {}).get(course_id)
            print(f"  - {course_id}: {depth}" + (f' (called "{alias}")' if alias else ""))
        mods = sorted(covering.get(cid, []), key=lambda m: (m["course"], m.get("order", 0)))
        if mods:
            print("Modules covering it:")
            for m in mods:
                print(f"  * [{m['course']}] {m['title']}")
                if m.get("topics"):
                    print("      sections: " + " | ".join(m["topics"][:14]))
                if m.get("projects"):
                    print("      projects: " + " | ".join(m["projects"][:8]))
        names = {"prerequisite_of": ("comes before", "comes after"),
                 "is_a": ("is a kind of", "has kinds"), "part_of": ("is part of", "has parts"),
                 "uses_tool": ("uses", "used by"), "related_to": ("related to", "related to")}
        rel = defaultdict(set)
        for e in edges:
            fwd, back = names.get(e["type"], (e["type"], e["type"] + " (reverse)"))
            if e["source"] == cid and e["target"] in concepts:
                rel[fwd].add(e["target"])
            elif e["target"] == cid and e["source"] in concepts:
                rel[back].add(e["source"])
        for k in sorted(rel):
            print(f"  {cid} {k}: {', '.join(sorted(rel[k]))}")
        print()


if __name__ == "__main__":
    main()
