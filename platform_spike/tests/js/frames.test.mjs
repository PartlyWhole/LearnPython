// Contract: replaying a real engine trace must reach the final state the engine reports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFrames, gemsLeft, describe } from "../../src/render/frames.js";

const fixtures = JSON.parse(readFileSync(new URL("../fixtures/run_results.json", import.meta.url)));

for (const [name, result] of Object.entries(fixtures.results)) {
  test(`frames reproduce the engine's final state: ${name}`, () => {
    const frames = buildFrames(fixtures.world, result.trace);
    assert.equal(frames.length, result.trace.length + 1);
    const last = frames.at(-1);
    const { x, y, dir, bag, gems_left } = result.final;
    assert.deepEqual({ x: last.x, y: last.y, dir: last.dir, bag: last.bag, gems_left: gemsLeft(last) },
                     { x, y, dir, bag, gems_left });
    const sorted = (m) => Object.fromEntries(Object.entries(m).sort());
    assert.deepEqual(sorted(last.gems), sorted(result.final.gems), "same gem layout, cell by cell");
  });
}

test("frame 0 is the start state and frames share gem maps until a pick", () => {
  const world = { width: 3, height: 1, start: [0, 0, "E"], gems: { "1,0": 2 } };
  const trace = [
    { line: 1, action: "move", x: 1, y: 0, dir: "E", bag: 0 },
    { line: 2, action: "pick", x: 1, y: 0, dir: "E", bag: 1 },
    { line: 2, action: "pick", x: 1, y: 0, dir: "E", bag: 2 },
  ];
  const f = buildFrames(world, trace);
  assert.deepEqual([f[0].x, f[0].event], [0, null]);
  assert.equal(f[1].gems, f[0].gems, "unchanged gem map is shared, not copied");
  assert.deepEqual(f[2].gems, { "1,0": 1 });
  assert.deepEqual(f[3].gems, {}, "empty cells are removed");
  assert.deepEqual(world.gems, { "1,0": 2 }, "the world spec is not mutated");
});

test("describe() gives learner-facing captions", () => {
  assert.equal(describe(null), "Start");
  assert.equal(describe({ action: "front_is_clear", result: false }), "front_is_clear() → False");
  assert.equal(describe({ action: "scan", result: [0, 2] }), "scan() → [0, 2]");
});

test("isOneAction: the renderer animates one move or one turn, and snaps anything bigger", async () => {
  const { isOneAction } = await import("../../src/render/geometry.js");
  const at = (x, y, dir) => ({ x, y, dir });
  assert.equal(isOneAction(at(0, 0, "E"), at(1, 0, "E")), true, "a move");
  assert.equal(isOneAction(at(1, 1, "E"), at(1, 1, "N")), true, "a left turn");
  assert.equal(isOneAction(at(1, 1, "N"), at(1, 1, "E")), true, "a turn back (stepping backwards)");
  assert.equal(isOneAction(at(1, 1, "N"), at(1, 1, "N")), true, "a sensor: nothing changes");
  assert.equal(isOneAction(at(4, 2, "S"), at(0, 0, "E")), false, "replay restarting from the start");
  assert.equal(isOneAction(at(0, 0, "E"), at(1, 0, "N")), false, "move and turn at once: the spin bug");
  assert.equal(isOneAction(at(0, 0, "E"), at(3, 0, "E")), false, "scrubbing several cells");
  assert.equal(isOneAction(at(0, 0, "E"), at(0, 0, "W")), false, "half a turn is two actions");
});
