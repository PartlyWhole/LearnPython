// Step-by-step guide logic (docs/lessons.md section 5). Pure: no DOM, timers injected, so it is
// unit-tested. Whether a step is done is decided by engine.guide_state in the worker; this file
// only turns those booleans into what the panel shows.

/** The current step is the first one not yet satisfied; steps.length means all are. */
export function currentStep(results) {
  const i = results.indexOf(false);
  return i < 0 ? results.length : i;
}

/**
 * Follows the guide through one try. update() takes the engine's answer and says what changed:
 *   index      the step to show (steps.length = finished)
 *   advanced   moved forward: flash the finished step's dot before showing the next one
 *   ahead      true once per try: every step but the last (the run) was done before step 2
 *              was ever on screen, so the learner is ahead of the guide (section 5.5)
 */
export class GuideTracker {
  constructor(stepCount) {
    this.n = stepCount;
    this.index = null;
    this.maxShown = -1;
    this.aheadReported = false;
  }

  update({ syntax_ok: syntaxOk, steps }) {
    if (!syntaxOk) return { index: this.index ?? 0, syntaxError: true, advanced: false, ahead: false };
    const index = currentStep(steps);
    const advanced = this.index !== null && index > this.index;
    let ahead = false;
    if (!this.aheadReported && this.maxShown < 1 && this.n > 2 && index >= this.n - 1) {
      ahead = this.index !== null; // the first answer after load is a returning draft, not a lead
      this.aheadReported = true;
    }
    this.index = index;
    this.maxShown = Math.max(this.maxShown, Math.min(index, this.n - 1));
    return { index, syntaxError: false, advanced, ahead, finished: index >= this.n };
  }
}

/** Run fn once things have been quiet for ms (editor changes arrive on every keystroke). */
export class Debouncer {
  constructor(ms, { setTimer, clearTimer }) {
    Object.assign(this, { ms, setTimer, clearTimer });
    this.timer = null;
  }

  call(fn) {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = this.setTimer(() => { this.timer = null; fn(); }, this.ms);
  }

  cancel() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }
}

/**
 * Line diff for "Show me": the example's lines, each marked added if it isn't matched in the
 * learner's code (longest common subsequence, compared without surrounding whitespace changes).
 */
export function lineDiff(current, example) {
  const a = current.replace(/\s+$/, "").split("\n"), b = example.replace(/\s+$/, "").split("\n");
  const same = (x, y) => x.trimEnd() === y.trimEnd();
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      L[i][j] = same(a[i], b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (j < b.length) {
    if (i < a.length && same(a[i], b[j])) { out.push({ text: b[j], added: false }); i++; j++; }
    else if (i < a.length && L[i + 1][j] >= L[i][j + 1]) i++;
    else { out.push({ text: b[j], added: true }); j++; }
  }
  return out;
}
