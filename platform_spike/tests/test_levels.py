"""Every level is solvable, and its checks catch the mistakes it is designed around.

For each level <id> in the play order (lessons/index.json, via tools/play_order.py):
  tests/solutions/<id>.py           reference solution: must pass every world and constraint
  tests/solutions/<id>.wrong_*.py   at least one known-wrong attempt (off-by-one, hard-coded,
                                    `if` instead of `while`, ...): each must fail
  tests/solutions/<id>.long_*.py    a working but long attempt (unrolled, no helper): it must
                                    pass, but miss the line bonus (max_lines is a bonus, not a gate)

Solutions live under tests/, not levels/, so the app never serves them.
"""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from engine import check_level  # noqa: E402

SOLUTIONS = ROOT / "tests" / "solutions"
sys.path.insert(0, str(ROOT / "tools"))
from play_order import level_ids  # noqa: E402
LEVEL_IDS = level_ids()


def load(level_id):
    return json.loads((ROOT / "levels" / f"{level_id}.json").read_text())


class EveryLevel(unittest.TestCase):
    def test_reference_solutions_pass(self):
        for level_id in LEVEL_IDS:
            with self.subTest(level=level_id):
                path = SOLUTIONS / f"{level_id}.py"
                self.assertTrue(path.exists(), f"missing reference solution {path.name}")
                report = check_level(path.read_text(), load(level_id))
                failures = [f for w in report["worlds"] for f in w["failures"]] + report["constraint_failures"]
                self.assertTrue(report["passed"], failures)
                if report["lines"]:
                    self.assertTrue(report["lines"]["met"], f"the reference misses the line bonus: {report['lines']}")

    def test_long_solutions_pass_without_the_bonus(self):
        for level_id in LEVEL_IDS:
            for path in sorted(SOLUTIONS.glob(f"{level_id}.long_*.py")):
                with self.subTest(level=level_id, long=path.name):
                    report = check_level(path.read_text(), load(level_id))
                    self.assertTrue(report["passed"], f"{path.name} should pass")
                    self.assertFalse(report["lines"]["met"], f"{path.name} should miss the line bonus")

    def test_wrong_solutions_fail(self):
        for level_id in LEVEL_IDS:
            wrong = sorted(SOLUTIONS.glob(f"{level_id}.wrong_*.py"))
            with self.subTest(level=level_id):
                self.assertTrue(wrong, "add at least one wrong_*.py the level must reject")
            for path in wrong:
                with self.subTest(level=level_id, wrong=path.name):
                    self.assertFalse(check_level(path.read_text(), load(level_id))["passed"],
                                     f"{path.name} should fail but passes")

    def test_starter_code_does_not_already_pass(self):
        for level_id in LEVEL_IDS:
            level = load(level_id)
            with self.subTest(level=level_id):
                self.assertFalse(check_level(level.get("starter_code", ""), level)["passed"])

    def test_varying_levels_have_hidden_worlds(self):
        # Levels whose goals are per-world (sizes vary) must actually test other worlds.
        for level_id in LEVEL_IDS:
            level = load(level_id)
            if "goal" in level["world"]:
                with self.subTest(level=level_id):
                    self.assertTrue(level.get("hidden_worlds"), "per-world goals but no hidden worlds")


if __name__ == "__main__":
    unittest.main()
