// Hint ladder: rungs unlock only on failed runs; "Not now" waits for the next failure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lessonIds } from "../../src/lessons/order.js";
import { HintLadder, rungsFor, lessonForPractice } from "../../src/lessons/hints.js";

test("rung 1 after 2 failures, rung 2 after 1 more, rung 3 after 2 more", () => {
  const h = new HintLadder(3);
  assert.equal(h.ran(false), false);
  assert.equal(h.offering, false, "one failure is not enough");
  assert.equal(h.ran(false), true, "second failure offers rung 1");
  assert.equal(h.open(), 0);
  assert.equal(h.offering, false, "nothing new until another failure");
  assert.equal(h.ran(false), true, "rung 2 after one more failure");
  assert.equal(h.open(), 1);
  assert.equal(h.ran(false), false);
  assert.equal(h.ran(false), true, "rung 3 after two more");
  assert.equal(h.open(), 2);
  h.ran(false);
  h.ran(false);
  assert.equal(h.offering, false, "the ladder ends at its last rung");
  assert.equal(h.open(), 2, "reopening shows the last rung again");
});

test("Not now hides the offer until the next failed run; a pass ends it", () => {
  const h = new HintLadder(2);
  h.ran(false);
  h.ran(false);
  h.notNow();
  assert.equal(h.offering, false);
  assert.equal(h.ran(false), true, "a new failure brings it back");
  h.ran(true);
  assert.equal(h.offering, false, "no offer after a pass");
});

test("state round-trips, so a reload keeps the ladder", () => {
  const h = new HintLadder(3);
  h.ran(false); h.ran(false); h.open(); h.ran(false);
  const again = new HintLadder(3, h.state);
  assert.equal(again.offering, true);
  assert.equal(again.open(), 1);
});

test("rungs come from the lesson, with a Goal-view default; practice lookup", () => {
  const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
  const lessons = lessonIds(read("../../lessons/index.json")).map((id) => read(`../../lessons/${id}.json`));
  assert.equal(lessonForPractice(lessons, "piles").id, "while_loops");
  assert.equal(lessonForPractice(lessons, "collect_row"), null, "a guided level is not practice");
  assert.equal(rungsFor(lessonForPractice(lessons, "piles"), "piles").length, 3);
  assert.deepEqual(rungsFor(null, "x"), ["Compare your result with the Goal view."]);
});
