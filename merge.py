#!/usr/bin/env python3
"""Merge courses/*.json into one aggregate knowledge graph.

Outputs (in ./aggregate/):
  aggregate.json        unified graph: course, module and concept nodes + edges with provenance
  coverage_matrix.csv   concept x course -> depth
  new_concepts.csv      concept IDs that courses introduced beyond CONCEPTS.md
  validation.txt        dangling references and other problems per course
"""
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COURSES_DIR = ROOT / "courses"
OUT_DIR = ROOT / "aggregate"
DEPTH_RANK = {"introduced": 1, "practiced": 2, "deep": 3}
# Duplicate concept IDs invented independently by different courses -> preferred ID
ALIASES = {
    "lib_pil": "lib_pillow",
    "binary_numbers": "binary_bitwise",
    "web_authentication": "authentication",
}


def canon(i):
    return ALIASES.get(i, i)


def load_vocab():
    """Parse CONCEPTS.md -> {id: (category, description)}."""
    vocab, category = {}, None
    for line in (ROOT / "CONCEPTS.md").read_text().splitlines():
        if line.startswith("## "):
            category = line[3:].strip()
        m = re.match(r"- `([a-z0-9_]+)`(?: — (.*))?", line)
        if m:
            vocab[m.group(1)] = (category, (m.group(2) or "").strip())
    return vocab


def main():
    vocab = load_vocab()
    files = sorted(COURSES_DIR.glob("*.json"))
    if not files:
        sys.exit("no course graphs in courses/")

    courses, modules = {}, {}
    concepts = {}  # id -> merged node
    edges = {}  # (src, tgt, type) -> {"courses": set}
    problems = defaultdict(list)

    for f in files:
        g = json.loads(f.read_text())
        for c in g.get("concepts", []):
            if c["id"] in ALIASES:
                c.setdefault("course_label", c.get("label"))
                c["id"] = canon(c["id"])
        for m in g.get("modules", []):
            m["concepts"] = list(dict.fromkeys(canon(x) for x in m.get("concepts", [])))
        for e in g.get("edges", []):
            e["source"], e["target"] = canon(e["source"]), canon(e["target"])
        cid = g["course"]["id"]
        courses[cid] = {**g["course"], "type": "course",
                        "module_count": len(g.get("modules", []))}
        local_concepts = {c["id"] for c in g.get("concepts", [])}
        module_ids = {m["id"] for m in g.get("modules", [])}

        for c in g.get("concepts", []):
            node = concepts.setdefault(c["id"], {
                "id": c["id"], "type": "concept",
                "label": c.get("label", c["id"]),
                "category": vocab.get(c["id"], (c.get("category"),))[0] or c.get("category"),
                "canonical": c["id"] in vocab,
                "courses": {}, "course_labels": {},
            })
            d = c.get("depth", "introduced")
            prev = node["courses"].get(cid)
            if prev is None or DEPTH_RANK.get(d, 0) > DEPTH_RANK.get(prev, 0):
                node["courses"][cid] = d
            if c.get("course_label"):
                node["course_labels"][cid] = c["course_label"]
            if c["id"] not in vocab and not c.get("new"):
                problems[cid].append(f"non-canonical concept not flagged new: {c['id']}")

        for m in g.get("modules", []):
            modules[m["id"]] = {**m, "type": "module", "course": cid}
            for ref in m.get("concepts", []):
                if ref not in local_concepts:
                    problems[cid].append(f"module {m['id']} references undefined concept {ref}")

        known = local_concepts | module_ids
        for e in g.get("edges", []):
            s, t, typ = e["source"], e["target"], e["type"]
            if typ == "requires":  # normalise to prerequisite_of
                s, t, typ = t, s, "prerequisite_of"
            for end in (s, t):
                if end not in known:
                    problems[cid].append(f"edge {s} -{typ}-> {t}: undefined node {end}")
            edges.setdefault((s, t, typ), {"courses": set()})["courses"].add(cid)

    # --- assemble aggregate -------------------------------------------------
    n_courses = len(courses)
    for c in concepts.values():
        c["course_count"] = len(c["courses"])
        c["coverage"] = round(c["course_count"] / n_courses, 3)
        c["max_depth"] = max(c["courses"].values(), key=lambda d: DEPTH_RANK.get(d, 0))

    edge_list = []
    for (s, t, typ), meta in sorted(edges.items()):
        edge_list.append({"source": s, "target": t, "type": typ,
                          "courses": sorted(meta["courses"]),
                          "weight": len(meta["courses"])})
    # membership edges: course -> module, module -> concept
    for mid, m in modules.items():
        edge_list.append({"source": m["course"], "target": mid, "type": "has_module",
                          "courses": [m["course"]], "weight": 1})
        for ref in m.get("concepts", []):
            edge_list.append({"source": mid, "target": ref, "type": "covers",
                              "courses": [m["course"]], "weight": 1})

    OUT_DIR.mkdir(exist_ok=True)
    aggregate = {
        "courses": list(courses.values()),
        "modules": list(modules.values()),
        "concepts": sorted(concepts.values(), key=lambda c: (-c["course_count"], c["id"])),
        "edges": edge_list,
        "stats": {"courses": n_courses, "modules": len(modules),
                  "concepts": len(concepts), "edges": len(edge_list)},
    }
    (OUT_DIR / "aggregate.json").write_text(json.dumps(aggregate, indent=2))

    course_ids = sorted(courses)
    with open(OUT_DIR / "coverage_matrix.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["concept", "label", "category", "course_count", *course_ids])
        for c in aggregate["concepts"]:
            w.writerow([c["id"], c["label"], c["category"], c["course_count"],
                        *[c["courses"].get(k, "") for k in course_ids]])

    with open(OUT_DIR / "new_concepts.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["concept", "label", "category", "courses"])
        for c in aggregate["concepts"]:
            if not c["canonical"]:
                w.writerow([c["id"], c["label"], c["category"], " ".join(sorted(c["courses"]))])

    lines = []
    for cid in course_ids:
        lines.append(f"[{cid}] {len(problems[cid])} problem(s)")
        lines += [f"  - {p}" for p in problems[cid]]
    (OUT_DIR / "validation.txt").write_text("\n".join(lines) + "\n")

    print(json.dumps(aggregate["stats"]))
    print("\n".join(l for l in lines if l.startswith("[")))


if __name__ == "__main__":
    main()
