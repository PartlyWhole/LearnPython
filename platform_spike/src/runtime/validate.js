// Checks on what a worker sends back, before the page uses it. Alone, the worker is ours; in a
// shared room it runs code a partner may have typed, inside the sandbox (sandbox.js), and that
// code can post anything. A result that isn't shaped like engine output is refused, and the
// run is reported as a failed run rather than drawn (docs/collab.md, decision D23).
// The shapes follow schemas/run_result.schema.json; caps keep a hostile result from freezing the page.

const ACTIONS = new Set(["move", "turn_left", "front_is_clear", "pick", "put", "gems_here", "scan", "coin_flip"]);
const DIRS = new Set(["E", "N", "W", "S"]);
export const CAPS = Object.freeze({ trace: 20_000, output: 100_000, text: 2_000, worlds: 50, failures: 50 });

const isInt = (v) => Number.isInteger(v) && Math.abs(v) <= 10_000;
const isText = (v, cap = CAPS.text) => typeof v === "string" && v.length <= cap;
const isGemMap = (m) => m && typeof m === "object" && !Array.isArray(m) &&
  Object.entries(m).every(([k, n]) => /^\d{1,4},\d{1,4}$/.test(k) && isInt(n) && n >= 0);

const isCalls = (c) => c === undefined || (Array.isArray(c) && c.length <= 200 && c.every(isInt));

function isEvent(e) {
  return e && typeof e === "object" && ACTIONS.has(e.action) && isInt(e.x) && isInt(e.y) &&
    DIRS.has(e.dir) && (e.line === null || e.line === undefined || isInt(e.line)) &&
    (e.bag === undefined || isInt(e.bag) || e.bag === "infinite") &&
    isCalls(e.calls) && isCalls(e.call_ids) && (e.out === undefined || (Number.isInteger(e.out) && e.out >= 0 && e.out <= CAPS.output));
}

export function isRunResult(r) {
  if (!r || typeof r !== "object") return false;
  if (!Array.isArray(r.trace) || r.trace.length > CAPS.trace || !r.trace.every(isEvent)) return false;
  const f = r.final;
  if (!f || !isInt(f.x) || !isInt(f.y) || !DIRS.has(f.dir) || !isGemMap(f.gems)) return false;
  if (r.error !== null && !(r.error && isText(r.error.message) && isText(r.error.type ?? "") &&
      (r.error.line === null || r.error.line === undefined || isInt(r.error.line)) && isCalls(r.error.calls))) return false;
  return isText(r.output ?? "", CAPS.output);
}

export function isCheckReport(c) {
  if (!c || typeof c !== "object" || typeof c.passed !== "boolean") return false;
  if (!Array.isArray(c.worlds) || !c.worlds.length || c.worlds.length > CAPS.worlds) return false;
  const worldOk = (w, i) => w && isText(w.world, 200) && typeof w.passed === "boolean" &&
    Array.isArray(w.failures) && w.failures.length <= CAPS.failures && w.failures.every((t) => isText(t)) &&
    (i === 0 ? isRunResult(w.result) : w.result === null || w.result === undefined || isRunResult(w.result));
  const l = c.lines;
  if (!(l === undefined || l === null || (l && isInt(l.max) && isInt(l.used) && typeof l.met === "boolean"))) return false;
  return c.worlds.every(worldOk) && Array.isArray(c.constraint_failures) &&
    c.constraint_failures.length <= CAPS.failures && c.constraint_failures.every((t) => isText(t));
}

export function isGuideState(g) {
  return g && typeof g === "object" && typeof g.syntax_ok === "boolean" && Array.isArray(g.steps) &&
    g.steps.length <= 50 && g.steps.every((b) => typeof b === "boolean");
}

/** Is `payload` a believable answer to `request` ({type: run | check | guide})? */
export function validPayload(request, payload) {
  if (request.type === "run") return isRunResult(payload);
  if (request.type === "check") return isCheckReport(payload);
  if (request.type === "guide") return isGuideState(payload);
  return false;
}
