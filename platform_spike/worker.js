// Pyodide worker for the assumption audit. Loads engine.py + cases.py and answers test requests.
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

let pyodide;
const ready = (async () => {
  const t0 = performance.now();
  pyodide = await loadPyodide();
  const loadMs = performance.now() - t0;
  for (const f of ["engine.py", "cases.py"]) {
    const src = await (await fetch(f, { cache: "no-store" })).text();
    pyodide.FS.writeFile(f, src);
  }
  pyodide.runPython("import sys; sys.path.insert(0, '.')");
  return loadMs;
})();

self.onmessage = async (e) => {
  const loadMs = await ready;
  const { id, kind, code } = e.data;
  const t0 = performance.now();
  let result;
  try {
    if (kind === "load") {
      result = { loadMs, python: pyodide.runPython("import platform; platform.python_version()"),
                 crossOriginIsolated: self.crossOriginIsolated, sab: typeof SharedArrayBuffer !== "undefined" };
    } else if (kind === "cases") {
      result = JSON.parse(pyodide.runPython(`
import json, time
from cases import CASES, WORLD
from engine import run_program, trace_digest
out = {}
for name, code in CASES.items():
    r = run_program(code, WORLD, seed=42)
    out[name] = {"digest": trace_digest(r), "events": len(r["trace"]), "error": r["error"], "final": r["final"]}
t0 = time.perf_counter()
run_program("for _ in range(100000):\\n    turn_left()\\n", dict(WORLD, max_steps=200_000))
out["turn_left_100k_seconds"] = round(time.perf_counter() - t0, 3)
json.dumps(out)`));
    } else if (kind === "exec_shared_globals") {
      // Naive warm-worker reuse: pyodide.runPython with its default (shared) globals.
      result = String(pyodide.runPython(code) ?? "None");
    } else if (kind === "exec_engine") {
      pyodide.globals.set("student_code", code);
      result = JSON.parse(pyodide.runPython(`
import json
from cases import WORLD
from engine import run_program
json.dumps(run_program(student_code, WORLD))`));
    } else if (kind === "stream") {
      // Live mode: post an event to the page after every step, sleeping between steps.
      result = String(pyodide.runPython(`
import js, time
from pyodide.ffi import to_js
for i in range(10):
    js.postMessage(to_js({"tick": i}, dict_converter=js.Object.fromEntries))
    time.sleep(0.1)
"done"`));
    } else if (kind === "raw") {
      result = String(pyodide.runPython(code));
    }
    self.postMessage({ id, ok: true, result, ms: performance.now() - t0 });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err).slice(-400), ms: performance.now() - t0 });
  }
};
