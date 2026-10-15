// Module Web Worker: loads Pyodide and engine.py, then answers run/check requests.
// It holds no learner state between requests: every request goes through run_program /
// check_level, which build a fresh world and namespace (CLAUDE.md invariant 2).
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.mjs";
import { MSG } from "./protocol.js";

const ENGINE_URL = new URL("../../engine.py", import.meta.url);

const ready = (async () => {
  const t0 = performance.now();
  const pyodide = await loadPyodide();
  const source = await (await fetch(ENGINE_URL, { cache: "no-store" })).text();
  pyodide.FS.writeFile("engine.py", source);
  pyodide.runPython("import sys; sys.path.insert(0, '.'); import engine, json");
  const run = pyodide.globals.get("engine").run_program;
  const check = pyodide.globals.get("engine").check_level;
  const guide = pyodide.globals.get("engine").guide_state;
  const dumps = pyodide.globals.get("json").dumps;
  const toPy = (obj) => pyodide.toPy(obj);
  self.postMessage({
    type: MSG.READY,
    loadMs: Math.round(performance.now() - t0),
    python: pyodide.runPython("import platform; platform.python_version()"),
  });
  return { run, check, guide, dumps, toPy };
})().catch((err) => {
  self.postMessage({ type: MSG.LOAD_FAILED, message: String(err) });
  throw err;
});

self.onmessage = async (event) => {
  const msg = event.data;
  let api;
  try {
    api = await ready;
  } catch {
    return; // LOAD_FAILED was already reported
  }
  try {
    let pyResult;
    if (msg.type === MSG.RUN) {
      pyResult = api.run(msg.code, api.toPy(msg.world), msg.seed ?? 0);
    } else if (msg.type === MSG.CHECK) {
      pyResult = api.check(msg.code, api.toPy(msg.level), msg.seed ?? 0);
    } else if (msg.type === MSG.GUIDE) {
      pyResult = api.guide(msg.code, api.toPy(msg.steps), msg.run ? api.toPy(msg.run) : null);
    } else {
      throw new Error(`unknown message type ${msg.type}`);
    }
    // Serialise in Python so the page receives plain JSON exactly as the schemas describe.
    const payload = JSON.parse(api.dumps(pyResult));
    pyResult.destroy?.();
    self.postMessage({ type: MSG.RESULT, id: msg.id, payload });
  } catch (err) {
    self.postMessage({ type: MSG.FAILED, id: msg.id, message: String(err) });
  }
};
