// Panel layout: the split stays reachable and is remembered per browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clampSplit, splitFromPointer, loadSplit, saveSplit, SPLIT } from "../../src/ui/layout.js";
import { memoryStorage } from "../../src/progress/progress.js";

const asLocal = (m) => ({ getItem: (k) => m.get(k), setItem: (k, v) => m.set(k, v) });

test("the split is clamped so neither panel disappears", () => {
  assert.equal(clampSplit(0.1), SPLIT.min);
  assert.equal(clampSplit(0.9), SPLIT.max);
  assert.equal(clampSplit(NaN), SPLIT.initial);
  assert.equal(splitFromPointer(600, 100, 1000), 0.5);
  assert.equal(splitFromPointer(0, 100, 1000), SPLIT.min);
});

test("the split is remembered, and a broken store falls back to the default", () => {
  const store = asLocal(memoryStorage().map);
  assert.equal(loadSplit(store), SPLIT.initial);
  saveSplit(0.62, store);
  assert.equal(loadSplit(store), 0.62);
  const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(loadSplit(throwing), SPLIT.initial);
  assert.doesNotThrow(() => saveSplit(0.4, throwing));
});
