// The room's checks on what other browsers send (src/collab/room.js): nothing from a room is
// trusted, so the doc and every peer's presence are shape-checked and capped before use.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readDoc, readPeer, transportsFrom, colorFor, PEER_COLORS, LIMITS, FRESH_MS, RELAY } from "../../src/collab/room.js";

test("a well-formed doc is read as is", () => {
  const d = { v: 1, level: "first_steps", code: "move()\n", run: { id: "lp-a-b", by: "lp-a", level: "first_steps", source: "move()" } };
  assert.deepEqual(readDoc(d), { level: "first_steps", code: "move()\n", run: { id: "lp-a-b", by: "lp-a", level: "first_steps", source: "move()" } });
});

test("a doc that isn't a room is refused", () => {
  for (const d of [null, 5, {}, { level: "x" }, { code: "", level: 3 }, { code: 1, level: "x" }, { code: "", level: "../x" }, { code: "", level: "x".repeat(200) }]) {
    assert.equal(readDoc(d), null, JSON.stringify(d));
  }
});

test("a malformed or oversized run is dropped, not used", () => {
  const base = { level: "a", code: "" };
  for (const run of [{ id: "x" }, { id: "x", by: "y", level: "a", source: 5 }, { id: "x", by: "y", level: "a", source: "m".repeat(LIMITS.code + 1) }, "run"]) {
    assert.equal(readDoc({ ...base, run }).run, null);
  }
});

test("code longer than the cap is cut", () => {
  assert.equal(readDoc({ level: "a", code: "x".repeat(LIMITS.code + 50) }).code.length, LIMITS.code);
});

test("a peer's name is capped and its colour must be one of ours", () => {
  const now = 1_000_000;
  const p = readPeer("lp-1", { user: { name: "N".repeat(500), color: "red; background:url(x)", build: "abc" }, cursor: null }, now, now);
  assert.equal(p.name.length, LIMITS.name);
  assert.ok(PEER_COLORS.includes(p.color));
  assert.equal(readPeer("lp-1", { user: { name: "Otter", color: PEER_COLORS[2] } }, now, now).color, PEER_COLORS[2]);
});

test("stale, nameless or oddly named peers are not shown", () => {
  const now = 1_000_000;
  assert.equal(readPeer("lp-1", { user: { name: "A" } }, now - FRESH_MS, now), null);
  assert.equal(readPeer("lp-1", {}, now, now), null);
  assert.equal(readPeer("<img>", { user: { name: "A" } }, now, now), null);
  assert.equal(readPeer("lp-1", { user: { name: "  " } }, now, now).name, "Someone");
});

test("a cursor must be places (strings or null), else it is ignored", () => {
  const now = 1;
  assert.deepEqual(readPeer("lp-1", { user: { name: "A" }, cursor: { anchor: null, head: "3@ab" } }, now, now).cursor, { anchor: null, head: "3@ab" });
  assert.equal(readPeer("lp-1", { user: { name: "A" }, cursor: { anchor: {}, head: 4 } }, now, now).cursor, null);
});

test("transports: ?transports beats the link's via, unknown names are ignored", () => {
  assert.deepEqual([...transportsFrom("?transports=tabs", "ws")], ["tabs"]);
  assert.deepEqual([...transportsFrom("", "ws")], ["ws"]);
  assert.deepEqual([...transportsFrom("?transports=evil", null)].sort(), ["tabs", "ws"]);
});

test("colours are stable per peer", () => {
  assert.equal(colorFor("lp-abc"), colorFor("lp-abc"));
  assert.ok(PEER_COLORS.includes(colorFor("lp-xyz")));
});

test("the relay is PartlyWhole's, and only tests on localhost can point elsewhere", () => {
  assert.equal(RELAY, "wss://sync.partlywhole.org");
  const src = readFileSync(new URL("../../src/collab/room.js", import.meta.url), "utf8");
  assert.match(src, /\["localhost", "127\.0\.0\.1"\]\.includes\(location\.hostname\) && globalThis\.__learnPythonRelay/);
});

test("room data is never put into the page as HTML", () => {
  for (const f of ["../../src/app.js", "../../src/collab/editor.js"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    const roomPart = f.endsWith("app.js") ? src.slice(src.indexOf("// ---------------------------------------------------------------- shared room")) .split("// ---------------------------------------------------------------- start")[0] : src;
    assert.doesNotMatch(roomPart, /innerHTML|insertAdjacentHTML|outerHTML/, f);
  }
});
