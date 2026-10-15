// SVG grid renderer. It draws a world and shows frames; it never decides outcomes
// (ARCHITECTURE.md: the renderer only reads traces). Colours come from CSS custom properties
// (--grid-*), so the page's theme controls light and dark.
import { DELTA_BY_DIR, isOneAction } from "./geometry.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const CELL = 40;
const ANGLE = { E: 0, S: 90, W: 180, N: 270 };
let nextId = 0; // gradient ids must be unique per page: the Goal view is a second renderer

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

export class GridRenderer {
  /** @param {HTMLElement} container  the SVG fills it, keeping the grid's aspect ratio. */
  constructor(container) {
    this.container = container;
    this.svg = el("svg", { class: "grid-world", role: "img" });
    container.replaceChildren(this.svg);
    this.angle = 0;
    this.uid = `g${nextId++}`;
    this.reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }

  /** Draw the static parts of a world and place the robot at its start. */
  setWorld(world) {
    this.world = world;
    const { width: w, height: h } = world;
    // 12 units of margin so markers on the outer edge (bumping the border) are not clipped.
    this.svg.setAttribute("viewBox", `-12 -12 ${w * CELL + 24} ${h * CELL + 24}`);
    this.svg.setAttribute("aria-label", `A ${w} by ${h} grid world`);
    this.svg.replaceChildren();
    // Gem glow = two radial gradients, no blur filters (an animated SVG blur re-runs its
    // convolution every frame; gradients render once and only their opacity/scale animate).
    //   halo: the gem's colour, wider than the robot, so a covered gem still glows around it
    //   core: near-white centre, so the glow reads as light rather than a flat tint
    const defs = el("defs", {}, this.svg);
    const halo = el("radialGradient", { id: `${this.uid}-halo` }, defs);
    el("stop", { offset: "0%", class: "halo-stop-0" }, halo);
    el("stop", { offset: "78%", class: "halo-stop-1" }, halo);
    el("stop", { offset: "100%", class: "halo-stop-2" }, halo);
    const core = el("radialGradient", { id: `${this.uid}-core` }, defs);
    el("stop", { offset: "0%", class: "core-stop-0" }, core);
    el("stop", { offset: "100%", class: "core-stop-1" }, core);

    const floor = el("g", { class: "floor" }, this.svg);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        el("rect", { x: x * CELL + 1, y: y * CELL + 1, width: CELL - 2, height: CELL - 2, rx: 5,
                     class: "cell" }, floor);
      }
    }
    for (const [x, y] of world.blocked ?? []) {
      el("rect", { x: x * CELL + 3, y: y * CELL + 3, width: CELL - 6, height: CELL - 6, rx: 4,
                   class: "wall" }, floor);
    }
    el("rect", { x: 0, y: 0, width: w * CELL, height: h * CELL, rx: 6, class: "border" }, this.svg);

    this.probe = el("rect", { width: CELL - 6, height: CELL - 6, rx: 6, class: "probe" }, this.svg);
    this.gemLayer = el("g", { class: "gems" }, this.svg);
    this.marker = el("g", { class: "error-marker", visibility: "hidden" }, this.svg);
    el("path", { d: "M-9,-9 L9,9 M9,-9 L-9,9" }, this.marker);

    // Robot: drawn facing east around (0, 0); positioned and rotated per frame.
    this.robot = el("g", { class: "robot" }, this.svg);
    this.robotBody = el("g", {}, this.robot);
    el("rect", { x: -13, y: -12, width: 24, height: 24, rx: 7, class: "robot-body" }, this.robotBody);
    el("path", { d: "M5,-7 L15,0 L5,7 Z", class: "robot-nose" }, this.robotBody);
    el("circle", { cx: -3, cy: 0, r: 3.2, class: "robot-eye" }, this.robotBody);
    // Gems on the robot's own cell stay centred under it (their glow shows around the robot);
    // this layer, drawn above the robot, keeps their count visible (see _drawGems).
    this.gemsUnderRobot = el("g", { class: "gems gems-under-robot" }, this.svg);

    // Lesson overlays (a highlight ring, the pick cursor): drawn last, never take pointer events.
    this.overlay = el("g", { class: "overlay" }, this.svg);
    this.ring = el("rect", { width: CELL - 2, height: CELL - 2, rx: 6, class: "focus-ring", visibility: "hidden" }, this.overlay);
    this.cursor = el("rect", { width: CELL - 2, height: CELL - 2, rx: 6, class: "pick-cursor", visibility: "hidden" }, this.overlay);
    // The goal's end cell, drawn on the floor (under gems and robot) so the target is in the world itself.
    this.target = el("rect", { width: CELL - 10, height: CELL - 10, rx: 7, class: "target", visibility: "hidden" });
    this.svg.insertBefore(this.target, this.gemLayer);
    this.stopPicking();

    this.angle = ANGLE[world.start[2]];
    this.at = null; // a new robot element: nothing to animate from
    this._placeRobot(world.start[0], world.start[1], world.start[2], 0);
    this._drawGems(world.gems ?? {}, world.start[0], world.start[1]);
    this.clearError();
  }

  /** Draw a goal (from goalWorld in goal.js): the goal's gems, faded if the goal doesn't care
   *  about gems, and a ghost robot on the end cell (no nose if any direction will do), or no
   *  robot at all if the goal doesn't say where it ends. */
  setGoal(view) {
    this.setWorld(view.world);
    // The page shows view.summary as visible text next to this picture, so screen readers
    // get the goal once, in words, rather than a second "grid world" image.
    this.svg.setAttribute("aria-hidden", "true");
    this.svg.classList.add("goal");
    this.svg.classList.toggle("gems-any", !view.gemsMatter);
    if (!view.robot) {
      this.robot.setAttribute("visibility", "hidden");
    } else {
      this.robot.classList.add("ghost");
      if (!view.robot.dir) this.robotBody.querySelector(".robot-nose").remove();
    }
  }

  /** Show one frame. durationMs controls how long the move/turn animates. */
  showFrame(frame, durationMs = 200) {
    const d = this.reduceMotion ? 0 : Math.max(0, Math.round(durationMs * 0.85));
    this._placeRobot(frame.x, frame.y, frame.dir, d);
    this._drawGems(frame.gems, frame.x, frame.y);
    this._probe(frame, d);
    this.clearError();
  }

  /** Mark where it went wrong: on the edge the robot bumped into (wall errors, which can be
   *  the outer border, so not a cell) or on the robot's own cell (other errors). */
  showError(frame, kind) {
    let cx = frame.x + 0.5, cy = frame.y + 0.5;
    if (kind === "wall") {
      const [dx, dy] = DELTA_BY_DIR[frame.dir];
      cx += dx * 0.5;
      cy += dy * 0.5;
    }
    this.marker.setAttribute("transform", `translate(${cx * CELL} ${cy * CELL})`);
    this.marker.setAttribute("visibility", "visible");
  }

  clearError() {
    this.marker?.setAttribute("visibility", "hidden");
  }

  /** A small nudge forward and back: the robot tried to go and couldn't (drive-mode crash). */
  bump() {
    this.robotBody.classList.remove("bump");
    void this.robotBody.getBoundingClientRect(); // restart the CSS animation
    this.robotBody.classList.add("bump");
  }

  /** Mark the cell the goal wants the robot to end on, or clear it with null. */
  markTarget(cell) {
    if (!cell) return this.target.setAttribute("visibility", "hidden");
    this.target.setAttribute("x", cell[0] * CELL + 5);
    this.target.setAttribute("y", cell[1] * CELL + 5);
    this.target.setAttribute("visibility", "visible");
  }

  /** Ring one cell (a lesson step's focus), or clear it with null. */
  highlightCell(cell) {
    if (!cell) return this.ring.setAttribute("visibility", "hidden");
    this.ring.setAttribute("x", cell[0] * CELL + 1);
    this.ring.setAttribute("y", cell[1] * CELL + 1);
    this.ring.setAttribute("visibility", "visible");
  }

  /**
   * Let the learner pick a cell (a prediction): click it, or focus the grid, move with the arrow
   * keys and press Enter or Space. onMove(cell) fires as the keyboard cursor moves (for a live
   * region); onPick(cell) fires once. The grid becomes focusable only while picking.
   */
  pickCell({ onPick, onMove = () => {}, start = [0, 0] }) {
    this.stopPicking();
    const { width: w, height: h } = this.world;
    let at = [...start];
    const show = () => {
      this.cursor.setAttribute("x", at[0] * CELL + 1);
      this.cursor.setAttribute("y", at[1] * CELL + 1);
      this.cursor.setAttribute("visibility", "visible");
    };
    const pick = (cell) => { this.stopPicking(); this.highlightCell(cell); onPick(cell); };
    const click = (e) => {
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(this.svg.getScreenCTM().inverse());
      const cell = [Math.floor(p.x / CELL), Math.floor(p.y / CELL)];
      if (cell[0] >= 0 && cell[0] < w && cell[1] >= 0 && cell[1] < h) pick(cell);
    };
    const key = (e) => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (d) {
        e.preventDefault();
        at = [Math.min(w - 1, Math.max(0, at[0] + d[0])), Math.min(h - 1, Math.max(0, at[1] + d[1]))];
        show();
        onMove(at);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick(at);
      }
    };
    this.svg.addEventListener("click", click);
    this.svg.addEventListener("keydown", key);
    this.svg.addEventListener("focus", show);
    this.svg.setAttribute("tabindex", "0");
    this.svg.classList.add("picking");
    show(); // the dashed cursor is the cue that the grid can be picked from
    this._unpick = () => {
      this.svg.removeEventListener("click", click);
      this.svg.removeEventListener("keydown", key);
      this.svg.removeEventListener("focus", show);
    };
  }

  stopPicking() {
    this._unpick?.();
    this._unpick = null;
    this.svg.removeAttribute("tabindex");
    this.svg.classList.remove("picking");
    this.cursor?.setAttribute("visibility", "hidden");
  }

  _placeRobot(x, y, dir, durationMs) {
    // Animate only what one action can do: one cell forward, or one turn in place. Anything else
    // (a replay restarting from the start, scrubbing, stepping back, a new run while the robot
    // still stands where the last one ended) snaps: one CSS transition carries both position and
    // rotation, so animating a bigger jump makes the robot spin while it slides.
    const prev = this.at;
    this.at = { x, y, dir };
    if (prev && durationMs && !isOneAction(prev, this.at)) durationMs = 0;
    // Rotate the short way round, so turning left from N to W turns 90 degrees, not 270.
    const target = ANGLE[dir];
    let delta = ((target - (this.angle % 360)) + 540) % 360 - 180;
    this.angle += delta;
    this.robot.style.transition = durationMs ? `transform ${durationMs}ms ease-in-out` : "none";
    this.robot.style.transform =
      `translate(${(x + 0.5) * CELL}px, ${(y + 0.5) * CELL}px) rotate(${this.angle}deg)`;
  }

  /** Draw gems centred in their cells, each with a glow wider than the robot. If the robot
   *  (robotX, robotY) stands on gems, they stay underneath it: the glow around its edges is the
   *  tell, and the count (for 2+) is drawn above the robot so it is never hidden. */
  _drawGems(gems, robotX, robotY) {
    this.gemLayer.replaceChildren();
    this.gemsUnderRobot.replaceChildren();
    for (const [key, count] of Object.entries(gems)) {
      if (count <= 0) continue;
      const [x, y] = key.split(",").map(Number);
      const cx = (x + 0.5) * CELL, cy = (y + 0.5) * CELL;
      const g = el("g", { transform: `translate(${cx} ${cy})`, class: "gem" }, this.gemLayer);
      // Each gem gets its own phase so they breathe and sparkle out of step.
      const phase = ((x * 7 + y * 13) % 10) / 10;
      g.style.setProperty("--phase", phase.toFixed(2));
      const glow = el("g", { class: "gem-glow" }, g);
      el("circle", { r: 16.5, fill: `url(#${this.uid}-halo)`, class: "gem-halo" }, glow);
      el("circle", { r: 7, fill: `url(#${this.uid}-core)`, class: "gem-core" }, glow);
      // The stone: base colour, a lit crown, a shaded right side and a highlight.
      el("path", { d: "M0,-9 L8,-2 L0,10 L-8,-2 Z", class: "gem-stone" }, g);
      el("path", { d: "M-8,-2 L0,-9 L8,-2 Z", class: "gem-facet-light" }, g);
      el("path", { d: "M0,-2 L8,-2 L0,10 Z", class: "gem-facet-dark" }, g);
      el("path", { d: "M-4.5,-3 L-0.5,-7 L1,-5.6 L-2.6,-2.6 Z", class: "gem-shine" }, g);
      el("path", { d: "M0,-4 L1,-1 L4,0 L1,1 L0,4 L-1,1 L-4,0 L-1,-1 Z", class: "gem-sparkle",
                   transform: "translate(5.5 -6.5)" }, g);
      const covered = x === robotX && y === robotY;
      if (count > 1) {
        // The count goes above the robot when covered, so it is never hidden either.
        const layer = covered ? this.gemsUnderRobot : g;
        const at = covered ? `translate(${cx} ${cy})` : null;
        const badge = el("g", at ? { transform: at, class: "gem" } : {}, layer);
        el("circle", { cx: 11, cy: -11, r: 7, class: "gem-badge" }, badge);
        const t = el("text", { x: 11, y: -7.5, class: "gem-count" }, badge);
        t.textContent = String(count);
      }
    }
  }

  _probe(frame, durationMs) {
    const action = frame.event?.action;
    const probe = this.probe;
    probe.classList.remove("on");
    if (!["front_is_clear", "scan", "gems_here"].includes(action)) return;
    let { x, y } = frame;
    if (action !== "gems_here") {
      const [dx, dy] = DELTA_BY_DIR[frame.dir];
      x += dx;
      y += dy;
    }
    probe.setAttribute("x", x * CELL + 3);
    probe.setAttribute("y", y * CELL + 3);
    probe.style.animationDuration = `${Math.max(150, durationMs * 1.5)}ms`;
    void probe.getBoundingClientRect(); // restart the CSS animation
    probe.classList.add("on");
  }
}
