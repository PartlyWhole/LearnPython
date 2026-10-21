// Web Worker: loads Pyodide and engine.py, then answers run/check requests.
// It holds no learner state between requests: every request goes through run_program /
// check_level, which build a fresh world and namespace (CLAUDE.md invariant 2).
//
// A classic (not module) worker, and self-contained, on purpose: in a shared room the same source
// runs as a blob worker inside a sandboxed, opaque-origin frame (src/runtime/sandbox.js), where
// Chrome refuses module workers and the worker can't fetch from this site. There it is named
// "sandbox" and is handed engine.py by message.
const PYODIDE_INDEX = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
importScripts(`${PYODIDE_INDEX}pyodide.js`); // defines self.loadPyodide

// Must equal MSG in protocol.js (tests/js/sandbox.test.mjs checks).
const MSG = Object.freeze({
  RUN: "run", CHECK: "check", GUIDE: "guide", QUESTS: "quests", READY: "ready", RESULT: "result", FAILED: "failed",
  LOAD_FAILED: "load_failed",
});
const SANDBOXED = self.name === "sandbox";

const engineSource = SANDBOXED
  ? new Promise((resolve) => {
      self.addEventListener("message", function first(event) {
        if (event.data?.type !== "engine") return;
        self.removeEventListener("message", first);
        resolve(String(event.data.source));
      });
    })
  : fetch(new URL("../../engine.py", self.location.href), { cache: "no-store" }).then((r) => r.text());

const ready = (async () => {
  const t0 = performance.now();
  const pyodide = await self.loadPyodide({ indexURL: PYODIDE_INDEX });
  const source = await engineSource;
  pyodide.FS.writeFile("engine.py", source);
  pyodide.runPython("import sys; sys.path.insert(0, '.'); import engine, json");
  const run = pyodide.globals.get("engine").run_program;
  const check = pyodide.globals.get("engine").check_level;
  const guide = pyodide.globals.get("engine").guide_state;
  const quests = pyodide.globals.get("engine").quest_state;
  const dumps = pyodide.globals.get("json").dumps;
  const toPy = (obj) => pyodide.toPy(obj);
  self.postMessage({
    type: MSG.READY,
    loadMs: Math.round(performance.now() - t0),
    python: pyodide.runPython("import platform; platform.python_version()"),
  });
  return { run, check, guide, quests, dumps, toPy };
})().catch((err) => {
  self.postMessage({ type: MSG.LOAD_FAILED, message: String(err) });
  throw err;
});

self.onmessage = async (event) => {
  const msg = event.data;
  if (msg?.type === "engine") return; // the sandbox's hand-over of engine.py (above)
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
    } else if (msg.type === MSG.QUESTS) {
      pyResult = api.quests(msg.code, api.toPy(msg.level), api.toPy(msg.quests));
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
