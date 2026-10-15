// Contract: the editor documents exactly the API the engine exposes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { API_DOCS } from "../../src/editor/api-docs.js";

test("API_DOCS keys equal engine.API_NAMES", () => {
  const src = readFileSync(new URL("../../engine.py", import.meta.url), "utf8");
  const match = src.match(/^API_NAMES = \(([^)]*)\)/m);
  assert.ok(match, "API_NAMES tuple not found in engine.py");
  const names = [...match[1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(Object.keys(API_DOCS).sort(), names.sort());
});
