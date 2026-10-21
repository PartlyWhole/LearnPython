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
