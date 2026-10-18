# Decision log

One entry per decision: what we chose, why, what it costs, and the evidence. Add a new entry
when you make or reverse a decision. Don't edit old entries; mark them superseded. Evidence
lives in `docs/ASSUMPTIONS_AUDIT.md` (A-numbers) and the tests.

---

### D1. Run Python in the browser with Pyodide in a Web Worker
**Status:** accepted (Oct 2026)
**Decision:** Learner code runs client-side in Pyodide (CPython compiled to WebAssembly), inside a dedicated Web Worker, not on a server and not on the main thread.
**Why:** No server cost or execution backend. It works offline once loaded. A worker keeps the page responsive while code runs: the largest gap between 50 ms page ticks was 52 ms during an infinite loop (A1, A5). Code in Place uses the same approach.
**Costs:** About 5.7 MB download and 1.5–4 s load on a laptop; phones are untested (A10). Each worker restart reloads Pyodide.
**Evidence:** A1, A5, A10; `index.html` harness.

### D2. One pure-Python engine, shared by the browser and desktop Python
**Status:** accepted
**Decision:** All rules, the learner API, validation and level checking live in `engine.py`, which uses only the standard library. The browser and the tests run the same file.
**Why:** One source of truth. Rules are unit-tested with pytest and can be graded on a server later. 5 of 5 golden traces are identical in CPython 3.12.13, CPython 3.9 and Pyodide 3.12.1 (A2).
**Costs:** The engine can't use browser APIs directly. Everything the page needs must come back as data.
**Evidence:** A2; `test_cases_match_golden` + browser harness.

### D3. Record-then-replay is the default, not live streaming
**Status:** accepted
**Decision:** Run the program to completion, return a trace, and animate the trace on the page.
**Why:** It enables step-back, scrubbing, speed control and line highlighting at any point, with no shared memory or special headers. It is simpler to test, since a trace is just data.
**Not the reason:** Live streaming also works without special headers: events arrived every 100 ms during a run (A7). The original claim that live mode *requires* solving the blocking problem was overstated.
**Costs:** Learners don't see the robot move until the run finishes. That is fine for typical runs of a few milliseconds. Revisit if levels become long-running or interactive.
**Evidence:** A7.

### D4. Every run is isolated
**Status:** accepted
**Decision:** `run_program` creates a fresh `World`, a fresh namespace and a captured `stdout` for every run.
**Why:** A warm interpreter reused naively leaked learner variables between runs, and an uncaptured `print()` corrupted a results file during the spike (A6).
**Evidence:** A6; `Isolation` tests.

### D5. Two stop mechanisms plus a spare worker
**Status:** accepted
**Decision:** The engine's step cap (default 10,000 events) stops runaway loops that call the API. The page's wall-clock timeout terminates the worker for everything else. Keep a pre-warmed spare worker to take over.
**Why:** The step cap can't see `while True: x += 1` (A4). Terminating works but costs a 3–5 s Pyodide reload (A5).
**Alternative:** Pyodide's interrupt buffer avoids reloads but needs `SharedArrayBuffer`, which needs cross-origin isolation headers (A8). Reconsider when hosting controls headers.
**Evidence:** A4, A5, A8.

### D6. No dependency on `SharedArrayBuffer` for now
**Status:** accepted
**Decision:** Ship without COOP/COEP headers. Nothing in the core loop needs shared memory.
**Why:** It keeps hosting simple and avoids breaking embedded third-party content. Only `input()`, mid-run control and soft interrupts need it (A7, A8).
**Revisit when:** adding `input()`-style interactive programs or live mode with mid-run control.

### D7. Learner code is untrusted; sandbox anything shared
**Status:** accepted
**Decision:** Running your own code in your own browser is acceptable. Running other people's code (shared solutions, community levels) requires a sandboxed cross-origin iframe or worker with no credentials, or server-side execution. `ast` constraints are teaching aids only.
**Why:** Learner code can `import js` and reach `fetch`, IndexedDB and the worker's location (A11).
**Evidence:** A11, A12.

### D8. CodeMirror 6 for the editor
**Status:** accepted, pending device testing
**Decision:** Use CodeMirror 6, not Monaco.
**Why:** Monaco intercepts touch events, breaking scrolling and selection on phones. This is from community reports; there is no official statement either way (A13). CodeMirror uses native mobile selection.
**Revisit if:** phone testing shows problems.

### D9. Levels are data, checked against hidden worlds
**Status:** accepted
**Decision:** Levels are JSON (`schemas/level.schema.json`) with a visible world, hidden variant worlds, a goal and optional teaching constraints. A level passes only if every world passes.
**Why:** Hidden worlds stop hard-coded move sequences. `test_hard_coded_answer_fails_a_hidden_world` demonstrates this. Stanford's CS106A Karel assignments test against several worlds of different sizes (A15). Whether hiding them helps learning, versus listing them, is untested.
**Evidence:** A15; `Levels` tests.

### D10. Write our own engine; do not reuse Code in Place's `karel` package
**Status:** accepted
**Decision:** No code from Code in Place's `karel` wheel or app.
**Why:** The wheel declares no licence and its repository is private (A19). The Karel idea (Pattis, 1981) is widely reimplemented. This is not legal advice.

### D11. Design the world to carry the curriculum past Karel
**Status:** accepted, value untested
**Decision:** Prefer sensors and objects that return Python data (`scan()` returns a list; planned: signs with strings and numbers, an inventory dictionary, a learner-defined robot class), so later topics have something in the world to practise on.
**Why:** Pattis's Karel had no variables or data, so it can only teach control flow and procedures (A16). `scan()` works identically in both runtimes.
**Evidence:** A16; `test_scan_returns_a_list_of_counts`.

### D12. No build step yet: plain ES modules, no npm dependencies
**Status:** accepted (Oct 2026); amended by D15 for CodeMirror
**Decision:** The app is plain ES modules served as-is. Pyodide comes from the jsDelivr CDN. JS tests use Node's built-in runner (`node --test`).
**Why:** Nothing to install, so agents and contributors can run everything immediately. The app is small.
**Revisit when:** CodeMirror 6 arrives (many small packages; a bundler such as Vite becomes worth it), or for TypeScript.

### D13. The page derives gem maps from the trace; the engine doesn't send per-step world snapshots
**Status:** accepted
**Decision:** Trace events carry the robot's state; `src/render/frames.js` rebuilds gem counts from `pick` events.
**Why:** Keeps traces small (the 10,000-step runaway trace is about 750 KB as JSON even without snapshots). The JS frame builder is checked against the engine's final state for every golden case, so the two cannot silently diverge. That check found a real engine bug: the step cap fired after state had changed.
**Revisit when:** the world gains state that is hard to derive (moving obstacles, learner-placed objects). Then send changed cells per event instead.

### D14. A crash is the only failure reported for that world
**Status:** accepted
**Decision:** If a run stops with an error, `check_level` reports just "Stopped on line N: message" for that world, not the knock-on failures (gems left behind and so on).
**Why:** In the first click-through, the knock-on messages buried the one thing the learner needs to fix.

### D15. CodeMirror is vendored as one pre-built file; the app stays build-free
**Status:** accepted (Oct 2026), amends D12
**Decision:** CodeMirror 6 packages are pinned dev dependencies (`codemirror` 6.0.2, `@codemirror/lang-python` 6.2.1, `@codemirror/autocomplete` 6.20.3, plus `state`, `view`, `commands`, `language` and `@lezer/highlight`). `npm run vendor` (esbuild 0.28.2) bundles the exports listed in `tools/vendor/codemirror-entry.js` into `vendor/codemirror.js`, which is committed. The app imports only that file.
**Why:** CodeMirror is about a dozen packages that must share one copy of `@codemirror/state`. Loading them from a CDN risks duplicate copies (a known cause of "Unrecognized extension value" errors) and adds a runtime dependency. Vendoring keeps the app serve-as-is, works offline, and costs 398 KB (137 KB gzipped), small next to Pyodide's 5.7 MB.
**Costs:** Contributors who change the editor need `npm install`. The bundle must be rebuilt after adding exports. Running and testing the app does not need npm.
**Revisit when:** the app needs TypeScript or more npm packages. Then move the whole app to Vite.

### D16. Editor behaviour for learners
**Status:** accepted
**Decision:** Tab accepts a visible completion (Oct 2026: Tab autocomplete, as in other code editors), otherwise indents (four spaces), and Esc then Tab leaves the editor (CodeMirror's tab-focus mode, verified). Completions cover only the robot API, with one-line descriptions. Enter accepts a visible completion. Replay and error marks clear on any edit.
**Why:** Indenting with Tab is what learners expect in Python. The Esc-then-Tab escape keeps the editor keyboard-accessible, and the "?" commands-and-keys popover says so (it was a hint line under the editor before D21). Clearing marks on edit avoids pointing at code that no longer exists.
**Untested:** real phones and screen readers. D8's device testing is still outstanding.

### D17. Level ladder adapted from Code in Place problem shapes, with four engine additions
**Status:** accepted (Oct 2026)
**Decision:** The first 13 levels (`docs/levels.md`) follow Code in Place's Karel order: sequencing, functions, decomposition, `for`, `while`, fencepost, nested loops, conditionals and helpers, serpentine traversal, building, then data (`scan()` lists). To support that, the engine gained:
- `put()` and a world `bag` (a count or `"infinite"`)
- a `gems_exactly` goal
- a `facing` goal
- per-world goal overrides
- `constraints.required` (and `if` as a construct)
- `constraints.hidden_commands`
**Why:** Research (`docs/research/code_in_place_problems.md`) found about 9 of 33 catalogued problems adaptable with the old API and about 30 with these additions. Per-world goals are needed because the pedagogy depends on worlds of varying size. Hiding `scan`/`gems_here` keeps "the robot can't count" puzzles meaningful.
**Not added, on purpose:** `turn_right`, `left_is_clear`/`right_is_clear`, `facing_*`. Writing these is the learners' first decomposition exercise (levels 2 and 8). If a direction sensor is ever needed, add one data-returning `heading()` (D11).
**Evidence:** `test_levels.py`: 13 reference solutions pass and 15 targeted wrong solutions fail. All 13 levels were solved in the browser through the app.

### D18. Linear unlocking and browser-stored progress, for now
**Status:** accepted; revisit with topic-based progression
**Decision:** A level unlocks when the previous one is solved. Progress and drafts live in browser storage (`src/progress/progress.js`).
**Why:** It is the simplest form of mastery gating and needs no accounts. Safari's 7-day storage deletion (A14) makes this a convenience, not a record.
**Revisit when:** progression moves to the topic graph (unlock by mastered prerequisites, schedule review), or accounts arrive.

### D19. Reference and wrong solutions are part of every level
**Status:** accepted
**Decision:** A level is only done when `tests/solutions/<id>.py` passes and at least one `<id>.wrong_*.py`, written for the mistake the level targets, fails. Per-world goals come from `tools/level_goals.py`, but the wrong solutions and a replay check keep the reference honest.
**Why:** The hidden worlds and goals *are* the level's teaching. A wrong solution that passes means the level doesn't teach what it claims. While authoring, this caught a reference solution that only worked for Karel-style thin walls (`hurdles`).

### D20. Lessons wrap levels; guided first tries with a "Step-by-step help" setting
**Status:** proposed (Oct 2026). Pieces move to accepted as they land (`docs/lessons.md` §11). Built so far: the Goal view; lesson files and the demo player (lessons attach to existing levels for now, `docs/lessons.md` §2); `engine.check_code` / `guide_state`, the step-by-step guide strip and its setting; drive mode (`"drive"` levels, unit "Meet the robot"); the hint ladder and the local playtest event log. the play order and lesson-based unlocking from `lessons/index.json` (format 2, replacing `levels/index.json` and D18's linear rule); the drive-log-to-code bridge (`code_from`, lesson `from_clicks_to_code`)
**Decision:** Each concept is taught by a lesson (`lessons/<id>.json`) in one beat:
- a learner-paced demo with one prediction
- a guided try on a real level, where state-based steps advance on what the code *is*, checked by a new `engine.check_code`
- practice levels with an opt-in hint ladder
- a twist level, and a recap

Before any code, Unit 0 uses drive mode: command buttons plus a "Your moves" log, still run through the engine. Every level gains a Goal view. The step-by-step guide is a setting, on by default, named "Step-by-step help".
**Why:**
- **Novelty favours teaching.** For novices programming is a novel paradigm, which is where tutorials help (Andersen et al. 2012).
- **Worked examples, then faded help.** Worked examples followed by similar problems, with help faded afterwards, beat unaided problem solving (the worked-example effect and its faded form).
- **Help can hurt experts.** Expertise reversal is why help is a setting and every beat is skippable.
- **Blocking doesn't help.** Stencil-style blocking shows no engagement benefit, so the guide never blocks.
- **Evidence:** `docs/research/guidance-design/` and `docs/lessons.md` §1.
**Order:** functions → `for` → decomposition → nested `for` → `if`/`else` (on fixed-length rows) → `while` → stepwise refinement (`docs/curriculum.md`). This moves `if` ahead of `while`, unlike the current level order and Code in Place.
**Costs:**
- 26 new levels and 13 lesson files.
- A new engine contract (`check_code`) and progress format 2.
- The lesson play order replaces `levels/index.json` (done: removed Oct 2026).
**Revisit when:** playtests show first-practice unaided solve rates don't differ with the setting on and off (then the guide isn't earning its keep), or when progression moves to the topic graph (D18).

### D21. Minimal, visual UI: pictures first, words only where they're needed
**Status:** accepted (Oct 2026; the project owner's direction)
**Decision:** Every surface should be minimal, elegant and as visual and intuitive as possible.
- **Progress** is shown as dots, not "2 of 4". Screen readers still hear the words.
- **Controls** are icon buttons from `src/ui/icons.js` (one stroke style). Each carries its name in `aria-label` and `title`.
- **Text** is one short line at a time, and only where it carries meaning a picture can't: an instruction, a code name, an offer.
- **Feedback** is a mark (✓), or the picture itself: the guessed cell keeps its ring next to where the robot really ended.
- **Instructions the picture already gives** move to `.sr-only` text, for example the dashed pick cursor instead of "click a cell".
**Why:** A visual UI suits a visual world and young learners. It also follows G-09: people glance at guidance, they don't read it.
**Applies to:** all UI. The older screens got a minimal pass in Oct 2026. Nothing was removed outright: the keyboard tips and command list moved behind a "?" popover, topic names into hover text, and status words into a dot (words on failure). See ARCHITECTURE.md "UI".

### D22. Demos are done, not read: the learner presses Run
**Status:** accepted (Oct 2026; the project owner's direction)
**Decision:** A demo step with `run` waits for the learner to press the real Run button, which a
pulsing coach mark points at. Captions shrink to one short line naming the idea, and the runs make
the point: stopping short, a crash (`"expect": "error"`), a count, printed output. The first lesson
is a single step: "Here is a program. Run it and watch it instruct the robot line by line."
**Why:**
- **The learner's own action shows it.** Pressing Run and watching the robot follow the code,
  line by line, demonstrates what a program is, with no explanation needed (G-00 P3: do, don't read).
- **It teaches the control used in every later level.**
- **Cause and effect are experienced, not claimed.**
- **No passive tour.** Next-only walkthroughs are the format the research finds people skip and forget (G-02).
**Applies to:** all 11 demos, rewritten from 77 steps to 57, with most captions 3-8 words.
