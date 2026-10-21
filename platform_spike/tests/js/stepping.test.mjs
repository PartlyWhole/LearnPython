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

test("a run that stopped on an error gets one more frame: the failed step", () => {
  const error = { type: "WorldError", message: "wall", line: 4, kind: "wall", calls: [9] };
  const fr = buildFrames(world, trace, error);
  assert.equal(fr.length, trace.length + 2);
  const end = fr.at(-1);
  assert.equal(end.error, error);
  assert.equal(end.event, null);
  assert.deepEqual([end.x, end.y, end.dir], [fr.at(-2).x, fr.at(-2).y, fr.at(-2).dir]);
  assert.equal(buildFrames(world, [], error).length, 2, "an error before any step still has its frame");
});

test("output follows the step: what was printed by then, all of it at the end", async () => {
  const { outputAt } = await import("../../src/render/frames.js");
  const t = [ev(1, "move", 1, 0, "E"), { ...ev(3, "move", 2, 0, "E"), out: 3 }, { ...ev(3, "move", 3, 0, "E"), out: 6 }];
  const fr = buildFrames(world, t);
  const output = "é1\né2\ndone\n";
  assert.deepEqual([0, 1, 2].map((i) => outputAt(fr, i, output)), ["", "", "é1\n"]);
  assert.equal(outputAt(fr, 3, output), output);
});

test("clicking the line that failed finds the failed step", () => {
  const fr = buildFrames(world, trace, { type: "NameError", message: "x", line: 8, calls: [3] });
  assert.equal(nextStepAt(fr, 8, 0), fr.length - 1);
});

test("a call line jumps to the start of each call made there, even back-to-back ones", () => {
  // def two(): move() (2); move() (3)  /  for i in range(2): two() (6)
  const t = [ev(2, "move", 1, 0, "E"), ev(3, "move", 2, 0, "E"), ev(2, "move", 3, 0, "E"), ev(3, "move", 4, 0, "E")]
    .map((e, i) => ({ ...e, calls: [6], call_ids: [i < 2 ? 1 : 2] }));
  const fr = buildFrames({ width: 6, height: 1, start: [0, 0, "E"] }, t);
  assert.equal(nextStepAt(fr, 6, 0), 1);
  assert.equal(nextStepAt(fr, 6, 1), 3, "skips the rest of call 1");
  assert.equal(nextStepAt(fr, 6, 3), 1, "wraps to call 1");
  assert.equal(nextStepAt(fr, 2, 1), 3, "a line's own steps: each one");
  const runs = lineRuns(fr);
  assert.deepEqual([1, 2, 3, 4].map((i) => runs.callPass(i, 6)), [{ n: 1, of: 2 }, { n: 1, of: 2 }, { n: 2, of: 2 }, { n: 2, of: 2 }]);
  assert.equal(runs.callPass(0, 6), null);
});

test("pathIndex agrees with pathTo at every frame", async () => {
  const { pathIndex } = await import("../../src/render/frames.js");
  const { cells, counts } = pathIndex(frames);
  frames.forEach((_, i) => assert.deepEqual(cells.slice(0, counts[i]), pathTo(frames, i)));
});
