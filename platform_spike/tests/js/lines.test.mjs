// The line counter matches the engine's max_lines rule: non-blank, non-comment lines.
import { test } from "node:test";
import assert from "node:assert/strict";
import { countLines } from "../../src/ui/lines.js";

test("counts like engine.check_constraints: blank lines and comments don't count", () => {
  assert.equal(countLines(""), 0);
  assert.equal(countLines("move()\n\n# a note\n    # indented note\nmove()\n"), 2);
  assert.equal(countLines("def f():\n    move()  # trailing comments still count the line\n"), 2);
});
