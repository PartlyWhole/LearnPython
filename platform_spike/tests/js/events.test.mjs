// Local event log: capped, persisted, tolerant of a broken store.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventLog, CAP } from "../../src/progress/events.js";
import { memoryStorage, Progress } from "../../src/progress/progress.js";

test("records with a time, keeps the last CAP events, and survives a reload", () => {
  const storage = memoryStorage();
  let t = 0;
  const log = new EventLog(storage, () => ++t);
  for (let i = 0; i < CAP + 10; i++) log.record("run", { level: "a", passed: i % 2 === 0 });
  assert.equal(log.events.length, CAP);
  assert.equal(log.events[0].t, 11, "oldest events dropped first");
  assert.deepEqual(new EventLog(storage).events.at(-1), { t: CAP + 10, type: "run", level: "a", passed: false });
});

test("a corrupt or failing store never throws", () => {
  const broken = { get: () => "{not json", set: () => false };
  const log = new EventLog(broken);
  log.record("x");
  assert.equal(log.events.length, 1);
});

test("hint state persists per level", () => {
  const storage = memoryStorage();
  const p = new Progress({ units: [{ id: "u", title: "U", levels: ["a"] }] }, storage);
  assert.equal(p.hintState("a"), undefined);
  p.setHintState("a", { failed: 3, seen: 1, failedAtSeen: 2 });
  assert.deepEqual(new Progress({ units: [{ id: "u", title: "U", levels: ["a"] }] }, storage).hintState("a"),
                   { failed: 3, seen: 1, failedAtSeen: 2 });
});
