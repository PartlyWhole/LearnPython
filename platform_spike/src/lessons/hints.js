// Hint ladder logic (docs/lessons.md section 6). Pure: no DOM, so it is unit-tested. Hints are
// offered, never pushed, and climb only on evidence: failed runs. Idle time never triggers one
// (a learner reading is not a learner stuck).
//
//   rung 1 unlocks after 2 failed runs on the level
//   rung 2 after rung 1 was seen and 1 more failed run
//   rung 3 after rung 2 was seen and 2 more failed runs
// "Not now" hides the offer until the next failed run. A pass ends the ladder.

export const FAILS_TO_UNLOCK = [2, 1, 2];

/** The rungs for a level: the lesson's hints, or one default that points at the Goal view. */
export function rungsFor(lesson, levelId) {
  const own = lesson?.hints?.[levelId];
  return own?.length ? own : ["Compare your result with the Goal view."];
}

/** The practice or twist lesson a level belongs to, or null. */
export function lessonForPractice(lessons, levelId) {
  return lessons.find((l) => l.practice?.includes(levelId) || l.twist === levelId) ?? null;
}

export class HintLadder {
  /**
   * @param {number} rungCount
   * @param {{failed?: number, seen?: number, failedAtSeen?: number}} state  persisted per level
   */
  constructor(rungCount, state = {}) {
    this.n = rungCount;
    this.failed = state.failed ?? 0;
    this.seen = state.seen ?? 0;              // how many rungs have been opened
    this.failedAtSeen = state.failedAtSeen ?? 0; // failed runs when the last rung was opened
    this.dismissed = false;
  }

  get state() { return { failed: this.failed, seen: this.seen, failedAtSeen: this.failedAtSeen }; }

  /** How many rungs are unlocked now. */
  get unlocked() {
    if (this.seen === 0) return this.failed >= FAILS_TO_UNLOCK[0] ? 1 : 0;
    if (this.seen >= this.n) return this.n;
    return this.failed - this.failedAtSeen >= FAILS_TO_UNLOCK[this.seen] ? this.seen + 1 : this.seen;
  }

  /** Show the offer (the lightbulb)? Only for a rung not yet opened, and not right after "Not now". */
  get offering() { return !this.dismissed && this.unlocked > this.seen; }

  /** A run finished. Returns true if this run newly made an offer. */
  ran(passed) {
    if (passed) { this.dismissed = true; return false; }
    const before = this.offering;
    this.failed += 1;
    this.dismissed = false;
    return this.offering && !before;
  }

  /** Open the next unlocked rung; returns its index (0-based), or the last seen one. */
  open() {
    if (this.unlocked > this.seen) {
      this.seen += 1;
      this.failedAtSeen = this.failed;
    }
    return this.seen - 1;
  }

  notNow() { this.dismissed = true; }
}
