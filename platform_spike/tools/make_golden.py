"""Regenerate tests/golden_traces.json from cases.py using desktop CPython.

The golden file is the cross-runtime contract: desktop CPython (tests/test_contracts.py) and
Pyodide in the browser (index.html) must both reproduce these digests exactly.

Only regenerate when you have *intentionally* changed engine behaviour or the result format,
and say so in the commit message. Run with the Python minor version pinned in CLAUDE.md:
    python3.12 tools/make_golden.py
"""
import json
import platform
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from cases import CASES, WORLD  # noqa: E402
from engine import run_program, trace_digest  # noqa: E402

out = {"python": platform.python_version(), "cases": {}}
for name, code in CASES.items():
    r = run_program(code, WORLD, seed=42)
    out["cases"][name] = {"digest": trace_digest(r), "events": len(r["trace"]),
                          "error": r["error"], "final": r["final"], "output": r["output"]}

t0 = time.perf_counter()
run_program("for _ in range(100000):\n    turn_left()\n", dict(WORLD, max_steps=200_000))
out["turn_left_100k_seconds"] = round(time.perf_counter() - t0, 3)

(ROOT / "tests" / "golden_traces.json").write_text(json.dumps(out, indent=1) + "\n")

# Full results for the JavaScript tests (tests/js): they replay real engine traces and must
# reach the same final state the engine reports.
fixtures = {"world": WORLD, "results": {name: run_program(code, WORLD, seed=42) for name, code in CASES.items()}}
(ROOT / "tests" / "fixtures" / "run_results.json").write_text(json.dumps(fixtures) + "\n")
print(f"wrote tests/golden_traces.json with {len(out['cases'])} cases (Python {out['python']})")
