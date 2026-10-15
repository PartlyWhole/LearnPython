"""Write tests/fixtures/goal_views.json: for every level, the engine's goal for the main world
and where the level's reference solution ends in it.

tests/js/goal.test.mjs uses it to check that the Goal view (src/render/goal.js) shows what the
reference solution really achieves. tests/test_contracts.py checks this file is up to date, so
re-run it after changing a level's world, goal or reference solution:

    python3 tools/make_goal_fixtures.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from engine import goal_for, run_program  # noqa: E402
from play_order import level_ids  # noqa: E402

OUT = ROOT / "tests" / "fixtures" / "goal_views.json"


def build():
    levels = {}
    for level_id in level_ids():
        level = json.loads((ROOT / "levels" / f"{level_id}.json").read_text())
        solution = (ROOT / "tests" / "solutions" / f"{level_id}.py").read_text()
        hidden = level.get("constraints", {}).get("hidden_commands", [])
        result = run_program(solution, level["world"], 0, hidden)
        levels[level_id] = {"goal": goal_for(level, level["world"]), "final": result["final"]}
    return {"levels": levels}


if __name__ == "__main__":
    OUT.write_text(json.dumps(build(), indent=1, sort_keys=True) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")
