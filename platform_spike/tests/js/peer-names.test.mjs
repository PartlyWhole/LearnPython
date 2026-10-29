// When a partner's name shows over their caret (src/collab/editor.js): when they arrive, or move
// after a pause, never on every keystroke (PLP's design/collab-presence.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { nameShowing, NAME_MS, PAUSE_MS } from "../../src/collab/editor.js";

const at = (head) => ({ id: "lp-1", cursor: { anchor: head, head } });

test("a name shows when someone arrives, then not after a while", () => {
  const seen = new Map();
  assert.equal(nameShowing(seen, at(3), 1000), 0);
  assert.equal(nameShowing(seen, at(3), 1000 + NAME_MS - 1), NAME_MS - 1);
  assert.equal(nameShowing(seen, at(3), 1000 + NAME_MS), null);
});

test("typing doesn't bring the name back", () => {
  const seen = new Map();
  nameShowing(seen, at(1), 0);
  let t = NAME_MS + 10;
  for (let head = 2; head < 30; head++, t += 150) assert.equal(nameShowing(seen, at(head), t), null);
});

test("moving after a pause shows it again", () => {
  const seen = new Map();
  nameShowing(seen, at(1), 0);
  assert.equal(nameShowing(seen, at(1), 10_000), null); // still: a heartbeat
  assert.equal(nameShowing(seen, at(9), 10_000 + PAUSE_MS + 1), 0);
});

test("redrawn mid-fade, the name says how far into its fade it is", () => {
  const seen = new Map();
  nameShowing(seen, at(1), 0);
  assert.equal(nameShowing(seen, at(2), 400), 400);
});
