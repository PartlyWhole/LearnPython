import { test } from "node:test";
import assert from "node:assert/strict";
import { TracePlayer } from "../../src/render/player.js";
import { FakeClock } from "./helpers.mjs";

const frames = [
  { index: 0, event: null },
  { index: 1, event: { action: "move" } },
  { index: 2, event: { action: "front_is_clear" } },
  { index: 3, event: { action: "move" } },
];

function setup(speed = 4) {
  const clock = new FakeClock();
  const shown = [], plays = [];
  let ended = 0;
  const p = new TracePlayer({ onFrame: (f) => shown.push(f.index), onPlayState: (s) => plays.push(s),
                              onEnd: () => ended++, stepsPerSecond: speed,
                              setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  p.load(frames);
  return { p, clock, shown, plays, ended: () => ended };
}

test("load shows frame 0 without playing", () => {
  const { p, shown } = setup();
  assert.deepEqual(shown, [0]);
  assert.equal(p.playing, false);
});

test("play advances on schedule; sensors take 40% of a step; stops at the end", () => {
  const { p, clock, shown, ended } = setup(4); // 250 ms per step
  p.play();
  clock.advance(249); assert.deepEqual(shown, [0]);
  clock.advance(1);   assert.deepEqual(shown, [0, 1]);
  clock.advance(100); assert.deepEqual(shown, [0, 1, 2], "sensor frame after 100 ms");
  clock.advance(250); assert.deepEqual(shown, [0, 1, 2, 3]);
  assert.equal(p.playing, false);
  assert.equal(ended(), 1);
  clock.advance(10_000); assert.equal(shown.length, 4, "no timers left running");
});

test("pause stops advancing; play at the end restarts from frame 0", () => {
  const { p, clock, shown } = setup();
  p.play(); clock.advance(250); p.pause(); clock.advance(5000);
  assert.deepEqual(shown, [0, 1]);
  p.toEnd(); p.play();
  assert.equal(shown.at(-1), 0, "restarted");
});

test("step and seek clamp to the trace and pause playback", () => {
  const { p, shown } = setup();
  p.play(); p.step(-1);
  assert.equal(p.playing, false);
  assert.deepEqual(shown, [0], "already at 0: no duplicate frame");
  p.seek(99); assert.equal(p.index, 3);
  p.step(1); assert.equal(p.index, 3);
  p.step(-2); assert.equal(p.index, 1);
});

test("speed is clamped and changes the step delay", () => {
  const { p } = setup();
  p.setSpeed(1000); assert.equal(p.stepMs, 1000 / 60);
  p.setSpeed(0); assert.equal(p.stepMs, 4000);
});

test("a very long run plays in at most MAX_PLAY_MS; short runs keep the chosen speed", async () => {
  const { MAX_PLAY_MS } = await import("../../src/render/player.js");
  const p = new TracePlayer({ onFrame: () => {}, stepsPerSecond: 5 });
  const frames = (n) => Array.from({ length: n }, (_, i) => ({ index: i, event: i ? { action: "turn_left" } : null }));
  p.load(frames(20));
  assert.equal(p.delayFor(p.frames[1]), 200);
  p.load(frames(10_001));
  assert.ok(p.delayFor(p.frames[1]) * 10_000 <= MAX_PLAY_MS);
});

test("a 10,000-step run reaches its end within MAX_PLAY_MS of play, a few steps per tick", async () => {
  const { MAX_PLAY_MS } = await import("../../src/render/player.js");
  const clock = new FakeClock();
  let ended = false;
  const p = new TracePlayer({ onFrame: () => {}, onEnd: () => { ended = true; }, stepsPerSecond: 5, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  p.load(Array.from({ length: 10_001 }, (_, i) => ({ index: i, event: i ? { action: "turn_left" } : null })));
  p.play();
  clock.advance(MAX_PLAY_MS + 100);
  assert.ok(ended, `stopped at ${p.index}`);
  assert.equal(p.index, 10_000);
});
