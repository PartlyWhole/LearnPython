"""Check a LearnPython lesson against the contract in docs/lessons.md section 9.

    python3 tools/check_lesson.py for_loops
    python3 tools/check_lesson.py path/to/lesson.json

tests/test_lessons.py runs the same checks (check()) on every lesson in lessons/index.json.

Runs what today's engine allows (levels exist, the demo runs, cell predictions, the last guided
example passes, hint skeletons fail, copy budgets). The step-by-step checks (each example passes
its own step and the previous example does not) need engine.check_code; until that exists they
are listed as SKIPPED, so do them by hand.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import engine  # noqa: E402

try:
    import jsonschema
except ImportError:  # schema checks are skipped without jsonschema; the rest still run
    jsonschema = None
SCHEMA = json.loads((ROOT / "schemas" / "lesson.schema.json").read_text())

BUDGET = {"watch": 25, "guided": 20, "drive": 8, "line": 25}
CHECK_KINDS = {"has", "defines", "calls", "run", "robot_at", "docstring", "not"}
CHECK_KEYS = {"has", "range", "defines", "body_calls", "calls", "inside", "outside", "min", "max",
              "run", "robot_at", "docstring", "not"}
FOCUS = re.compile(r"^(world|editor|editor:\d+|cell:\d+,\d+|button:[a-z_]+|run|goal)$")
errors, warnings, skipped = [], [], []
VERBOSE = True


def err(msg):
    errors.append(msg)
    if VERBOSE:
        print(f"  error: {msg}")


def warn(msg):
    warnings.append(msg)
    if VERBOSE:
        print(f"  warn:  {msg}")


def say(msg):
    if VERBOSE:
        print(msg)


def words(text):
    # Code fragments count as one word each, so `for i in range(5):` doesn't blow the budget.
    return len(re.sub(r"`[^`]*`", "X", text).split())


def load_level(level_id):
    path = ROOT / "levels" / f"{level_id}.json"
    if not path.exists():
        err(f"level '{level_id}' does not exist (author it with the author-level skill)")
        return None
    return json.loads(path.read_text())


def check_kinds(where, check):
    """docs/lessons.md section 5.3: only known check kinds and keys."""
    kinds = CHECK_KINDS & set(check)
    if len(kinds) != 1 or (check.keys() - CHECK_KEYS):
        err(f"{where}: unknown or ambiguous check {check} (kinds: {sorted(CHECK_KINDS)})")
    if "not" in check:
        check_kinds(where, check["not"])


def code_only(checks):
    """The checks engine.check_code can judge from code alone: no run checks, and no malformed
    ones (those are already reported as errors)."""
    return [c for c in checks if "run" not in c and "robot_at" not in c
            and len(CHECK_KINDS & set(c)) == 1 and not (c.keys() - CHECK_KEYS)]


def check_budget(where, text, limit):
    if words(text) > limit:
        warn(f"{where}: {words(text)} words (budget {limit}): {text!r}")


def check(lesson, verbose=False):
    """All checks on one lesson. Returns (errors, warnings, skipped) as lists of strings."""
    global VERBOSE
    VERBOSE = verbose
    for bucket in (errors, warnings, skipped):
        bucket.clear()
    _check(lesson)
    return list(errors), list(warnings), list(skipped)


def _check(lesson):
    say(f"lesson {lesson.get('id')}: {lesson.get('title')}")
    if SCHEMA and jsonschema:
        for e in jsonschema.Draft202012Validator(SCHEMA).iter_errors(lesson):
            err(f"schema: {'/'.join(map(str, e.absolute_path)) or '(top)'}: {e.message[:160]}")

    missing = [k for k in ("format", "id", "title", "concept", "watch", "guided", "practice", "recap")
               if k not in lesson]
    for key in missing:
        err(f"missing key '{key}'")
    if missing:  # the checks below need these; schema errors alone don't stop them
        return

    say("watch")
    world = lesson["watch"]["world"]
    try:
        engine.validate_world(world, "watch.world")
    except Exception as e:  # validate_* raise ValueError-like errors with a path
        err(f"demo world invalid: {e}")
        return
    code, predicts, runs = "", 0, 0
    steps = lesson["watch"]["steps"]
    if len(steps) > 10:
        warn(f"{len(steps)} demo steps (show, don't tell: most demos need 3-6; refinement up to ~10)")
    for i, step in enumerate(steps, 1):
        check_budget(f"watch step {i}", step.get("say", ""), BUDGET["watch"])
        if "focus" in step and not FOCUS.match(step["focus"]):
            err(f"watch step {i}: unknown focus {step['focus']!r}")
        if "world" in step:
            try:
                engine.validate_world(step["world"], f"watch step {i}.world")
                world = step["world"]
            except Exception as e:
                err(f"watch step {i}: world invalid: {e}")
        code = step.get("code", code)
        if "code_from" in step:
            src = ROOT / "levels" / f"{step['code_from']}.json"
            if not src.exists():
                err(f"watch step {i}: code_from names a missing level {step['code_from']!r}")
            elif json.loads(src.read_text())["world"] != world:
                err(f"watch step {i}: code_from {step['code_from']!r} but the demo world is not that level's world "
                    "(the learner's own code must run in it)")
            if "code" not in step:
                err(f"watch step {i}: code_from needs a `code` fallback (learners who skipped that level)")
        if "predict" in step:
            predicts += 1
            pred = step["predict"]
            cell = pred.get("answer") if pred.get("cell") is True else None
            if not (pred.get("cell") is True or ("choices" in pred and pred.get("answer") in pred["choices"])):
                err(f"watch step {i}: predict must be {{cell: true, answer: [x, y]}} or {{choices, answer in choices}}")
            elif cell is not None:
                result = engine.run_program(code, world)
                end = [result["final"]["x"], result["final"]["y"]]
                if end != list(cell):
                    err(f"watch step {i}: predict answer {cell} but the code ends at {end}")
            else:
                skipped.append(f"watch step {i}: 'choices' prediction: check the answer by watching the demo")
        if step.get("run"):
            runs += 1
            result = engine.run_program(code, world)
            if step.get("expect") == "error":  # the crash IS the lesson: show it rather than describe it
                if not result["error"]:
                    err(f"watch step {i}: expects the run to crash, but it finishes")
            elif result["error"]:
                err(f"watch step {i}: demo run fails: {result['error']['message']} "
                    "(add \"expect\": \"error\" if showing this crash is the point)")
        elif step.get("expect"):
            err(f"watch step {i}: `expect` only makes sense on a run step")
    if predicts > 1:
        warn(f"{predicts} predictions in the demo (at most one)")
    if runs == 0:
        err("the demo never runs the code")

    say("guided")
    guided = lesson["guided"]
    level = load_level(guided["level"])
    gsteps = guided["steps"]
    if not 3 <= len(gsteps) <= 6:
        warn(f"{len(gsteps)} guided steps (aim for 3-6)")
    for i, step in enumerate(gsteps, 1):
        check_budget(f"guided step {i}", step.get("say", ""), BUDGET["guided"])
        if not step.get("done_when"):
            err(f"guided step {i} has no done_when")
        for check in step.get("done_when", []):
            check_kinds(f"guided step {i}", check)
    if gsteps and gsteps[-1].get("done_when") != [{"run": "passed"}]:
        warn("the last guided step should be a passing run: done_when [{\"run\": \"passed\"}]")
    examples = [s["example"] for s in gsteps if "example" in s]
    if level is not None and examples:
        report = engine.check_level(examples[-1], level)
        if not report["passed"]:
            fails = [f for w in report["worlds"] for f in w["failures"]] + report["constraint_failures"]
            err(f"the last guided example does not pass {guided['level']}: {fails[:3]}")
        if level.get("starter_code", "").strip() == examples[0].strip():
            err("step 1's example equals the starter code: the step is already done")
    ref = ROOT / "tests" / "solutions" / f"{guided['level']}.py"
    if not ref.exists():
        err(f"no reference solution {ref.relative_to(ROOT)}")
    if hasattr(engine, "check_code"):
        prev = level.get("starter_code", "") if level else ""
        for k, step in enumerate(gsteps, 1):
            code_checks = code_only(step["done_when"])
            if not code_checks or "example" not in step:
                continue
            for j, earlier in enumerate(gsteps[:k], 1):
                cc = code_only(earlier["done_when"])
                if cc and not all(engine.check_code(step["example"], cc)):
                    err(f"guided step {k}: its example fails step {j}'s checks")
            if all(engine.check_code(prev, code_checks)):
                err(f"guided step {k} is already satisfied before it starts")
            if ref.exists() and not all(engine.check_code(ref.read_text(), code_checks)):
                err(f"the reference solution fails guided step {k}'s checks: a correct learner would be stuck")
            prev = step["example"]
    else:
        skipped.append("guided steps: example_k passes steps 1..k, example_{k-1} fails step k, "
                       "the reference passes every step (needs engine.check_code; do it by hand)")
    check_budget("guided done", guided.get("done", ""), BUDGET["line"])

    say("practice and twist")
    later = list(lesson["practice"]) + ([lesson["twist"]] if "twist" in lesson else [])
    if not 1 <= len(lesson["practice"]) <= 3:
        warn(f"{len(lesson['practice'])} practice levels (aim for 1-3; the curriculum's new levels may not exist yet)")
    if "twist" not in lesson:
        warn("no twist level yet")
    levels = {lid: load_level(lid) for lid in later}
    for lid in lesson.get("hints", {}):
        if lid not in later:
            err(f"hints for '{lid}', which is not a practice or twist level")
    for lid in later:
        rungs = lesson.get("hints", {}).get(lid, [])
        if not rungs:
            warn(f"no hints for '{lid}'")
        if len(rungs) > 3:
            err(f"'{lid}' has {len(rungs)} hint rungs (at most 3)")
        for r, text in enumerate(rungs, 1):
            if "__" in text and levels.get(lid):
                for fill in ("0", "pass"):
                    if engine.check_level(text.replace("__", fill), levels[lid])["passed"]:
                        err(f"'{lid}' hint {r} is a passing solution once its blanks are filled with {fill}")
                if text.count("__") == 1:
                    warn(f"'{lid}' hint {r} has a single blank: check it isn't the whole answer")
            elif "\n" in text:
                if levels.get(lid) and engine.check_level(text, levels[lid])["passed"]:
                    err(f"'{lid}' hint {r} is a full passing solution (hints stop at a skeleton)")
                else:
                    warn(f"'{lid}' hint {r} looks like code but has no __ blanks")
            else:
                check_budget(f"'{lid}' hint {r}", text, BUDGET["line"])

    check_budget("recap", lesson["recap"].get("say", ""), BUDGET["line"])


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
    path = Path(arg) if arg.endswith(".json") else ROOT / "lessons" / f"{arg}.json"
    errs, warns, skips = check(json.loads(path.read_text()), verbose=True)
    for s in skips:
        print(f"  SKIPPED: {s}")
    print(f"{len(errs)} error(s), {len(warns)} warning(s), {len(skips)} skipped")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
