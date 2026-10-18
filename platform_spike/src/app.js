// App glue: wires the editor, run controller, trace player and renderer together.
// Game rules live in engine.py; this file only moves data between the parts.
import { RunController } from "./runtime/controller.js";
import { SandboxHost, SandboxedWorker } from "./runtime/sandbox.js";
import { validPayload } from "./runtime/validate.js";
import { buildFrames, describe, gemsLeft } from "./render/frames.js";
import { TracePlayer } from "./render/player.js";
import { GridRenderer } from "./render/renderer.js";
import { goalFor, goalWorld } from "./render/goal.js";
import { createEditor } from "./editor/editor.js";
import { API_DOCS } from "./editor/api-docs.js";
import { Progress, browserStorage } from "./progress/progress.js";
import { lessonForLevel } from "./lessons/demo.js";
import { DemoPlayer } from "./lessons/demo-ui.js";
import { GuideUI } from "./lessons/guide-ui.js";
import { DriveUI } from "./lessons/drive-ui.js";
import { HintUI } from "./lessons/hint-ui.js";
import { lessonForPractice } from "./lessons/hints.js";
import { playOrder, lessonIds } from "./lessons/order.js";
import { EventLog } from "./progress/events.js";
import { applyIcons, setIcon, icon } from "./ui/icons.js";
import { setupLayout } from "./ui/layout.js";
import { countLines } from "./ui/lines.js";
import { Room, transportsFrom } from "./collab/room.js"; // light: Automerge loads only on Share or join
import { sharedEditor, setPeers } from "./collab/editor.js";

const $ = (id) => document.getElementById(id);
applyIcons(); // icon buttons carry their names in aria-label; the svg is decoration
const START_SEARCH = location.search; // before init tidies the address bar
const PARAMS = new URLSearchParams(START_SEARCH);
const REQUESTED_LEVEL = PARAMS.get("level");
const ROOM_URL = PARAMS.get("room"); // a shared room's link (docs/collab.md)
const TIMEOUT_MS = 3000;

const ui = {
  run: $("run"), stop: $("stop"),
  note: $("run-note"), status: $("runtime-status"), results: $("results"), output: $("output"),
  outputWrap: $("output-wrap"), play: $("play"), back: $("back"), fwd: $("fwd"), scrub: $("scrub"),
  speed: $("speed"), captionLine: $("caption-line"), captionText: $("caption-text"),
  bag: $("bag"), left: $("left"),
};

let level = null;
let progress = null;
let order = null; // the play order (lessons/index.json expanded by order.js)
const levelMeta = {}; // id -> {title, topics}
let lastReport = null; // CheckReport from the last finished run
let pendingHintRun = null; // pass/fail of the last run, handed to the hint ladder once its result shows
let busy = false;
let lessons = [];      // lessons/index.json order; each attaches to its guided level
let lesson = null;     // this level's lesson, if it has one
let shownWorld = null; // the world on screen: the level's, or a demo's
let room = null;       // the shared room this page is in, if any
let levelsById = {};
let seenRun = null;      // the last room run this page has run or skipped
let shownRun = null;     // the room run on screen (for step sync)
let pendingShared = null; // a partner's run that arrived while one was going
let followSince = null;   // when a partner moved the room to another level
const FOLLOW_MS = 8000;

// ---------------------------------------------------------------- editor
let draftTimer = null;
const editor = createEditor($("editor"), {
  onRun: () => runCode(),
  onChange: () => { // save the learner's code for this level, at most twice a second
    clearTimeout(draftTimer);
    if (demo?.active) return; // demo code is not the learner's draft
    guide?.codeChanged();
    updateLineCount();
    if (room) return; // a room's code is everyone's, not this browser's draft
    draftTimer = setTimeout(() => level && !demo.active && progress?.saveDraft(level.id, editor.getCode()), 500);
  },
});
/** The level's commands live in the "?" popover (and in completions), not as a line of text. */
function showCommands(hidden = []) {
  const names = Object.keys(API_DOCS).filter((n) => n !== "coin_flip" && !hidden.includes(n));
  $("help-commands").replaceChildren(...names.map((n) => {
    const c = document.createElement("code");
    c.textContent = `${n}()`;
    c.title = API_DOCS[n].text;
    return c;
  }));
  editor.setCommands(Object.keys(API_DOCS).filter((n) => !hidden.includes(n)));
}

// "?" popover: commands and keys. Non-modal; Esc or a click elsewhere closes it.
const help = { button: $("open-help"), pop: $("help-pop") };
function setHelp(open) {
  help.pop.hidden = !open;
  help.button.setAttribute("aria-expanded", String(open));
}
help.button.onclick = (e) => { e.stopPropagation(); setHelp(help.pop.hidden); };
help.pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { setHelp(false); help.button.focus(); } });
help.button.addEventListener("keydown", (e) => { if (e.key === "Escape") setHelp(false); });
document.addEventListener("click", (e) => { if (!help.pop.hidden && !help.pop.contains(e.target)) setHelp(false); });

// ---------------------------------------------------------------- world + replay
const renderer = new GridRenderer($("world"));
const goalRenderer = new GridRenderer($("goal"));

/** The Goal view: what the main world should look like at the end (hidden worlds stay hidden). */
function showGoal() {
  const view = goalWorld(level.world, goalFor(level, level.world));
  goalRenderer.setGoal(view);
  $("goal-summary").textContent = view.summary;
}
// Replay speed: one button that cycles; its bars show the speed, its label says it.
const SPEEDS = [{ steps: 2, name: "Slow" }, { steps: 5, name: "Normal" }, { steps: 12, name: "Fast" }, { steps: 60, name: "Instant" }];
let speedIndex = 1;
function setSpeed(i) {
  speedIndex = (i + SPEEDS.length) % SPEEDS.length;
  ui.speed.dataset.speed = String(speedIndex);
  ui.speed.setAttribute("aria-label", `Replay speed: ${SPEEDS[speedIndex].name}`);
  ui.speed.title = `Speed: ${SPEEDS[speedIndex].name}`;
  player?.setSpeed(SPEEDS[speedIndex].steps);
}
const player = new TracePlayer({
  stepsPerSecond: SPEEDS[speedIndex].steps,
  onFrame: showFrame,
  onPlayState: (playing) => {
    setIcon(ui.play, playing ? "pause" : "play");
    ui.play.setAttribute("aria-label", playing ? "Pause" : "Play");
    ui.play.title = playing ? "Pause" : "Play";
  },
  onEnd: () => (demo?.active ? demo.replayEnded() : showOutcome()),
});

function showFrame(frame, index, total) {
  renderer.showFrame(frame, player.delayFor(frame));
  ui.scrub.max = String(total - 1);
  ui.scrub.value = String(index);
  ui.scrub.setAttribute("aria-valuetext", `step ${index} of ${total - 1}`);
  ui.captionText.textContent = frame.event ? describe(frame.event) : ""; // nothing to say before the first step
  ui.captionLine.textContent = frame.event?.line ? `line ${frame.event.line}` : "";
  const world = demo?.active ? demo.world : shownWorld;
  ui.bag.textContent = world?.bag === "infinite" ? "∞" : String(frame.bag);
  ui.left.textContent = String(gemsLeft(frame));
  if (frame.event?.line) editor.showLine(frame.event.line); else editor.clearMarks();
  if (index === total - 1 && lastReport && !player.playing) showOutcome();
}

ui.play.onclick = () => player.toggle();
ui.back.onclick = () => { player.step(-1); shareStep(); };
ui.fwd.onclick = () => { player.step(1); shareStep(); };
ui.scrub.oninput = () => { player.pause(); player.seek(Number(ui.scrub.value)); shareStep(); };
ui.speed.onclick = () => { setSpeed(speedIndex + 1); progress?.setSetting("speed", speedIndex); };

// ---------------------------------------------------------------- running
// In a shared room, code may be a partner's: run it in the sandbox (src/runtime/sandbox.js).
// `?sandbox=1` forces the sandbox outside a room too (testing). Sharing switches it on (useSandbox).
let sandboxed = Boolean(ROOM_URL) || PARAMS.get("sandbox") === "1";
let sandboxHost = null;
const controller = new RunController({
  createWorker: () => {
    if (!sandboxed) return new Worker(new URL("./runtime/worker.js", import.meta.url)); // classic worker
    sandboxHost ??= new SandboxHost({
      workerUrl: new URL("./runtime/worker.js", import.meta.url),
      engineUrl: new URL("../engine.py", import.meta.url),
    });
    return new SandboxedWorker(sandboxHost);
  },
  validate: (request, payload) => !sandboxed || validPayload(request, payload), // a sandboxed run's result is untrusted data
  timeoutMs: TIMEOUT_MS,
  onState: (state, detail) => {
    // A dot shows the state; words appear only when something is wrong (screen readers hear them all).
    const text = {
      loading: "Starting Python…",
      ready: detail?.python ? `Python ${detail.python} ready` : "Ready",
      running: busy ? "Running…" : null, // guide checks and demo runs are quiet
      restarting: "Restarting Python after Stop…",
      load_failed: `Python could not start: ${detail?.message ?? "unknown error"}. Check your connection and reload.`,
    }[state];
    if (text) {
      ui.status.dataset.state = state;
      ui.status.title = text;
      const words = ui.status.querySelector(".status-text");
      words.textContent = text;
      words.classList.toggle("sr-only", state !== "load_failed");
    }
    syncButtons();
  },
});

function syncButtons() {
  ui.run.disabled = busy || !level || controller.state === "load_failed";
  ui.stop.disabled = !busy;
}

/** On levels with a line limit: "18/16" by the Run button, red when over. You can run any length;
 *  the level only passes within the limit (the engine checks). */
function updateLineCount() {
  const el = $("line-count");
  const max = level?.constraints?.max_lines;
  el.hidden = !max || demo?.active;
  if (!max) return;
  const n = countLines(editor.getCode());
  el.textContent = `${n}/${max}`;
  el.classList.toggle("over", n > max);
  el.title = n > max ? `${n} lines: this level passes with ${max} or fewer` : `${n} of at most ${max} lines`;
  el.setAttribute("aria-label", el.title);
}

function setNote(text, bad = false) {
  ui.note.textContent = text;
  ui.note.classList.toggle("bad", bad);
}

/** Runs the editor's code; `shared` is a partner's run from the room ({id, source}). In a room, a
 *  run of your own is recorded in the room so every peer runs it too (each in its own sandbox). */
async function runCode(shared = null) {
  if (demo.active) return demo.runRequested(); // in a demo, Run runs the demo's step
  if (!level || drive.active) return;
  if (busy) { if (shared) pendingShared = shared; return; } // a partner's run waits for this one
  busy = true;
  syncButtons();
  await guide.idle(); // a guide check may be using the worker; it takes milliseconds
  lastReport = null;
  player.pause();
  showLevelWorld();
  resultsPanel.hidden = false;
  resultsPanel.classList.add("busy"); // a quiet pulse, not a sentence
  ui.results.replaceChildren();
  ui.outputWrap.hidden = true;
  setNote(controller.state === "ready" ? "" : "Waiting for Python to finish loading…");
  syncButtons();

  const code = shared ? shared.source : editor.getCode();
  shownRun = shared ? shared.id : room ? room.startRun(code, level.id) : null;
  if (shownRun) seenRun = shownRun;
  const out = await controller.run({ type: "check", code, level, seed: 0 });
  busy = false;
  resultsPanel.classList.remove("busy");
  syncButtons();
  setNote("");

  if (out.status === "done") {
    lastReport = out.payload;
    const main = lastReport.worlds[0].result;
    events.record("run", { level: level.id, passed: lastReport.passed, ...(shared && { shared: true }) });
    pendingHintRun = lastReport.passed;
    guide.noteRun({ code, passed: lastReport.passed, error: Boolean(main.error), end: [main.final.x, main.final.y] });
    player.load(buildFrames(level.world, main.trace));
    ui.output.textContent = main.output;
    ui.outputWrap.hidden = !main.output;
    if (main.trace.length) player.play(); else showOutcome();
  } else if (out.status === "timeout") {
    resultsPanel.hidden = true;
    setNote(`Your program ran for more than ${TIMEOUT_MS / 1000} seconds without finishing, so it was stopped. ` +
            "A loop that never calls a robot command can run forever. Check your while conditions.", true);
  } else if (out.status === "stopped") {
    resultsPanel.hidden = true;
    setNote("Stopped.");
  } else if (out.status === "failed" && out.untrusted) {
    // Only code can do this (e.g. posting fake results via `import js`): it isn't drawn.
    setNote("This program sent back something that isn't a robot run, so it isn't shown.", true);
  } else if (out.status === "failed") {
    setNote(`Something went wrong running Python (${String(out.message).slice(0, 200)}). This is a bug in the app, not your code.`, true);
  }
  if (pendingShared) { const next = pendingShared; pendingShared = null; runCode(next); }
}

ui.run.onclick = () => runCode();

// ---------------------------------------------------------------- lesson demo (Watch beat)
const resultsPanel = document.querySelector(".results-panel");
const timers = { setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: (id) => clearTimeout(id) };
const goalFigure = document.querySelector(".goal-view");
const demo = new DemoPlayer({
  editor, renderer, player, controller, ...timers,
  codeFor: (levelId) => progress?.data.solved[levelId]?.code || null, // the drive log becomes code
  reduceMotion: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  el: {
    panel: $("demo"), name: $("demo-name"), count: $("demo-count"), dots: $("demo-dots"), sr: $("demo-sr"), say: $("demo-say"),
    predict: $("demo-predict"), feedback: $("demo-feedback"), output: $("demo-output"), back: $("demo-back"), next: $("demo-next"),
    run: $("run"), host: document.querySelector(".editor-panel"),
    replay: $("demo-replay"), skip: $("demo-skip"),
    focusTargets: { world: $("world"), editor: $("editor") },
  },
  onStart: () => {
    guide.detach();
    events.record("lesson.beat_started", { lesson: demo.lesson.id, beat: "watch" });
    lastReport = null;
    document.querySelector(".editor-panel").classList.add("demo-on");
    goalFigure.hidden = true;
    $("watch-demo").hidden = true;
    $("share").hidden = true;
    resultsPanel.hidden = true;
    ui.outputWrap.hidden = true;
    shownWorld = null;
  },
  onExit: (how) => {
    progress.markLesson(demo.lesson.id, how); // the demo's lesson: a hint can replay a practice level's lesson
    document.querySelector(".editor-panel").classList.remove("demo-on");
    setTimeout(updateLineCount);
    goalFigure.hidden = false;
    $("watch-demo").hidden = !lesson;
    $("share").hidden = Boolean(room);
    editor.setCode(progress.draft(level.id) ?? level.starter_code ?? "");
    showLevelWorld();
    ui.results.replaceChildren();
    guide.attach(lesson, level);
    hints.attach(lessonForPractice(lessons, level.id), level);
    if (how === "done") editor.focus();
  },
});

// ---------------------------------------------------------------- step-by-step guide + settings
const guide = new GuideUI({
  editor, controller, ...timers, // progress is set once it has loaded (init)
  el: {
    panel: $("guide"), dots: $("guide-dots"), say: $("guide-say"), sr: $("guide-sr"),
    show: $("guide-show"), hide: $("guide-hide"), chip: $("guide-chip"),
    preview: $("guide-preview"), previewCode: $("guide-preview-code"), use: $("guide-use"),
    closePreview: $("guide-preview-close"),
    offer: $("guide-offer"), offerOff: $("guide-offer-off"), offerKeep: $("guide-offer-keep"),
  },
});
guide.onSettingChanged = (on) => { $("setting-step").checked = on; };
guide.onEvent = (type, data) => events.record(type, data);

// ---------------------------------------------------------------- hint ladder + playtest log
const events = new EventLog(browserStorage());
const hints = new HintUI({
  onEvent: (type, data) => events.record(type, data),
  onWatchDemo: (l) => demo.start(l),
  pulseGoal: () => {
    goalFigure.classList.remove("goal-pulse");
    void goalFigure.getBoundingClientRect(); // restart the animation
    goalFigure.classList.add("goal-pulse");
  },
  el: {
    offer: $("hint-offer"), panel: $("hint"), dots: $("hint-dots"), say: $("hint-say"), code: $("hint-code"),
    copy: $("hint-copy"), demo: $("hint-demo"), close: $("hint-close"), sr: $("hint-sr"),
  },
});
$("export-events").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(events.toBlob());
  a.download = `learnpython-playtest-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};
$("open-settings").onclick = () => { $("setting-step").checked = progress.setting("stepByStep"); $("settings-dialog").showModal(); };
$("close-settings").onclick = () => $("settings-dialog").close();
$("settings-dialog").addEventListener("click", (e) => { if (e.target === $("settings-dialog")) $("settings-dialog").close(); });
// ---------------------------------------------------------------- drive mode (levels with "drive")
const drive = new DriveUI({
  controller, renderer, player, ...timers,
  showWorld: () => showLevelWorld(), // the level's world plus its target cell
  el: {
    panel: $("drive"), buttons: $("drive-buttons"), log: $("drive-log"), undo: $("drive-undo"),
    reset: $("drive-reset"), msg: $("drive-msg"), sr: $("drive-sr"),
  },
  onPass: (report, code) => {
    lastReport = report;
    resultsPanel.hidden = false;
    showOutcome(code);
  },
});

$("setting-step").onchange = (e) => {
  progress.setSetting("stepByStep", e.target.checked);
  guide.settingChanged(e.target.checked);
};
$("watch-demo").onclick = () => lesson && demo.start(lesson);

function showLevelWorld() {
  shownWorld = level.world;
  renderer.setWorld(level.world);
  renderer.markTarget(goalFor(level, level.world).end_at ?? null);
  player.load(buildFrames(level.world, []));
}
ui.stop.onclick = () => controller.stop();

// ---------------------------------------------------------------- results
function showOutcome(code = drive.active ? drive.program.code : editor.getCode()) {
  if (!lastReport) return;
  const main = lastReport.worlds[0].result;
  const last = player.frames.at(-1);
  if (main.error) {
    renderer.showError(last, main.error.kind);
    if (main.error.line) editor.showError(main.error.line, main.error.message);
    ui.captionLine.textContent = main.error.line ? `line ${main.error.line}` : "";
    // The message is shown at the code line and in the results; here, just which line failed.
    const failed = main.error.line ? (code.split("\n")[main.error.line - 1] ?? "").trim() : "";
    ui.captionText.textContent = failed ? `✗ ${failed}` : `✗ ${main.error.message}`;
  }
  if (pendingHintRun !== null) { hints.ran(pendingHintRun); pendingHintRun = null; }
  resultsPanel.hidden = false;
  // One row per world: a mark, an eye (this world) or a crossed eye (a hidden world, named), and
  // only for failures, the engine's message. A pass is a big check and the way on.
  const items = lastReport.worlds.map((w) => {
    const li = document.createElement("li");
    li.className = w.passed ? "pass" : "fail";
    const mark = document.createElement("span");
    mark.className = `mark ${w.passed ? "pass" : "fail"}`;
    mark.innerHTML = icon(w.passed ? "check" : "close");
    const where = document.createElement("span");
    where.className = "where";
    where.innerHTML = icon(w.world === "main" ? "eye" : "eye_off");
    const name = document.createElement("span");
    name.className = w.world === "main" ? "sr-only" : "name";
    name.textContent = w.world === "main" ? "This world" : w.world;
    where.title = w.world === "main" ? "This world" : `Hidden world: ${w.world}`;
    where.append(name);
    const why = document.createElement("span");
    why.className = "why";
    why.textContent = w.passed ? "" : w.failures.join(" ");
    const status = document.createElement("span");
    status.className = "sr-only";
    status.textContent = w.passed ? "solved" : "not yet";
    li.append(mark, where, status, why);
    return li;
  });
  const parts = [];
  if (lastReport.passed) {
    const verdict = document.createElement("p");
    verdict.className = "verdict pass";
    verdict.innerHTML = `${icon("check")}<span class="sr-only">Level complete</span>`;
    parts.push(verdict);
  }
  let nextLink = null;
  if (lastReport.passed && progress) {
    const help = guide.help() !== "none" ? guide.help() : hints.used() ? "hint" : "none";
    if (!progress.isSolved(level.id)) events.record("level.solved", { level: level.id, with: help });
    progress.markSolved(level.id, code, undefined, help);
    guide.solved();
    updateLevelsButton();
    const next = progress.next(level.id);
    nextLink = document.createElement("a");
    nextLink.className = "next-level round-button";
    if (next) {
      nextLink.href = `?level=${encodeURIComponent(next)}`;
      if (room) nextLink.onclick = (e) => { e.preventDefault(); moveRoom(next); };
      // The button just says Continue; where it goes is for screen readers and the hover tooltip.
      nextLink.innerHTML = `<span class="label">Continue</span>${icon("next")}`;
      nextLink.setAttribute("aria-label", `Continue to ${levelMeta[next]?.title ?? next}`);
      nextLink.title = levelMeta[next]?.title ?? next;
    } else {
      nextLink.innerHTML = `<span class="label">Every level done</span>${icon("check")}`;
    }
  }
  const list = document.createElement("ul");
  list.className = "world-list";
  list.append(...items);
  if (!lastReport.passed) parts.push(list); // on a pass the big check says it all
  for (const msg of lastReport.constraint_failures) {
    const p = document.createElement("p");
    p.className = "why constraint";
    p.textContent = msg;
    parts.push(p);
  }
  if (nextLink) parts.push(nextLink);
  ui.results.replaceChildren(...parts);
  // The editor fills the window, so results can sit below it: bring them into view.
  const r = resultsPanel.getBoundingClientRect();
  if (r.top > window.innerHeight - 60 || r.bottom < 0) resultsPanel.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// ---------------------------------------------------------------- levels
function updateLevelsButton() {
  const { solved, total } = progress.counts();
  $("levels-count").textContent = `${solved}/${total}`;
  $("open-levels").setAttribute("aria-label", `Levels: ${solved} of ${total} solved`);
}

function renderLevelList() {
  // Units, then each item's levels in play order. A lesson's levels sit together (a gap marks
  // where a lesson starts); ▷ marks a level with a demo, ★ a lesson's twist (the "I know this" path).
  const units = order.units.map((unit) => {
    const section = document.createElement("section");
    section.className = "unit";
    const h = document.createElement("h3");
    h.textContent = unit.title;
    const list = document.createElement("ol");
    for (const item of unit.items) {
      item.levels.forEach((id, i) => {
        const li = document.createElement("li");
        if (i === 0 && item.lesson) li.className = "lesson-start";
        const unlocked = progress.isUnlocked(id);
        const row = document.createElement(unlocked ? "a" : "span");
        if (unlocked) {
          row.href = `?level=${encodeURIComponent(id)}`;
          if (room) row.onclick = (e) => { e.preventDefault(); moveRoom(id); };
          if (id === level?.id) row.setAttribute("aria-current", "page");
        } else {
          row.className = "locked";
        }
        const solved = progress.isSolved(id);
        const status = document.createElement("span");
        status.className = `lv-status${solved ? " solved" : unlocked ? " open" : ""}`;
        status.innerHTML = icon(solved ? "check" : unlocked ? "dot" : "lock");
        const state = document.createElement("span");
        state.className = "sr-only";
        state.textContent = solved ? "solved: " : unlocked ? "" : "locked: ";
        const title = document.createElement("span");
        title.textContent = levelMeta[id]?.title ?? id;
        const isTwist = id === item.twist;
        const hasDemo = item.lesson && id === item.guided;
        if (hasDemo) title.insertAdjacentHTML("beforeend", ` <span class="lv-mark" aria-hidden="true">${icon("play")}</span>`);
        if (isTwist) title.insertAdjacentHTML("beforeend", ` <span class="lv-mark" aria-hidden="true">${icon("star")}</span>`);
        // Concepts and roles are hover detail, not a second line of text on every row.
        row.title = [hasDemo && "has a demo", isTwist && "twist: solve it to skip ahead", levelMeta[id]?.concepts]
          .filter(Boolean).join(" · ");
        if (isTwist) state.textContent += "twist: ";
        row.append(status, state, title);
        li.append(row);
        list.append(li);
      });
    }
    section.append(h, list);
    return section;
  });
  $("levels-list").replaceChildren(...units);
}

$("open-levels").onclick = () => { renderLevelList(); $("levels-dialog").showModal(); };
$("close-levels").onclick = () => $("levels-dialog").close();
$("levels-dialog").addEventListener("click", (e) => { if (e.target === $("levels-dialog")) $("levels-dialog").close(); });
$("reset").onclick = () => {
  if (!level) return;
  editor.setCode(level.starter_code ?? "");
  if (!room) progress.saveDraft(level.id, editor.getCode());
  editor.focus();
};

// ---------------------------------------------------------------- shared room (docs/collab.md)
// Share puts this level and code in a room on the relay; the link is the key. In a room: the code
// is merged live, each Run is run by every peer in its own sandbox, scrubbing a replay moves
// everyone's, and Continue or a level from the list moves the whole room. Leave goes back to
// working alone (a reload, so the page is solo again, without the sandbox).
const roomUi = { bar: $("room-bar"), peers: $("room-peers"), copy: $("room-copy"), leave: $("room-leave") };

function shareStep() {
  if (room && shownRun && player.frames.length) room.shareStep(shownRun, player.index);
}

/** From here on, runs go to the sandbox: a partner's code is about to arrive. */
function useSandbox() {
  if (sandboxed) return;
  sandboxed = true;
  controller.dispose();
  controller.start().catch(() => {});
}

async function joinRoom() {
  setNote("Joining the room…");
  const joined = await Room.join(ROOM_URL, transportsFrom(START_SEARCH, PARAMS.get("via")));
  setNote(joined ? "" : "That room could not be reached, so you're working alone.", !joined);
  return joined;
}

function enterRoom() {
  editor.setShared(sharedEditor(room));
  room.shareLevel(level.id);
  roomUi.bar.hidden = false;
  $("share").hidden = true;
  $("watch-demo").hidden = true;
  room.subscribe(onRoomChange);
  room.onStep((runId, index) => {
    if (runId !== shownRun || !player.frames.length) return;
    player.pause();
    player.seek(index);
  });
  addEventListener("pagehide", () => room?.goodbye());
  // Someone ran the code that is in the editor now: show it to the joiner too.
  const d = room.doc();
  if (d.run && d.run.level === level.id && d.run.source === d.code && !level.drive) runCode(d.run);
  else seenRun = d.run?.id ?? null;
  onRoomChange();
}

function onRoomChange() {
  if (!room) return;
  const d = room.doc();
  if (!d) return;
  if (d.level !== level.id && levelsById[d.level]) { // a partner moved the room on: follow
    // once they're back on the new level, so one of us always holds the room (or after 8 s).
    followSince ??= Date.now();
    if (room.peers().some((p) => p.level === d.level) || Date.now() - followSince > FOLLOW_MS) {
      location.href = room.link(location.pathname, d.level);
    } else {
      setNote("Moving on with the room…");
      setTimeout(onRoomChange, FOLLOW_MS + 100);
    }
    return;
  }
  followSince = null;
  if (d.run && d.run.id !== seenRun) {
    seenRun = d.run.id;
    if (d.run.level === level.id && d.run.by !== room.me.id && !drive.active) runCode(d.run);
  }
  const peers = room.peers();
  editor.view.dispatch({ effects: setPeers.of(peers) });
  // Who is here: a dot each, you first (ringed). Names are hover detail.
  const dot = (p, you) => {
    const el = document.createElement("span");
    el.className = `peer-dot${you ? " you" : ""}`;
    el.style.setProperty("--peer", p.color);
    el.title = you ? `${p.name} (you)` : p.name;
    return el;
  };
  roomUi.peers.replaceChildren(dot(room.me, true), ...peers.map((p) => dot(p, false)));
  roomUi.peers.setAttribute("aria-label", `In this room: you (${room.me.name})${peers.map((p) => `, ${p.name}`).join("")}`);
  if (room.otherBuilds().length) setNote("Someone here has an older or newer version of LearnPython. Reload to stay in step.", true);
}

/** Moves the whole room to another level, then this page follows. */
function moveRoom(id) {
  const target = levelsById[id];
  if (!room || !target) return;
  room.setLevel(id, target.starter_code ?? "");
  setTimeout(() => { location.href = room.link(location.pathname, id); }, 400); // let it reach the others
}

$("share").onclick = () => $("share-dialog").showModal();
$("close-share").onclick = () => $("share-dialog").close();
$("share-dialog").addEventListener("click", (e) => { if (e.target === $("share-dialog")) $("share-dialog").close(); });
$("share-start").onclick = async () => {
  const button = $("share-start");
  button.disabled = true;
  try {
    useSandbox();
    room = await Room.create({ level: level.id, code: editor.getCode() }, transportsFrom(START_SEARCH, null));
    history.replaceState(null, "", room.link(location.pathname, level.id));
    enterRoom();
    $("share-dialog").close();
    copyLink();
  } catch (err) {
    setNote(`The room could not be created (${err.message ?? err}).`, true);
  } finally {
    button.disabled = false;
  }
};

async function copyLink() {
  try {
    await navigator.clipboard.writeText(location.href);
    setIcon(roomUi.copy, "check");
    setTimeout(() => setIcon(roomUi.copy, "copy"), 1500);
  } catch {
    prompt("Copy this link", location.href);
  }
}
roomUi.copy.onclick = copyLink;
roomUi.leave.onclick = async () => {
  const r = room;
  room = null;
  await r?.leave();
  location.href = `?level=${encodeURIComponent(level.id)}`;
};

// ---------------------------------------------------------------- start
async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function init() {
  controller.start().catch(() => {}); // state shown via onState
  try {
    // The play order is the lesson index: units of plain levels and lessons (docs/lessons.md §2, §7).
    const lessonIndex = await fetchJson("lessons/index.json");
    lessons = await Promise.all(lessonIds(lessonIndex).map((id) => fetchJson(`lessons/${id}.json`)));
    order = playOrder(lessonIndex, Object.fromEntries(lessons.map((l) => [l.id, l])));
    const ids = order.levels;
    const levels = await Promise.all(ids.map((id) => fetchJson(`levels/${id}.json`)));
    levels.forEach((lv) => {
      levelMeta[lv.id] = { title: lv.title, concepts: [...new Set((lv.topics ?? []).map((t) => t.split(".")[0].replace(/_/g, " ")))].join(", ") };
    });
    levelsById = Object.fromEntries(levels.map((lv) => [lv.id, lv]));
    progress = new Progress(order, browserStorage());
    guide.progress = progress;
    hints.progress = progress;
    if (Number.isInteger(progress.setting("speed"))) setSpeed(progress.setting("speed"));
    if (ROOM_URL) room = await joinRoom();
    const roomLevel = room?.doc()?.level;
    const wanted = roomLevel && ids.includes(roomLevel) ? roomLevel // a room is on the level it's on
      : REQUESTED_LEVEL && ids.includes(REQUESTED_LEVEL) && progress.isUnlocked(REQUESTED_LEVEL)
        ? REQUESTED_LEVEL : progress.current();
    level = levels[ids.indexOf(wanted)];
    if (REQUESTED_LEVEL && REQUESTED_LEVEL !== wanted) {
      setNote(`That level is still locked, so you're on "${level.title}".`);
    }
  } catch (err) {
    $("level-title").textContent = "The levels could not be loaded";
    $("level-brief").textContent = String(err.message ?? err);
    return;
  }
  history.replaceState(null, "", room ? room.link(location.pathname, level.id) : `?level=${encodeURIComponent(level.id)}`);
  $("level-title").textContent = level.title;
  $("level-brief").textContent = level.brief ?? "";
  document.title = `${level.title} · LearnPython`;
  showCommands(level.constraints?.hidden_commands ?? []);
  editor.setCode(room ? room.doc().code : progress.draft(level.id) ?? level.starter_code ?? "");
  updateLineCount();
  updateLevelsButton();
  if (room) enterRoom();
  showLevelWorld();
  showGoal();
  syncButtons();
  if (level.drive) { // played with buttons: no editor, demo or guide
    document.body.classList.add("drive-mode");
    drive.start(level);
    return;
  }
  $("share").hidden = Boolean(room); // driving with buttons has no code to share
  lesson = lessonForLevel(lessons, level.id);
  $("watch-demo").hidden = !lesson || Boolean(room);
  // The demo plays once before a lesson's guided try (skippable), and on request with ?demo=1.
  if (lesson && !room && (PARAMS.get("demo") === "1" || (!progress.lesson(lesson.id) && !progress.isSolved(level.id)))) {
    demo.start(lesson); // the guide attaches when the demo ends
  } else {
    guide.attach(lesson, level);
  }
  hints.attach(lessonForPractice(lessons, level.id), level);
}

// ---------------------------------------------------------------- layout: resizable split, fullscreen panels
setupLayout({
  layout: document.querySelector(".layout"),
  splitter: document.querySelector(".splitter"),
  fullscreenButtons: [...document.querySelectorAll("[data-fullscreen]")].map((button) => (
    { button, panel: document.querySelector(button.dataset.fullscreen) })),
  icon,
  onResize: () => editor.view.requestMeasure(),
});

// Test hook for browser automation on a local dev server only (never on a deployed host).
if (["localhost", "127.0.0.1"].includes(location.hostname)) {
  window.__learnPython = { editor, demo, guide, drive, hints, events, get progress() { return progress; }, get level() { return level; }, get room() { return room; }, runCode,
    setSpeed: (name) => setSpeed(SPEEDS.findIndex((s) => s.name === name)) };
}

init();
