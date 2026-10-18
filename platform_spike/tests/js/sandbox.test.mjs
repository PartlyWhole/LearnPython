// The worker is self-contained (it also runs as a blob inside the sandbox) and speaks the same
// protocol as the page; the sandbox's policy keeps the network to the Pyodide CDN only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG } from "../../src/runtime/protocol.js";
import { SANDBOX_CSP, sandboxDocument } from "../../src/runtime/sandbox.js";

const worker = readFileSync(new URL("../../src/runtime/worker.js", import.meta.url), "utf8");

test("worker.js has no imports (it must run as a classic blob worker) and the page's MSG", () => {
  assert.doesNotMatch(worker, /^\s*import\s/m, "no static imports");
  assert.doesNotMatch(worker, /import\.meta/, "no import.meta: classic workers don't have it");
  const inline = worker.match(/const MSG = Object\.freeze\(\{([\s\S]*?)\}\);/)[1];
  const pairs = Object.fromEntries([...inline.matchAll(/(\w+):\s*"(\w+)"/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(pairs, { ...MSG });
});

test("the sandbox policy: network only to the Pyodide CDN, no frames or forms, opaque-origin frame", () => {
  assert.match(SANDBOX_CSP, /default-src 'none'/);
  assert.match(SANDBOX_CSP, /connect-src https:\/\/cdn\.jsdelivr\.net(;|$)/);
  assert.doesNotMatch(SANDBOX_CSP, /connect-src[^;]*(\*|wss:|partlywhole)/, "not even the relay");
  assert.match(SANDBOX_CSP, /frame-src 'none'/);
  assert.match(sandboxDocument(), /http-equiv="Content-Security-Policy"/);
  const src = readFileSync(new URL("../../src/runtime/sandbox.js", import.meta.url), "utf8");
  assert.match(src, /setAttribute\("sandbox", "allow-scripts"\)/);
  assert.doesNotMatch(src, /setAttribute\("sandbox", "[^"]*allow-same-origin/, "allow-same-origin would give the frame this site's storage");
});
