# Grid-world Python game: agent guide

A learner writes Python that steers a robot through a grid world, in the browser. The Python
runs in Pyodide in a Web Worker. A pure-Python engine records every action into a trace, and
the page replays that trace. Levels are JSON, solved against hidden worlds as well as the
visible one, and tagged with topics from `../topics/all_topics.json`.

This folder holds the engine, contracts, tests, a browser harness, and a first playable app
(`app.html`): CodeMirror 6 editor, run controller, trace player and SVG renderer. Read `ARCHITECTURE.md` for the layers and `docs/decisions.md` for why things are this
way. Decisions are cited below as D1 to D11.

## Layout

| Path | What |
|---|---|
| `engine.py` | World rules, learner API, `run_program`, `check_level`, validation. **Pure Python, stdlib only.** |
| `schemas/` | JSON Schemas for level files and run results: the contract with the JS side |
| `levels/` | Level files `<id>.json` (43). See `docs/levels.md` |
| `lessons/` | **The play order**, `index.json` (format 2): units of `{"level": id}` and `{"lesson": id}` items. A lesson expands to guided, practice, then twist. Plus 11 lesson files `<id>.json` (demo, guided steps, practice, hints). Checked by `tools/check_lesson.py` and `tests/test_lessons.py` |
| `tools/build_site.py`, `../.github/workflows/pages.yml` | The public site (GitHub Pages, repo "LearnPython"): only `app.html` (also as `index.html`), `src/`, `vendor/`, `levels/`, `lessons/` and `engine.py`, never `tests/solutions/`. The workflow runs the tests, then deploys on every push to `main`. `tests/test_site.py` checks the contents |
| `tools/play_order.py` | Expands `lessons/index.json` into the level list (Python). `src/lessons/order.js` does the same for the app. `python3 tools/play_order.py` prints it |
| `src/lessons/` | `order.js` (play order), `demo.js` / `guide.js` / `drive.js` / `hints.js` (demo, guide, drive-mode and hint-ladder logic, pure), `demo-ui.js` / `guide-ui.js` / `drive-ui.js` / `hint-ui.js` (their parts of the page) |
| `src/ui/icons.js` | The icon set, `applyIcons()` for `<button data-icon>`, progress dots |
| `tests/solutions/` | Per level: a reference `<id>.py` and at least one `<id>.wrong_*.py`. Kept under tests/ so the app never serves them |
| `tools/level_goals.py` | Fills per-world goals (`gems_exactly`, `end_at`, `facing`) from the reference solution |
| `src/progress/` | `progress.js`: solved levels (and how: none / hint / guided), drafts, unlocking, lesson, guide and hint state, settings. `events.js`: the local playtest log. Both in wrapped browser storage |
| `cases.py` | Programs whose traces are frozen in `tests/golden_traces.json` |
| `tests/` | `test_engine.py` (behaviour), `test_contracts.py` (golden traces, schemas, level index, topic tags), `test_levels.py` (every level solvable; wrong solutions fail) |
| `tools/make_golden.py` | Regenerates the golden traces. Only for intentional behaviour changes. |
| `app.html`, `src/app.js`, `src/app.css` | The app page and its glue code (wiring only, no game rules) |
| `src/runtime/` | `protocol.js` (page↔worker messages), `worker.js` (Pyodide + engine), `controller.js` (worker pool, timeout, Stop) |
| `src/editor/` | `editor.js` (CodeMirror 6 setup: Python, completions, replay and error line marks), `api-docs.js` (learner-facing API descriptions) |
| `vendor/codemirror.js` | CodeMirror bundled into one file. **Generated: never edit it.** Rebuilt from `tools/vendor/codemirror-entry.js` with `npm run vendor` |
| `src/render/` | `frames.js` (trace → frames, pure), `player.js` (replay timing, pure), `renderer.js` (SVG), `goal.js` (Goal view, pure), `geometry.js` |
| `tests/js/` | Node tests for frames, player and controller (fake clock and fake workers in `helpers.mjs`) |
| `tests/fixtures/run_results.json` | Full engine results the JS tests replay; written by `tools/make_golden.py` |
| `tests/fixtures/goal_views.json` | Each level's main-world goal and its reference solution's end state, for the Goal view test. Re-run `python3 tools/make_goal_fixtures.py` after changing a level or its reference (`test_contracts.py` fails until you do) |
| `index.html`, `worker.js` | Runtime audit harness: runs the engine in Pyodide 0.26.4 and checks it against the golden file |
| `docs/` | `decisions.md` (decision log) and `ASSUMPTIONS_AUDIT.md` (the evidence behind it) |
| `docs/curriculum.md`, `docs/lessons.md` | Lesson progression (Unit 0 drive mode → stepwise refinement, all authored) and the lesson/guidance design (D20, built). Evidence: `docs/research/guidance-design/` |
| `.claude/skills/` | `author-level` (levels), `design-lesson` (lesson content), `build-guidance` (guidance runtime) |

## Commands

```bash
python3 -m pytest -q tests                      # full suite, incl. schema checks (needs pytest + jsonschema)
python3.12 -m unittest discover -s tests        # stdlib only; schema checks skip without jsonschema
node --test "tests/js/*.test.mjs"               # JS: frames, player, controller, API docs, goal view, demo, progress (no npm install needed)
python3 tools/check_lesson.py <lesson id>       # one lesson's contract checks, with warnings and what was skipped
npm install && npm run vendor                   # ONLY to change CodeMirror: add exports to tools/vendor/codemirror-entry.js first
python3.12 tools/make_golden.py                 # ONLY after an intended engine change; say why in the commit
```

Run the app: serve this folder over http and open `app.html` (`?level=<id>` picks a level).
The app has no build step: plain ES modules (D12). CodeMirror is the one exception, and it is
pre-bundled into `vendor/` (D15). Under macOS privacy rules a server started by
the agent may not be able to read `~/Desktop`; serve a copy from a scratch folder if so.

Browser check: serve this folder over http (for example `python3 -m http.server`) and open
`index.html`. Every case under `2_same_trace_as_cpython` must show `"same": true`.
After app changes, also click through `app.html`: a passing run, a failing run, a crash, an
infinite `while True: x += 1` (stopped at 3 s) and Stop. For editor changes, also check: typing with
completions, Ctrl/⌘+Enter, replay and error marks clearing on edit, and Esc then Tab leaving the editor.
Browser automation may send keys without `keyCode`, which CodeMirror's Esc/Tab logic needs: verify that
case with `KeyboardEvent`s that carry `keyCode` before concluding it is broken.

Python version: the engine targets **3.12** to match Pyodide 0.26.x (Python 3.12.1). Don't
use syntax or stdlib features newer than 3.12. The tests also pass on 3.9; keep it that way
while 3.9 is the only interpreter with pytest installed here.

## UI principle (D21)

Minimal, elegant, visual first. Prefer a picture, an icon (`src/ui/icons.js`, with `aria-label`) or
progress dots over words. Show one short line of text only where it carries meaning a picture
can't. Words that only help screen readers go in `.sr-only`. Before adding a label, a sentence or
a button, ask whether the world, an icon or the layout already says it.

## Invariants (do not break; the reason is in brackets)

1. **`engine.py` imports only the standard library: never `js`, `pyodide` or third-party packages.** [The same file must give identical results in desktop Python (tests, grading) and in the browser. D2]
2. **Every run gets a fresh `World`, a fresh namespace and captured `print()` output.** Always go through `run_program`. [A reused worker leaked variables between runs, and `print` leaked into a results file. D4]
3. **Learner errors are data, never exceptions out of the engine.** `run_program` returns `error: {type, message, line}`; `WorldError` messages are written for learners. [The UI replays up to the error and points at the line.]
4. **Every trace event carries the learner's line number.** [Line highlighting during replay; error location.]
5. **Two stop mechanisms:** the engine's step cap, plus a wall-clock timeout in the app that terminates the worker. Keep a spare pre-warmed worker. [The cap misses `while True: x += 1`; a terminated worker costs a 3–5 s reload. D5]
6. **Learner code is untrusted.** It can `import js` and reach `fetch` and storage. Shared programs or levels must run in a sandbox (D7). `ast` constraints are teaching aids, not security.
7. **Formats are versioned contracts.** A change to `schemas/`, the trace or `run_result` must update the schema, `validate_*` in `engine.py`, `BAD_LEVEL_EDITS` in `tests/test_contracts.py` and, if traces change, the golden file, all in one change. [Parallel work stays compatible.]
8. **Determinism:** all randomness goes through `World.rng`, seeded per run. No `time`, no unseeded `random`, no set iteration order in results. [Golden traces and grading.]
9. **Every learner-facing API method calls `self._spend_step()` before changing any state.** [If the step cap fired after a change, the replayed final state would disagree with the engine; `test_step_cap_changes_nothing_without_an_event` and `tests/js/frames.test.mjs` catch it.]
10. **Inject timers and workers; never call native `setTimeout` as a method of another object.** Wrap it (`(fn, ms) => setTimeout(fn, ms)`). [Browsers throw "Illegal invocation"; Node does not, so the unit tests can't catch it.]
11. **Import CodeMirror only from `vendor/codemirror.js`, never from `@codemirror/*` or a CDN.** Need something new? Export it in `tools/vendor/codemirror-entry.js` and run `npm run vendor`. [More than one copy of `@codemirror/state` breaks CodeMirror. D15]
12. **`src/editor/api-docs.js` lists exactly the engine's `API_NAMES`.** [Completions must not offer commands that don't exist; `tests/js/api-docs.test.mjs` checks it.]
13. **Don't copy Code in Place code.** This also covers its problem text and worlds: adapt the problem *shapes* (D10, D17). Its `karel` package declares no licence. Write your own. [D10]

## Adding things (checklist)

- **A learner action or sensor:**
  - add a method on `World` that calls `self._record(...)`
  - add its name to `API_NAMES`
  - add it to the `action` enum in `schemas/run_result.schema.json`
  - add a test in `test_engine.py`
  - call `self._spend_step()` first
  - add a case to `cases.py` and regenerate the golden file (this also refreshes the JS fixtures)
  - add a caption in `describe()` (`src/render/frames.js`), and to `SENSORS` if it changes nothing
  - add it to `API_DOCS` (`src/editor/api-docs.js`) with a one-line description for completions
  - prefer sensors that return data (lists, numbers, strings), so later topics have something in the world to practise on (D11)
- **A level:** follow "Authoring a level" in `docs/levels.md`. In short:
  - write the level JSON and put it in the play order, `lessons/index.json`: in a lesson's `practice` or `twist`, or as a `{"level": id}` item. Then run `python3 tools/make_goal_fixtures.py`
  - write `tests/solutions/<id>.py` plus at least one `wrong_*` solution for the mistake the level targets
  - fill per-world goals with `tools/level_goals.py`
  - run the tests, then play the level and watch the replay
  - use `constraints` as teaching levers: `required` (e.g. `def`, or `compare` / `return` so a comparison or a returning helper can't be dodged), `banned`, `max_lines`, and `hidden_commands` (e.g. hide `scan` so the robot "can't count")
- **A lesson:** follow the `design-lesson` skill; its levels come from `author-level`. **Guidance UI** (guide, demo player, drive mode, hints, goal view): the `build-guidance` skill and `docs/lessons.md`.
- **A goal type or constraint:** update `_goal_failures` / `BANNABLE`, the level schema, and `BAD_LEVEL_EDITS`.

## Definition of done

`python3 -m pytest -q tests` and `node --test "tests/js/*.test.mjs"` pass. If engine behaviour changed, the browser harness still
shows all golden cases matching. Any new decision or reversal is added to `docs/decisions.md`.

## Don't

- Regenerate the golden file to make a failing test pass without understanding why it failed.
- Add a dependency to `engine.py`, or Pyodide-only code paths inside it.
- Put game rules in the renderer. The renderer only reads traces.
- Add the `window.__gemRover` test hook anywhere but `localhost` / `127.0.0.1` (it exposes the editor and progress for automation).
- Echo `===` separators in zsh commands (`echo ===` fails with "== not found").
