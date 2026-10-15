// Hint ladder on the page (docs/lessons.md section 6): a lightbulb by the results, offered only
// after failed runs on a lesson's practice or twist level. Opening it shows one rung in the same
// strip style as the guide. It never covers the editor or the world. Logic: hints.js.
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
    this.ladder = lesson && !this.progress.isSolved(level.id)
      ? new HintLadder(this.rungs.length, this.progress.hintState(level.id)) : null;
    this.el.panel.hidden = true;
    this._renderOffer();
  }

  /** A run's outcome is on screen. */
  ran(passed) {
    if (!this.ladder) return;
    const newly = this.ladder.ran(passed);
    this.progress.setHintState(this.level.id, this.ladder.state);
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
    this.progress.setHintState(this.level.id, this.ladder.state);
    this.onEvent("hint.opened", { level: this.level.id, rung: i + 1 });
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
    this.el.panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
    this.el.close.focus({ preventScroll: true }); // the learner asked for it, so focus moves into the hint
  }

  notNow() {
    if (!this.ladder) return;
    this.ladder.notNow();
    this.el.panel.hidden = true;
    this._renderOffer();
  }

  _renderOffer() {
    this.el.offer.hidden = !this.ladder?.offering;
  }
}
