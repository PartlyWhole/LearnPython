// Hint ladder on the page (docs/lessons.md section 6): a lightbulb by the results, offered only
// after failed runs on a lesson's practice or twist level. Opening it shows one rung in the same
// strip style as the guide. It never covers the editor or the world. Logic: hints.js.
// In a shared room (`room`: {help(), setHelp(patch)}), the room is the learner: one ladder for
// everyone, counted from the room's runs (by whoever ran), and the rung on screen is everyone's.
import { HintLadder, rungsFor } from "./hints.js";
import { setCaption } from "./demo-ui.js";
import { renderDots } from "../ui/icons.js";

export class HintUI {
  /**
   * deps: progress (set at init), onEvent(type, data), onWatchDemo(lesson), pulseGoal(),
   *   el: {offer, panel, dots, say, code, copy, demo, close, sr}
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.ladder = null;
    this.room = null;
    this.el.offer.onclick = () => this.open();
    this.el.close.onclick = () => this.notNow();
    this.el.copy.onclick = () => navigator.clipboard?.writeText(this.el.code.textContent).catch(() => {});
    this.el.demo.onclick = () => this.lesson && this.onWatchDemo(this.lesson);
    this.el.panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); this.notNow(); }
    });
  }

  /** lesson: the lesson this level is practice or twist for (or null: no hints here). */
  attach(lesson, level) {
    this.lesson = lesson;
    this.level = level;
    this.rungs = lesson ? rungsFor(lesson, level.id) : null;
    const shared = this.room?.help().hint;
    this.ladder = lesson && (this.room || !this.progress.isSolved(level.id))
      ? new HintLadder(this.rungs.length, this.room ? shared ?? {} : this.progress.hintState(level.id)) : null;
    this.el.panel.hidden = true;
    this._renderOffer();
    if (shared) this.follow(shared);
  }

  /** The room's ladder changed (a run, or a partner opened or closed a rung): match it. */
  follow(hint) {
    if (!this.ladder || !hint) return;
    Object.assign(this.ladder, { failed: hint.failed, seen: hint.seen, failedAtSeen: hint.failedAtSeen, dismissed: hint.dismissed });
    if (hint.open === null) this.el.panel.hidden = true;
    else if (hint.open !== this.shown || this.el.panel.hidden) this._showRung(hint.open, { focus: false });
    this._renderOffer();
  }

  _share(open) {
    this.room?.setHelp({ hint: { ...this.ladder.state, dismissed: this.ladder.dismissed, open } });
  }

  _save() { if (!this.room) this.progress.setHintState(this.level.id, this.ladder.state); }

  /** A run's outcome is on screen. In a room, a partner's run is counted by them (`mine` false). */
  ran(passed, { mine = true } = {}) {
    if (!this.ladder || (this.room && !mine)) return;
    const newly = this.ladder.ran(passed);
    this._save();
    if (this.room) this._share(passed || this.el.panel.hidden ? null : this.shown);
    if (passed) {
      this.el.panel.hidden = true;
      this.el.offer.hidden = true;
      return;
    }
    if (newly) {
      this.onEvent("hint.offered", { level: this.level.id, rung: this.ladder.seen + 1 });
      this.el.sr.textContent = "A hint is available.";
    }
    this._renderOffer();
  }

  /** Was any rung opened on this level? (A solve is then recorded with: "hint".) */
  used() { return Boolean(this.ladder?.seen); }

  open() {
    if (!this.ladder) return;
    const i = this.ladder.open();
    this._save();
    this._share(i);
    this.onEvent("hint.opened", { level: this.level.id, rung: i + 1 });
    this._showRung(i);
  }

  _showRung(i, { focus = true } = {}) {
    if (!this.rungs?.[i]) return;
    this.shown = i;
    const text = this.rungs[i];
    const isCode = text.includes("\n");
    this.el.say.hidden = isCode;
    this.el.code.hidden = !isCode;
    this.el.copy.hidden = !isCode;
    if (isCode) this.el.code.textContent = text; else setCaption(this.el.say, text);
    renderDots(this.el.dots, this.rungs.length, i, { done: i });
    this.el.demo.hidden = !(i === this.rungs.length - 1 && this.lesson);
    this.el.panel.hidden = false;
    this._renderOffer();
    if (/Goal view/.test(text)) this.pulseGoal();
    if (!focus) return; // a partner opened it: don't move this person's focus or scroll
    this.el.panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
    this.el.close.focus({ preventScroll: true }); // the learner asked for it, so focus moves into the hint
  }

  notNow() {
    if (!this.ladder) return;
    this.ladder.notNow();
    this._share(null);
    this.el.panel.hidden = true;
    this._renderOffer();
  }

  _renderOffer() {
    this.el.offer.hidden = !this.ladder?.offering;
  }
}
