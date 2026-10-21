// Helpers for stepping through a replay (src/render/frames.js): which pass over a line a step
// is, jumping to the next step a line ran, and the path drawn so far.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFrames, lineRuns, nextStepAt, pathTo } from "../../src/render/frames.js";

const world = { width: 4, height: 2, start: [0, 0, "E"] };
const ev = (line, action, x, y, dir, calls) => ({ line, action, x, y, dir, bag: 0, ...(calls && { calls }) });
// for i in range(2): move() (line 2) / turn_left() inside turn() called on line 3
const trace = [ev(2, "move", 1, 0, "E"), ev(5, "turn_left", 1, 0, "N", [3]), ev(2, "move", 1, -0, "N"), ev(5, "turn_left", 1, 0, "W", [3])];
const frames = buildFrames(world, trace);

test("each step knows which pass over its line it is", () => {
  const runs = lineRuns(frames);
  assert.deepEqual(runs.nth, [0, 1, 1, 2, 2]);
  assert.equal(runs.total(2), 2);
  assert.equal(runs.total(9), 0);
});

test("clicking a line finds the next step it ran, including calls made there, wrapping", () => {
  assert.equal(nextStepAt(frames, 2, 0), 1);
  assert.equal(nextStepAt(frames, 2, 1), 3);
  assert.equal(nextStepAt(frames, 2, 3), 1); // wraps
  assert.equal(nextStepAt(frames, 3, 0), 2); // the call site of turn()
  assert.equal(nextStepAt(frames, 7, 0), -1);
});

test("the path so far lists each cell once per visit, in order", () => {
  assert.deepEqual(pathTo(frames, 0), [[0, 0]]);
  assert.deepEqual(pathTo(frames, 2), [[0, 0], [1, 0]]); // a turn doesn't add a point
});
