"""Every code level has sub-quests (quests/<id>.json), and every quests file passes
tools/check_quests.py: the reference solution completes each part, the starter doesn't complete
them all, and no text gives the answer away (docs/quests.md)."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from check_quests import check  # noqa: E402
from play_order import level_ids  # noqa: E402

CODE_LEVELS = [i for i in level_ids() if not json.loads((ROOT / "levels" / f"{i}.json").read_text()).get("drive")]


class SubQuests(unittest.TestCase):
    def test_every_code_level_has_sub_quests(self):
        missing = [i for i in CODE_LEVELS if not (ROOT / "quests" / f"{i}.json").exists()]
        self.assertEqual(missing, [])

    def test_no_quests_for_unknown_or_drive_levels(self):
        extra = [p.stem for p in (ROOT / "quests").glob("*.json") if p.stem not in CODE_LEVELS]
        self.assertEqual(extra, [])

    def test_every_quests_file_passes_its_checks(self):
        for path in sorted((ROOT / "quests").glob("*.json")):
            with self.subTest(level=path.stem):
                errors, _, _ = check(path.stem)
                self.assertEqual(errors, [])

    def test_the_schema_accepts_every_quests_file(self):
        try:
            import jsonschema
        except ImportError:
            self.skipTest("jsonschema not installed")
        schema = json.loads((ROOT / "schemas" / "quests.schema.json").read_text())
        for path in sorted((ROOT / "quests").glob("*.json")):
            with self.subTest(level=path.stem):
                jsonschema.validate(json.loads(path.read_text()), schema)

if __name__ == "__main__":
    unittest.main()
