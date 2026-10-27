"""Sub-quest checks in the engine (engine.quest_state, docs/quests.md)."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from engine import LevelError, definitions_only, quest_state, validate_quests  # noqa: E402

LEVEL = {"id": "t", "world": {"width": 5, "height": 1, "start": [0, 0, "E"], "gems": {"3,0": 1}},
         "goal": {"all_gems_collected": True}}
TURN_TEST = {"id": "tr", "title": "Turn right", "ask": "...", "check": {"test": {
    "call": "turn_right", "world": {"width": 3, "height": 3, "start": [1, 1, "E"]},
    "goal": {"end_at": [1, 1], "facing": "S"}}}}


def state(code, quests, level=LEVEL):
    return quest_state(code, level, quests)["quests"]


class FunctionTests(unittest.TestCase):
    def test_a_function_is_tested_alone_without_the_rest_of_the_program(self):
        code = "def turn_right():\n    turn_left()\n    turn_left()\n    turn_left()\n\nmove()\nmove()\nmove()\nmove()\nmove()\n"
        q = state(code, [TURN_TEST])[0]
        self.assertTrue(q["done"], q["why"])  # the five moves (a crash in a 3x3) never ran
        self.assertEqual([e["line"] for e in q["result"]["trace"]], [2, 3, 4])  # real line numbers
        lines = len(code.split("\n"))
        self.assertTrue(all(e["calls"] == [lines + 1] for e in q["result"]["trace"]),
                        "the test's own call is past the learner's last line, so it's never drawn")

    def test_a_wrong_function_says_what_happened_not_how_to_fix_it(self):
        q = state("def turn_right():\n    turn_left()\n", [TURN_TEST])[0]
        self.assertFalse(q["done"])
        self.assertEqual(q["why"], "The robot ends facing north (↑), not south (↓).")

    def test_a_missing_function_is_named(self):
        q = state("move()\n", [TURN_TEST])[0]
        self.assertEqual((q["done"], q["why"], q["missing"]), (False, "There's no turn_right() to test yet. This part tests a function with exactly that name.", True))

    def test_returns_and_arguments(self):
        quest = {"id": "c", "title": "x", "ask": "x", "check": {"test": {
            "call": "count_to_wall", "world": {"width": 4, "height": 1, "start": [0, 0, "E"]}, "returns": 3}}}
        good = "def count_to_wall():\n    n = 0\n    while front_is_clear():\n        move()\n        n += 1\n    return n\n"
        self.assertTrue(state(good, [quest])[0]["done"])
        bad = state(good.replace("return n", "return n - 1"), [quest])[0]
        self.assertEqual(bad["why"], "count_to_wall() gave back 2, but should give back 3.")

    def test_definitions_only_keeps_line_numbers(self):
        code = "X = 3\ndef f():\n    move()\nfor i in range(2):\n    f()\n"
        self.assertEqual(definitions_only(code).split("\n"), ["X = 3", "def f():", "    move()", "", "", ""])
        self.assertIsNone(definitions_only("def f(:\n"))


class ProgramChecks(unittest.TestCase):
    def test_reach_on_the_levels_world(self):
        quest = {"id": "g", "title": "x", "ask": "x", "check": {"program": {"reach": {"pick_at": [3, 0]}}}}
        self.assertTrue(state("move()\nmove()\nmove()\npick()\n", [quest])[0]["done"])
        q = state("move()\nmove()\nmove()\n", [quest])[0]
        self.assertEqual(q["why"], "The robot never picks up a gem on the marked cell.")
        self.assertEqual(len(q["result"]["trace"]), 3, "every part has a run to replay on its page")

    def test_a_smaller_world_with_a_goal(self):
        quest = {"id": "s", "title": "x", "ask": "x", "check": {"program": {
            "world": {"width": 2, "height": 1, "start": [0, 0, "E"], "gems": {"1,0": 1}}, "goal": {"all_gems_collected": True}}}}
        q = state("while front_is_clear():\n    move()\npick()\n", [quest])[0]
        self.assertTrue(q["done"])
        self.assertEqual(len(q["result"]["trace"]), 4)  # check, move, check, pick

    def test_a_place_reached_before_a_later_crash_counts(self):
        quest = {"id": "g", "title": "x", "ask": "x", "check": {"program": {"reach": {"pick_at": [3, 0]}}}}
        q = state("move()\nmove()\nmove()\npick()\npick()\n", [quest])[0]
        self.assertTrue(q["done"], q["why"])

    def test_the_floor_on_arrival(self):
        # One pass of a loop: put a row, then arrive at the next row's start; the floor then is the part.
        world = {"width": 3, "height": 2, "start": [0, 0, "E"], "bag": 9}
        quest = {"id": "g", "title": "x", "ask": "x", "check": {"program": {"world": world,
                 "reach": {"visit": [0, 1], "gems_then": {"0,0": 1, "1,0": 1}}}}}
        down = "turn_left()\nturn_left()\nmove()\nturn_left()\nmove()\n"  # back one cell, then down
        self.assertTrue(state("put()\nmove()\nput()\n" + down, [quest])[0]["done"])
        q = state("put()\nmove()\nput()\nmove()\nput()\nturn_left()\nturn_left()\nmove()\nmove()\nturn_left()\nmove()\n", [quest])[0]
        self.assertIn("don't match the picture", q["why"])  # three gems: the row is too long

    def test_a_crash_is_the_only_reason_given(self):
        quest = {"id": "g", "title": "x", "ask": "x", "check": {"program": {"reach": {"visit": [4, 0]}}}}
        q = state("pick()\n", [quest])[0]
        self.assertTrue(q["why"].startswith("Stopped on line 1"))


class Validation(unittest.TestCase):
    def test_shape(self):
        ok = {"format": 1, "level": "t", "quests": [TURN_TEST, dict(TURN_TEST, id="b")]}
        validate_quests(ok, LEVEL)
        for bad in [dict(ok, level="x"), dict(ok, quests=[TURN_TEST]), dict(ok, quests=[TURN_TEST, TURN_TEST]),
                    dict(ok, quests=[TURN_TEST, dict(TURN_TEST, id="b", check={"program": {}})]),
                    dict(ok, quests=[TURN_TEST, dict(TURN_TEST, id="b", extra=1)])]:
            with self.assertRaises(LevelError):
                validate_quests(bad, LEVEL)


if __name__ == "__main__":
    unittest.main()


class Messages(unittest.TestCase):
    """Sub-quest messages talk about the picture, never in coordinates."""

    def test_messages_point_at_the_picture(self):
        world = {"width": 3, "height": 1, "start": [0, 0, "E"], "gems": {"2,0": 1}}
        def why(goal, code="move()\n"):
            q = {"id": "q", "title": "x", "ask": "x", "check": {"program": {"world": world, "goal": goal}}}
            return state(code, [q])[0]["why"]
        self.assertEqual(why({"end_at": [2, 0]}), "The robot doesn't end on the marked cell.")
        self.assertEqual(why({"all_gems_collected": True}), "1 gem is still on the floor.")
        self.assertEqual(why({"gems_exactly": {"1,0": 1, "2,0": 1}}), "Some cells in the picture are still missing gems.")
        self.assertEqual(why({"gems_exactly": {}}), "A gem the picture doesn't show is still on the floor: it should be picked up.")
        self.assertEqual(why({"gems_exactly": {"1,0": 1}}), "The gems don't match the picture: some cells have too few, others too many.")
        for text in [why({"end_at": [2, 0]}), why({"gems_exactly": {"1,0": 1}})]:
            self.assertNotRegex(text, r"\[\d|\(\d")

    def test_a_code_shape_says_what_is_missing(self):
        q = {"id": "q", "title": "x", "ask": "x", "check": {"code": [{"has": "for"}]}}
        self.assertEqual(state("move()\n", [q])[0]["why"], "The code doesn't use a for loop yet.")
