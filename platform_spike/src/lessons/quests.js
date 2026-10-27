// Sub-quests (docs/quests.md): the pure part. What picture a sub-quest gets, which ones are
// done, and its text split into words and code names. No DOM; tests/js/quests.test.mjs.

/**
 * The picture for a sub-quest: the world it's tried in, the goal there (null: none to draw),
 * and a cell to mark (a `reach` check's cell). Null for a code-shape check (no world).
 */
export function questPicture(quest, level) {
  const { test, program } = quest.check;
  if (test) return { world: test.world, goal: test.goal ?? null, mark: null, own: true };
  if (!program) return null;
  const reach = program.reach ?? {};
  const mark = reach.visit ?? reach.pick_at ?? reach.put_at ?? null;
  const world = program.world ?? level.world;
  let goal = program.goal ?? null;
  // "Stack several here": the count is the point, so the picture shows the stack it asks for.
  if (!goal && reach.put_at && (reach.n ?? 1) > 1) {
    const key = `${reach.put_at[0]},${reach.put_at[1]}`;
    goal = { gems_exactly: { ...(world.gems ?? {}), [key]: (world.gems?.[key] ?? 0) + reach.n } };
  }
  return { world, goal, mark, own: Boolean(program.world) };
}

/** Can the learner "Try it": run this sub-quest's own world and watch it? (The level's own
 *  world is what Run already shows.) */
export function canTry(quest) {
  return Boolean(quest.check.test || quest.check.program?.world);
}

/** The text with `code` spans marked: [{code: false, text: "Fill in "}, {code: true, text: "f()"}]. */
export function textParts(text) {
  return String(text).split(/(`[^`]*`)/).filter(Boolean)
    .map((s) => (s.startsWith("`") && s.endsWith("`") && s.length > 1 ? { code: true, text: s.slice(1, -1) } : { code: false, text: s }));
}

/** Follows the done flags across checks: which sub-quests just got done, and which is current. */
export class QuestTracker {
  constructor(n) { this.done = Array(n).fill(false); this.checked = false; }

  /** states: [{done, why}] from engine.quest_state. */
  update(states) {
    const newlyDone = [];
    states.forEach((s, i) => { if (s.done && !this.done[i] && this.checked) newlyDone.push(i); });
    this.done = states.map((s) => s.done);
    this.checked = true;
    return { newlyDone, current: this.current(), all: this.done.every(Boolean) };
  }

  /** The first not done, or -1 when all are. */
  current() { return this.done.indexOf(false); }
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A sub-quest's goal in words, for its page's Goal view (a reach or code part has no end
 *  picture of its own, so the words carry it). Null: the goal picture's own summary will do. */
export function questGoalSummary(quest) {
  const { test, program, code } = quest.check;
  const returns = test && "returns" in test ? ` ${test.call}() gives back ${pyRepr(test.returns)}.` : "";
  if (test && !test.goal) return `Goal:${returns}`;
  if (test) return returns ? `${returns.trim()}` : null;
  if (code) return "Goal: the same robot, written the way the part asks.";
  const reach = program.reach ?? {};
  if (program.goal) return null;
  if (reach.visit) return "Goal: the robot gets to the marked cell (it can carry on after).";
  if (reach.pick_at) return `Goal: the robot picks up ${reach.n > 1 ? plural(reach.n, "gem") : "a gem"} on the marked cell.`;
  if (reach.put_at) return `Goal: the robot puts ${reach.n > 1 ? plural(reach.n, "gem") : "a gem"} on the marked cell.`;
  return null;
}

function pyRepr(v) {
  if (v === true) return "True";
  if (v === false) return "False";
  if (v === null) return "None";
  return JSON.stringify(v);
}

/** What Run does on a sub-quest's page, in one line: which code runs, in which world. */
export function runNote(quest) {
  const { test, program } = quest.check;
  if (test) return { lead: "Run tests only ", code: `${test.call}()`, rest: ", on its own, in this small world." };
  if (program?.world) return { lead: "Run tries your whole program in this smaller world.", code: null, rest: "" };
  return { lead: "Run tries your whole program in the challenge's world.", code: null, rest: "" };
}

/** Where "next" goes after part i is done: the next part not done after it, then any part not
 *  done before it, then null (all done: back to the challenge). */
export function nextQuest(done, i) {
  for (let k = i + 1; k < done.length; k++) if (!done[k]) return k;
  for (let k = 0; k < i; k++) if (!done[k]) return k;
  return null;
}

/** A tab's status: "done" (the code solves it now), "changed" (solved before, not by the code
 *  as it is now: an edit broke it), or "todo". */
export function questStatus(doneNow, doneBefore) {
  if (doneNow) return "done";
  return doneBefore ? "changed" : "todo";
}
