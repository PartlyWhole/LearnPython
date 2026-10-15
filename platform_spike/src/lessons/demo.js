// Demo player logic (the lesson's "Watch" beat, docs/lessons.md section 2). Pure: no DOM, no
// timers, so it is unit-tested. src/lessons/demo-ui.js drives the page with it.

/** The lesson whose guided try is this level, or null. */
export function lessonForLevel(lessons, levelId) {
  return lessons.find((l) => l.guided?.level === levelId) ?? null;
}

/**
 * Resolve every watch step into the full state it shows. Code and world carry forward from
 * earlier steps, so any step can be shown on its own (Back, Replay, jumping in).
 * codeFor(levelId) gives the learner's solved code for a level (for code_from steps), or null.
 * @returns {Array<{index, total, say, code, world, worldChanged, focus, predict, run}>}
 */
export function demoSteps(lesson, { codeFor = () => null } = {}) {
  const steps = lesson.watch.steps;
  let code = "";
  let world = lesson.watch.world;
  return steps.map((step, index) => {
    const worldChanged = index === 0 || Boolean(step.world);
    if (step.world) world = step.world;
    // code_from: the learner's own program for that level (the drive log becomes code), if any.
    if (step.code !== undefined) code = (step.code_from && codeFor(step.code_from)) || step.code;
    return {
      index, total: steps.length, say: step.say, code, world, worldChanged,
      focus: step.focus ?? null, predict: step.predict ?? null, run: Boolean(step.run),
    };
  });
}

/** The smallest single edit that turns `from` into `to`: keep a common prefix and suffix. */
export function textChange(from, to) {
  let start = 0;
  while (start < from.length && start < to.length && from[start] === to[start]) start++;
  let endFrom = from.length, endTo = to.length;
  while (endFrom > start && endTo > start && from[endFrom - 1] === to[endTo - 1]) { endFrom--; endTo--; }
  return { start, removeTo: endFrom, inserted: to.slice(start, endTo) };
}

/**
 * How to animate a code change: remove the changed part at once, then type the new part.
 * Typing runs at charsPerSecond, but never takes longer than maxMs, so big steps stay quick.
 */
export function typingPlan(from, to, { charsPerSecond = 30, maxMs = 1500 } = {}) {
  const change = textChange(from, to);
  const n = change.inserted.length;
  const msPerChar = n ? Math.min(1000 / charsPerSecond, maxMs / n) : 0;
  return { ...change, msPerChar };
}

/** A cell in the learner's words: 1-based columns and rows. */
export function describeCell([x, y]) {
  return `column ${x + 1}, row ${y + 1}`;
}

/**
 * The visible mark after a prediction's run. Never a grade: a check when right; otherwise the
 * picture already shows the difference (the guessed cell keeps its ring, the robot sits where it
 * really ended), so a cell guess gets no mark and a choice gets just the answer.
 * (predictionFeedback is the full sentence, for screen readers.)
 */
export function predictionMark(predict, guess, endCell) {
  const right = guess !== null && guess !== undefined &&
    (predict.cell ? guess[0] === endCell[0] && guess[1] === endCell[1] : guess === predict.answer);
  if (right) return "✓";
  return predict.cell ? "" : String(predict.answer);
}

/**
 * Feedback once the code has run: never a grade, just what was guessed next to what happened.
 * @param predict  the step's predict ({cell, answer} or {choices, answer})
 * @param guess    the learner's guess ([x, y] or a choice), or null if they didn't guess
 * @param endCell  where the robot ended, [x, y] (used for cell predictions)
 */
export function predictionFeedback(predict, guess, endCell) {
  if (predict.cell) {
    const actual = describeCell(endCell);
    if (!guess) return `It ended in ${actual}.`;
    const same = guess[0] === endCell[0] && guess[1] === endCell[1];
    return same ? `You said ${describeCell(guess)}. Right: it ended there.`
                : `You said ${describeCell(guess)}. It ended in ${actual}.`;
  }
  if (guess === null || guess === undefined) return `The answer: ${predict.answer}.`;
  return guess === predict.answer ? `You said ${guess}. Right.` : `You said ${guess}. The answer: ${predict.answer}.`;
}
