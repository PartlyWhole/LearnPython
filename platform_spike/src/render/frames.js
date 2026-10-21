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
 * @returns {Array<{index, x, y, dir, bag, gems, event, error?}>} frames[0] is the start state;
 *          frames[i] (i >= 1) is the state after trace[i - 1].
 * If the run stopped on an error, one more frame follows: the same state, with `error` and no
 * event. It is the step that failed (a move into a wall, a NameError), so stepping shows the
 * last good step on its own line first, then the failure on its line.
 */
export function buildFrames(world, trace, error = null) {
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
  if (error) {
    const last = frames.at(-1);
    frames.push({ ...last, index: frames.length, event: null, error });
  }
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

/** Which call from `line` frame f's step is inside (its call id), or null if it isn't inside
 *  one made there. The failed step has no ids: it belongs to the call the step before it was in. */
function callAt(frames, i, line) {
  const e = frames[i].event ?? frames[i].error;
  const k = e?.calls?.indexOf(line) ?? -1;
  if (k < 0) return null;
  if (e.call_ids) return e.call_ids[k];
  return i > 0 ? callAt(frames, i - 1, line) ?? `step${i}` : `step${i}`;
}

/**
 * For stepping through a replay:
 *   nth[i]          which pass over its own line frame i's step is ("2 of 4": the 2nd of 4
 *                   times that line ran), so a loop's iterations can be told apart; 0 if none
 *   total(line)     how many steps that line made
 *   callPass(i, l)  for a call site l frame i is inside: {n, of}, the call's place among the
 *                   calls made from l ("call 2 of 3")
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
  const callsFrom = new Map(); // call-site line -> its call ids, in order
  frames.forEach((f, i) => {
    for (const line of new Set((f.event ?? f.error)?.calls ?? [])) {
      const id = callAt(frames, i, line);
      const ids = callsFrom.get(line) ?? [];
      if (ids.at(-1) !== id && !ids.includes(id)) ids.push(id);
      callsFrom.set(line, ids);
    }
  });
  const callPass = (i, line) => {
    const ids = callsFrom.get(line) ?? [];
    const n = ids.indexOf(callAt(frames, i, line)) + 1;
    return n ? { n, of: ids.length } : null;
  };
  return { nth, total: (line) => totals.get(line) ?? 0, callPass };
}

/**
 * The next frame after `from` that starts something on `line`, wrapping round to the start; -1
 * if nothing did. (Clicking a line number.) For a line's own steps, the next one; for a line
 * that calls a function, the first step of the next call made there; the failed step counts
 * for its line too.
 */
export function nextStepAt(frames, line, from) {
  const key = (i) => {
    const e = frames[i].event ?? frames[i].error;
    if (!e) return null;
    if (e.line === line) return `own${i}`;
    const c = callAt(frames, i, line);
    return c === null ? null : `call${c}`;
  };
  const n = frames.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    const here = key(i);
    if (here !== null && (i === 0 || here !== key(i - 1))) return i;
  }
  return -1;
}

/** The whole path once, for a replay: cells (in order, each visit once) and, per frame, how
 *  many of them it has walked. pathTo(frames, i) is cells.slice(0, counts[i]). */
export function pathIndex(frames) {
  const cells = [], counts = [];
  for (const f of frames) {
    const last = cells.at(-1);
    if (!last || last[0] !== f.x || last[1] !== f.y) cells.push([f.x, f.y]);
    counts.push(cells.length);
  }
  return { cells, counts };
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

/** The print() output up to frame `index`: what had been printed by that step (events carry
 *  `out`, a count of characters as Python counts them, so code points here), all of it at the end. */
export function outputAt(frames, index, output) {
  if (index >= frames.length - 1) return output;
  const n = frames[index]?.event?.out ?? 0; // absent: nothing printed yet (output only grows)
  return Array.from(output).slice(0, n).join("");
}
