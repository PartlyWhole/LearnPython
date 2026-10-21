// Sub-quests panel (docs/quests.md): only when the learner asks (the puzzle icon by Run). A
// level's challenge broken into smaller problems, one open at a time. Each has the problem in a
// sentence, a picture of its own small world (start → goal), and an automatic check: it ticks
// itself off when the code solves that part. "Try it" runs just that part in the world, so the
// learner can watch (and step through) one piece on its own. A bulb hides a thinking nudge.
// Nothing here shows code: the parts are problems, not answers.
import { questPicture, canTry, textParts, QuestTracker } from "./quests.js";
import { goalWorld } from "../render/goal.js";
import { GridRenderer } from "../render/renderer.js";
import { icon } from "../ui/icons.js";

export class QuestsUI {
  /**
   * deps: { controller, editor, el: {button, panel, list, dots, close, sr}, setTimer, clearTimer,
   *         onTry(world, result, quest, goal), onEvent(type, data) }
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.level = null;
    this.quests = [];
    this.states = [];
    this.openIndex = 0;
    this.pending = Promise.resolve();
    this.el.button.onclick = () => (this.el.panel.hidden ? this.open() : this.close());
    this.el.close.onclick = () => this.close();
    this.el.panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { this.close(); this.el.button.focus(); }
    });
  }

  /** A level's sub-quests (null: none; the icon hides). */
  attach(level, doc) {
    this.close();
    this.level = level;
    this.quests = doc?.quests ?? [];
    this.states = this.quests.map(() => null);
    this.tracker = new QuestTracker(this.quests.length);
    this.openIndex = 0;
    this.acted = false; // reasons (red) only once the learner has run or tried something
    this.el.button.hidden = !this.quests.length;
  }

  /** Hide the icon and the panel (demo, drive mode). */
  setAvailable(on) {
    if (!on) this.close();
    this.el.button.hidden = !on || !this.quests.length;
  }

  open() {
    if (!this.quests.length) return;
    this.el.panel.hidden = false;
    // One kind of help at a time: the step-by-step guide steps aside while sub-quests are open.
    this.el.panel.closest(".editor-panel")?.classList.add("quests-on");
    this.el.button.setAttribute("aria-expanded", "true");
    this.el.button.classList.add("on");
    this.onEvent("quests.opened", { level: this.level.id });
    this.render();
    this.check();
  }

  close() {
    this.el.panel.hidden = true;
    this.el.panel.closest(".editor-panel")?.classList.remove("quests-on");
    this.el.button.setAttribute("aria-expanded", "false");
    this.el.button.classList.remove("on");
  }

  get isOpen() { return !this.el.panel.hidden; }

  /** Wait for a check in progress (a learner's Run waits, as for the guide). */
  idle() { return this.pending; }

  /** Ask the engine which sub-quests the code completes: on opening (to tick off what's
   *  already done), and after each Run or Try it (`acted`: now say why a part isn't done). */
  check({ acted = false } = {}) {
    if (acted) this.acted = true;
    if (!this.isOpen || !this.quests.length) return this.pending;
    const code = this.editor.getCode();
    const level = this.level;
    const request = { type: "quests", code, level, quests: this.quests };
    this.pending = this.pending.then(async () => {
      this.el.panel.classList.add("checking");
      let out = await this.controller.run(request);
      for (let i = 0; out.status === "busy" && i < 20; i++) {
        await new Promise((r) => this.setTimer(r, 150));
        out = await this.controller.run(request);
      }
      this.el.panel.classList.remove("checking");
      if (out.status !== "done" || this.level !== level) return null;
      this.states = out.payload.quests;
      this.checkedCode = code;
      const first = !this.tracker.checked;
      const { newlyDone, current } = this.tracker.update(this.states);
      if (first && current >= 0) this.openIndex = current; // open on the first part not done yet
      for (const i of newlyDone) this.onEvent("quest.done", { level: level.id, quest: this.quests[i].id });
      // Move on to the next part when the open one just got done.
      if (newlyDone.includes(this.openIndex) && current >= 0) this.openIndex = current;
      this.render(newlyDone);
      if (newlyDone.length) {
        const names = newlyDone.map((i) => this.quests[i].title).join(", ");
        this.el.sr.textContent = `Sub-quest done: ${names}.`;
      }
      return out.payload;
    }).catch(() => null);
    return this.pending;
  }

  // ------------------------------------------------------------ drawing
  render(justDone = []) {
    const n = this.quests.length;
    const doneCount = this.states.filter((s) => s?.done).length;
    this.el.dots.replaceChildren(...this.quests.map((_, i) => {
      const dot = document.createElement("span");
      dot.className = `dot${this.states[i]?.done ? " done" : ""}${i === this.openIndex ? " now" : ""}`;
      return dot;
    }));
    this.el.dots.setAttribute("aria-label", `${doneCount} of ${n} done`);
    this.el.list.replaceChildren(...this.quests.map((q, i) => this._item(q, i, justDone.includes(i))));
  }

  _item(quest, i, justDone) {
    const state = this.states[i];
    const open = i === this.openIndex;
    const li = document.createElement("li");
    li.className = `quest${state?.done ? " done" : ""}${open ? " open" : ""}${justDone ? " just-done" : ""}`;

    const head = document.createElement("button");
    head.className = "quest-head";
    head.setAttribute("aria-expanded", String(open));
    const mark = document.createElement("span");
    mark.className = "quest-mark";
    if (state?.done) mark.innerHTML = icon("check"); else mark.textContent = String(i + 1);
    const title = document.createElement("span");
    title.className = "quest-title";
    title.textContent = quest.title;
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = state?.done ? " (done)" : "";
    head.append(mark, title, sr);
    head.onclick = () => { this.openIndex = open ? -1 : i; this.render(); };
    li.append(head);
    if (!open) return li;

    const body = document.createElement("div");
    body.className = "quest-body";
    const ask = document.createElement("p");
    ask.className = "quest-ask";
    for (const part of textParts(quest.ask)) {
      const node = document.createElement(part.code ? "code" : "span");
      node.textContent = part.text;
      ask.append(node);
    }
    body.append(ask);

    const pic = questPicture(quest, this.level);
    if (pic) body.append(this._picture(pic));

    // Not done after the learner ran or tried it: what happened, in one line (never how to fix
    // it). A function not written yet is said calmly at any time: it's the part to write.
    if (state && !state.done && state.why && this.checkedCode === this.editor.getCode() && (this.acted || state.missing)) {
      const why = document.createElement("p");
      why.className = `quest-why${state.missing ? " missing" : ""}`; // not written yet: no alarm
      why.textContent = state.why;
      body.append(why);
    }

    const actions = document.createElement("div");
    actions.className = "quest-actions";
    if (canTry(quest)) {
      const tryIt = document.createElement("button");
      tryIt.className = "round-button quest-try";
      tryIt.innerHTML = `${icon("play")}<span class="label">Try it</span>`;
      tryIt.setAttribute("aria-label", `Try it: run this part on its own${quest.check.test ? ` (${quest.check.test.call}())` : ""}`);
      tryIt.onclick = () => this._try(quest, i);
      if (state?.missing) {
        tryIt.disabled = true;
        tryIt.title = `Write ${quest.check.test.call}() first`;
      }
      actions.append(tryIt);
    }
    if (quest.nudge) {
      const bulb = document.createElement("button");
      bulb.className = "icon-button quest-nudge-button";
      bulb.innerHTML = icon("bulb");
      bulb.setAttribute("aria-label", "A way to think about it");
      bulb.title = "A way to think about it";
      bulb.setAttribute("aria-expanded", "false");
      const nudge = document.createElement("p");
      nudge.className = "quest-nudge";
      nudge.textContent = quest.nudge;
      nudge.hidden = true;
      bulb.onclick = () => {
        nudge.hidden = !nudge.hidden;
        bulb.setAttribute("aria-expanded", String(!nudge.hidden));
        if (!nudge.hidden) this.onEvent("quest.nudge", { level: this.level.id, quest: quest.id });
      };
      actions.append(bulb);
      body.append(actions, nudge);
    } else if (actions.childElementCount) {
      body.append(actions);
    }
    li.append(body);
    return li;
  }

  /** Start → goal: the part's world as it begins, and what it should look like after. Drawn at
   *  a size per cell (a long corridor is long, not tiny); side by side, or one above the other
   *  when two wouldn't fit across. */
  _picture({ world, goal, mark }) {
    const fig = document.createElement("figure");
    const both = Boolean(goal && Object.keys(goal).length);
    const room = Math.max(220, (this.el.list.clientWidth || 320) - 44); // the part's body width
    const span = world.width + 0.6; // the drawing keeps a small margin round the grid
    const tall = Math.min(26, 104 / world.height);
    const sideBySide = Math.min(tall, (room - 42) / 2 / span) - 0.4; // two pictures and an arrow
    const stacked = !both || sideBySide < 13; // too small to read side by side: one above the other
    const cell = stacked ? Math.max(10, Math.min(tall, (room - 10) / span)) : sideBySide;
    fig.className = `quest-pic${both && stacked ? " stacked" : ""}`;
    fig.style.setProperty("--pic-w", `${Math.round(cell * span + 8)}px`);
    const start = document.createElement("div");
    start.className = "quest-grid";
    const r = new GridRenderer(start);
    r.setWorld(world);
    r.svg.setAttribute("aria-hidden", "true");
    if (mark) r.markTarget(mark);
    fig.append(start);
    if (goal && Object.keys(goal).length) {
      const arrow = document.createElement("span");
      arrow.className = "quest-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.innerHTML = icon("next");
      const end = document.createElement("div");
      end.className = "quest-grid";
      const view = goalWorld(world, goal);
      new GridRenderer(end).setGoal(view);
      const caption = document.createElement("figcaption");
      caption.className = "sr-only";
      caption.textContent = view.summary;
      fig.append(arrow, end, caption);
    }
    return fig;
  }

  async _try(quest, i) {
    this.onEvent("quest.try", { level: this.level.id, quest: quest.id });
    const payload = await this.check({ acted: true });
    const result = payload?.quests?.[i]?.result;
    if (!result) return;
    const pic = questPicture(quest, this.level);
    this.onTry(pic.world, result, quest, pic.goal);
  }
}
