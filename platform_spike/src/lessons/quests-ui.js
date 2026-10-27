// Sub-quests (docs/quests.md): the strip of tabs that moves between a level's challenge and its
// sub-quests. Each sub-quest is a page of its own (app.js enterQuest): its own title, problem,
// world, goal and Run. One program is shared by all of them, so what solves a part carries into
// the next part and into the challenge.
//
// The strip shows, per part: done (the code solves it now), changed (solved before, but the code
// has changed since and doesn't any more), or not yet. It opens from the puzzle icon by Run, and
// is always there while a sub-quest is on screen. Nothing here shows code: the parts are
// problems, not answers.
import { QuestTracker, questStatus } from "./quests.js";
import { icon } from "../ui/icons.js";

export class QuestsUI {
  /**
   * deps: { controller, editor, progress (set once loaded), el: {button, panel, tabs, sr},
   *         setTimer, clearTimer, onEnter(index | null), onEvent(type, data) }
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.level = null;
    this.quests = [];
    this.states = [];
    this.current = null; // the sub-quest on screen, or null: the challenge
    this.pending = Promise.resolve();
    this.el.button.onclick = () => (this.isOpen && this.current === null ? this.close() : this.open());
  }

  /** A level's sub-quests (null: none; the icon hides). */
  attach(level, doc) {
    this.close();
    this.level = level;
    this.quests = doc?.quests ?? [];
    this.states = this.quests.map(() => null);
    this.tracker = new QuestTracker(this.quests.length);
    this.current = null;
    this.el.button.hidden = !this.quests.length;
  }

  /** Hide the icon and the strip (demo, drive mode). */
  setAvailable(on) {
    if (!on) this.close();
    this.el.button.hidden = !on || !this.quests.length;
  }

  get isOpen() { return !this.el.panel.hidden; }

  open() {
    if (!this.quests.length) return;
    if (!this.isOpen) this.onEvent("quests.opened", { level: this.level.id });
    this.el.panel.hidden = false;
    this.el.button.setAttribute("aria-expanded", "true");
    this.el.button.classList.add("on");
    this.render();
    this.check();
  }

  close() {
    if (this.current !== null) return; // inside a sub-quest the strip is the way back
    this.el.panel.hidden = true;
    this.el.button.setAttribute("aria-expanded", "false");
    this.el.button.classList.remove("on");
  }

  /** The app moved to sub-quest i (or to the challenge, null). */
  setCurrent(i) {
    this.current = i;
    if (i !== null) this.open(); else this.render();
  }

  quest(i) { return this.quests[i]; }

  /** Done now, per part (from the last check; false until checked). */
  doneNow() { return this.states.map((s) => Boolean(s?.done)); }

  /** Wait for a check in progress (a learner's Run waits, as for the guide). */
  idle() { return this.pending; }

  /** Which parts does the code solve? On opening, after each Run, on entering a part. Resolves
   *  to the engine's states ({done, why, result} per part), or null. */
  check() {
    if (!this.quests.length) return Promise.resolve(null);
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
      const { newlyDone } = this.tracker.update(this.states);
      this.states.forEach((s, i) => { if (s.done) this.progress?.markQuestDone(level.id, this.quests[i].id); });
      for (const i of newlyDone) this.onEvent("quest.done", { level: level.id, quest: this.quests[i].id });
      this.render(newlyDone);
      if (newlyDone.length) this.el.sr.textContent = `Sub-quest done: ${newlyDone.map((i) => this.quests[i].title).join(", ")}.`;
      return this.states;
    }).catch(() => null);
    return this.pending;
  }

  // ------------------------------------------------------------ drawing
  render(justDone = []) {
    if (!this.level) return;
    const before = new Set(this.progress?.questsDone(this.level.id) ?? []);
    const tab = (label, index, status) => {
      const b = document.createElement("button");
      b.className = `quest-tab ${status}${justDone.includes(index) ? " just-done" : ""}`;
      if (index === this.current) b.setAttribute("aria-current", "page");
      const mark = document.createElement("span");
      mark.className = "quest-mark";
      if (index === null) mark.innerHTML = icon("star");
      else if (status === "done") mark.innerHTML = icon("check");
      else mark.textContent = String(index + 1);
      const words = document.createElement("span");
      words.className = "quest-tab-title";
      words.textContent = label;
      const state = { done: "done", changed: "solved before, but not by the code as it is now", todo: "not done yet" }[status];
      b.title = index === null ? label : `${label}: ${state}`;
      b.setAttribute("aria-label", index === null ? `The challenge: ${label}` : `Sub-quest ${index + 1}: ${label}, ${state}`);
      b.append(mark, words);
      b.onclick = () => this.onEnter(index);
      return b;
    };
    this.el.tabs.replaceChildren(
      tab(this.level.title, null, "challenge"),
      ...this.quests.map((q, i) => tab(q.title, i, questStatus(Boolean(this.states[i]?.done), before.has(q.id)))),
    );
  }
}
