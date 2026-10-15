"""Every lesson in lessons/index.json passes the lesson contract (docs/lessons.md section 9).

The checks live in tools/check_lesson.py, shared with the design-lesson skill:
- the schema
- levels that exist
- the demo runs
- cell predictions match what the code does
- the last guided example passes its level
- hint skeletons don't pass
- copy budgets

Warnings (no twist yet, too few practice levels) are allowed while the curriculum's new levels are
being authored (docs/curriculum.md). Errors are not.
"""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from check_lesson import check  # noqa: E402

from play_order import load as load_play_order  # noqa: E402

ORDER = load_play_order()
LESSON_IDS = list(ORDER["lessons"])
LESSON_FILES = sorted(p for p in (ROOT / "lessons").glob("*.json") if p.name != "index.json")
LEVEL_IDS = ORDER["levels"]


def load(lesson_id):
    return json.loads((ROOT / "lessons" / f"{lesson_id}.json").read_text())


class EveryLesson(unittest.TestCase):
    def test_index_lists_every_lesson_exactly_once(self):
        named = [i["lesson"] for u in ORDER["units"] for i in u["items"] if "lesson" in i]
        self.assertEqual(sorted(named), sorted(p.stem for p in LESSON_FILES))
        self.assertEqual(len(named), len(set(named)))

    def test_ids_match_file_names(self):
        for path in LESSON_FILES:
            with self.subTest(lesson=path.name):
                self.assertEqual(json.loads(path.read_text())["id"], path.stem)

    def test_lessons_pass_the_contract(self):
        for lesson_id in LESSON_IDS:
            with self.subTest(lesson=lesson_id):
                errors, _, _ = check(load(lesson_id))
                self.assertEqual(errors, [])

    def test_one_lesson_per_guided_level_in_the_level_index(self):
        # The app finds a level's lesson by its guided level, so two lessons can't share one.
        guided = [load(lid)["guided"]["level"] for lid in LESSON_IDS]
        self.assertEqual(len(guided), len(set(guided)))
        for level_id in guided:
            self.assertIn(level_id, LEVEL_IDS)

    def test_checker_catches_a_broken_lesson(self):
        lesson = load(LESSON_IDS[0])
        lesson["watch"]["steps"].append({"say": "Crash.", "code": "while True:\n    move()\n", "run": True})
        lesson["guided"]["steps"][0]["done_when"] = [{"bogus": 1}]
        errors, _, _ = check(lesson)
        self.assertTrue(any("demo run fails" in e for e in errors), errors)
        self.assertTrue(any("schema" in e or "unknown" in e for e in errors), errors)


if __name__ == "__main__":
    unittest.main()
