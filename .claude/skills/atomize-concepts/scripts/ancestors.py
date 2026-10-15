#!/usr/bin/env python3
"""List every topic a topic builds on: the skills its worked examples may use.

Usage:
  python3 ancestors.py <project_root> <topic_id> [<topic_id> ...]
  python3 ancestors.py <project_root> --prereqs a.b,c.d   # for a topic not written yet

Reads all topics/B*.json. Prints ancestors grouped by concept, so you can check that a
worked example only uses syntax the learner has already met.
"""
import json
import sys
from collections import defaultdict
from pathlib import Path


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    root = Path(sys.argv[1]).resolve()
    prereq, title = {}, {}
    for f in sorted((root / "topics").glob("B*.json")):
        for t in json.loads(f.read_text())["topics"]:
            prereq[t["id"]] = t.get("prerequisites", [])
            title[t["id"]] = t["title"]
    if sys.argv[2] == "--prereqs":
        starts = {"(new topic)": sys.argv[3].split(",")}
    else:
        starts = {tid: prereq.get(tid, []) for tid in sys.argv[2:]}
    for tid, first in starts.items():
        seen, stack = set(), list(first)
        while stack:
            p = stack.pop()
            if p not in seen:
                seen.add(p)
                stack.extend(prereq.get(p, []))
        groups = defaultdict(list)
        for a in sorted(seen):
            groups[a.split(".")[0]].append(a.split(".", 1)[1])
        print(f"# {tid}: {len(seen)} ancestor topics")
        for c in sorted(groups):
            print(f"  {c}: {', '.join(groups[c])}")
        unknown = [p for p in first if p not in prereq]
        if unknown:
            print(f"  (not found: {', '.join(unknown)})")


if __name__ == "__main__":
    main()
