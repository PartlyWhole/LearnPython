import { test } from "node:test";
import assert from "node:assert/strict";
import { RunController } from "../../src/runtime/controller.js";
import { FakeClock, fakeWorkerFactory, flush } from "./helpers.mjs";

const OK = { format: 1, trace: [], error: null, output: "", final: {} };

function setup(behaviour = () => OK, opts = {}) {
  const clock = new FakeClock();
  const workers = fakeWorkerFactory(behaviour, opts);
  const states = [];
  const c = new RunController({ createWorker: workers.create, timeoutMs: 1000,
                                onState: (s) => states.push(s),
                                setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  return { c, clock, workers, states };
}

test("start creates an active and a spare worker and becomes ready", async () => {
  const { c, workers, states } = setup();
  const started = c.start();
  assert.equal(workers.made.length, 2);
  workers.made[0].emitReady();
  assert.deepEqual(await started, { loadMs: 10, python: "3.12.1" });
  assert.deepEqual(states, ["loading", "ready"]);
});

test("a run returns the worker's payload and clears its timeout", async () => {
  const { c, clock, workers } = setup();
  c.start(); workers.made[0].emitReady();
  const out = await c.run({ type: "check", code: "move()" });
  assert.deepEqual(out, { status: "done", payload: OK });
  assert.equal(clock.timers.size, 0);
  assert.equal(workers.made[0].received[0].type, "check");
});

test("a hanging run times out: worker killed, spare promoted, new spare created", async () => {
  const { c, clock, workers, states } = setup(() => null); // never replies
  c.start(); workers.made[0].emitReady(); workers.made[1].emitReady();
  await flush();
  const pending = c.run({ type: "run", code: "while True: pass" });
  await flush();
  clock.advance(1000);
  assert.deepEqual(await pending, { status: "timeout" });
  assert.equal(workers.made[0].terminated, true);
  assert.equal(workers.made.length, 3, "a fresh spare is loading");
  assert.equal(c.active.worker, workers.made[1]);
  assert.equal(states.at(-1), "ready", "the promoted spare was already warm");
});

test("stop kills the run; a cold spare reports restarting until ready", async () => {
  const { c, workers, states } = setup(() => null);
  c.start(); workers.made[0].emitReady();
  await flush();
  const pending = c.run({ type: "run", code: "..." });
  await flush();
  c.stop();
  assert.deepEqual(await pending, { status: "stopped" });
  assert.equal(states.at(-1), "restarting");
  workers.made[1].emitReady();
  await flush();
  assert.equal(states.at(-1), "ready");
});

test("only one run at a time", async () => {
  const { c, workers } = setup(() => null);
  c.start(); workers.made[0].emitReady();
  await flush();
  c.run({ type: "run", code: "a" });
  assert.deepEqual(await c.run({ type: "run", code: "b" }), { status: "busy" });
});

test("runs requested before load wait for the worker, and stop works while waiting", async () => {
  const { c, workers } = setup();
  c.start();
  const waiting = c.run({ type: "run", code: "move()" });
  c.stop();
  assert.deepEqual(await waiting, { status: "stopped" });
  workers.made[1].emitReady();
  assert.deepEqual(await c.run({ type: "run", code: "move()" }), { status: "done", payload: OK });
});

test("a load failure is reported, not hung", async () => {
  const { c, workers, states } = setup(() => OK, { loadOk: false });
  const started = c.start().catch((e) => e.message);
  workers.made[0].emitReady(); // emits LOAD_FAILED
  assert.equal(await started, "no network");
  assert.equal(states.at(-1), "load_failed");
});
