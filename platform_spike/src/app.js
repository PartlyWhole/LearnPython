// App glue: wires the editor, run controller, trace player and renderer together.
// Game rules live in engine.py; this file only moves data between the parts.
import { RunController } from "./runtime/controller.js";
import { SandboxHost, SandboxedWorker } from "./runtime/sandbox.js";
import { validPayload } from "./runtime/validate.js";
import { buildFrames, describe, gemsLeft, lineRuns, nextStepAt, outputAt, pathIndex } from "./render/frames.js";
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
import { QuestsUI } from "./lessons/quests-ui.js";
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
  bag: $("bag"), left: $("left"), stepCount: $("step-count"), runSteps: $("run-steps"),
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
let celebrated = false; // this run's line bonus has been celebrated
let nudged = false;     // this run's failure has pointed at Step back
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
  onLineClick: (line) => jumpToLine(line),
  onChange: () => { // save the learner's code for this level, at most twice a second
    clearTimeout(draftTimer);
    if (demo?.active) return; // demo code is not the learner's draft
    guide?.codeChanged();
    updateLineCount();
    // A replay on screen is now of older code: redraw its step without line marks (after this
    // editor update; CodeMirror refuses a dispatch from inside one).
    if (player?.frames.length > 1) setTimeout(() => player.frames.length > 1 && showFrame(player.frames[player.index], player.index, player.frames.length));
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
function showGoal(world = level.world, goal = goalFor(level, world)) {
  const view = goalWorld(world, goal);
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

// ---------------------------------------------------------------- stepping through a replay
// Students who don't trace the logic line by line get lost on harder levels, so a replay reads
// like a debugger: an arrow at the running line (hollow arrows at the calls it's inside), which
// pass over a loop line this is ("2 of 4"), the path walked so far, a step count, ← / → keys,
// and a click on a line number to jump to the next time that line ran.
let runs = null, path = null, runsFor = null; // lineRuns() and pathIndex() of the frames in the player
let replayCode = null;             // the code the loaded replay came from (null: a demo's)
let replayOutput = null;           // its print() output (shown as far as the step on screen)
let replayWorld = "main";          // which world's run is on screen: "main" or a hidden world's name
let handStepped = false;           // the learner has stepped this run by hand
// The marks belong on the editor only while it still holds the code that ran.
const marksFit = () => demo?.active || (replayCode !== null && replayCode === editor.getCode());
const replayLive = () => player.frames.length > 1 && replayCode !== null && replayCode === editor.getCode() && !demo?.active;

/** Put a run on screen to replay: its world (the level's, or a hidden one), its goal, and its
 *  frames, with the failed step at the end if it stopped on an error. */
function loadReplay(world, result, name = "main", { goal = goalFor(level, world), kind = "hidden" } = {}) {
  replayWorld = name;
  shownWorld = world;
  renderer.setWorld(world);
  renderer.markTarget(goal.end_at ?? null);
  showGoal(world, goal);
  // Not the level's own world: a tag says whose (a hidden world, or a sub-quest's).
  const tag = $("world-tag");
  tag.hidden = name === "main";
  tag.innerHTML = icon(kind === "quest" ? "puzzle" : "eye_off");
  const sr = document.createElement("span");
  sr.className = "sr-only";
  sr.textContent = kind === "quest" ? "Trying sub-quest: " : "Replaying hidden world ";
  const words = document.createElement("span");
  words.textContent = name;
  tag.append(sr, words);
  tag.classList.toggle("quest", kind === "quest");
  replayOutput = result.output ?? "";
  player.load(buildFrames(world, result.trace, result.error));
}

function jumpToLine(line) {
  if (!replayLive()) return false;
  const i = nextStepAt(player.frames, line, player.index);
  if (i < 0) { ui.captionText.textContent = `line ${line}: no robot steps`; ui.captionLine.textContent = ""; return true; }
  player.pause();
  player.seek(i);
  stepped();
  return true;
}

/** The learner moved the replay by hand: drop the hint on Step back, tell the room. */
function stepped() {
  handStepped = true;
  clearCoach();
  shareStep();
  // Screen readers hear steps taken by hand (not every frame of a playing replay).
  const total = player.frames.length - 1;
  const line = ui.captionLine.textContent;
  $("step-sr").textContent = `Step ${player.index} of ${total}${line ? `, ${line}` : ""}: ${ui.captionText.textContent}`;
}

function clearCoach() {
  ui.back.classList.remove("coach");
  ui.fwd.classList.remove("coach");
  ui.back.title = "Step back (←)";
}

document.addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || player.frames.length < 2) return;
  if (e.target.closest?.(".cm-editor, input, textarea, select, dialog, [contenteditable], svg.grid-world")) return;
  if (e.key === " " && e.target.closest?.("button, a")) return; // Space presses the focused button
  const act = { ArrowLeft: () => player.step(-1), ArrowRight: () => player.step(1), " ": () => player.toggle(),
    Home: () => { player.pause(); player.seek(0); }, End: () => player.toEnd() }[e.key];
  if (!act) return;
  e.preventDefault();
  act();
  if (e.key !== " ") stepped();
});

function showFrame(frame, index, total) {
  renderer.showFrame(frame, player.delayFor(frame));
  if (runsFor !== player.frames) { runs = lineRuns(player.frames); path = pathIndex(player.frames); runsFor = player.frames; }
  renderer.showTrail(path.cells.slice(0, path.counts[index]));
  ui.stepCount.textContent = total > 1 ? `${index}/${total - 1}` : "";
  ui.scrub.max = String(total - 1);
  ui.scrub.value = String(index);
  ui.scrub.setAttribute("aria-valuetext", `step ${index} of ${total - 1}`);
  // Before the first step: "Start", so stepping back to the beginning is plain (nothing on a fresh world).
  ui.captionText.textContent = frame.event ? describe(frame.event) : total > 1 ? "Start" : "";
  ui.captionText.classList.toggle("start", !frame.event && !frame.error);
  ui.captionLine.textContent = frame.event?.line ? `line ${frame.event.line}` : "";
  const world = demo?.active ? demo.world : shownWorld;
  ui.bag.textContent = world?.bag === "infinite" ? "∞" : String(frame.bag);
  ui.left.textContent = String(gemsLeft(frame));
  const fits = marksFit();
  const line = frame.event?.line;
  if (frame.error) {
    // The step that failed: marked in the world, at its line, and named in the caption.
    const e = frame.error;
    renderer.showError(frame, e.kind);
    ui.captionLine.textContent = e.line ? `line ${e.line}` : "";
    const ran = demo?.active ? editor.getCode() : replayCode; // a demo's program is in the editor
    const failed = e.line && ran ? (ran.split("\n")[e.line - 1] ?? "").trim() : "";
    ui.captionText.textContent = failed ? `✗ ${failed}` : `✗ ${e.message}`;
    const calls = e.calls ?? [];
    if (fits && e.line) editor.showError(e.line, e.message, { calls, callPasses: calls.map((c) => runs.callPass(index, c)) });
    else editor.clearMarks();
  } else if (line && fits) {
    const calls = frame.event.calls ?? [];
    editor.showLine(line, { calls, pass: { n: runs.nth[index], of: runs.total(line) }, callPasses: calls.map((c) => runs.callPass(index, c)) });
  } else {
    editor.clearMarks();
  }
  // Edited since the run: the replay is of the old code, so its line numbers would point wrong.
  if (!fits) ui.captionLine.textContent = "";
  ui.captionLine.parentElement.classList.toggle("stale", !fits && player.frames.length > 1);
  if (replayOutput !== null && !demo?.active) {
    const text = outputAt(player.frames, index, replayOutput);
    ui.output.textContent = text;
    ui.outputWrap.hidden = !text;
  }
  if (index === total - 1 && !player.playing) {
    // Reached the end by stepping (playing to the end goes through onEnd): the same as playing.
    if (demo?.active) { if (demo.lastRun && !demo.lastRun.shown) demo.replayEnded(); }
    else if (lastReport) showOutcome();
  }
}

ui.play.onclick = () => player.toggle();
ui.back.onclick = () => { player.step(-1); stepped(); };
ui.fwd.onclick = () => { player.step(1); stepped(); };
ui.scrub.oninput = () => { player.pause(); player.seek(Number(ui.scrub.value)); stepped(); };
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
  ui.runSteps.disabled = ui.run.disabled;
  ui.stop.disabled = !busy;
}

/** On levels with a line limit: a star and "18/16" by the Run button. The limit is a bonus, not
 *  a gate: any length that works solves the level; within the limit the star turns gold. */
function updateLineCount() {
  const el = $("line-count");
  const max = level?.constraints?.max_lines;
  el.hidden = !max || demo?.active;
  if (!max) return;
  const n = countLines(editor.getCode());
  el.innerHTML = icon("star");
  el.append(`${n}/${max}`);
  el.classList.toggle("met", n <= max);
  el.title = n <= max ? `Bonus: ${n} lines, within ${max}` : `Bonus: solve it in ${max} lines or fewer (now ${n})`;
  el.setAttribute("aria-label", el.title);
}

/** The line bonus: a gold star rises over the world in a ring of sparkles, then settles. */
function celebrate() {
  const host = $("world");
  host.querySelector(".celebrate")?.remove();
  const box = document.createElement("div");
  box.className = "celebrate";
  box.setAttribute("aria-hidden", "true");
  const ring = document.createElement("b");
  ring.className = "celebrate-ring";
  box.append(ring);
  const N = 18;
  for (let i = 0; i < N; i++) {
    const spark = document.createElement("i");
    const a = (i / N) * Math.PI * 2 + (i % 2 ? 0.17 : 0);
    const r = i % 2 ? 85 : 130;
    spark.style.setProperty("--dx", `${Math.cos(a) * r}px`);
    spark.style.setProperty("--dy", `${Math.sin(a) * r}px`);
    spark.style.setProperty("--d", `${(i % 3) * 60}ms`);
    spark.style.setProperty("--s", String(i % 3 === 0 ? 1 : 0.65));
    box.append(spark);
  }
  const star = document.createElement("span");
  star.className = "celebrate-star";
  star.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2.8l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.9l-5.5 2.9 1.05-6.12L3.1 9.3l6.15-.9z"/></svg>`;
  box.append(star);
  host.append(box);
  setTimeout(() => box.remove(), 2600);
}

function setNote(text, bad = false) {
  ui.note.textContent = text;
  ui.note.classList.toggle("bad", bad);
}

/** Runs the editor's code; `shared` is a partner's run from the room ({id, source}). In a room, a
 *  run of your own is recorded in the room so every peer runs it too (each in its own sandbox). */
async function runCode(shared = null, { stepping = false } = {}) {
  if (demo.active) return demo.runRequested(); // in a demo, Run runs the demo's step
  if (!level || drive.active) return;
  if (busy) { if (shared) pendingShared = shared; return; } // a partner's run waits for this one
  busy = true;
  syncButtons();
  await guide.idle(); // a guide check may be using the worker; it takes milliseconds
  await quests.idle();
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
  clearCoach();
  celebrated = nudged = handStepped = false;
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
    replayCode = code;
    if (!shared) quests.check({ acted: true }); // the sub-quests panel, if open, ticks off what this code solves
    resultsPanel.hidden = true; // the results come with the end of the replay (showOutcome)
    loadReplay(level.world, main);
    if (player.frames.length < 2) showOutcome(); // nothing happened: straight to the outcome
    else if (!stepping) player.play();
    else { ui.fwd.classList.add("coach"); ui.fwd.focus(); } // one step at a time: → or the button
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
ui.runSteps.onclick = () => runCode(null, { stepping: true });

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
    quests.setAvailable(false);
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
    quests.setAvailable(true);
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
$("open-settings").onclick = () => {
  $("setting-step").checked = progress.setting("stepByStep");
  $("setting-unlock").checked = progress.setting("unlockAll") === true;
  $("settings-dialog").showModal();
};
$("setting-unlock").onchange = (e) => {
  progress.setSetting("unlockAll", e.target.checked);
  events.record("setting.unlock_all", { on: e.target.checked });
};
$("close-settings").onclick = () => $("settings-dialog").close();
$("settings-dialog").addEventListener("click", (e) => { if (e.target === $("settings-dialog")) $("settings-dialog").close(); });
// ---------------------------------------------------------------- sub-quests (docs/quests.md)
const quests = new QuestsUI({
  controller, editor, ...timers,
  onEvent: (type, data) => events.record(type, data),
  onTry: (world, result, quest, goal) => {
    player.pause();
    replayCode = editor.getCode();
    loadReplay(world, result, quest.title, { goal: goal ?? {}, kind: "quest" });
    player.play();
  },
  el: {
    button: $("quests-open"), panel: $("quests"), list: $("quests-list"), dots: $("quests-dots"),
    close: $("quests-close"), sr: $("quests-sr"),
  },
});

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
  replayWorld = "main";
  replayOutput = null;
  $("world-tag").hidden = true;
  if (!demo?.active) showGoal();
  shownWorld = level.world;
  renderer.setWorld(level.world);
  renderer.markTarget(goalFor(level, level.world).end_at ?? null);
  player.load(buildFrames(level.world, []));
}
ui.stop.onclick = () => controller.stop();

// ---------------------------------------------------------------- results
/** The run's outcome, once per run, when its replay first reaches the end: results, the bonus,
 *  solving. (Stepping back and forth to the end again changes nothing here.) The failed step
 *  itself is drawn by showFrame, as the replay's last frame. */
let outcomeFor = null;
function showOutcome(code = drive.active ? drive.program.code : replayCode ?? editor.getCode()) {
  if (!lastReport || outcomeFor === lastReport) return;
  outcomeFor = lastReport;
  if (pendingHintRun !== null) { hints.ran(pendingHintRun); pendingHintRun = null; }
  // A failed run that did something, watched rather than stepped: point at Step back, the way
  // to see what led here.
  // (If this world passed and a hidden one failed, it's that world's replay button instead, below.)
  const mainPassed = lastReport.worlds[0].passed;
  if (!lastReport.passed && !mainPassed && !nudged && !handStepped && player.frames.length > 2 && !drive.active) {
    nudged = true;
    ui.back.classList.add("coach");
    ui.back.title = "Step back to see what led here (←)";
  }
  resultsPanel.hidden = false;
  // One row per world: a mark, an eye (this world) or a crossed eye (a hidden world, named), and
  // only for failures, the engine's message. A pass is a big check and the way on.
  const items = lastReport.worlds.map((w, i) => {
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
    // A world that failed can be replayed and stepped through, hidden ones too; so can this world.
    const spec = i === 0 ? level.world : level.hidden_worlds?.[i - 1];
    if (w.result && spec && !drive.active) {
      // A failed world gets a labelled Watch: a hidden world is otherwise only a name and a reason.
      const watch = document.createElement("button");
      watch.className = `icon-button watch-world${w.passed ? "" : " labelled"}`;
      watch.innerHTML = w.passed ? icon("replay") : `${icon("play")}<span class="label">Watch</span>`;
      watch.setAttribute("aria-label", i === 0 ? "Replay this world" : `Replay hidden world ${w.world}`);
      watch.title = watch.getAttribute("aria-label");
      watch.onclick = () => {
        loadReplay(spec, w.result, w.world);
        for (const row of ui.results.querySelectorAll(".world-list li")) row.removeAttribute("aria-current");
        li.setAttribute("aria-current", "true");
        player.play();
      };
      if (i === 0) li.setAttribute("aria-current", "true");
      li.append(watch);
    }
    return li;
  });
  const parts = [];
  const lines = lastReport.lines ?? null; // the line bonus: {max, used, met}, or null
  const bonus = lastReport.passed && lines?.met === true;
  if (lastReport.passed) {
    const verdict = document.createElement("p");
    verdict.className = `verdict pass${bonus ? " bonus" : ""}`;
    verdict.innerHTML = `${icon("check")}<span class="sr-only">Level complete</span>`;
    if (bonus) {
      const star = document.createElement("span");
      star.className = "bonus-star";
      star.innerHTML = icon("star");
      star.title = `Bonus: ${lines.used} lines, within ${lines.max}`;
      const sr = document.createElement("span");
      sr.className = "sr-only";
      sr.textContent = `, and the bonus: ${lines.used} lines, within ${lines.max}`;
      verdict.append(star, sr);
    }
    parts.push(verdict);
    if (lines && !lines.met) {
      // Solved, and there's more to find: one quiet line naming the bonus.
      const miss = document.createElement("p");
      miss.className = "bonus-miss";
      miss.innerHTML = icon("star");
      miss.append(`Bonus: solve it in ${lines.max} lines or fewer (you used ${lines.used})`);
      parts.push(miss);
    }
    if (bonus && !celebrated) { celebrated = true; celebrate(); }
  }
  let nextLink = null;
  if (lastReport.passed && progress) {
    const help = guide.help() !== "none" ? guide.help() : hints.used() ? "hint" : "none";
    if (!progress.isSolved(level.id)) events.record("level.solved", { level: level.id, with: help });
    progress.markSolved(level.id, code, undefined, help, bonus);
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
  if (!lastReport.passed && lastReport.worlds[0].passed) {
    // Solved the world on screen, failed one it can't see: say why the others are there at all.
    const note = document.createElement("p");
    note.className = "worlds-note";
    note.textContent = "It works here. Your program is also tried in other worlds, and these need it too:";
    parts.push(note);
  }
  if (!lastReport.passed) parts.push(list); // on a pass the big check says it all
  for (const msg of lastReport.constraint_failures) {
    const p = document.createElement("p");
    p.className = "why constraint";
    p.textContent = msg;
    parts.push(p);
  }
  if (nextLink) parts.push(nextLink);
  ui.results.replaceChildren(...parts);
  if (!lastReport.passed && mainPassed && !nudged) {
    nudged = true;
    const first = ui.results.querySelector(".world-list li.fail .watch-world");
    first?.classList.add("coach");
    first?.addEventListener("click", () => first.classList.remove("coach"), { once: true });
  }
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
        const gold = solved && progress.hasBonus(id); // solved within the line limit: a gold star
        status.className = `lv-status${solved ? " solved" : unlocked ? " open" : ""}${gold ? " bonus" : ""}`;
        status.innerHTML = icon(gold ? "star" : solved ? "check" : unlocked ? "dot" : "lock");
        const state = document.createElement("span");
        state.className = "sr-only";
        state.textContent = gold ? "solved with the line bonus: " : solved ? "solved: " : unlocked ? "" : "locked: ";
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
  if (room && shownRun && replayWorld === "main" && player.frames.length) room.shareStep(shownRun, player.index);
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
    if (runId !== shownRun || replayWorld !== "main" || !player.frames.length) return;
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
  // Sub-quests are optional files: a level without one simply has no puzzle icon.
  quests.attach(level, level.drive ? null : await fetchJson(`quests/${level.id}.json`).catch(() => null));
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
  window.__learnPython = { editor, demo, guide, drive, hints, quests, events, get progress() { return progress; }, get level() { return level; }, get room() { return room; }, runCode,
    setSpeed: (name) => setSpeed(SPEEDS.findIndex((s) => s.name === name)) };
}

init();
