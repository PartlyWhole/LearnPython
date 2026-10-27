// Contract: the Goal view shows what each level's reference solution really achieves in the
// main world (fixtures from tools/make_goal_fixtures.py), plus unit cases for each goal type.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { goalFor, goalWorld } from "../../src/render/goal.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const fixtures = read("../fixtures/goal_views.json").levels;
const sorted = (m) => Object.fromEntries(Object.entries(m).filter(([, n]) => n > 0).sort());

for (const [id, { goal, final }] of Object.entries(fixtures)) {
  test(`goal view agrees with the reference solution: ${id}`, () => {
    const level = read(`../../levels/${id}.json`);
    assert.deepEqual(goalFor(level, level.world), goal, "same goal merge as engine.goal_for");
    const view = goalWorld(level.world, goal);
    if (view.gemsMatter) assert.deepEqual(sorted(view.world.gems), sorted(final.gems), "gem layout");
    if (view.robot) assert.deepEqual([view.robot.x, view.robot.y], [final.x, final.y], "end cell");
    if (view.robot?.dir || view.facing) assert.equal(view.robot?.dir ?? view.facing, final.dir, "facing");
    if (view.bagAtLeast) assert.ok(final.bag >= view.bagAtLeast, "bag");
    assert.match(view.summary, /^Goal: .+\.$/);
  });
}

const WORLD = { width: 4, height: 2, start: [0, 0, "E"], gems: { "2,0": 2 }, blocked: [[3, 1]] };

test("all_gems_collected: an empty floor, no robot", () => {
  const v = goalWorld(WORLD, { all_gems_collected: true });
  assert.deepEqual(v.world.gems, {});
  assert.equal(v.robot, null);
  assert.deepEqual(v.world.blocked, [[3, 1]]);
  assert.equal(v.summary, "Goal: no gems left on the floor.");
});

test("gems_exactly: the layout, counted in words", () => {
  assert.equal(goalWorld(WORLD, { gems_exactly: { "0,0": 1, "1,0": 1 } }).summary,
               "Goal: a gem on each of 2 marked cells.");
  assert.equal(goalWorld(WORLD, { gems_exactly: { "0,0": 3 } }).summary, "Goal: 3 gems on the marked cell.");
});

test("end_at and facing: a ghost robot; facing alone has no cell to draw on", () => {
  const v = goalWorld(WORLD, { end_at: [1, 1], facing: "N", bag_at_least: 1 });
  assert.deepEqual(v.robot, { x: 1, y: 1, dir: "N" });
  assert.deepEqual(v.world.start, [1, 1, "N"]);
  assert.equal(v.gemsMatter, false, "the floor's gems are not part of this goal");
  assert.deepEqual(v.world.gems, {}, "a bag goal means the gems are picked up, so none are drawn");
  assert.deepEqual(goalWorld(WORLD, { end_at: [1, 1] }).world.gems, { "2,0": 2 }, "no bag goal: drawn (faded)");
  assert.equal(v.summary, "Goal: at least 1 gem in the bag and the robot on the marked cell, facing north (↑).");
  assert.deepEqual(goalWorld(WORLD, { end_at: [1, 1] }).robot, { x: 1, y: 1, dir: null });
  const f = goalWorld(WORLD, { facing: "W" });
  assert.equal(f.robot, null);
  assert.equal(f.facing, "W");
});

test("no_error only, and the world spec is not mutated", () => {
  const before = JSON.stringify(WORLD);
  assert.equal(goalWorld(WORLD, { no_error: true }).summary, "Goal: finish without crashing.");
  goalWorld(WORLD, { gems_exactly: { "0,0": 1 } });
  assert.equal(JSON.stringify(WORLD), before);
});

test("an empty gems_exactly reads as no gems left, not '0 marked cells'", async () => {
  const { goalWorld } = await import("../../src/render/goal.js");
  const v = goalWorld({ width: 2, height: 1, start: [0, 0, "E"], gems: { "1,0": 1 } }, { gems_exactly: {} });
  assert.equal(v.summary, "Goal: no gems left on the floor.");
});
