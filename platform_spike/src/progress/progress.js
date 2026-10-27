// Learner progress: which levels are solved, the draft code for each level, which lesson demos
// have been watched or skipped, and which levels
// are unlocked. Storage is injected (localStorage in the app, a Map in tests) and every access is
// wrapped, because browser storage can be missing, full or wiped: Safari deletes it after 7 days
// without a visit (docs/ASSUMPTIONS_AUDIT.md A14). Progress here is a convenience, not a record.

const KEY = "learnpython/progress/v1";
// The game was called Gem Rover before; progress saved under its key moves over on first load.
const LEGACY_KEYS = ["gem-rover/progress/v1"];
// Fields added since the first stores (lessons, settings, guide, nudges) get defaults when an
// older store loads, so nothing needs migrating.
const EMPTY = () => ({
  solved: {}, drafts: {}, lessons: {},
  settings: { stepByStep: true },
  guide: { hidden: {} },
  quests: {}, // level id -> sub-quest ids solved at least once (a later edit can break one again)
  hints: {},
  nudges: { aheadOfGuide: 0, aheadOffer: "unasked" },
});

/** Wrap window.localStorage so failures never break the game. */
export function browserStorage() {
  return {
    get(key) { try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; } },
    set(key, value) { try { globalThis.localStorage?.setItem(key, value); return true; } catch { return false; } },
  };
}

/** In-memory storage for tests (and as a fallback). */
export function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { get: (k) => map.get(k) ?? null, set: (k, v) => { map.set(k, v); return true; }, map };
}

/**
 * @param order  the play order: playOrder() from src/lessons/order.js ({items, levels}), or an
 *               older {units: [{levels}]} index (each level is then its own item)
 * @param {{get, set}} storage
 *
 * Unlocking (docs/lessons.md section 7): items unlock in order. A plain level is complete when
 * solved. A lesson opens its guided level and its twist (the "I know this" path) together; its
 * practice opens once the guided level is solved; it is complete when its twist is solved, or
 * all its practice is (or, with neither, when its guided level is). A solved level always stays open.
 */
export class Progress {
  constructor(order, storage) {
    this.items = order.items ?? order.units.flatMap((u) => u.levels.map((id) => (
      { lesson: null, levels: [id], guided: id, practice: [], twist: null })));
    this.order = this.items.flatMap((i) => i.levels);
    this.itemOf = new Map(this.items.flatMap((item, k) => item.levels.map((id) => [id, k])));
    this.storage = storage;
    this.data = this._load();
  }

  _load() {
    for (const key of [KEY, ...LEGACY_KEYS]) {
      try {
        const raw = JSON.parse(this.storage.get(key) ?? "null");
        if (raw && typeof raw === "object" && raw.solved && raw.drafts) {
          const data = { ...EMPTY(), ...raw };
          if (key !== KEY) this.storage.set(KEY, JSON.stringify(data)); // migrate once
          return data;
        }
      } catch { /* corrupted: try the next key, then start fresh */ }
    }
    return EMPTY();
  }

  _save() { this.storage.set(KEY, JSON.stringify(this.data)); }

  isSolved(id) { return Boolean(this.data.solved[id]); }

  /** Is item k done, so the next one opens? */
  itemComplete(k) {
    const item = this.items[k];
    if (item.twist && this.isSolved(item.twist)) return true;
    if (item.practice.length) return item.practice.every((id) => this.isSolved(id));
    return !item.twist && this.isSolved(item.guided);
  }

  itemUnlocked(k) { return k === 0 || this.itemComplete(k - 1); }

  isUnlocked(id) {
    const k = this.itemOf.get(id);
    if (k === undefined) return false;
    if (this.isSolved(id) || this.setting("unlockAll") === true) return true; // Settings: Unlock all levels
    if (k > 0 && !this.itemComplete(k - 1)) return false;
    const item = this.items[k];
    if (id === item.guided || id === item.twist) return true;
    return this.isSolved(item.guided); // practice
  }

  /** Where to send the learner: the first open, unsolved level of the first unfinished item. */
  current() {
    for (let k = 0; k < this.items.length; k++) {
      if (this.itemComplete(k)) continue;
      const open = this.items[k].levels.find((id) => !this.isSolved(id) && this.isUnlocked(id));
      if (open) return open;
    }
    return this.order.at(-1);
  }

  /** Where Continue goes after solving id: the next open level in play order, solved or not.
   *  So replaying an earlier level leads to the one after it, not to the furthest level reached.
   *  Inside a lesson that is guided → practice → twist; then the next item. null at the end. */
  next(id) {
    const i = this.order.indexOf(id);
    if (i < 0) return null;
    return this.order.slice(i + 1).find((x) => this.isUnlocked(x)) ?? null;
  }

  /** help: "none" | "guided" (the step-by-step guide was on screen) | "guided+shown" (Show me used). */
  /** bonus: solved within the level's line limit. Once earned, a bonus stays. */
  markSolved(id, code, when = Date.now(), help = "none", bonus = false) {
    if (!this.order.includes(id)) return;
    const had = this.data.solved[id]?.bonus === true;
    this.data.solved[id] = { at: when, code, with: help, ...((bonus || had) && { bonus: true }) };
    this._save();
  }

  /** Sub-quests of a level solved at least once. */
  questsDone(levelId) { return this.data.quests?.[levelId] ?? []; }

  markQuestDone(levelId, questId) {
    if (!this.order.includes(levelId)) return;
    this.data.quests ??= {};
    const done = new Set(this.data.quests[levelId] ?? []);
    if (done.has(questId)) return;
    done.add(questId);
    this.data.quests[levelId] = [...done];
    this._save();
  }

  /** Was this level solved within its line limit (the bonus)? */
  hasBonus(id) { return this.data.solved[id]?.bonus === true; }

  setting(name) { return this.data.settings[name]; }

  setSetting(name, value) {
    this.data.settings[name] = value;
    this._save();
  }

  /** Did the learner hide the guide on this level? (Show steps brings it back.) */
  guideHidden(levelId) { return Boolean(this.data.guide.hidden[levelId]); }

  setGuideHidden(levelId, hidden) {
    if (hidden) this.data.guide.hidden[levelId] = true; else delete this.data.guide.hidden[levelId];
    this._save();
  }

  /** The hint ladder's state on a level ({failed, seen, failedAtSeen}), or undefined. */
  hintState(levelId) { return this.data.hints[levelId]; }

  setHintState(levelId, state) {
    this.data.hints[levelId] = state;
    this._save();
  }

  /** Count tries where the learner got ahead of the guide; the offer to turn it off is made once. */
  noteAheadOfGuide() {
    this.data.nudges.aheadOfGuide += 1;
    this._save();
    return this.data.nudges.aheadOfGuide;
  }

  aheadOffer() { return this.data.nudges.aheadOffer; }

  setAheadOffer(answer) {
    this.data.nudges.aheadOffer = answer;
    this._save();
  }

  draft(id) { return this.data.drafts[id] ?? null; }

  saveDraft(id, code) {
    this.data.drafts[id] = code;
    this._save();
  }

  /** A lesson's demo: null (not yet), or {watch: "done" | "skipped", at}. */
  lesson(id) { return this.data.lessons[id] ?? null; }

  /** Skipping a replay never undoes a demo already watched to the end. */
  markLesson(id, watch, when = Date.now()) {
    const was = this.data.lessons[id];
    if (was?.watch === "done") watch = "done";
    this.data.lessons[id] = { ...was, watch, at: when };
    this._save();
  }

  /** The guided try of a lesson was solved ("done"). */
  markGuided(id, how = "done") {
    this.data.lessons[id] = { ...this.data.lessons[id], guided: how };
    this._save();
  }

  counts() {
    return { solved: this.order.filter((id) => this.isSolved(id)).length, total: this.order.length };
  }
}
