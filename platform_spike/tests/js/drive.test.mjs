// Drive mode logic: the button program and what a press announces.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DriveProgram, describePress, DRIVE_KEYS } from "../../src/lessons/drive.js";

test("presses build a program; undo drops the last line; reset clears", () => {
  const p = new DriveProgram();
  p.press("move");
  p.press("turn_left");
  assert.equal(p.code, "move()\nturn_left()\n");
  assert.equal(p.undo(), "move()\n");
  assert.equal(p.length, 1);
  assert.equal(p.reset(), "");
  assert.equal(p.undo(), "", "undo on an empty program is harmless");
});

test("describePress names what changed, or the crash", () => {
  assert.equal(describePress({ x: 2, y: 0, dir: "E", bag: 0, event: { action: "move" } }, null), "Moved to column 3, row 1.");
  assert.equal(describePress({ x: 2, y: 0, dir: "N", bag: 0, event: { action: "turn_left" } }, null), "Turned to face north.");
  assert.equal(describePress({ x: 2, y: 0, dir: "N", bag: 1, event: { action: "pick" } }, null), "Picked a gem. Bag: 1.");
  assert.equal(describePress({ x: 0, y: 0, dir: "E", bag: 0, event: null }, { kind: "wall", message: "x" }), "Bumped into a wall.");
  assert.equal(describePress({}, { kind: "step_limit", message: "Too many steps." }), "Too many steps.");
});

test("keyboard shortcuts only map to drive commands", () => {
  for (const cmd of Object.values(DRIVE_KEYS)) assert.ok(["move", "turn_left", "pick", "put"].includes(cmd));
});
