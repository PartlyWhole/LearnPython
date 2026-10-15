"""The play order: lessons/index.json (format 2) expanded into levels.

lessons/index.json lists units of items. An item is either a plain level ({"level": id}, e.g. the
drive levels) or a lesson ({"lesson": id}), which expands to its guided level, then its practice
levels, then its twist. Every level file appears in the play order exactly once
(tests/test_contracts.py). The JS side does the same in src/lessons/order.js.

    from play_order import load
    order = load()            # {"units": [...], "levels": [ids in play order], "lessons": {id: lesson}}
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def lesson_levels(lesson):
    """A lesson's levels in play order: guided, practice..., twist."""
    return [lesson["guided"]["level"], *lesson.get("practice", []),
            *([lesson["twist"]] if lesson.get("twist") else [])]


def load(root=ROOT):
    index = json.loads((root / "lessons" / "index.json").read_text())
    lessons, units, levels = {}, [], []
    for unit in index["units"]:
        items = []
        for item in unit["items"]:
            if "lesson" in item:
                lesson = json.loads((root / "lessons" / f"{item['lesson']}.json").read_text())
                lessons[lesson["id"]] = lesson
                items.append({"lesson": lesson["id"], "levels": lesson_levels(lesson)})
            else:
                items.append({"level": item["level"], "levels": [item["level"]]})
            levels += items[-1]["levels"]
        units.append({"id": unit["id"], "title": unit["title"], "items": items})
    return {"units": units, "levels": levels, "lessons": lessons}


def level_ids(root=ROOT):
    return load(root)["levels"]


if __name__ == "__main__":
    order = load()
    for unit in order["units"]:
        print(unit["title"])
        for item in unit["items"]:
            label = f"lesson {item['lesson']}" if "lesson" in item else "level"
            print(f"  {label:<28} {', '.join(item['levels'])}")
    print(f"{len(order['levels'])} levels, {len(order['lessons'])} lessons")
