// Step-by-step guide on the page (docs/lessons.md section 5): a quiet strip above the editor with
// progress dots, one instruction and two icon buttons (Show me, Hide). It never blocks the editor
// and never takes focus by itself. Which steps are done is the engine's answer (guide_state);
// guide.js turns it into what to show.
import { GuideTracker, Debouncer, lineDiff } from "./guide.js";
import { setCaption } from "./demo-ui.js";
import { renderDots } from "../ui/icons.js";

const FLASH_MS = 700;   // a finished step's dot shows its check before the next instruction
const DEBOUNCE_MS = 400;

export class GuideUI {
  /**
   * deps: editor, controller, progress, setTimer, clearTimer,
   *   el: {panel, dots, say, sr, show, hide, chip, preview, previewCode, use, closePreview, offer, offerOff, offerKeep}
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.lesson = null;
    this.debounce = new Debouncer(DEBOUNCE_MS, deps);
    this.pending = Promise.resolve();
    this.el.show.onclick = () => this.togglePreview();
    this.el.hide.onclick = () => this.hide();
    this.el.chip.onclick = () => this.show();
    this.el.use.onclick = () => this.useExample();
    this.el.closePreview.onclick = () => this.closePreview();
    this.el.offerOff.onclick = () => this._answerOffer("accepted");
    this.el.offerKeep.onclick = () => this._answerOffer("declined");
    this.el.panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); this.hide(); this.editor.focus(); }
    });
  }

  /** Called when a level opens. The guide only exists on a lesson's guided level, until it's solved. */
  attach(lesson, level) {
    this.detach();
    if (!lesson || lesson.guided.level !== level.id || this.progress.isSolved(level.id)) return;
    this.lesson = lesson;
    this.level = level;
    this.steps = lesson.guided.steps;
    this.tracker = new GuideTracker(this.steps.length);
    this.shownThisTry = false;
    this.usedShowMe = false;
    this.lastRun = null;
    this.index = null; // nothing announced yet: the first answer announces step 1
    const wanted = this.progress.setting("stepByStep") && !this.progress.guideHidden(level.id);
    if (wanted) this.show({ remember: false }); else this._collapse();
  }

  detach() {
    this.debounce.cancel();
    this.clearTimer(this.flashTimer);
    this.lesson = null;
    this.el.panel.hidden = true;
    this.el.chip.hidden = true;
    this.closePreview();
  }

  get active() { return Boolean(this.lesson) && !this.el.panel.hidden; }

  /** "guided+shown" | "guided" | "none": how the level was solved, for progress. */
  help() {
    if (!this.lesson) return "none";
    return this.usedShowMe ? "guided+shown" : this.shownThisTry ? "guided" : "none";
  }

  // ------------------------------------------------------------ events from the app
  codeChanged() {
    if (this.active) this.debounce.call(() => this.evaluate());
  }

  /** The app ran the level: {code, passed, error, end}. Run checks count only for that code. */
  noteRun(run) {
    if (!this.lesson) return;
    this.lastRun = run;
    if (this.active) this.evaluate();
  }

  solved() {
    if (!this.lesson) return;
    this.progress.markGuided(this.lesson.id, "done");
    if (this.active) this._render({ index: this.steps.length, finished: true });
    this.lesson = null; // a solved level is no longer a first try
    this.el.chip.hidden = true;
  }

  /** Resolves when no guide check is in flight, so Run never meets a busy worker. */
  idle() { return this.pending; }

  show({ remember = true } = {}) {
    if (!this.lesson) return;
    if (remember) this.progress.setGuideHidden(this.level.id, false);
    this.el.chip.hidden = true;
    this.el.panel.hidden = false;
    if (!this.shownThisTry) this.onEvent?.("lesson.beat_started", { lesson: this.lesson.id, beat: "guided" });
    this.shownThisTry = true;
    this.evaluate();
  }

  hide() {
    if (!this.lesson) return;
    this.onEvent?.("guide.hidden", { lesson: this.lesson.id, step: (this.index ?? 0) + 1 });
    this.progress.setGuideHidden(this.level.id, true);
    this._collapse();
  }

  /** The setting changed: apply it now (turning it off collapses the guide to its chip). */
  settingChanged(on) {
    if (!this.lesson) return;
    if (on && !this.progress.guideHidden(this.level.id)) this.show({ remember: false }); else this._collapse();
  }

  // ------------------------------------------------------------ Show me
  togglePreview() {
    if (!this.el.preview.hidden) return this.closePreview();
    const at = Math.min(this.index ?? 0, this.steps.length - 1);
    const step = this.steps[at];
    const example = step.example ?? [...this.steps].slice(0, at + 1).reverse().find((s) => s.example)?.example;
    if (!example) return;
    this.example = example;
    this.el.previewCode.replaceChildren(...lineDiff(this.editor.getCode(), example).map(({ text, added }) => {
      const line = document.createElement("span");
      line.className = added ? "line added" : "line";
      line.textContent = text || " ";
      return line;
    }));
    this.el.preview.hidden = false;
    this.el.show.setAttribute("aria-expanded", "true");
  }

  closePreview() {
    this.el.preview.hidden = true;
    this.el.show.setAttribute("aria-expanded", "false");
  }

  useExample() {
    this.editor.setCode(this.example); // one transaction: Ctrl/Cmd+Z restores the learner's code
    this.usedShowMe = true;
    this.onEvent?.("guide.show_me", { lesson: this.lesson.id, step: this.index + 1 });
    this.closePreview();
    this.editor.focus();
  }

  // ------------------------------------------------------------ internals
  _collapse() {
    this.el.panel.hidden = true;
    this.el.chip.hidden = !this.lesson;
    this.closePreview();
    this.debounce.cancel();
  }

  evaluate() {
    if (!this.lesson) return;
    const code = this.editor.getCode();
    const request = { type: "guide", code, steps: this.steps.map((s) => s.done_when), run: this.lastRun };
    this.pending = this.pending.then(async () => {
      let out = await this.controller.run(request);
      for (let i = 0; out.status === "busy" && i < 20; i++) { // a learner's run is in progress
        await new Promise((r) => this.setTimer(r, 150));
        out = await this.controller.run(request);
      }
      if (out.status !== "done" || !this.lesson || this.editor.getCode() !== code) return;
      this._apply(this.tracker.update(out.payload));
    }).catch(() => {});
  }

  _apply(state) {
    if (state.ahead && this.progress.aheadOffer() === "unasked" && this.progress.noteAheadOfGuide() >= 3) {
      this.el.offer.hidden = false;
    }
    this.clearTimer(this.flashTimer);
    if (state.advanced && !state.finished) {
      // Check off the finished dot first, then show the next instruction.
      renderDots(this.el.dots, this.steps.length, -1, { done: state.index });
      this.flashTimer = this.setTimer(() => this._render(state), FLASH_MS);
    } else {
      this._render(state);
    }
  }

  _render({ index, syntaxError = false, finished = index >= this.steps.length }) {
    const n = this.steps.length;
    const changed = index !== this.index;
    this.index = index;
    renderDots(this.el.dots, n, finished ? -1 : index, { done: finished ? n : index });
    this.el.panel.classList.toggle("finished", finished);
    this.el.panel.classList.toggle("syntax", syntaxError);
    const text = finished ? this.lesson?.guided.done ?? this.steps.at(-1).say
      : syntaxError ? "Python can't read this yet. Check the line you're typing."
      : this.steps[index].say;
    setCaption(this.el.say, text);
    this.el.show.hidden = finished || !this.steps.some((s) => s.example);
    // Screen readers hear the step number and text once per change of step, not per keystroke.
    if (changed && !finished) this.onEvent?.("guide.step_shown", { lesson: this.lesson.id, step: index + 1 });
    if (changed || finished) {
      this.el.sr.textContent = finished ? `All ${n} steps done. ${text}` : `Step ${index + 1} of ${n}. ${this.steps[index].say.replaceAll("`", "")}`;
    }
    this.el.panel.setAttribute("aria-label", finished ? "Step-by-step help: done" : `Step-by-step help, step ${index + 1} of ${n}`);
    if (changed) this.closePreview();
  }

  _answerOffer(answer) {
    this.progress.setAheadOffer(answer);
    this.el.offer.hidden = true;
    if (answer === "accepted") {
      this.progress.setSetting("stepByStep", false);
      this.onSettingChanged?.(false);
      this._collapse();
    }
  }
}
