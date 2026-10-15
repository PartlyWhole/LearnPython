# Architecture

The app has three cores: a **pure-Python engine**, a **Python runtime in the browser**
(Pyodide in a Web Worker) and a **renderer that replays traces**. Everything else builds on
those: the editor, level checking, progression and storage. Status: built: the engine,
contracts, CodeMirror editor, run controller, trace player and SVG renderer, plus a first app page.
Also built: a level select with
15 levels. Not built yet: progression tied to topic mastery and review.

```
  levels/*.json ──────────────┐            Editor (CodeMirror 6)
  (schemas/level.schema.json) │                   │ learner code
                              ▼                   ▼
 ┌──────────── Web Worker (Pyodide 0.26.x, Python 3.12) ────────────┐
 │  run_program(code, world)  /  check_level(code, level)            │
 │      learner code ──calls──▶ API (move, scan, ...) ──▶ World      │
 │                                               records events       │
 │  returns RunResult (schemas/run_result.schema.json)               │
 └──────────────────────────────────┬────────────────────────────────┘
          postMessage (JSON)        │          ▲ terminate() on timeout
                                    ▼          │ (spare warm worker takes over)
            Page (main thread): run controller, timeout, worker pool
                      │                         │
                      ▼                         ▼
      Renderer: replays trace          Checker UI: pass/fail per world,
      (speed, step, scrub,             constraint messages
      current-line highlight)                   │
                                                ▼
                              Progress: level ↔ topic IDs ↔ mastery/review
```

## Layers and what each owns

| Layer | Owns | Must not |
|---|---|---|
| **Level files** | World layout, hidden worlds, goal, constraints, topic tags | Contain code |
| **Engine** (`engine.py`) | Rules, learner API, validation, running, checking, trace format | Import browser modules; touch the DOM; use time or unseeded randomness |
| **Runtime** (worker) | Loading Pyodide and the engine; calling `run_program` / `check_level`; returning JSON | Change results; hold learner state between runs |
| **Run controller** (page) | Starting runs, the wall-clock timeout, terminating and replacing workers | Interpret game rules |
| **Renderer** | Drawing the world and animating a trace | Decide outcomes; it only reads traces |
| **Editor** | Code editing, current-line highlight, error markers | Execute code |
| **Progress** | Which levels are unlocked, mastery and review scheduling from topic tags | Change level content |

## Boundaries (what crosses, in what format)

| From → To | What | Format | Contract enforced by |
|---|---|---|---|
| Level file → Engine | World and level definition | JSON (`schemas/level.schema.json`) | `validate_level` + schema; both checked against the same bad cases in `test_contracts.py` |
| Page → Worker | `run` / `check` / `guide` requests | `src/runtime/protocol.js` (`MSG`) | `tests/js/controller.test.mjs` (fake workers); click-through in `app.html` |
| Lesson file → Engine / page | Demo, guided steps (`done_when` checks), hints | JSON (`schemas/lesson.schema.json`) | `tests/test_lessons.py` via `tools/check_lesson.py`; `check_code` vocabulary in `test_engine.py` `GuideChecks` |
| Worker → Page | `ready` / `result` / `failed` / `load_failed`; payload is a RunResult or CheckReport | `protocol.js` + `schemas/run_result.schema.json` | `test_run_results_match_schema`, controller tests |
| Engine API → Editor completions | Command names and descriptions | `src/editor/api-docs.js` | `tests/js/api-docs.test.mjs` (keys equal `API_NAMES`) |
| Trace → Frames | Per-step state incl. the derived gem map | `src/render/frames.js` | `tests/js/frames.test.mjs`: replaying each real engine trace must reach the engine's final state |
| Engine (desktop) ↔ Engine (browser) | Identical behaviour | Golden trace digests (`tests/golden_traces.json`) | `test_cases_match_golden` (desktop) + `index.html` (browser) |
| Level → reference solutions | Solvable, and catches its target mistakes | `tests/solutions/*.py` | `test_levels.py` |
| Play order → level and lesson files | Units of plain levels and lessons (guided, practice, twist) | `lessons/index.json` (format 2), `tools/play_order.py`, `src/lessons/order.js` | `test_play_order_lists_every_level_exactly_once`, `tests/js/order.test.mjs` |
| Level → Topic graph | Topic IDs | Strings matching `../topics/all_topics.json` | `test_topic_tags_exist_in_topic_graph` |

## Run lifecycle

1. **Load.** The page starts two workers: one active, one spare. Each loads Pyodide and writes
   `engine.py` into its filesystem. That is about 5.7 MB over the network, 1.5–4 s on a laptop.
   Show the world while this happens.
2. **Run.** The page posts the code. The worker calls `check_level`, which runs `run_program`
   on the visible world and then each hidden world. Each run gets a fresh world, namespace and
   output capture.
3. **Stop.** Loops that call the API stop at the step cap and come back as a learner error.
   Loops that never call the API (`while True: x += 1`) hit the page's wall-clock timeout: the
   page terminates that worker, promotes the spare, and starts a new spare in the background.
4. **Replay.** The renderer animates the visible world's trace, highlighting `event.line` in
   the editor. On error, the replay stops at the last event and marks `error.line`.
5. **Report.** Show pass/fail for each world, with its failure messages and any constraint
   messages. Hidden worlds can be described ("a shorter corridor") without showing them.

## Security model

Learner code is untrusted. In the worker it can reach `fetch`, IndexedDB and the worker's
URL through `import js` (tested). That is acceptable while learners only run their own code in
their own browser. Before adding sharing (running someone else's code or code-bearing
levels), run it in a sandboxed cross-origin iframe or worker with no credentials, or on a
server (D7). `ast` constraints guide learners but are trivially bypassed, so they are not a
security control.

## Extension points

- **New actions and sensors:** add them in the engine (see the `CLAUDE.md` checklist). Data-returning
  sensors (`scan()` returns a list) let the world carry the curriculum past Karel's limits into
  lists, dictionaries and classes (D11).
- **New goal types and constraints:** `_goal_failures` and `BANNABLE` in the engine, plus the schema.
- **Live mode (later):** streaming events while the program runs works without special
  headers (tested). `input()`, mid-run speed changes and soft interrupts need
  `SharedArrayBuffer` (COOP/COEP headers) or a service worker (D3, D6).
- **Server-side grading (later):** run the same `engine.py` under CPython (D2).

## Built so far (src/)

- **Run controller** (`runtime/controller.js`): an active and a spare worker. `run()` resolves to
  `done | timeout | stopped | failed | busy`, so it never hangs. A timeout or Stop terminates the
  active worker, promotes the spare and starts a new spare. A run requested while Python is
  still loading waits for it. The state (`loading → ready → running → restarting / load_failed`)
  drives the status dot in the header (words appear only when Python fails to load).
- **Trace player** (`render/player.js`): position, play/pause, step, seek and speed. Sensor checks
  take 40% of a step. No DOM, so it is unit-tested.
- **Renderer** (`render/renderer.js`): an SVG grid themed by CSS variables. The robot moves and
  turns the short way round, and only a single action animates (`isOneAction` in `geometry.js`): bigger jumps
  such as a replay restarting, scrubbing or stepping back snap, so the robot never spins while it slides; gems are faceted stones with an animated glow (a white-ish core plus a
  coloured halo, built from radial gradients rather than blur filters; only opacity and scale animate;
  each gem has its own phase, plus an occasional sparkle; screen blending in dark mode). The halo is
  wider than the robot, so a gem under the robot still shows. Sensors flash the cell they look at; an error ✗ marks the edge it
  bumped. Respects reduced motion.
- **Editor** (`editor/editor.js`): CodeMirror 6 with Python highlighting, line numbers, auto-indent,
  bracket matching, undo, completions for the robot API (with descriptions) and Ctrl/⌘+Enter to run.
  Two marks driven by the replay: the current line, and the crash line with the message shown under
  it. Any edit clears both. Tab indents; Esc then Tab leaves the editor. Colours come from the page's
  CSS variables.
- **Levels and progress** (`lessons/index.json`, `lessons/order.js`, `progress/progress.js`): the play order is
  units of items, each a plain level or a lesson (guided → practice → twist). Items unlock in order. A lesson
  opens its guided level and its twist ("I know this") together, and its practice after the guided solve. It is
  done when its twist is solved, or all its practice is (`docs/lessons.md` §7). Solved levels and per-level drafts are kept in
  browser storage, wrapped so a missing or full store never breaks the game. Asking for a locked
  level opens the current one with a note. A "Levels" dialog (grid icon with a solved count) lists units and levels with status icons, grouped by lesson; concepts are the row's hover text, ▷ marks a level with a demo and ★ a lesson's twist;
  "Next →" appears after a solve.
- **Goal view** (`render/goal.js`, a second `GridRenderer`): a smaller copy of the main world beside it,
  showing the end state its goal asks for. That means the goal's gem layout (an empty floor for "collect
  all"), a dashed ghost robot on an `end_at` cell (no nose if any direction will do), and faded gems
  when the goal doesn't constrain them. A sentence under it says the same in words; the picture is
  `aria-hidden`, and the sentence is what screen readers get. Hidden worlds' goals are never shown.
  `goalWorld()` is pure. `tests/js/goal.test.mjs` checks every level's picture against where its
  reference solution really ends (`tests/fixtures/goal_views.json`, from `tools/make_goal_fixtures.py`).
  `test_contracts.py` fails if that fixture is stale.
- **Lessons and the demo player** (`lessons/`, `src/lessons/demo.js` pure, `src/lessons/demo-ui.js`): a
  lesson attaches to its guided level. Opening that level plays the lesson's demo once
  (`progress.lesson(id)` records done or skipped), and **Watch demo** or `?demo=1` replays it.
  The demo uses the real editor (read-only), world and replay. Back, Next, Replay and Skip are buttons,
  Esc skips, and nothing auto-advances.
  - Each step's code is the *whole* editor content, so any step can be shown on its own. Moving
    forward types the change (capped at 1.5 s). A second Next finishes the typing, and reduced
    motion skips it.
  - Demo runs go through the worker (`run_program` on the demo world) and queue, so a quick Next
    never drops one.
  - A cell prediction is picked by click or by keyboard (arrows + Enter, announced as "column c,
    row r"). Feedback appears after the run, and is never a gate.
  - The learner's draft is not touched: drafts aren't saved during a demo, and the draft comes back on exit.
  - `tests/test_lessons.py` runs `tools/check_lesson.py` on every lesson: the schema, the demo runs,
    predictions match, the last guided example passes, hints aren't solutions.
- **Step-by-step guide** (`src/lessons/guide.js` pure, `guide-ui.js`, `engine.check_code` / `guide_state`):
  on a lesson's guided level, until it's solved, a strip above the editor shows progress dots, one
  instruction, and Show me (eye) and Hide (✕).
  - **Checking:** after each edit (400 ms debounce) and each run, the page sends a `guide` request.
    The engine answers which steps' `done_when` checks hold, using `ast` plus the last run of that
    exact code, and the current step is the first one that fails. That way typing order, pasting
    and deleting all just work.
  - **Show me** previews the step's example with the added lines marked. Using it is one undoable edit,
    and the solve is recorded `guided+shown` (otherwise `guided`, or `none` if the guide never showed).
  - **Hide and the setting:** hiding is remembered per level, and a steps icon brings the guide back.
    The Settings gear holds the "Step-by-step help" switch (on by default). Getting ahead of the
    guide three times brings a one-time offer to turn it off.
  - **No collisions:** guide checks run quietly (no "Running…" status). Run waits for one in flight,
    and a guide check retries while a run holds the worker.
- **Drive mode** (`src/lessons/drive.js` pure, `drive-ui.js`; a level's `"drive": {"buttons"}`): big
  command buttons (icon plus code name) and a "Your moves" log of numbered code lines, where the
  editor would be. Each press re-runs the whole button program through `check_level`, so there are
  no JS game rules, and the replay animates only the newest step. A crash bumps the robot, marks the
  wall, disables the buttons and highlights Undo and Reset. A pass shows the usual result. A dashed
  target ring marks any goal `end_at` cell in the main world.
- **Hint ladder** (`src/lessons/hints.js` pure, `hint-ui.js`): only on an unsolved practice or twist
  level of a lesson. After 2 failed runs a lightbulb appears by the results. Rungs 2 and 3 need 1
  and then 2 more failed runs, and never come from time alone.
  - **What a rung shows:** one line, or a code skeleton with a copy icon. The last rung can replay
    the lesson's demo, and any rung that mentions the Goal view pulses it.
  - **Dismiss and persistence:** "Not now" waits for the next failed run. The state lives in
    `progress.hints`, and a solve after any hint is recorded `with: "hint"`.
- **Playtest log** (`src/progress/events.js`): the last 500 events (runs, solves, demo, guide and
  hint events) in browser storage. Settings › Playtest log downloads them as JSON.
- **UI** (D21): minimal and visual. Since the minimal pass, the older screens follow it too:
  - **Header:** a status dot, and a levels grid icon with the solved count.
  - **Editor toolbar:** Run, Stop and Reset are icons. Commands and keys live behind a "?" popover
    (non-modal; Esc or a click elsewhere closes it).
  - **Under the world:** the bag and gems-left counters are icons with numbers. Replay is step and
    play icons, the slider (its position is read out as `aria-valuetext`), and one speed button with
    bars that cycles Slow, Normal, Fast and Instant (remembered).
  - **Results:** the panel stays hidden until the first run. A pass is a big ✓ and a "Continue" button
    (the next level's name is in its accessible label and tooltip only). A failure lists each world with ✓/✗, an eye (this world) or a crossed
    eye plus the name (hidden world), and the engine's message only where it failed.
  - **Crashes:** the full message sits at the code line and in the results; the caption under the
    world shows only ✗ and the failing line. Icon buttons (`src/ui/icons.js`), progress dots, and one line of text at a time.
- **App page** (`app.html`): the editor, replay controls, Goal view, lesson demo, guide and per-world results.

## Deployment

GitHub Pages, from the repo "LearnPython" (`yourname.github.io/LearnPython/`). The app needs no server: Python
runs in the browser (Pyodide from jsDelivr), every path is relative, and no special headers are needed (D6).
`.github/workflows/pages.yml` runs both test suites, then publishes what `tools/build_site.py` assembles.
That is only the files the app loads: reference solutions, tests, tools and docs stay out
(`tests/test_site.py`). Pages caches files for about 10 minutes, so a deploy can take that long to reach every
visitor. Note that in a public repo the solutions are still readable on GitHub itself.

## Not built yet

Progression from topic mastery (unlock and review from the topic graph, not just order), level editor, progress store linked to
topic IDs, live mode. Each should arrive with its own contract test where it crosses a boundary
above.
