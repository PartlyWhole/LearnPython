"""Assemble the public website (GitHub Pages) from platform_spike/: only what the app needs.

    python3 tools/build_site.py _site      # then serve _site/ or upload it

Copies app.html (also as index.html, so the site root opens the game), src/, vendor/, levels/,
lessons/ and engine.py, plus an empty .nojekyll (GitHub Pages must not run Jekyll over the files).
Deliberately left out: tests/ (reference and wrong solutions, fixtures), tools/, docs/, the audit
harness (index.html, worker.js), node_modules/. .github/workflows/pages.yml runs this on every push.
"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = ["app.html", "engine.py"]
DIRS = ["src", "vendor", "levels", "lessons"]


def build(out):
    out = Path(out).resolve()
    if out == ROOT or ROOT in out.parents and out.name in DIRS:
        sys.exit(f"refusing to build into {out}")
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    for name in FILES:
        shutil.copy2(ROOT / name, out / name)
    shutil.copy2(ROOT / "app.html", out / "index.html")
    for name in DIRS:
        shutil.copytree(ROOT / name, out / name, ignore=shutil.ignore_patterns("__pycache__", ".DS_Store"))
    (out / ".nojekyll").write_text("")
    leaked = [p for p in out.rglob("*") if "solutions" in p.parts or p.suffix == ".py" and p.name != "engine.py"]
    if leaked:
        sys.exit(f"would publish files that must stay private: {leaked[:5]}")
    count = sum(1 for p in out.rglob("*") if p.is_file())
    print(f"built {out} ({count} files)")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "_site")
