// Drive mode on the page (docs/lessons.md section 3): big command buttons and a "Your moves" log
// where the editor would be. Each press re-runs the whole button program through the engine
// (check_level), so there is one set of game rules (D2); the replay shows only the newest step.
import { DriveProgram, describePress, DRIVE_KEYS } from "./drive.js";
import { buildFrames } from "../render/frames.js";
import { icon } from "../ui/icons.js";

const SETTLE_MS = 260; // presses are ignored while the last one animates

export class DriveUI {
  /**
   * deps: controller, renderer, player (TracePlayer: its onFrame updates caption and counters),
   *   setTimer, showWorld() (draw the level's world fresh), onPass(report, code),
   *   el: {panel, buttons, log, undo, reset, msg, sr}
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.program = new DriveProgram();
    this.active = false;
    this.el.undo.onclick = () => this.undo();
    this.el.reset.onclick = () => this.reset();
    this.el.panel.addEventListener("keydown", (e) => {
      const command = DRIVE_KEYS[e.key];
      if (command && this.level?.drive.buttons.includes(command)) { e.preventDefault(); this.press(command); }
      else if (e.key === "Backspace") { e.preventDefault(); this.undo(); }
    });
  }

  start(level) {
    this.level = level;
    this.active = true;
    this.passed = false;
    this.el.panel.hidden = false;
    this.el.buttons.replaceChildren(...level.drive.buttons.map((command) => {
      const b = document.createElement("button");
      b.className = "drive-button";
      b.dataset.command = command;
      b.setAttribute("aria-label", `${command}()`);
      b.innerHTML = `${icon(command)}<code>${command}()</code>`;
      b.onclick = () => this.press(command);
      return b;
    }));
    this.reset();
  }

  async press(command) {
    if (!this.active || this.busy || this.crashed || this.passed) return;
    this.busy = true;
    this.program.press(command);
    this._renderLog();
    const out = await this._check();
    this.setTimer(() => { this.busy = false; }, SETTLE_MS);
    if (out) this._show(out, { animate: true });
  }

  async undo() {
    if (!this.active || this.busy || !this.program.length) return;
    this.busy = true;
    this.program.undo();
    this._renderLog();
    this.passed = false;
    const out = this.program.length ? await this._check() : null;
    this.busy = false;
    if (out) this._show(out, { animate: false });
    else this._fresh();
  }

  reset() {
    this.program.reset();
    this._renderLog();
    this.passed = false;
    this._fresh();
  }

  // ------------------------------------------------------------ internals
  _fresh() {
    this._setCrashed(false);
    this.showWorld();
    this.player.load(buildFrames(this.level.world, []));
    this.el.sr.textContent = "";
  }

  async _check() {
    const out = await this.controller.run({ type: "check", code: this.program.code, level: this.level, seed: 0 });
    return out.status === "done" ? out.payload : null;
  }

  _show(report, { animate }) {
    const main = report.worlds[0].result;
    const frames = buildFrames(this.level.world, main.trace);
    this.player.load(frames);
    this.player.seek(frames.length - 1); // the robot animates from where the last press left it
    const last = frames.at(-1);
    if (!animate) this.renderer.showFrame(last, 0); // Undo snaps back instead of replaying
    this._setCrashed(Boolean(main.error));
    if (main.error) {
      this.renderer.showError(last, main.error.kind);
      this.renderer.bump();
      this.el.msg.textContent = `${main.error.message} Press Undo to step back.`;
    } else if (!report.passed && ["put", "pick"].includes(main.trace.at(-1)?.action)) {
      // A gem put down (or picked up) where the Goal doesn't want it: say so now, while Undo
      // can still take it back (after the bag empties, nothing more can pass).
      const e = main.trace.at(-1);
      const want = this.level.goal.gems_exactly;
      const key = `${e.x},${e.y}`;
      const wrongPut = e.action === "put" && want && (last.gems[key] ?? 0) > (want[key] ?? 0);
      if (wrongPut) this.el.msg.textContent = "That's not a cell the Goal view wants a gem on. Press Undo to take it back.";
    }
    this.el.sr.textContent = describePress(last, main.error);
    if (report.passed) {
      this.passed = true;
      this.onPass(report, this.program.code);
    }
  }

  _setCrashed(crashed) {
    this.crashed = crashed;
    this.el.panel.classList.toggle("crashed", crashed);
    for (const b of this.el.buttons.children) b.setAttribute("aria-disabled", String(crashed));
    if (!crashed) this.el.msg.textContent = "";
  }

  _renderLog() {
    const lines = this.program.lines;
    this.el.log.replaceChildren(...lines.map((text, i) => {
      const li = document.createElement("li");
      li.textContent = text;
      if (i === lines.length - 1) li.className = "newest";
      return li;
    }));
    this.el.log.lastElementChild?.scrollIntoView({ block: "nearest" });
    this.el.undo.disabled = !lines.length;
    this.el.reset.disabled = !lines.length;
  }
}
