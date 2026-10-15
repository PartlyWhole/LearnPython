// Demo player on the page: steps a lesson's "Watch" beat through the real editor, world and
// replay (docs/lessons.md sections 1-2; build-guidance skill, references/surfaces.md). The
// learner paces it: nothing advances on a timer. Step logic is in demo.js; game rules stay in
// engine.py (demo runs go through the worker like any run).
import { demoSteps, typingPlan, predictionFeedback, predictionMark, describeCell } from "./demo.js";
import { buildFrames } from "../render/frames.js";
import { renderDots } from "../ui/icons.js";

/** Captions mark code with backticks: show those parts as <code>, the rest as plain text. */
export function setCaption(el, text) {
  el.replaceChildren(...text.split("`").map((part, i) => {
    if (i % 2 === 0) return document.createTextNode(part);
    const code = document.createElement("code");
    code.textContent = part;
    return code;
  }));
}

export class DemoPlayer {
  /**
   * @param {object} deps
   *   editor, renderer, player (TracePlayer), controller (RunController)
   *   el: {panel, name, count, say, predict, feedback, back, next, replay, skip, focusTargets: {world, editor}}
   *   setTimer, clearTimer   wrapped timers (CLAUDE.md invariant 10)
   *   reduceMotion           boolean
   *   onStart(), onExit(how) the app swaps its own level UI out and back in
   *   codeFor(levelId)       the learner's solved code for a level, or null (code_from steps)
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.active = false;
    this.el.back.onclick = () => this.go(this.i - 1);
    this.el.next.onclick = () => this.next();
    this.el.replay.onclick = () => this.go(0);
    this.el.skip.onclick = () => this.exit("skipped");
    this.el.panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); this.exit("skipped"); }
    });
  }

  start(lesson) {
    this.lesson = lesson;
    this.steps = demoSteps(lesson, { codeFor: this.codeFor });
    this.active = true;
    this.token = 0;
    this.el.name.textContent = lesson.title;
    this.el.panel.hidden = false;
    this.editor.setReadOnly(true);
    this.onStart();
    this.go(0);
    this.el.next.focus();
  }

  /** Next finishes a typing animation first; otherwise it moves on (or ends the demo). */
  next() {
    if (this.typing) return this.finishTyping();
    if (this.i === this.steps.length - 1) return this.exit("done");
    this.go(this.i + 1, { animate: true });
  }

  go(i, { animate = false } = {}) {
    if (!this.active || i < 0 || i >= this.steps.length) return;
    const prev = this.steps[this.i];
    const forward = animate && this.i === i - 1;
    this.i = i;
    const token = ++this.token;
    const st = this.steps[i];
    this.finishTyping({ apply: false });
    this.player.pause();
    this._clearFocus();
    this.renderer.stopPicking();
    if (!forward || st.predict) { this.pendingPredict = null; this.guess = null; }
    this.el.feedback.hidden = true;

    // Keep the world as the last step left it (so "the last cell is still empty" is visible),
    // except when this step switches worlds or the learner jumped back.
    if (!forward || st.worldChanged) {
      this.renderer.setWorld(st.world);
      this.player.load(buildFrames(st.world, []));
    }
    this.world = st.world;

    this.el.count.textContent = `Step ${i + 1} of ${st.total}`;
    renderDots(this.el.dots, st.total, i);
    setCaption(this.el.say, st.say);
    this.el.back.disabled = i === 0;
    // The last Next leaves the demo: the only place a word helps ("Try it").
    const last = i === st.total - 1;
    this.el.next.querySelector(".label").textContent = last ? "Try it" : "";
    this.el.next.setAttribute("aria-label", last ? "Try it yourself" : "Next");
    this.el.next.title = last ? "Try it yourself" : "Next";

    const fromCode = forward ? prev.code : null;
    const afterCode = () => {
      if (token !== this.token) return;
      this._applyFocus(st.focus);
      if (st.predict) this._showPredict(st.predict);
      else this.el.predict.hidden = true;
      if (st.run) this._run(st, token);
    };
    if (fromCode !== null && fromCode !== st.code && !this.reduceMotion) this._type(fromCode, st.code, afterCode);
    else { this.editor.setCode(st.code); afterCode(); }
  }

  exit(how) {
    if (!this.active) return;
    this.finishTyping({ apply: false });
    this.token++;
    this.player.pause();
    this._clearFocus();
    this.renderer.stopPicking();
    this.active = false;
    this.el.panel.hidden = true;
    this.el.predict.hidden = true;
    this.editor.setReadOnly(false);
    this.onExit(how);
  }

  /** The replay of a demo run reached its end (the app forwards the player's onEnd). */
  replayEnded() {
    if (!this.active || !this.lastRun) return;
    const { result, world } = this.lastRun;
    const last = this.player.frames.at(-1);
    if (result.error) this.renderer.showError(last, result.error.kind);
    if (this.pendingPredict) {
      const end = [result.final.x, result.final.y];
      const mark = predictionMark(this.pendingPredict, this.guess, end);
      this.el.feedback.textContent = mark;
      this.el.feedback.className = `demo-feedback ${mark.startsWith("✓") ? "right" : "wrong"}`;
      this.el.feedback.hidden = !mark;
      this.el.sr.textContent = predictionFeedback(this.pendingPredict, this.guess, end);
      this.pendingPredict = null;
    }
    this.lastRun = { result, world, shown: true };
  }

  // ------------------------------------------------------------ internals
  /** Runs queue behind each other: the controller answers "busy" to a second concurrent run. */
  _run(st, token) {
    const before = this.runQueue ?? Promise.resolve();
    this.runQueue = (async () => {
      await before;
      if (token !== this.token) return;
      const out = await this.controller.run({ type: "run", code: st.code, world: st.world, seed: 0 });
      if (token !== this.token || out.status !== "done") return;
      this.lastRun = { result: out.payload, world: st.world };
      this.player.load(buildFrames(st.world, out.payload.trace));
      if (out.payload.trace.length) this.player.play(); else this.replayEnded();
    })().catch(() => {});
  }

  _type(from, to, done) {
    const plan = typingPlan(from, to);
    const head = from.slice(0, plan.start), tail = from.slice(plan.removeTo);
    let n = 0;
    this.editor.setCode(head + tail);
    const tick = () => {
      n += 1;
      this.editor.setCode(head + plan.inserted.slice(0, n) + tail);
      if (n < plan.inserted.length) this.typing.timer = this.setTimer(tick, plan.msPerChar);
      else { this.typing = null; done(); }
    };
    this.typing = { to, done, timer: this.setTimer(tick, plan.msPerChar) };
  }

  /** Jump to the end of a typing animation. apply: false drops it (the step is being left). */
  finishTyping({ apply = true } = {}) {
    if (!this.typing) return;
    const { to, done, timer } = this.typing;
    this.clearTimer(timer);
    this.typing = null;
    if (apply) { this.editor.setCode(to); done(); }
  }

  _showPredict(predict) {
    this.pendingPredict = predict;
    const box = this.el.predict;
    box.replaceChildren();
    box.hidden = false;
    if (predict.cell) {
      // The dashed cursor on the grid is the cue; this sentence is for screen readers only.
      const help = document.createElement("p");
      help.className = "sr-only";
      help.textContent = "Pick a cell: click it, or focus the world, use the arrow keys, then Enter.";
      box.append(help);
      this.renderer.pickCell({
        start: this.world.start,
        onMove: (cell) => { this.el.sr.textContent = describeCell(cell); },
        onPick: (cell) => { this.guess = cell; this.el.sr.textContent = `You picked ${describeCell(cell)}.`; },
      });
    } else {
      const group = document.createElement("div");
      group.setAttribute("role", "radiogroup");
      group.setAttribute("aria-label", this.el.say.textContent);
      for (const choice of predict.choices) {
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "demo-predict";
        input.value = choice;
        input.onchange = () => { this.guess = choice; };
        label.append(input, ` ${choice}`);
        group.append(label);
      }
      box.append(group);
    }
  }

  _applyFocus(focus) {
    if (!focus) return;
    const [kind, arg] = focus.split(":");
    if (kind === "cell") this.renderer.highlightCell(arg.split(",").map(Number));
    else if (kind === "editor" && arg) this.editor.showLine(Number(arg));
    else this.el.focusTargets[kind === "editor" ? "editor" : "world"]?.classList.add("guide-ring");
  }

  _clearFocus() {
    this.renderer.highlightCell?.(null);
    this.editor.clearMarks();
    for (const t of Object.values(this.el.focusTargets)) t.classList.remove("guide-ring");
  }
}
