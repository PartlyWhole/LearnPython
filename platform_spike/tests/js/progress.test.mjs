import { test } from "node:test";
import assert from "node:assert/strict";
import { Progress, memoryStorage } from "../../src/progress/progress.js";
import { playOrder } from "../../src/lessons/order.js";

const INDEX = { units: [{ id: "u1", title: "One", levels: ["a", "b"] }, { id: "u2", title: "Two", levels: ["c"] }] };

test("only the first level starts unlocked; solving unlocks the next across units", () => {
  const p = new Progress(INDEX, memoryStorage());
  assert.deepEqual(["a", "b", "c"].map((id) => p.isUnlocked(id)), [true, false, false]);
  p.markSolved("a", "code");
  p.markSolved("b", "code");
  assert.equal(p.isUnlocked("c"), true, "unlocking crosses unit boundaries");
  assert.equal(p.isUnlocked("zzz"), false, "unknown ids are never unlocked");
});

test("current() is the first unsolved level; next() follows the index order", () => {
  const p = new Progress(INDEX, memoryStorage());
  assert.equal(p.current(), "a");
  p.markSolved("a", "x");
  assert.equal(p.current(), "b");
  p.markSolved("b", "x");
  assert.equal(p.next("b"), "c", "after a solve, the next open level");
  p.markSolved("c", "x");
  assert.equal(p.next("c"), null, "the end");
  assert.equal(p.current(), "c", "everything solved: stay on the last level");
});

test("progress and drafts persist through storage", () => {
  const storage = memoryStorage();
  const p = new Progress(INDEX, storage);
  p.markSolved("a", "move()", 123);
  p.saveDraft("b", "turn_left()");
  const again = new Progress(INDEX, storage);
  assert.equal(again.isSolved("a"), true);
  assert.equal(again.draft("b"), "turn_left()");
  assert.deepEqual(again.counts(), { solved: 1, total: 3 });
});

test("corrupted or failing storage never breaks the game", () => {
  const p = new Progress(INDEX, memoryStorage({ "learnpython/progress/v1": "{not json" }));
  assert.equal(p.current(), "a");
  const broken = { get() { throw new Error("denied"); }, set() { throw new Error("denied"); } };
  assert.throws(() => new Progress(INDEX, broken).markSolved("a", "x"), /denied/,
    "raw storage can throw: the app must wrap it (browserStorage does)");
});

test("lesson demos: remembered as done or skipped; old stores without lessons still load", () => {
  const storage = memoryStorage({ "learnpython/progress/v1": JSON.stringify({ solved: { a: { at: 1, code: "" } }, drafts: {} }) });
  const p = new Progress(INDEX, storage);
  assert.equal(p.isSolved("a"), true, "an existing store keeps its solves");
  assert.equal(p.lesson("loops"), null);
  p.markLesson("loops", "skipped", 5);
  assert.deepEqual(p.lesson("loops"), { watch: "skipped", at: 5 });
  p.markLesson("loops", "done", 6);
  assert.equal(new Progress(INDEX, storage).lesson("loops").watch, "done", "persisted");
  p.markLesson("loops", "skipped", 7);
  assert.equal(p.lesson("loops").watch, "done", "skipping a replay keeps it watched");
});

test("step-by-step setting, how a level was solved, hidden guides and the one-time offer", () => {
  const storage = memoryStorage({ "learnpython/progress/v1": JSON.stringify({ solved: {}, drafts: {} }) });
  const p = new Progress(INDEX, storage);
  assert.equal(p.setting("stepByStep"), true, "on by default, also for old stores");
  p.setSetting("stepByStep", false);
  p.markSolved("a", "code", 1, "guided+shown");
  assert.equal(p.data.solved.a.with, "guided+shown");
  p.markSolved("b", "code", 2);
  assert.equal(p.data.solved.b.with, "none");
  p.setGuideHidden("b", true);
  assert.equal(p.guideHidden("b"), true);
  assert.equal(p.noteAheadOfGuide(), 1);
  assert.equal(p.aheadOffer(), "unasked");
  p.setAheadOffer("declined");
  p.markGuided("loops");
  const again = new Progress(INDEX, storage);
  assert.equal(again.setting("stepByStep"), false);
  assert.equal(again.guideHidden("b"), true);
  again.setGuideHidden("b", false);
  assert.equal(again.guideHidden("b"), false);
  assert.equal(again.aheadOffer(), "declined");
  assert.equal(again.lesson("loops").guided, "done");
});

// Lesson play order (docs/lessons.md section 7): a plain level, a lesson (guided g, practice p1 p2,
// twist t), a lesson without twist (guided h, practice q), and a final plain level z.
const LESSONS = {
  L1: { id: "L1", guided: { level: "g" }, practice: ["p1", "p2"], twist: "t" },
  L2: { id: "L2", guided: { level: "h" }, practice: ["q"] },
};
const ORDER = playOrder({ format: 2, units: [
  { id: "u0", title: "Zero", items: [{ level: "a" }] },
  { id: "u1", title: "One", items: [{ lesson: "L1" }, { lesson: "L2" }, { level: "z" }] },
] }, LESSONS);

test("playOrder expands lessons into guided, practice, twist", () => {
  assert.deepEqual(ORDER.levels, ["a", "g", "p1", "p2", "t", "h", "q", "z"]);
  assert.throws(() => playOrder({ units: [{ id: "u", title: "U", items: [{ lesson: "nope" }] }] }, {}), /missing lesson/);
});

test("a lesson opens its guided level and twist; practice after the guided solve", () => {
  const p = new Progress(ORDER, memoryStorage());
  const open = () => ORDER.levels.filter((id) => p.isUnlocked(id));
  assert.deepEqual(open(), ["a"]);
  p.markSolved("a", "");
  assert.deepEqual(open(), ["a", "g", "t"], "guided and the I-know-this twist");
  assert.equal(p.current(), "g");
  p.markSolved("g", "");
  assert.deepEqual(open(), ["a", "g", "p1", "p2", "t"]);
  assert.equal(p.next("g"), "p1");
  p.markSolved("p1", "");
  assert.equal(p.next("p1"), "p2");
  p.markSolved("p2", "");
  assert.ok(p.isUnlocked("h"), "all practice solved: the next lesson opens");
  assert.equal(p.next("p2"), "t", "the twist is still offered inside the finished lesson");
});

test("solving the twist alone finishes a lesson (placement); next() moves on", () => {
  const p = new Progress(ORDER, memoryStorage());
  p.markSolved("a", "");
  p.markSolved("t", "");
  assert.ok(p.isUnlocked("h"), "twist solved: next lesson open, guided and practice skipped");
  assert.equal(p.next("t"), "h");
  assert.equal(p.current(), "h", "current skips the finished lesson's unsolved levels");
  p.markSolved("h", "");
  assert.equal(p.isUnlocked("z"), false, "a lesson with practice but no twist needs its practice");
  p.markSolved("q", "");
  assert.equal(p.next("q"), "z");
});

test("old progress keeps its solves; solved levels stay open even if the order moved them", () => {
  const storage = memoryStorage({ "learnpython/progress/v1": JSON.stringify({ solved: { q: { at: 1, code: "" } }, drafts: {} }) });
  const p = new Progress(ORDER, storage);
  assert.equal(p.isUnlocked("q"), true);
  assert.equal(p.isUnlocked("h"), false);
  assert.equal(p.current(), "a");
});

test("progress saved under the old Gem Rover key moves to the LearnPython key", () => {
  const storage = memoryStorage({ "gem-rover/progress/v1": JSON.stringify({ solved: { a: { at: 1, code: "" } }, drafts: { b: "x" } }) });
  const p = new Progress(INDEX, storage);
  assert.equal(p.isSolved("a"), true);
  assert.equal(p.draft("b"), "x");
  assert.ok(JSON.parse(storage.map.get("learnpython/progress/v1")).solved.a, "copied to the new key");
  p.markSolved("b", "y");
  assert.equal(new Progress(INDEX, storage).isSolved("b"), true, "new progress reads from the new key");
});

test("Continue after replaying an earlier level goes to the level after it, not the furthest one", () => {
  const p = new Progress(ORDER, memoryStorage());
  for (const id of ["a", "g", "p1", "p2"]) p.markSolved(id, "");
  assert.equal(p.next("a"), "g", "replaying the first level leads to the second");
  assert.equal(p.next("g"), "p1", "and on through the lesson");
  assert.equal(p.next("p1"), "p2");
  assert.equal(p.next("p2"), "t");
  assert.equal(p.next("z"), null, "the end");
});

test("a line bonus, once earned, stays when the level is solved again without it", () => {
  const storage = memoryStorage();
  const p = new Progress(INDEX, storage);
  p.markSolved("a", "x", 1, "none", false);
  assert.equal(p.hasBonus("a"), false);
  p.markSolved("a", "x", 2, "none", true);
  p.markSolved("a", "long", 3, "none", false);
  assert.equal(p.hasBonus("a"), true);
  assert.equal(new Progress(INDEX, storage).hasBonus("a"), true);
});

test("the Unlock all levels setting opens every level, and turning it off locks them again", () => {
  const p = new Progress(INDEX, memoryStorage());
  assert.equal(p.isUnlocked("c"), false);
  p.setSetting("unlockAll", true);
  assert.deepEqual(["a", "b", "c"].map((id) => p.isUnlocked(id)), [true, true, true]);
  assert.equal(p.isUnlocked("zzz"), false, "unknown ids stay closed");
  assert.equal(p.next("a"), "b", "Continue still follows the play order");
  p.setSetting("unlockAll", false);
  assert.equal(p.isUnlocked("c"), false);
});
