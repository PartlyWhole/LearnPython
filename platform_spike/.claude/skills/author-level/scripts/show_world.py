"""Draw a level's worlds as ASCII, so a layout can be reviewed without a browser.

    python3 .claude/skills/author-level/scripts/show_world.py <id>                 # start of every world
    python3 .claude/skills/author-level/scripts/show_world.py <id> --goal          # + the gems_exactly target
    python3 .claude/skills/author-level/scripts/show_world.py <id> --run tests/solutions/<id>.wrong_x.py
    python3 .claude/skills/author-level/scripts/show_world.py levels/draft.json --world "one cell"

<id> is a level id (levels/<id>.json) or a path to a level file. --run executes a program on each
world and draws where it ended, with that world's goal failures (or PASS) underneath.

Legend: each cell is two characters, a robot marker then the cell.
    >  ^  <  v   the robot, facing east, north, west, south (y grows SOUTH: row y0 is the top)
    .            empty cell        1-9   gems on the cell     +   ten or more gems
    ##           blocked cell (it fills the whole cell, unlike Karel's thin walls)
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]  # platform_spike/
sys.path.insert(0, str(ROOT))
from engine import _goal_failures, goal_for, run_program, validate_level  # noqa: E402

ARROWS = {"E": ">", "N": "^", "W": "<", "S": "v"}


def load_level(arg):
    path = Path(arg)
    if not path.suffix:
        path = ROOT / "levels" / f"{arg}.json"
    return json.loads(path.read_text())


def worlds_of(level):
    yield "main", level["world"]
    for i, w in enumerate(level.get("hidden_worlds", [])):
        yield w.get("name", f"hidden {i + 1}"), w


def grid(spec, gems, robot=None):
    """Lines of text for one world state. gems: {"x,y": n}; robot: (x, y, dir) or None."""
    w, h = spec["width"], spec["height"]
    blocked = {tuple(c) for c in spec.get("blocked", [])}
    lines = ["    " + "".join(f" {x % 10}" for x in range(w))]
    for y in range(h):
        row = f"y{y:<2} "
        for x in range(w):
            if (x, y) in blocked:
                row += "##"
                continue
            n = gems.get(f"{x},{y}", 0)
            cell = "." if n == 0 else str(n) if n < 10 else "+"
            mark = ARROWS[robot[2]] if robot and (robot[0], robot[1]) == (x, y) else " "
            row += mark + cell
        lines.append(row)
    return lines


def side_by_side(panels, gap=4):
    width = [max(len(s) for s in [title] + lines) for title, lines in panels]
    out = ["".ljust(gap).join(t.ljust(wd) for (t, _), wd in zip(panels, width))]
    for i in range(max(len(lines) for _, lines in panels)):
        out.append("".ljust(gap).join(
            (lines[i] if i < len(lines) else "").ljust(wd) for (_, lines), wd in zip(panels, width)))
    return "\n".join(s.rstrip() for s in out)


def describe(spec, goal):
    bag = spec.get("bag", 0)
    other = {k: v for k, v in goal.items() if k != "gems_exactly"}
    return (f"{spec['width']}x{spec['height']}  start ({spec['start'][0]},{spec['start'][1]}) {spec['start'][2]}"
            f"  bag {bag}  goal {json.dumps(other)}"
            + ("  + gems_exactly (see goal panel)" if "gems_exactly" in goal else ""))


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("level")
    ap.add_argument("--goal", action="store_true", help="also draw each world's gems_exactly target")
    ap.add_argument("--run", metavar="FILE", help="run this program on every world and draw the end state")
    ap.add_argument("--world", help="only the world with this name ('main' for the visible one)")
    args = ap.parse_args()

    level = load_level(args.level)
    validate_level(level)
    hidden = level.get("constraints", {}).get("hidden_commands", [])
    code = Path(args.run).read_text() if args.run else None

    for name, spec in worlds_of(level):
        if args.world and name != args.world:
            continue
        goal = goal_for(level, spec)
        x, y, d = spec["start"]
        panels = [("start", grid(spec, spec.get("gems", {}), (x, y, d)))]
        if args.goal and "gems_exactly" in goal:
            end = goal.get("end_at")
            robot = (end[0], end[1], goal.get("facing", "E")) if end else None
            panels.append(("goal" + ("" if end else " (no end_at)"), grid(spec, goal["gems_exactly"], robot)))
        verdict = None
        if code is not None:
            result = run_program(code, spec, 0, hidden)
            f = result["final"]
            panels.append(("after run", grid(spec, f["gems"], (f["x"], f["y"], f["dir"]))))
            failures = _goal_failures(result, goal)
            verdict = "PASS" if not failures else "FAIL: " + " | ".join(failures)
            if result["output"]:
                verdict += f"\n    printed: {result['output'].strip()[:200]!r}"
        print(f"== {name}: {describe(spec, goal)}")
        print(side_by_side(panels))
        if verdict:
            print("   ", verdict)
        print()


if __name__ == "__main__":
    main()
