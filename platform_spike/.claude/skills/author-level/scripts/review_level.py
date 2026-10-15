"""Review one level the way test_levels.py can't: WHY each solution passes or fails, and what the
worlds cover.

    python3 .claude/skills/author-level/scripts/review_level.py <id>

Prints, for levels/<id>.json and tests/solutions/<id>*.py:
  1. bookkeeping: schema/engine validation, topic IDs, the play order (lessons/index.json), docs/levels.md row
  2. the reference solution, world by world (must PASS everywhere)
  3. every wrong_*.py, world by world, with the failure messages, so you can confirm it fails
     for the mistake it is named after and not for some accident (a crash, a constraint)
  4. the starter code (must fail somewhere)
  5. a hard-coded replay of the reference's moves on the main world, which the hidden worlds
     must reject (D9); if it passes everywhere, the hidden worlds aren't doing their job
  6. edge-case coverage of the worlds (1x1, single row/column, no gems, gem on start, odd/even)

Exit status 1 if anything in 1-5 is an ERROR; coverage gaps in 6 are warnings for you to judge.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]  # platform_spike/
sys.path.insert(0, str(ROOT))
from engine import LevelError, check_level, run_program, validate_level  # noqa: E402

SOLUTIONS = ROOT / "tests" / "solutions"
TOPICS_FILE = ROOT.parent / "topics" / "all_topics.json"
ACTIONS = {"move", "turn_left", "pick", "put"}  # state-changing commands; sensors are dropped
errors = []


def error(msg):
    errors.append(msg)
    print(f"  ERROR {msg}")


def report(label, code, level, expect_pass):
    rep = check_level(code, level)
    print(f"\n{label}: {'PASS' if rep['passed'] else 'FAIL'}"
          + ("" if rep["passed"] == expect_pass else "   <-- unexpected"))
    for w in rep["worlds"]:
        print(f"  {'ok  ' if w['passed'] else 'FAIL'} {w['world']:<24} {' | '.join(w['failures'])}")
    for c in rep["constraint_failures"]:
        print(f"  FAIL constraint                {c}")
    return rep


def bookkeeping(level_id, level):
    print("Bookkeeping")
    try:
        validate_level(level)
        print("  ok   validate_level")
    except LevelError as e:
        error(f"validate_level: {e}")
    if level.get("id") != level_id:
        error(f"id {level.get('id')!r} doesn't match the file name {level_id!r}")
    if TOPICS_FILE.exists():
        known = {t["id"] for t in json.loads(TOPICS_FILE.read_text())["topics"]}
        missing = [t for t in level.get("topics", []) if t not in known]
        if missing:
            error(f"unknown topic IDs {missing}; search with find_topics.py")
        elif not level.get("topics"):
            error("no topics: tag 1-3 topic IDs from ../topics/all_topics.json")
        else:
            print(f"  ok   topics {level['topics']}")
    sys.path.insert(0, str(ROOT / "tools"))
    from play_order import load as load_play_order
    order = load_play_order()
    units = [u["title"] for u in order["units"] for item in u["items"] if level_id in item["levels"]]
    if units:
        print(f"  ok   in the play order (lessons/index.json), unit {units[0]!r}")
    else:
        error("not in the play order: add it to lessons/index.json, as a {\"level\": id} item or in a "
              "lesson's guided/practice/twist (test_contracts fails, and the app won't list it)")
    if f"`{level_id}`" in (ROOT / "docs" / "levels.md").read_text():
        print("  ok   row in docs/levels.md")
    else:
        error("no row in the docs/levels.md table")
    if "goal" in level["world"] and not level.get("hidden_worlds"):
        error("per-world goal on the main world but no hidden worlds")
    for i, w in enumerate(level.get("hidden_worlds", [])):
        if "name" not in w:
            error(f"hidden world {i + 1} has no name (failure messages will say 'hidden {i + 1}')")


def hard_coded_replay(level, code):
    """The reference's main-world actions as a straight-line program (what a learner might type)."""
    hidden = level.get("constraints", {}).get("hidden_commands", [])
    trace = run_program(code, level["world"], 0, hidden)["trace"]
    return "\n".join(f"{e['action']}()" for e in trace if e["action"] in ACTIONS) + "\n"


def coverage(level):
    print("\nWorld coverage")
    worlds = [("main", level["world"])] + [
        (w.get("name", f"hidden {i + 1}"), w) for i, w in enumerate(level.get("hidden_worlds", []))]
    seen = set()
    for name, w in worlds:
        W, H = w["width"], w["height"]
        gems = w.get("gems", {})
        sx, sy, _ = w["start"]
        tags = []
        if W == 1 and H == 1:
            tags.append("1x1")
        elif H == 1:
            tags.append("single row")
        elif W == 1:
            tags.append("single column")
        if not gems:
            tags.append("no gems")
        if f"{sx},{sy}" in gems:
            tags.append("gem on start")
        tags.append("odd width" if W % 2 else "even width")
        if H > 1:
            tags.append("odd height" if H % 2 else "even height")
        if w.get("blocked"):
            tags.append(f"{len(w['blocked'])} blocked")
        seen.update(tags)
        print(f"  {name:<24} {W}x{H:<4} {', '.join(tags)}")
    wanted = ["1x1", "single row", "single column", "no gems", "gem on start",
              "odd width", "even width"]
    gaps = [t for t in wanted if t not in seen]
    if gaps:
        print(f"  warn not covered: {', '.join(gaps)}. Fine if the level makes them impossible or"
              " pointless; otherwise add a hidden world (see SKILL.md, 'Hidden worlds').")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    level_id = sys.argv[1]
    level = json.loads((ROOT / "levels" / f"{level_id}.json").read_text())
    bookkeeping(level_id, level)

    ref_path = SOLUTIONS / f"{level_id}.py"
    if not ref_path.exists():
        error(f"missing {ref_path.relative_to(ROOT)}")
        sys.exit(1)
    ref = ref_path.read_text()
    if not report(f"Reference {ref_path.name}", ref, level, True)["passed"]:
        error("the reference solution fails")

    wrongs = sorted(SOLUTIONS.glob(f"{level_id}.wrong_*.py"))
    if not wrongs:
        error(f"no tests/solutions/{level_id}.wrong_*.py")
    signatures = {}
    for path in wrongs:
        rep = report(f"Wrong {path.name}", path.read_text(), level, False)
        if rep["passed"]:
            error(f"{path.name} passes")
        elif not any(w["failures"] for w in rep["worlds"]):
            print("  note: fails ONLY on a constraint. Intended? Then the worlds don't catch this mistake.")
        elif rep["worlds"][0]["passed"]:
            print("  warn: passes the main world, so the learner never SEES this mistake, only a"
                  " hidden world's message. Change the main world unless that's deliberate.")
        sig = tuple(tuple(w["failures"]) for w in rep["worlds"])
        if sig in signatures:
            print(f"  warn: fails exactly like {signatures[sig]} in every world. Add a world that"
                  " tells them apart, or drop one.")
        signatures.setdefault(sig, path.name)

    starter = level.get("starter_code", "")
    if report("Starter code" + ("" if starter else " (empty)"), starter, level, False)["passed"]:
        error("the starter code already passes")

    replay = hard_coded_replay(level, ref)
    rep = report("Hard-coded replay of the reference's main-world moves", replay, level, False)
    if not level.get("hidden_worlds"):
        print("  note: fixed-world level (no hidden worlds), so a move list solves it unless a"
              " constraint stops it. Fine for sequencing/def/for levels, not for while/if levels.")
    elif rep["passed"]:
        error("a hard-coded move list passes every world: add hidden worlds that differ (D9)")
    elif all(w["passed"] for w in rep["worlds"]):
        print("  note: only a constraint stops the move list; every hidden world accepts it.")

    coverage(level)
    print(f"\n{len(errors)} error(s)" + "".join(f"\n  - {e}" for e in errors))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
