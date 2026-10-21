"""Check a level's sub-quests (quests/<level id>.json) against the rules in docs/quests.md.

    python3 tools/check_quests.py turn_right     # one level: errors, warnings, and what each wrong solution misses
    python3 tools/check_quests.py --all          # every quests file

Errors (tests/test_quests.py fails on them):
  - the shape (engine.validate_quests)
  - the reference solution must complete every sub-quest (they're parts of a real solution)
  - the starter code must not complete every sub-quest
  - no answer leaks: no line of the reference solution in the text, and inline code only for
    names (`turn_right()`, `while`), never a statement or a count (`range(4)`)
  - word budgets: title 6, ask 30, nudge 20
  - a test calls a function the reference solution defines (so the name is one a real solution uses)
Warnings:
  - a sub-quest the starter code already completes (fine for a first "warm-up" only)
  - a wrong solution that completes every sub-quest (the parts don't catch that mistake)
  - a test world bigger than 6x6 (a test should be small enough to see at a glance)
"""
import ast
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from engine import LevelError, quest_state, validate_quests  # noqa: E402

BUDGET = {"title": 6, "ask": 30, "nudge": 20}
NAME_CODE = re.compile(r"^(?:[A-Za-z_][A-Za-z0-9_]*(?:\(\))?|def|for|while|if|else|elif|not|return|range\(\))$")


def words(text):
    return len(re.findall(r"[\w'’]+", text))


def load(level_id):
    level = json.loads((ROOT / "levels" / f"{level_id}.json").read_text())
    path = ROOT / "quests" / f"{level_id}.json"
    doc = json.loads(path.read_text()) if path.exists() else None
    return level, doc


def reference_lines(code):
    """Lines of the reference solution that would give part of it away if quoted."""
    out = []
    for raw in code.splitlines():
        line = raw.strip()
        if len(line) < 8 or line.startswith("#"):
            continue
        if re.fullmatch(r"def \w+\(\):", line) or re.fullmatch(r"\w+\(\)", line):
            continue  # a bare name or call is how a quest names its part
        out.append(line)
    return out


def check(level_id):
    """Returns (errors, warnings, notes)."""
    errors, warnings, notes = [], [], []
    level, doc = load(level_id)
    if doc is None:
        return [f"no quests/{level_id}.json"], [], []
    try:
        validate_quests(doc, level)
    except LevelError as e:
        return [str(e)], [], []
    quests = doc["quests"]
    ref_path = ROOT / "tests" / "solutions" / f"{level_id}.py"
    ref = ref_path.read_text()
    ref_defs = {n.name for n in ast.parse(ref).body if isinstance(n, ast.FunctionDef)}

    for q in quests:
        where = f"{q['id']}"
        for key, cap in BUDGET.items():
            if key in q and words(q[key]) > cap:
                errors.append(f"{where}.{key}: {words(q[key])} words (at most {cap})")
        for key in ("title", "ask", "nudge"):
            text = q.get(key, "")
            for span in re.findall(r"`([^`]*)`", text):
                if not NAME_CODE.match(span.strip()):
                    errors.append(f"{where}.{key}: inline code `{span}` shows more than a name")
            for line in reference_lines(ref):
                if line in text:
                    errors.append(f"{where}.{key}: quotes the reference solution ({line!r})")
        t = q["check"].get("test")
        if t:
            if t["call"] not in ref_defs:
                errors.append(f"{where}: tests {t['call']}(), which the reference solution doesn't define")
            w = t["world"]
            if w["width"] * w["height"] > 36:
                warnings.append(f"{where}: test world is {w['width']}x{w['height']} (keep it small)")

    done = quest_state(ref, level, quests)["quests"]
    for q, d in zip(quests, done):
        if not d["done"]:
            errors.append(f"{q['id']}: the reference solution doesn't complete it ({d['why']})")
    starter = level.get("starter_code", "")
    sdone = quest_state(starter, level, quests)["quests"]
    if all(d["done"] for d in sdone):
        errors.append("the starter code completes every sub-quest")
    for q, d in zip(quests, sdone):
        if d["done"]:
            warnings.append(f"{q['id']}: the starter code already completes it")
    for path in sorted((ROOT / "tests" / "solutions").glob(f"{level_id}.wrong_*.py")):
        wd = quest_state(path.read_text(), level, quests)["quests"]
        missed = [q["id"] for q, d in zip(quests, wd) if not d["done"]]
        if missed:
            notes.append(f"{path.stem.split('.', 1)[1]}: misses {', '.join(missed)}")
        else:
            warnings.append(f"{path.stem.split('.', 1)[1]} completes every sub-quest")
    return errors, warnings, notes


def main(argv):
    ids = sorted(p.stem for p in (ROOT / "quests").glob("*.json")) if argv[1:] == ["--all"] else argv[1:]
    bad = 0
    for level_id in ids:
        errors, warnings, notes = check(level_id)
        bad += bool(errors)
        status = "FAIL" if errors else "ok"
        print(f"{level_id}: {status}")
        for e in errors:
            print(f"  error: {e}")
        for w in warnings:
            print(f"  warning: {w}")
        for n in notes:
            print(f"  {n}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
