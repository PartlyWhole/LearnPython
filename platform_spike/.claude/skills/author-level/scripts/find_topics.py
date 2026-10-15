"""Find topic IDs in ../topics/all_topics.json for a level's "topics" list.

    python3 .claude/skills/author-level/scripts/find_topics.py modulo parity      # any word matches
    python3 .claude/skills/author-level/scripts/find_topics.py --used             # tags levels already use

Matches words against each topic's id, title and summary; prints id, title and prerequisites.
Prefer core topics a learner meets at the level's place in the ladder (see docs/levels.md).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]  # platform_spike/
TOPICS = json.loads((ROOT.parent / "topics" / "all_topics.json").read_text())["topics"]


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    if args == ["--used"]:
        for path in sorted((ROOT / "levels").glob("*.json")):
            if path.name != "index.json":
                print(f"{path.stem:<16} {json.loads(path.read_text()).get('topics', [])}")
        return
    words = [a.lower() for a in args]
    hits = [t for t in TOPICS
            if any(w in f"{t['id']} {t['title']} {t.get('summary', '')}".lower() for w in words)]
    for t in hits:
        core = "" if t.get("core", True) else "  (not core)"
        print(f"{t['id']:<44} {t['title']}{core}")
        if t.get("prerequisites"):
            print(f"{'':<44}   needs: {', '.join(t['prerequisites'])}")
    print(f"\n{len(hits)} match(es)")


if __name__ == "__main__":
    main()
