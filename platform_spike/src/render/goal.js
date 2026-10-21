// Goal view: turns a level's goal for its main world into something the renderer can draw.
// Pure (no DOM), so it is unit-tested. It never decides pass/fail: engine.py does that.
// tests/js/goal.test.mjs checks, for every level, that this picture agrees with where the
// level's reference solution actually ends (fixtures from tools/make_goal_fixtures.py).

const DIR_NAMES = { E: "east", N: "north", W: "west", S: "south" };

/** The goal that applies to one world. Mirrors engine.goal_for: level goal, then world overrides. */
export function goalFor(level, worldSpec) {
  return { ...level.goal, ...(worldSpec.goal ?? {}) };
}

/**
 * What to draw for a goal.
 * @returns {{
 *   world: object,         // a world spec for GridRenderer (gems = the goal layout)
 *   gemsMatter: boolean,   // false: the goal says nothing about the floor's gems (drawn faded,
 *                          // or not drawn when the goal wants them in the bag)
 *   robot: null | {x: number, y: number, dir: string | null},  // ghost robot; dir null = any way
 *   facing: string | null, // required direction when there is no end cell to draw it on
 *   bagAtLeast: number | null,
 *   summary: string,       // the same goal in words (accessible name and caption)
 * }}
 */
export function goalWorld(world, goal) {
  let gems = world.gems ?? {};
  let gemsMatter = true;
  if (goal.gems_exactly) gems = goal.gems_exactly;
  else if (goal.all_gems_collected) gems = {};
  else if (goal.bag_at_least) { gems = {}; gemsMatter = false; } // they're meant to end up in the bag
  else gemsMatter = false;

  const robot = goal.end_at ? { x: goal.end_at[0], y: goal.end_at[1], dir: goal.facing ?? null } : null;
  const facing = !goal.end_at && goal.facing ? goal.facing : null;
  const bagAtLeast = goal.bag_at_least ?? null;

  const parts = [];
  if (goal.gems_exactly && !Object.keys(gems).length) {
    parts.push("no gems left on the floor");
  } else if (goal.gems_exactly) {
    const cells = Object.values(gems).filter((n) => n > 0);
    const total = cells.reduce((a, n) => a + n, 0);
    parts.push(cells.length === total
      ? `a gem on each of ${plural(cells.length, "marked cell")}`
      : `${plural(total, "gem")} on ${plural(cells.length, "marked cell")}`);
  } else if (goal.all_gems_collected) {
    parts.push("no gems left on the floor");
  }
  if (bagAtLeast) parts.push(`at least ${plural(bagAtLeast, "gem")} in the bag`);
  if (robot) parts.push(`the robot on the marked cell${robot.dir ? `, facing ${DIR_NAMES[robot.dir]}` : ""}`);
  if (facing) parts.push(`the robot facing ${DIR_NAMES[facing]}`);
  const summary = parts.length ? `Goal: ${joinWords(parts)}.` : "Goal: finish without crashing.";

  const { width, height, blocked } = world;
  const start = robot ? [robot.x, robot.y, robot.dir ?? "E"] : world.start;
  return { world: { width, height, blocked, gems, start }, gemsMatter, robot, facing, bagAtLeast, summary };
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function joinWords(parts) {
  return parts.length < 3 ? parts.join(" and ") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}
