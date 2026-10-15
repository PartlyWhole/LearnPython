// Demo player logic, against the real lesson files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lessonIds } from "../../src/lessons/order.js";
import { demoSteps, textChange, typingPlan, lessonForLevel, describeCell, predictionFeedback } from "../../src/lessons/demo.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const lessons = lessonIds(read("../../lessons/index.json")).map((id) => read(`../../lessons/${id}.json`));

test("every step resolves to a full state; code and world carry forward", () => {
  for (const lesson of lessons) {
    const steps = demoSteps(lesson);
    assert.equal(steps.length, lesson.watch.steps.length);
    let code = "", world = lesson.watch.world;
    steps.forEach((s, i) => {
      const raw = lesson.watch.steps[i];
      if (raw.code !== undefined) code = raw.code;
      if (raw.world) world = raw.world;
      assert.equal(s.code, code, `${lesson.id} step ${i + 1} code`);
      assert.equal(s.world, world, `${lesson.id} step ${i + 1} world`);
      assert.equal(s.worldChanged, i === 0 || Boolean(raw.world));
      assert.equal(s.total, steps.length);
    });
  }
});

test("while_loops switches to the 1-cell corridor at step 5 and keeps that world after", () => {
  const steps = demoSteps(lessons.find((l) => l.id === "while_loops"));
  assert.equal(steps[3].world.width, 8);
  assert.equal(steps[4].world.width, 1);
  assert.equal(steps[5].world.width, 1);
  assert.equal(steps[5].worldChanged, false);
});

test("show, don't tell: every demo lets the learner press Run, and its first step has code to run", () => {
  for (const lesson of lessons) {
    const raw = lesson.watch.steps;
    assert.ok(raw.some((s) => s.run), `${lesson.id} has a run step`);
    assert.ok(raw.every((s) => s.say.split(/\s+/).length <= 16), `${lesson.id}: captions stay short`);
  }
  assert.equal(lessons.find((l) => l.id === "from_clicks_to_code").watch.steps.length, 1, "the first demo is one run");
});

test("textChange finds the one edit between two snapshots", () => {
  assert.deepEqual(textChange("a\nb\n", "a\nX\nb\n"), { start: 2, removeTo: 2, inserted: "X\n" });
  assert.deepEqual(textChange("range(7)", "range(3)"), { start: 6, removeTo: 7, inserted: "3" });
  assert.deepEqual(textChange("abc", "abc"), { start: 3, removeTo: 3, inserted: "" });
  assert.deepEqual(textChange("", "put()\n"), { start: 0, removeTo: 0, inserted: "put()\n" });
  for (const [from, to] of [["put()\nput()\n", "for i in range(7):\n    put()\n"], ["x", ""], ["", ""]]) {
    const c = textChange(from, to);
    assert.equal(from.slice(0, c.start) + c.inserted + from.slice(c.removeTo), to, "applying the change gives the target");
  }
});

test("typingPlan caps long insertions", () => {
  assert.equal(typingPlan("", "abc").msPerChar, 1000 / 30);
  assert.equal(typingPlan("", "x".repeat(300)).msPerChar, 5, "300 chars in at most 1.5 s");
  assert.equal(typingPlan("same", "same").msPerChar, 0);
});

test("lessonForLevel, describeCell and predictionFeedback", () => {
  assert.equal(lessonForLevel(lessons, "plant_row").id, "for_loops");
  assert.equal(lessonForLevel(lessons, "sweep"), null);
  assert.equal(describeCell([0, 2]), "column 1, row 3");
  const cell = { cell: true, answer: [3, 1] };
  assert.equal(predictionFeedback(cell, [3, 1], [3, 1]), "You said column 4, row 2. Right: it ended there.");
  assert.equal(predictionFeedback(cell, [0, 1], [3, 1]), "You said column 1, row 2. It ended in column 4, row 2.");
  assert.equal(predictionFeedback(cell, null, [3, 1]), "It ended in column 4, row 2.");
  const pick = { choices: ["1", "7"], answer: "7" };
  assert.equal(predictionFeedback(pick, "1", null), "You said 1. The answer: 7.");
  assert.equal(predictionFeedback(pick, "7", null), "You said 7. Right.");
});

test("predictionMark: a check when right, the answer when not", async () => {
  const { predictionMark } = await import("../../src/lessons/demo.js");
  assert.equal(predictionMark({ cell: true, answer: [1, 0] }, [1, 0], [1, 0]), "✓");
  assert.equal(predictionMark({ cell: true, answer: [1, 0] }, [2, 0], [1, 0]), "", "the picture shows it");
  assert.equal(predictionMark({ cell: true, answer: [1, 0] }, null, [1, 0]), "");
  assert.equal(predictionMark({ choices: ["1", "7"], answer: "7" }, "1", null), "7");
  assert.equal(predictionMark({ choices: ["1", "7"], answer: "7" }, "7", null), "✓");
});

test("code_from shows the learner's own program, with the lesson's code as the fallback", () => {
  const lesson = { watch: { world: { width: 2, height: 1, start: [0, 0, "E"] }, steps: [
    { say: "a", code: "move()\n", code_from: "drive_x" },
    { say: "b" },
  ] } };
  assert.equal(demoSteps(lesson)[0].code, "move()\n", "no solve: fallback");
  const mine = demoSteps(lesson, { codeFor: (id) => (id === "drive_x" ? "turn_left()\nmove()\n" : null) });
  assert.equal(mine[0].code, "turn_left()\nmove()\n");
  assert.equal(mine[1].code, "turn_left()\nmove()\n", "and it carries forward");
});
