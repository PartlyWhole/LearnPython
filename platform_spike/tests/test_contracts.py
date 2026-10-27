"""Contract tests: golden traces, schemas vs the engine, level files, topic tags.

These are the checks that keep parallel agents from drifting apart. If one fails, fix the
code or update the contract deliberately (and record why in docs/decisions.md); never just
regenerate the golden file to make the failure go away.
"""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from cases import CASES, WORLD  # noqa: E402
from engine import LevelError, run_program, trace_digest, validate_level  # noqa: E402

try:
    import jsonschema
except ImportError:  # the schema checks are skipped, not failed, without jsonschema
    jsonschema = None

GOLDEN = json.loads((ROOT / "tests" / "golden_traces.json").read_text())
LEVEL_SCHEMA = json.loads((ROOT / "schemas" / "level.schema.json").read_text())
RESULT_SCHEMA = json.loads((ROOT / "schemas" / "run_result.schema.json").read_text())
LEVEL_FILES = sorted(p for p in (ROOT / "levels").glob("*.json") if p.name != "index.json")
sys.path.insert(0, str(ROOT / "tools"))
from play_order import load as load_play_order  # noqa: E402
PLAY_ORDER = load_play_order()
TOPICS_FILE = ROOT.parent / "topics" / "all_topics.json"

# Each bad level must be rejected by BOTH the engine and the JSON Schema.
BAD_LEVEL_EDITS = {
    "wrong format": lambda lv: lv.update(format=2),
    "missing goal": lambda lv: lv.pop("goal"),
    "unknown goal": lambda lv: lv.update(goal={"win": True}),
    "bad use_functions": lambda lv: lv.update(constraints={"use_functions": ["not a name"]}),
    "bad loop_calls": lambda lv: lv.update(constraints={"loop_calls": [3]}),
    "bad direction": lambda lv: lv["world"].update(start=[0, 0, "X"]),
    "zero width": lambda lv: lv["world"].update(width=0),
    "zero gems": lambda lv: lv["world"].update(gems={"1,0": 0}),
    "bad gem key": lambda lv: lv["world"].update(gems={"one": 1}),
    "unknown world key": lambda lv: lv["world"].update(colour="red"),
    "unknown banned": lambda lv: lv.update(constraints={"banned": ["goto"]}),
    "unknown required": lambda lv: lv.update(constraints={"required": ["class"]}),
    "unknown hidden command": lambda lv: lv.update(constraints={"hidden_commands": ["teleport"]}),
    "bad bag": lambda lv: lv["world"].update(bag=-1),
    "bad bag word": lambda lv: lv["world"].update(bag="lots"),
    "bad facing": lambda lv: lv.update(goal={"facing": "up"}),
    "bad layout goal": lambda lv: lv.update(goal={"gems_exactly": {"1,0": 0}}),
    "unknown world goal": lambda lv: lv["world"].update(goal={"win": True}),
    "end_at outside grid": lambda lv: lv["world"].update(goal={"end_at": [99, 0]}),
    "drive sensor button": lambda lv: lv.update(drive={"buttons": ["front_is_clear"]}),
    "drive without buttons": lambda lv: lv.update(drive={}),
    "drive repeated button": lambda lv: lv.update(drive={"buttons": ["move", "move"]}),
}


# Rules JSON Schema cannot express (they depend on other fields, e.g. the grid size), so only the
# engine enforces them. The JS side must therefore also rely on the engine for these.
ENGINE_ONLY = {"end_at outside grid"}


class GoldenTraces(unittest.TestCase):
    """Desktop CPython must reproduce the golden digests; the browser harness checks Pyodide."""

    def test_cases_match_golden(self):
        self.assertEqual(set(CASES), set(GOLDEN["cases"]), "cases.py and the golden file differ")
        for name, code in CASES.items():
            with self.subTest(case=name):
                self.assertEqual(trace_digest(run_program(code, WORLD, seed=42)),
                                 GOLDEN["cases"][name]["digest"])


class LevelFiles(unittest.TestCase):
    def test_level_files_pass_engine_validation(self):
        self.assertTrue(LEVEL_FILES, "no levels found")
        for path in LEVEL_FILES:
            with self.subTest(level=path.name):
                validate_level(json.loads(path.read_text()))

    @unittest.skipIf(jsonschema is None, "jsonschema not installed")
    def test_level_files_pass_schema(self):
        for path in LEVEL_FILES:
            with self.subTest(level=path.name):
                jsonschema.validate(json.loads(path.read_text()), LEVEL_SCHEMA)

    def test_play_order_lists_every_level_exactly_once(self):
        # The play order is lessons/index.json (format 2): plain levels plus each lesson's
        # guided, practice and twist levels (tools/play_order.py, src/lessons/order.js).
        listed = PLAY_ORDER["levels"]
        self.assertEqual(json.loads((ROOT / "lessons" / "index.json").read_text())["format"], 2)
        self.assertEqual(sorted(listed), sorted(p.stem for p in LEVEL_FILES),
                         "the play order and the level files differ")
        self.assertEqual(len(listed), len(set(listed)), "a level is in the play order twice")
        unit_ids = [u["id"] for u in PLAY_ORDER["units"]]
        self.assertEqual(len(unit_ids), len(set(unit_ids)))
        self.assertFalse((ROOT / "levels" / "index.json").exists(),
                         "levels/index.json was replaced by lessons/index.json; don't bring it back")

    def test_level_ids_match_file_names(self):
        for path in LEVEL_FILES:
            self.assertEqual(json.loads(path.read_text())["id"], path.stem)

    @unittest.skipUnless(TOPICS_FILE.exists(), "topic graph not present")
    def test_drive_twins_share_their_world(self):
        # The corner is solved by buttons first (corner_drive), then in code (turn_right): same world.
        for drive_id, code_id in {"corner_drive": "turn_right"}.items():
            load = lambda i: json.loads((ROOT / "levels" / f"{i}.json").read_text())
            self.assertEqual(load(drive_id)["world"], load(code_id)["world"], f"{drive_id} vs {code_id}")

    def test_goal_view_fixtures_are_current(self):
        # tests/js/goal.test.mjs compares the Goal view with these; stale fixtures would test nothing.
        sys.path.insert(0, str(ROOT / "tools"))
        from make_goal_fixtures import OUT, build
        self.assertEqual(json.loads(OUT.read_text()), build(),
                         "run python3 tools/make_goal_fixtures.py after changing a level or its reference")

    def test_topic_tags_exist_in_topic_graph(self):
        known = {t["id"] for t in json.loads(TOPICS_FILE.read_text())["topics"]}
        for path in LEVEL_FILES:
            for tag in json.loads(path.read_text()).get("topics", []):
                with self.subTest(level=path.name, topic=tag):
                    self.assertIn(tag, known)


class SchemaMatchesEngine(unittest.TestCase):
    base = json.loads(LEVEL_FILES[0].read_text()) if LEVEL_FILES else {}

    def test_engine_rejects_bad_levels(self):
        for name, edit in BAD_LEVEL_EDITS.items():
            lv = copy.deepcopy(self.base)
            edit(lv)
            with self.subTest(bad=name), self.assertRaises(LevelError):
                validate_level(lv)

    @unittest.skipIf(jsonschema is None, "jsonschema not installed")
    def test_schema_rejects_bad_levels(self):
        for name, edit in BAD_LEVEL_EDITS.items():
            if name in ENGINE_ONLY:
                continue
            lv = copy.deepcopy(self.base)
            edit(lv)
            with self.subTest(bad=name), self.assertRaises(jsonschema.ValidationError):
                jsonschema.validate(lv, LEVEL_SCHEMA)

    @unittest.skipIf(jsonschema is None, "jsonschema not installed")
    def test_run_results_match_schema(self):
        for name, code in CASES.items():
            with self.subTest(case=name):
                jsonschema.validate(run_program(code, WORLD, seed=42), RESULT_SCHEMA)


if __name__ == "__main__":
    unittest.main()
