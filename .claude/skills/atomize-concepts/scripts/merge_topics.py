#!/usr/bin/env python3
"""Merge all topic batches into topics/all_topics.json and resolve pending prerequisites.

Usage:
  python3 merge_topics.py <project_root>

A pending prerequisite `concept:<id>` is replaced by that concept's entry topic (or its
covered_by topics), unless that would exceed the 4-prerequisite limit or create a cycle,
in which case it is kept and reported. Writes topics/all_topics.json and prints stats.
"""
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


def ancestors(tid, prereq):
    seen, stack = set(), list(prereq.get(tid, []))
    while stack:
        p = stack.pop()
        if p not in seen:
            seen.add(p)
            stack.extend(prereq.get(p, []))
    return seen


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    root = Path(sys.argv[1]).resolve()
    plan = json.loads((root / "topics" / "plan.json").read_text())
    wave_of = {b["id"]: w["wave"] for w in plan["waves"] for b in w["batches"]}
    topics, concept_map, batches = [], {}, []
    for f in sorted((root / "topics").glob("B*.json")):
        d = json.loads(f.read_text())
        batches.append(d["batch"])
        for t in d["topics"]:
            t["batch"], t["wave"] = d["batch"], wave_of.get(d["batch"])
            topics.append(t)
        concept_map.update(d.get("concept_map", {}))
    by_id = {t["id"]: t for t in topics}
    prereq = {t["id"]: list(t.get("prerequisites", [])) for t in topics}

    unresolved = []
    for t in topics:
        keep = []
        for p in t.get("pending_prerequisites", []):
            c = p.split(":", 1)[1]
            entry = concept_map.get(c, {})
            cands = [entry["entry_topic"]] if entry.get("entry_topic") else entry.get("covered_by", [])
            cands = [x for x in cands if x in by_id and x not in prereq[t["id"]]]
            ok = cands and len(prereq[t["id"]]) + len(cands) <= 4 and all(
                t["id"] not in ancestors(x, prereq) and x != t["id"] for x in cands)
            if ok:
                prereq[t["id"]].extend(cands)
                t["prerequisites"] = prereq[t["id"]]
                t.setdefault("resolved_pending", []).append({p: cands})
            else:
                keep.append(p)
                unresolved.append((t["id"], p, "not written yet" if not cands else "limit or cycle"))
        t["pending_prerequisites"] = keep

    per_concept = Counter(t["concept"] for t in topics)
    out = {
        "stats": {
            "batches": batches,
            "topics": len(topics),
            "knowledge_points": sum(len(t["knowledge_points"]) for t in topics),
            "minutes": sum(t["minutes"] for t in topics),
            "core_topics": sum(1 for t in topics if t.get("core")),
            "prerequisite_edges": sum(len(t["prerequisites"]) for t in topics),
            "encompassing_edges": sum(len(t.get("encompasses", [])) for t in topics),
            "concepts_written": len(concept_map),
        },
        "concept_map": concept_map,
        "topics": topics,
    }
    (root / "topics" / "all_topics.json").write_text(json.dumps(out, indent=2))

    s = out["stats"]
    print(json.dumps(s, indent=2))
    print(f"hours of material: {s['minutes'] / 60:.0f}")
    fan = Counter(len(t["prerequisites"]) for t in topics)
    print("direct prerequisites per topic:", dict(sorted(fan.items())))
    roots = [t["id"] for t in topics if not t["prerequisites"]]
    print(f"entry points (no prerequisites): {len(roots)}")
    print("most topics per concept:", per_concept.most_common(8))
    dependents = defaultdict(int)
    for t in topics:
        for p in t["prerequisites"]:
            dependents[p] += 1
    print("most depended-on topics:", sorted(dependents.items(), key=lambda x: -x[1])[:8])
    for tid, p, why in unresolved:
        print(f"UNRESOLVED {tid}: {p} ({why})")


if __name__ == "__main__":
    main()
