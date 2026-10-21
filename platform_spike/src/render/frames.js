// Turn a world + trace into replayable frames. Pure functions, no DOM: unit-tested in Node and
// cross-checked against the Python engine's final state (tests/js/frames.test.mjs).
//
// A trace event holds the robot state AFTER the action (schemas/run_result.schema.json) but not
// the gem map, so gem counts are derived here: "pick" removes one gem at (x, y), "put" adds one.

export const SENSORS = new Set(["front_is_clear", "gems_here", "scan", "coin_flip"]);

/** Initial gem map from a world spec: { "x,y": count }. */
export function initialGems(world) {
  return { ...(world.gems ?? {}) };
}

/**
 * @returns {Array<{index, x, y, dir, bag, gems, event}>} frames[0] is the start state;
 *          frames[i] (i >= 1) is the state after trace[i - 1].
 */
export function buildFrames(world, trace) {
  const [x0, y0, dir0] = world.start;
  let gems = initialGems(world);
  const bag0 = typeof world.bag === "number" ? world.bag : 0; // an infinite bag is shown as ∞ by the app
  const frames = [{ index: 0, x: x0, y: y0, dir: dir0, bag: bag0, gems, event: null }];
  trace.forEach((event, i) => {
    if (event.action === "pick" || event.action === "put") {
      const key = `${event.x},${event.y}`;
      gems = { ...gems, [key]: (gems[key] ?? 0) + (event.action === "put" ? 1 : -1) };
      if (gems[key] <= 0) delete gems[key];
    }
    frames.push({ index: i + 1, x: event.x, y: event.y, dir: event.dir, bag: event.bag, gems, event });
  });
  return frames;
}

export function gemsLeft(frame) {
  return Object.values(frame.gems).reduce((a, b) => a + b, 0);
}

/** Learner-facing one-liner for an event, shown under the world during replay. */
export function describe(event) {
  if (!event) return "Start";
  const r = event.result;
  switch (event.action) {
    case "move": return "move()";
    case "turn_left": return "turn_left()";
    case "pick": return "pick()";
    case "put": return "put()";
    case "front_is_clear": return `front_is_clear() → ${r ? "True" : "False"}`;
    case "gems_here": return `gems_here() → ${r}`;
    case "scan": return `scan() → [${(r ?? []).join(", ")}]`;
    case "coin_flip": return `coin_flip() → ${r ? "True" : "False"}`;
    default: return `${event.action}()`;
  }
}

/**
 * For stepping through a replay: each frame's pass over its line ("2 of 4": the 2nd of 4 times
 * that line ran), so a loop's iterations can be told apart. nth[i] is 0 for frames with no line.
 */
export function lineRuns(frames) {
  const totals = new Map();
  const nth = frames.map((f) => {
    const line = f.event?.line;
    if (!line) return 0;
    const n = (totals.get(line) ?? 0) + 1;
    totals.set(line, n);
    return n;
  });
  return { nth, total: (line) => totals.get(line) ?? 0 };
}

/** The next frame after `from` whose step ran `line`, directly or inside a call made there,
 *  wrapping round to the start; -1 if that line never ran. (Clicking a line number.) */
export function nextStepAt(frames, line, from) {
  const n = frames.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    const e = frames[i].event;
    if (e && (e.line === line || e.calls?.includes(line))) return i;
  }
  return -1;
}

/** The robot's path up to and including frame `index`: its cell after every move. */
export function pathTo(frames, index) {
  const out = [];
  for (const f of frames.slice(0, index + 1)) {
    const last = out.at(-1);
    if (!last || last[0] !== f.x || last[1] !== f.y) out.push([f.x, f.y]);
  }
  return out;
}
