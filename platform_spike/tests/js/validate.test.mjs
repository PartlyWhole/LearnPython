// Results from a sandboxed worker are checked before use: real engine output passes, forged or
// oversized shapes are refused, and the controller reports a refused result as a failed run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isRunResult, isCheckReport, isGuideState, validPayload, CAPS } from "../../src/runtime/validate.js";
import { RunController } from "../../src/runtime/controller.js";
import { FakeClock, fakeWorkerFactory, flush } from "./helpers.mjs";

const fixtures = JSON.parse(readFileSync(new URL("../fixtures/run_results.json", import.meta.url)));

test("every real engine result passes", () => {
  for (const [name, r] of Object.entries(fixtures.results)) assert.ok(isRunResult(r), name);
  const report = { passed: true, worlds: [{ world: "main", passed: true, failures: [], result: Object.values(fixtures.results)[0] }], constraint_failures: [] };
  assert.ok(isCheckReport(report));
  assert.ok(isGuideState({ syntax_ok: true, steps: [true, false] }));
});

test("forged or hostile shapes are refused", () => {
  const good = structuredClone(Object.values(fixtures.results)[0]);
  const bad = (edit) => { const r = structuredClone(good); edit(r); return isRunResult(r); };
  assert.equal(bad((r) => { r.trace = "nope"; }), false);
  assert.equal(bad((r) => { r.trace = new Array(CAPS.trace + 1).fill(r.trace[0] ?? { action: "move", x: 0, y: 0, dir: "E" }); }), false, "too long");
  assert.equal(bad((r) => { r.trace.push({ action: "explode", x: 0, y: 0, dir: "E" }); }), false, "unknown action");
  assert.equal(bad((r) => { r.final.x = 1e9; }), false);
  assert.equal(bad((r) => { r.final.gems = { "<img>": 1 }; }), false, "bad gem key");
  assert.equal(bad((r) => { r.output = "x".repeat(CAPS.output + 1); }), false);
  assert.equal(isCheckReport({ passed: "yes", worlds: [], constraint_failures: [] }), false);
  assert.equal(isGuideState({ syntax_ok: true, steps: ["x"] }), false);
  assert.equal(validPayload({ type: "unknown" }, {}), false);
});

test("the controller turns a refused result into a failed run", async () => {
  const clock = new FakeClock();
  const workers = fakeWorkerFactory(() => ({ forged: true }));
  const c = new RunController({ createWorker: workers.create, validate: validPayload,
                                setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  c.start(); workers.made[0].emitReady();
  const out = await c.run({ type: "check", code: "move()", level: {} });
  assert.equal(out.status, "failed");
  assert.match(out.message, /not shaped like engine output/);
  assert.equal(out.untrusted, true);
  await flush();
});
