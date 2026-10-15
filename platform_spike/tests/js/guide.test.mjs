// Step-by-step guide logic: current step, the tracker's flashes and "ahead" signal, debounce, diff.
import { test } from "node:test";
import assert from "node:assert/strict";
import { currentStep, GuideTracker, Debouncer, lineDiff } from "../../src/lessons/guide.js";
import { FakeClock } from "./helpers.mjs";

const ok = (steps) => ({ syntax_ok: true, steps });

test("the current step is the first unsatisfied one, whatever order things were typed in", () => {
  assert.equal(currentStep([false, false, false]), 0);
  assert.equal(currentStep([true, false, true]), 1, "a later step done early doesn't skip an earlier one");
  assert.equal(currentStep([true, true, true]), 3, "finished");
});

test("tracker: advancing, going back on delete, and syntax errors keep the step", () => {
  const t = new GuideTracker(3);
  assert.deepEqual(t.update(ok([false, false, false])), { index: 0, syntaxError: false, advanced: false, ahead: false, finished: false });
  assert.equal(t.update(ok([true, false, false])).advanced, true);
  const err = t.update({ syntax_ok: false, steps: [false, false, false] });
  assert.equal(err.syntaxError, true);
  assert.equal(err.index, 1, "a syntax error keeps the step on screen");
  const back = t.update(ok([false, false, false]));
  assert.equal(back.index, 0);
  assert.equal(back.advanced, false);
  assert.equal(t.update(ok([true, true, true])).finished, true);
});

test("tracker: 'ahead' fires once, when the code jumps past step 2 before it was shown", () => {
  const t = new GuideTracker(3);
  t.update(ok([false, false, false]));
  assert.equal(t.update(ok([true, true, false])).ahead, true, "pasted a full solution");
  assert.equal(t.update(ok([true, true, false])).ahead, false, "only once per try");

  const steady = new GuideTracker(3);
  steady.update(ok([false, false, false]));
  steady.update(ok([true, false, false]));
  assert.equal(steady.update(ok([true, true, false])).ahead, false, "followed the steps");

  const draft = new GuideTracker(3);
  assert.equal(draft.update(ok([true, true, false])).ahead, false, "a returning draft is not a lead");
  assert.equal(new GuideTracker(2).update(ok([true, false])).ahead, false, "two-step guides never count");
});

test("debouncer runs once after quiet", () => {
  const clock = new FakeClock();
  const d = new Debouncer(400, clock);
  let n = 0;
  d.call(() => n++);
  clock.advance(300);
  d.call(() => n++);
  clock.advance(300);
  assert.equal(n, 0);
  clock.advance(100);
  assert.equal(n, 1);
  d.call(() => n++);
  d.cancel();
  clock.advance(1000);
  assert.equal(n, 1);
});

test("lineDiff marks the lines Show me would add", () => {
  const diff = lineDiff("for i in range(5):\n    put()\nmove()\n", "for i in range(5):\n    put()\n    move()\n");
  assert.deepEqual(diff, [
    { text: "for i in range(5):", added: false },
    { text: "    put()", added: false },
    { text: "    move()", added: true },
  ]);
  assert.ok(lineDiff("", "move()\n").every((l) => l.added));
});
