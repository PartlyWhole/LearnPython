"""Thin wrapper: the lesson checker lives in tools/check_lesson.py, shared with tests/test_lessons.py.

    python3 .claude/skills/design-lesson/scripts/check_lesson.py <lesson id | path/to/lesson.json>
"""
import runpy
import sys
from pathlib import Path

sys.argv[0] = str(Path(__file__).resolve().parents[4] / "tools" / "check_lesson.py")
runpy.run_path(sys.argv[0], run_name="__main__")
