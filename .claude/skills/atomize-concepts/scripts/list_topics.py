#!/usr/bin/env python3
"""List topics already written, so a new batch can link to them as prerequisites.

Usage:
  python3 list_topics.py <project_root>                 # every topic, grouped by concept
  python3 list_topics.py <project_root> --before-wave 4 # only batches from waves 1-3
  python3 list_topics.py <project_root> --concepts lists,strings
"""
import json
import sys
from pathlib import Path


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    root = Path(sys.argv[1]).resolve()
    args = sys.argv[2:]
    before = int(args[args.index("--before-wave") + 1]) if "--before-wave" in args else None
    only = set(args[args.index("--concepts") + 1].split(",")) if "--concepts" in args else None

    plan = json.loads((root / "topics" / "plan.json").read_text())
    wave_of = {b["id"]: w["wave"] for w in plan["waves"] for b in w["batches"]}
    total = 0
    for f in sorted((root / "topics").glob("B*.json")):
        data = json.loads(f.read_text())
        if before is not None and wave_of.get(data["batch"], 99) >= before:
            continue
        print(f"# {data['batch']} {data.get('title', '')}")
        current = None
        for t in data["topics"]:
            if only and t["concept"] not in only:
                continue
            if t["concept"] != current:
                current = t["concept"]
                print(f"  [{current}]")
            print(f"    {t['id']} | {t['title']} | {t['minutes']} min")
            total += 1
        notes = {c: e["notes"] for c, e in data.get("concept_map", {}).items()
                 if e.get("notes") and (not only or c in only)}
        if notes:
            print("  notes from this batch:")
            for c, n in notes.items():
                print(f"    [{c}] {n}")
    print(f"\n{total} topics listed")


if __name__ == "__main__":
    main()
