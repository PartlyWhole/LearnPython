// Page <-> worker message protocol. Both sides import these constants; change them together
// and update the "Boundaries" table in ARCHITECTURE.md.
//
// Page -> worker
//   { type: "run",   id, code, world, seed }   -> engine.run_program(code, world, seed)
//   { type: "check", id, code, level, seed }   -> engine.check_level(code, level, seed)
//   { type: "guide", id, code, steps, run }    -> engine.guide_state(code, steps, run): which lesson
//                                                 guide steps the code satisfies (docs/lessons.md 5.3)
// Worker -> page
//   { type: "ready",  loadMs, python }         once, after Pyodide and engine.py have loaded
//   { type: "result", id, payload }            payload: RunResult or CheckReport (schemas/), or for
//                                              "guide": {syntax_ok, steps: [bool]}
//   { type: "failed", id, message }            the runtime itself failed (NOT a learner error;
//                                              learner errors arrive inside payload.error)
//   { type: "load_failed", message }           Pyodide or engine.py could not load

export const MSG = Object.freeze({
  RUN: "run",
  CHECK: "check",
  GUIDE: "guide",
  READY: "ready",
  RESULT: "result",
  FAILED: "failed",
  LOAD_FAILED: "load_failed",
});

export const PYODIDE_VERSION = "0.26.4";
export const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
