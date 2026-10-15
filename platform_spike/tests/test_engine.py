"""Behaviour tests for the engine. Each test protects an invariant listed in CLAUDE.md."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from engine import LevelError, check_code, check_level, guide_state, run_program, validate_world  # noqa: E402

CORRIDOR = {"width": 6, "height": 1, "start": [0, 0, "E"], "gems": {"2,0": 2, "5,0": 1}}
SOLUTION = "while front_is_clear():\n    move()\n    while gems_here() > 0:\n        pick()\n"
LEVEL = json.loads((ROOT / "levels" / "collect_row.json").read_text())


class LearnerErrors(unittest.TestCase):
    def test_wall_error_reports_learner_line(self):
        r = run_program("move()\nmove()\nturn_left()\nmove()\n", CORRIDOR)
        self.assertEqual(r["error"]["type"], "WorldError")
        self.assertEqual(r["error"]["line"], 4)
        self.assertIn("wall", r["error"]["message"])
        self.assertEqual(r["error"]["kind"], "wall")

    def test_world_error_kinds(self):
        self.assertEqual(run_program("pick()\n", CORRIDOR)["error"]["kind"], "no_gem")
        r = run_program("while True:\n    turn_left()\n", dict(CORRIDOR, max_steps=50))
        self.assertEqual(r["error"]["kind"], "step_limit")
        self.assertNotIn("kind", run_program("x = 1/0\n", CORRIDOR)["error"], "only WorldError has a kind")

    def test_python_errors_become_data_with_line(self):
        r = run_program("move()\nmvoe()\n", CORRIDOR)
        self.assertEqual((r["error"]["type"], r["error"]["line"]), ("NameError", 2))
        self.assertEqual(len(r["trace"]), 1, "events before the error are kept for replay")

    def test_syntax_error_has_line_and_no_trace(self):
        r = run_program("move(\n", CORRIDOR)
        self.assertEqual(r["error"]["type"], "SyntaxError")
        self.assertEqual(r["trace"], [])

    def test_every_event_carries_its_learner_line(self):
        r = run_program("move()\n\nturn_left()\n", CORRIDOR)
        self.assertEqual([e["line"] for e in r["trace"]], [1, 3])


class Stopping(unittest.TestCase):
    def test_step_cap_stops_runaway_api_loop(self):
        r = run_program("while True:\n    turn_left()\n", dict(CORRIDOR, max_steps=500))
        self.assertEqual(len(r["trace"]), 500)
        self.assertIn("more than 500 steps", r["error"]["message"])

    def test_step_cap_changes_nothing_without_an_event(self):
        # The final state must equal the last recorded event, or replays disagree with the engine.
        for code in ("while True:\n    turn_left()\n", "while True:\n    move()\n    turn_left()\n    turn_left()\n"):
            r = run_program(code, dict(CORRIDOR, width=2, gems={}, max_steps=7))
            last = r["trace"][-1]
            self.assertEqual({k: r["final"][k] for k in ("x", "y", "dir", "bag")},
                             {k: last[k] for k in ("x", "y", "dir", "bag")})

    # A loop that never calls the API (`while True: x += 1`) is NOT caught by the step cap.
    # The app must enforce a wall-clock timeout that terminates the worker (CLAUDE.md, D5).
    # That cannot be unit-tested in-process; it is covered by the browser harness (index.html).


class Isolation(unittest.TestCase):
    def test_runs_do_not_share_variables(self):
        run_program("secret = 1\n", CORRIDOR)
        r = run_program("print(secret)\n", CORRIDOR)
        self.assertEqual(r["error"]["type"], "NameError")

    def test_runs_do_not_share_world_state(self):
        run_program("move()\nmove()\npick()\n", CORRIDOR)
        r = run_program("print(gems_here())\nmove()\nmove()\nprint(gems_here())\n", CORRIDOR)
        self.assertEqual(r["output"], "0\n2\n", "a fresh world every run")

    def test_print_is_captured_not_leaked(self):
        r = run_program("print('hi')\n", CORRIDOR)
        self.assertEqual(r["output"], "hi\n")


class Determinism(unittest.TestCase):
    def test_same_seed_same_result(self):
        code = "n = 0\nfor _ in range(30):\n    if coin_flip():\n        n += 1\nprint(n)\n"
        self.assertEqual(run_program(code, CORRIDOR, seed=7), run_program(code, CORRIDOR, seed=7))

    def test_scan_returns_a_list_of_counts(self):
        r = run_program("print(scan())\n", CORRIDOR)
        self.assertEqual(r["output"], "[0, 2, 0, 0, 1]\n")


class Building(unittest.TestCase):
    def test_put_uses_the_bag_and_reports_an_empty_bag(self):
        r = run_program("put()\nmove()\nput()\nput()\n", dict(CORRIDOR, gems={}, bag=2))
        self.assertEqual(r["final"]["gems"], {"0,0": 1, "1,0": 1})
        self.assertEqual((r["error"]["kind"], r["error"]["line"]), ("empty_bag", 4))

    def test_infinite_bag_never_runs_out(self):
        r = run_program("for _ in range(50):\n    put()\n", dict(CORRIDOR, gems={}, bag="infinite"))
        self.assertIsNone(r["error"])
        self.assertEqual(r["final"]["gems"], {"0,0": 50})

    def test_picked_out_cells_disappear_from_the_gem_map(self):
        r = run_program("move()\nmove()\npick()\npick()\n", CORRIDOR)
        self.assertEqual(r["final"]["gems"], {"5,0": 1})


class GuideChecks(unittest.TestCase):
    """engine.check_code: the lesson guide's done_when vocabulary (docs/lessons.md section 5.3)."""

    LOOP = "for k in range(5):\n    put()\n    if gems_here():\n        move()\nturn_left()\n"

    def ok(self, code, check, run=None):
        return check_code(code, [check], run)[0]

    def test_has_range_and_variable_names_do_not_matter(self):
        self.assertTrue(self.ok(self.LOOP, {"has": "for", "range": 5}))
        self.assertFalse(self.ok(self.LOOP, {"has": "for", "range": 4}))
        self.assertTrue(self.ok(self.LOOP, {"has": "if", "inside": "for"}))
        self.assertFalse(self.ok(self.LOOP, {"has": "while"}))
        self.assertTrue(self.ok("while x:\n    a()\nwhile y:\n    b()\n", {"has": "while", "min": 2}))
        self.assertFalse(self.ok("while x:\n    a()\n", {"has": "while", "min": 2}))

    def test_calls_inside_paths_and_outside(self):
        self.assertTrue(self.ok(self.LOOP, {"calls": "put", "inside": "for"}))
        self.assertTrue(self.ok(self.LOOP, {"calls": "move", "inside": "for>if"}))
        self.assertFalse(self.ok(self.LOOP, {"calls": "turn_left", "inside": "for"}))
        self.assertTrue(self.ok(self.LOOP, {"calls": "turn_left", "outside": "for"}))
        self.assertFalse(self.ok(self.LOOP, {"calls": "put", "outside": "for"}))

    def test_a_condition_is_not_inside_its_own_construct(self):
        code = "while front_is_clear():\n    move()\n    while gems_here():\n        pick()\n"
        self.assertTrue(self.ok(code, {"calls": "front_is_clear", "outside": "while"}))
        self.assertTrue(self.ok(code, {"calls": "gems_here", "inside": "while"}))
        self.assertFalse(self.ok(code, {"calls": "gems_here", "inside": "while>while"}))
        self.assertTrue(self.ok(code, {"calls": "pick", "inside": "while>while"}))
        # The headline mistake of while_loops: if instead of while.
        self.assertFalse(self.ok(code.replace("while gems", "if gems"), {"calls": "pick", "inside": "while>while"}))

    def test_defines_body_calls_docstring_and_def_paths(self):
        code = 'def turn_right():\n    """Face right."""\n    turn_left()\n    turn_left()\n    turn_left()\nturn_right()\n'
        self.assertTrue(self.ok(code, {"defines": "turn_right", "body_calls": {"turn_left": 3}}))
        self.assertFalse(self.ok(code, {"defines": "turn_right", "body_calls": {"turn_left": 2}}))
        self.assertTrue(self.ok(code, {"docstring": "turn_right"}))
        self.assertFalse(self.ok(code.replace('"""Face right."""\n    ', ""), {"docstring": "turn_right"}))
        self.assertTrue(self.ok(code, {"calls": "turn_left", "inside": "def turn_right", "min": 3}))
        self.assertTrue(self.ok(code, {"calls": "turn_right", "outside": "def"}))
        self.assertFalse(self.ok(code, {"calls": "turn_left", "outside": "def"}))

    def test_else_not_and_counts(self):
        self.assertTrue(self.ok("if a():\n    b()\nelse:\n    c()\n", {"has": "else"}))
        self.assertFalse(self.ok("if a():\n    b()\nelif c():\n    d()\n", {"has": "else"}))
        self.assertTrue(self.ok(self.LOOP, {"not": {"has": "while"}}))
        self.assertTrue(self.ok(self.LOOP, {"calls": "put", "max": 1}))
        self.assertFalse(self.ok("put()\nput()\n", {"calls": "put", "max": 1}))

    def test_run_checks_only_count_for_the_code_that_ran(self):
        run = {"code": "move()\n", "passed": True, "error": None, "end": [1, 0]}
        self.assertTrue(self.ok("move()\n", {"run": "passed"}, run))
        self.assertTrue(self.ok("move()\n", {"robot_at": [1, 0]}, run))
        self.assertFalse(self.ok("move()\nmove()\n", {"run": "any"}, run), "an edit makes the run stale")
        self.assertFalse(self.ok("move()\n", {"run": "passed"}, None))
        self.assertFalse(self.ok("move()\n", {"run": "no_error"}, dict(run, error={"type": "WorldError"})))

    def test_syntax_errors_fail_code_checks_and_guide_state_reports_them(self):
        self.assertFalse(self.ok("for i in range(5)\n    put()\n", {"has": "for"}))
        state = guide_state("for i in range(5):\n", [[{"has": "for"}]])
        self.assertEqual(state, {"syntax_ok": False, "steps": [False]})
        state = guide_state(self.LOOP, [[{"has": "for"}], [{"has": "while"}], [{"run": "passed"}]])
        self.assertEqual(state, {"syntax_ok": True, "steps": [True, False, False]})


class Goals(unittest.TestCase):
    def level(self, **extra):
        base = {"format": 1, "id": "t", "title": "t", "world": dict(CORRIDOR, gems={}, bag="infinite"),
                "goal": {"gems_exactly": {"0,0": 1, "1,0": 1}}}
        base.update(extra)
        return base

    def test_gems_exactly_needs_the_exact_layout(self):
        self.assertTrue(check_level("put()\nmove()\nput()\n", self.level())["passed"])
        report = check_level("put()\nput()\nmove()\nput()\n", self.level())
        self.assertIn("too many", report["worlds"][0]["failures"][0])

    def test_facing_goal(self):
        lv = self.level(goal={"facing": "N"})
        self.assertTrue(check_level("turn_left()\n", lv)["passed"])
        self.assertIn("facing north", check_level("move()\n", lv)["worlds"][0]["failures"][0])

    def test_world_goal_overrides_level_goal(self):
        # "End at the east wall" in worlds of different widths.
        lv = self.level(goal={"end_at": [5, 0]},
                        hidden_worlds=[dict(CORRIDOR, width=3, gems={}, goal={"end_at": [2, 0]})])
        report = check_level("while front_is_clear():\n    move()\n", lv)
        self.assertTrue(report["passed"], report)

    def test_compare_and_return_constructs(self):
        from engine import check_constraints
        self.assertEqual(check_constraints("while gems_here():\n    pick()\n", {"required": ["compare"]}),
                         ["This level asks you to use a comparison such as > or ==."])
        self.assertEqual(check_constraints("while gems_here() > 1:\n    pick()\n", {"required": ["compare"]}), [])
        inline = "turn_left()\nok = front_is_clear()\n"
        self.assertEqual(check_constraints(inline, {"required": ["return"]}),
                         ["This level asks you to use a function that uses return."])
        helper = "def clear():\n    return front_is_clear()\nclear()\n"
        self.assertEqual(check_constraints(helper, {"required": ["return"]}), [])

    def test_required_and_banned_constructs(self):
        lv = self.level(goal={"facing": "S"}, constraints={"required": ["def"], "banned": ["for"]})
        three_lefts = "turn_left()\nturn_left()\nturn_left()\n"
        self.assertEqual(check_level(three_lefts, lv)["constraint_failures"], ["This level asks you to use 'def'."])
        good = "def turn_right():\n    turn_left()\n    turn_left()\n    turn_left()\nturn_right()\n"
        self.assertTrue(check_level(good, lv)["passed"])

    def test_hidden_commands_fail_with_a_learner_message(self):
        lv = self.level(goal={"no_error": True}, constraints={"hidden_commands": ["scan"]})
        report = check_level("print(len(scan()))\n", lv)
        self.assertFalse(report["passed"])
        self.assertIn("isn't available", report["worlds"][0]["failures"][0])
        r = run_program("scan()\n", CORRIDOR, hidden_commands=["scan"])
        self.assertEqual(r["error"]["kind"], "unavailable")


class Levels(unittest.TestCase):
    def test_solution_passes_all_worlds(self):
        report = check_level(SOLUTION, LEVEL)
        self.assertTrue(report["passed"], report)
        self.assertEqual(len(report["worlds"]), 4)

    def test_hard_coded_answer_fails_a_hidden_world(self):
        hard = "move()\nmove()\npick()\npick()\nmove()\nmove()\nmove()\npick()\n"
        report = check_level(hard, dict(LEVEL, constraints={}))
        self.assertTrue(report["worlds"][0]["passed"], "it does solve the visible world")
        self.assertFalse(report["passed"], "but hidden worlds catch the hard-coding")

    def test_constraints_are_reported(self):
        report = check_level(SOLUTION + "\n".join(["turn_left()"] * 4 + ["pass"]) + "\n", LEVEL)
        self.assertTrue(any("at most 6 lines" in f for f in report["constraint_failures"]))
        banned = check_level(SOLUTION, dict(LEVEL, constraints={"banned": ["while"]}))
        self.assertEqual(banned["constraint_failures"], ["This level asks you not to use 'while'."])

    def test_a_crash_is_the_only_failure_reported(self):
        report = check_level("move()\nturn_left()\nmove()\n", LEVEL)
        self.assertEqual(report["worlds"][0]["failures"],
                         ["Stopped on line 3: There's a wall in front of you."])

    def test_bad_world_is_an_authoring_error(self):
        with self.assertRaises(LevelError):
            validate_world({"width": 3, "height": 1, "start": [5, 0, "E"]})


if __name__ == "__main__":
    unittest.main()
