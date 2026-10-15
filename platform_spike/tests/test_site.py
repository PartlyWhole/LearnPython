"""The public site (tools/build_site.py, deployed by .github/workflows/pages.yml) has everything the
app loads and nothing private: no solutions, tests, tools or docs."""
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from build_site import build  # noqa: E402
from play_order import load  # noqa: E402


class PublicSite(unittest.TestCase):
    def test_site_has_what_the_app_loads_and_no_solutions(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "site"
            build(out)
            files = {p.relative_to(out).as_posix() for p in out.rglob("*") if p.is_file()}
            for needed in ["index.html", "app.html", "engine.py", ".nojekyll", "src/app.js",
                           "src/runtime/worker.js", "vendor/codemirror.js", "lessons/index.json"]:
                self.assertIn(needed, files)
            order = load()
            for level_id in order["levels"]:
                self.assertIn(f"levels/{level_id}.json", files)
            for lesson_id in order["lessons"]:
                self.assertIn(f"lessons/{lesson_id}.json", files)
            private = [f for f in files if re.match(r"(tests|tools|docs|node_modules)/", f) or
                       (f.endswith(".py") and f != "engine.py")]
            self.assertEqual(private, [])


if __name__ == "__main__":
    unittest.main()
