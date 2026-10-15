"""Fill per-world goals of a level from its reference solution.

When world sizes vary, goals such as "end at the east wall" or "a gem on every cell" differ per
world. Typing those by hand is error-prone, so run the reference solution on every world and
copy the requested outcome into that world's own goal:

    python3 tools/level_goals.py gem_line --fields gems_exactly          # preview
    python3 tools/level_goals.py gem_line --fields gems_exactly --write  # update levels/gem_line.json

Fields: gems_exactly (final gem layout), end_at (final cell), facing (final direction).

This makes the goals agree with the reference solution BY CONSTRUCTION, so it proves nothing
about the reference. The wrong solutions in tests/solutions/ and a look at the replay are what
check that the reference (and therefore the goals) are right.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from engine import run_program, validate_level  # noqa: E402

FIELDS = {
    "gems_exactly": lambda f: f["gems"],
    "end_at": lambda f: [f["x"], f["y"]],
    "facing": lambda f: f["dir"],
}


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("level_id")
    ap.add_argument("--fields", required=True, help=f"comma-separated: {', '.join(FIELDS)}")
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()
    fields = args.fields.split(",")
    if set(fields) - set(FIELDS):
        sys.exit(f"unknown field(s): {set(fields) - set(FIELDS)}")

    path = ROOT / "levels" / f"{args.level_id}.json"
    level = json.loads(path.read_text())
    solution = (ROOT / "tests" / "solutions" / f"{args.level_id}.py").read_text()
    hidden = level.get("constraints", {}).get("hidden_commands", [])

    for label, world in [("main", level["world"])] + [
            (w.get("name", f"hidden {i + 1}"), w) for i, w in enumerate(level.get("hidden_worlds", []))]:
        result = run_program(solution, world, 0, hidden)
        if result["error"]:
            sys.exit(f"reference solution fails in world '{label}': {result['error']}")
        goal = world.setdefault("goal", {})
        for field in fields:
            goal[field] = FIELDS[field](result["final"])
        print(f"{label:>24}: " + ", ".join(f"{k}={json.dumps(goal[k])}" for k in fields))

    if args.write:
        validate_level(level)
        path.write_text(json.dumps(level, indent=2) + "\n")
        print(f"wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
