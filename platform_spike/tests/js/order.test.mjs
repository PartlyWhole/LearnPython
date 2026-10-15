// Contract: the JS play order (what the app loads) lists every level file exactly once, the same
// as tools/play_order.py (test_contracts.py checks the Python side).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { playOrder, lessonIds } from "../../src/lessons/order.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));

test("the real play order covers every level file once, and every lesson it names", () => {
  const index = read("../../lessons/index.json");
  const lessons = Object.fromEntries(lessonIds(index).map((id) => [id, read(`../../lessons/${id}.json`)]));
  const order = playOrder(index, lessons);
  const files = readdirSync(new URL("../../levels/", import.meta.url)).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
  assert.deepEqual([...order.levels].sort(), files.sort());
  assert.equal(new Set(order.levels).size, order.levels.length);
  assert.equal(order.levels[0], "drive_to_star", "a new learner starts by driving");
});
