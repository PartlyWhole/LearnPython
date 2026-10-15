// App glue: wires the editor, run controller, trace player and renderer together.
// Game rules live in engine.py; this file only moves data between the parts.
import { RunController } from "./runtime/controller.js";
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

const $ = (id) => document.getElementById(id);
applyIcons(); // icon buttons carry their names in aria-label; the svg is decoration
const PARAMS = new URLSearchParams(location.search);
const REQUESTED_LEVEL = PARAMS.get("level");
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

// ---------------------------------------------------------------- editor
let draftTimer = null;
const editor = createEditor($("editor"), {
  onRun: () => runCode(),
  onChange: () => { // save the learner's code for this level, at most twice a second
    clearTimeout(draftTimer);
    if (demo?.active) return; // demo code is not the learner's draft
    guide?.codeChanged();
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
ui.back.onclick = () => player.step(-1);
ui.fwd.onclick = () => player.step(1);
ui.scrub.oninput = () => { player.pause(); player.seek(Number(ui.scrub.value)); };
ui.speed.onclick = () => { setSpeed(speedIndex + 1); progress?.setSetting("speed", speedIndex); };

// ---------------------------------------------------------------- running
const controller = new RunController({
  createWorker: () => new Worker(new URL("./runtime/worker.js", import.meta.url), { type: "module" }),
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

function setNote(text, bad = false) {
  ui.note.textContent = text;
  ui.note.classList.toggle("bad", bad);
}

async function runCode() {
  if (busy || !level || demo.active || drive.active) return;
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

  const code = editor.getCode();
  const out = await controller.run({ type: "check", code, level, seed: 0 });
  busy = false;
  resultsPanel.classList.remove("busy");
  syncButtons();
  setNote("");

  if (out.status === "done") {
    lastReport = out.payload;
    const main = lastReport.worlds[0].result;
    events.record("run", { level: level.id, passed: lastReport.passed });
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
  } else if (out.status === "failed") {
    setNote(`Something went wrong running Python (${out.message}). This is a bug in the app, not your code.`, true);
  }
}

ui.run.onclick = runCode;

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
    predict: $("demo-predict"), feedback: $("demo-feedback"), back: $("demo-back"), next: $("demo-next"),
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
    resultsPanel.hidden = true;
    ui.outputWrap.hidden = true;
    shownWorld = null;
  },
  onExit: (how) => {
    progress.markLesson(demo.lesson.id, how); // the demo's lesson: a hint can replay a practice level's lesson
    document.querySelector(".editor-panel").classList.remove("demo-on");
    goalFigure.hidden = false;
    $("watch-demo").hidden = !lesson;
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
  progress.saveDraft(level.id, editor.getCode());
  editor.focus();
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
    progress = new Progress(order, browserStorage());
    guide.progress = progress;
    hints.progress = progress;
    if (Number.isInteger(progress.setting("speed"))) setSpeed(progress.setting("speed"));
    const wanted = REQUESTED_LEVEL && ids.includes(REQUESTED_LEVEL) && progress.isUnlocked(REQUESTED_LEVEL)
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
  history.replaceState(null, "", `?level=${encodeURIComponent(level.id)}`);
  $("level-title").textContent = level.title;
  $("level-brief").textContent = level.brief ?? "";
  document.title = `${level.title} · LearnPython`;
  showCommands(level.constraints?.hidden_commands ?? []);
  editor.setCode(progress.draft(level.id) ?? level.starter_code ?? "");
  updateLevelsButton();
  showLevelWorld();
  showGoal();
  syncButtons();
  if (level.drive) { // played with buttons: no editor, demo or guide
    document.body.classList.add("drive-mode");
    drive.start(level);
    return;
  }
  lesson = lessonForLevel(lessons, level.id);
  $("watch-demo").hidden = !lesson;
  // The demo plays once before a lesson's guided try (skippable), and on request with ?demo=1.
  if (lesson && (PARAMS.get("demo") === "1" || (!progress.lesson(lesson.id) && !progress.isSolved(level.id)))) {
    demo.start(lesson); // the guide attaches when the demo ends
  } else {
    guide.attach(lesson, level);
  }
  hints.attach(lessonForPractice(lessons, level.id), level);
}

// Test hook for browser automation on a local dev server only (never on a deployed host).
if (["localhost", "127.0.0.1"].includes(location.hostname)) {
  window.__learnPython = { editor, demo, guide, drive, hints, events, get progress() { return progress; }, get level() { return level; }, runCode,
    setSpeed: (name) => setSpeed(SPEEDS.findIndex((s) => s.name === name)) };
}

init();
