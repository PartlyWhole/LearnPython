// Sub-quests, the pure part (src/lessons/quests.js), and every quests file against its level.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { questPicture, canTry, textParts, QuestTracker } from "../../src/lessons/quests.js";

const level = { world: { width: 4, height: 1, start: [0, 0, "E"] }, goal: {} };
const T = { check: { test: { call: "f", world: { width: 3, height: 3, start: [1, 1, "E"] }, goal: { facing: "S" } } } };
const R = { check: { program: { reach: { pick_at: [2, 0] } } } };
const W = { check: { program: { world: { width: 2, height: 1, start: [0, 0, "E"] }, goal: { all_gems_collected: true } } } };
const C = { check: { code: [{ defines: "f" }] } };

test("each kind of sub-quest gets its own picture", () => {
  assert.deepEqual(questPicture(T, level), { world: T.check.test.world, goal: { facing: "S" }, mark: null, own: true });
  assert.deepEqual(questPicture(R, level), { world: level.world, goal: null, mark: [2, 0], own: false });
  assert.equal(questPicture(W, level).own, true);
  assert.equal(questPicture(C, level), null);
});

test("Try it is for sub-quests with a world of their own", () => {
  assert.deepEqual([T, R, W, C].map(canTry), [true, false, true, false]);
});

test("text splits into words and code names", () => {
  assert.deepEqual(textParts("Fill in `turn_right()` now"), [
    { code: false, text: "Fill in " }, { code: true, text: "turn_right()" }, { code: false, text: " now" }]);
  assert.deepEqual(textParts("no code"), [{ code: false, text: "no code" }]);
});

test("the tracker reports sub-quests that just got done, not the ones done from the start", () => {
  const t = new QuestTracker(3);
  assert.deepEqual(t.update([{ done: true }, { done: false }, { done: false }]), { newlyDone: [], current: 1, all: false });
  assert.deepEqual(t.update([{ done: true }, { done: true }, { done: false }]), { newlyDone: [1], current: 2, all: false });
  assert.deepEqual(t.update([{ done: true }, { done: true }, { done: true }]), { newlyDone: [2], current: -1, all: true });
  assert.deepEqual(t.update([{ done: true }, { done: false }, { done: true }]).current, 1, "undone again by an edit");
});

test("every quests file names its level, and its pictures fit their worlds", () => {
  const dir = new URL("../../quests/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const doc = JSON.parse(readFileSync(new URL(name, dir)));
    const lv = JSON.parse(readFileSync(new URL(`../../levels/${doc.level}.json`, import.meta.url)));
    assert.equal(`${doc.level}.json`, name);
    for (const q of doc.quests) {
      const pic = questPicture(q, lv);
      if (pic?.mark) assert.ok(pic.mark[0] < pic.world.width && pic.mark[1] < pic.world.height, `${name} ${q.id}`);
    }
  }
});

test("a part that stacks several gems on one cell pictures the stack", () => {
  const q = { check: { program: { reach: { put_at: [1, 0], n: 3 } } } };
  assert.deepEqual(questPicture(q, level).goal, { gems_exactly: { "1,0": 3 } });
  assert.equal(questPicture({ check: { program: { reach: { put_at: [1, 0] } } } }, level).goal, null);
});
