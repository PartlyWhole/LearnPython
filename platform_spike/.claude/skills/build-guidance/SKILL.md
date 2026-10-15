---
name: build-guidance
description: Implement or change LearnPython's in-app guidance runtime in platform_spike, meaning the goal view, lesson loader and lesson list, demo player, guide panel with state-based steps and engine check_code, the Step-by-step help setting, drive mode (command buttons and the Your moves log), the hint ladder, progress format 2 and the local event log, following docs/lessons.md. Use whenever asked to build, wire up, fix or restyle any tutorial, onboarding, walkthrough, tooltip, hint, coach-mark or guide UI in the LearnPython app, even if the request names only one piece ("add a Show me button", "make the guide accessible").
---

# Building LearnPython's guidance runtime

`docs/lessons.md` is the spec: what each surface does, the lesson format, the checks, the
setting, the hint ladder, progress format 2 and the build order (§11). This skill covers *how* to
build those pieces inside this codebase without breaking its invariants. Content (lessons,
captions, hints) is the `design-lesson` skill's job, and levels belong to `author-level`.

Paths are relative to `platform_spike/`. Read `CLAUDE.md` (the invariants) and the relevant
§ of `docs/lessons.md` before you start. Then read:
- `references/surfaces.md`: DOM, ARIA, states and styling for each surface
- `references/acceptance.md`: the browser and accessibility checks every piece must pass

## 0. Ground rules (they follow from CLAUDE.md)

- **Minimal and visual (D21).** Dots, not counts. Icon buttons (`src/ui/icons.js`, `data-icon` +
  `aria-label` + `title`), not word buttons. One short line of text, only where a picture can't say
  it. Feedback is a mark or the picture itself, and sentences for screen readers go in `.sr-only`.
  Look at every new surface and remove what the layout already says.

- **No game rules in JS.** Whether a step is done, whether a level passes and what a drive-mode
  press does are all decided by `engine.py` in the worker. JS only draws and routes. (Drive mode
  re-runs the whole button program through `run_program`, `docs/lessons.md` §3.) The goal view's
  `goalWorld()` is presentation: keep it pure and test it against engine fixtures.
- **New engine functions are contracts** (invariant 7). `check_code(code, checks)` needs:
  - the check vocabulary in `schemas/lesson.schema.json`
  - a `validate_lesson` in `engine.py`
  - a `check_code` protocol message in `src/runtime/protocol.js` and `worker.js`
  - tests in `tests/test_engine.py` and `tests/test_lessons.py`
  - bad edits added to `BAD_LEVEL_EDITS` (or a lesson equivalent)

  Ship all of these in one change. It uses `ast` only (stdlib, invariant 1).
- **One piece per change**, in the §11 order unless asked otherwise. Each piece comes with its tests, an
  `ARCHITECTURE.md` "Built so far" update, and a `docs/decisions.md` entry if it changes a decision.
  D20 moves from *proposed* to *accepted* as its pieces land.
- **Never block the editor.** No overlay may swallow clicks or keys meant for the editor or the
  world. The guide panel sits beside the editor (or below it when narrow), never on top.
- **Inject timers and storage** (invariant 10; `Progress` already takes a storage). The guide's
  debounce and the hint chip's timing take a clock, so Node tests can drive them.
- **Keep the test hook local.** Extend `window.__learnPython` for automation (`lesson`, `guide`,
  `setStepByStep`), still only on localhost.
- **No new runtime dependencies.** Plain ES modules (D12). If you need a CodeMirror feature (a
  diff preview for Show me), export it through `tools/vendor/codemirror-entry.js` and run `npm run vendor` (D15).

## 1. Where things go

| Piece | Files | Pure, Node-testable part |
|---|---|---|
| Goal view | `src/render/goal.js` (`goalWorld`), a second `Renderer` in `app.js`, `app.html` | `goalWorld(world, goal)` |
| Lessons (**built**) | `lessons/`, `schemas/lesson.schema.json`, `tools/check_lesson.py`, loading in `app.js` | `lessonForLevel` in `demo.js` |
| Demo player (**built**) | `src/lessons/demo.js`, `src/lessons/demo-ui.js`, renderer `highlightCell` / `pickCell` | `demoSteps`, `textChange`, `typingPlan`, `predictionFeedback` |
| Guide (**built**) | `src/lessons/guide.js`, `guide-ui.js`, `engine.check_code` / `guide_state`, protocol `guide` message | `currentStep`, `GuideTracker`, `Debouncer`, `lineDiff` |
| Setting + progress (**built**, unlock rule still to do) | `src/progress/progress.js`, Settings dialog in `app.html` | settings, `with:` bookkeeping, hidden guides, nudges |
| Drive mode (**built**) | `src/lessons/drive.js`, `drive-ui.js`, renderer `bump` / `markTarget`, level `"drive"` key | `DriveProgram`, `describePress` |
| Hint ladder (**built**) | `src/lessons/hints.js`, `hint-ui.js` | `HintLadder`, `rungsFor`, `lessonForPractice` |
| Event log (**built**) | `src/progress/events.js`, Settings › Playtest log | `EventLog` (capped at 500, wrapped storage) |

Put pure logic in the module with no DOM, as `frames.js` and `player.js` do, and test it in
`tests/js/<module>.test.mjs` with the fakes in `tests/js/helpers.mjs`.

## 2. Workflow for each piece

1. Re-read its § in `docs/lessons.md` and its entry in `references/surfaces.md`.
2. Write the pure module and its Node tests first. For engine work, write the Python tests first.
3. Wire it into `app.js` / `app.html` / `app.css`. Use the theme variables. Do it in light and dark.
4. Run `python3 -m pytest -q tests` and `node --test tests/js/*.test.mjs`.
5. Run `references/acceptance.md` for this piece in the browser. Also run the CLAUDE.md app
   click-through: a passing run, a failing run, a crash, an infinite loop and Stop. Guidance must not break the core loop.
6. Update `ARCHITECTURE.md` and, if a decision changed, `docs/decisions.md`. Update `docs/lessons.md` if
   the implementation taught you the spec was wrong. Say so in your report rather than drifting from it silently.

## 3. Done when

- [ ] Python and JS suites pass; new pure modules have Node tests; engine additions have Python tests
- [ ] The acceptance script for the piece passes in the browser, in light and dark
- [ ] Keyboard-only and reduced-motion checks pass (`references/acceptance.md` §A)
- [ ] The core click-through still works
- [ ] `ARCHITECTURE.md` (and `docs/decisions.md` if needed) updated
