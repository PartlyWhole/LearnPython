# Lessons and in-app guidance: design

**Status: proposed (D20), not built.** This document describes how Gem Rover teaches: lessons,
demos, guided first tries, drive mode, the goal view and hints. It is the contract that the
`design-lesson` skill writes to and the `build-guidance` skill implements.

The general evidence behind it is in `docs/research/guidance-design/` (an imported reference set,
cited below as G-00 to G-12). The lesson order is in `docs/curriculum.md`.

## 1. Principles, as they apply here

Gem Rover is the case where a tutorial *is* worth having. For a novice, programming is a
genuinely new way of interacting, and the paradigm-novelty and complexity effects favour
teaching (G-00 E3: Foldit). Even so, most of what the evidence says still holds:

| Rule | What it means in Gem Rover |
|---|---|
| Doing beats reading (G-00 P3) | Every guided step is something the learner types or runs in the real editor and world. Nothing is a slideshow. |
| One concept at a time, just before use (P4) | One lesson per concept. A demo shows exactly the construct the next exercise needs. |
| Brief (P5) | Captions and guide steps are 25 words or fewer. Drive-mode prompts are 8 or fewer. |
| Pull over push (P2) | Hints appear only after failure, and as an offer. The only pushed guidance is the guided try. It runs once, can be turned off, and can be hidden mid-try. |
| Never blocking (G-05: stencils show no benefit) | The editor is always live. The guide reacts to what the code *is*, not to clicks on highlighted areas. |
| Skippable and re-findable (P6, P7) | Every beat can be skipped and replayed from the lesson list. "Show steps" brings a hidden guide back. |
| Stateful (P8) | Watched, guided and solved-with-help are all stored. Nothing re-runs that the learner has already done, unless they ask. |
| Can't fail the tutorial (G-07, Adams) | Demos can't fail. Guided tries can't soft-lock: Reset (the undo icon), "Show me" and Hide are always there. |
| Measure behaviour (P9) | The measure of success is solving the practice level *unaided* after the guided try, not finishing the guide. |

Programming-education findings that add to the reference set:
- **Worked examples first, then similar problems.** Novices learn more from studying a worked example
  and then solving a similar problem than from solving problems alone (the worked-example effect,
  Sweller and colleagues). The *Watch → Guided try* pair is that structure.
- **Fade the help.** Help should be withdrawn step by step as competence grows (faded worked examples,
  Renkl and Atkinson). Our sequence is guide (first try), then hints on request (practice), then nothing (twist).
- **Expertise reversal.** Guidance that helps novices can slow down learners who already know the
  material (Kalyuga). That is why step-by-step help is a *setting*, why every beat can be skipped,
  and why the app offers to switch help off when a learner keeps getting ahead of the guide (§5.5).
- **Predict before running.** Asking learners to predict what code will do before they run it is the
  first stage of PRIMM (Sentance, Waite and Kallia, 2019). Each demo has one prediction.
- **Name the subgoals.** Labelling the steps of a solution helps transfer (subgoal labelling, Margulieux,
  Catrambone and Morrison). Guided steps and stepwise-refinement captions name the subgoal ("Test one
  column before you loop"), not just the keystrokes.

## 2. Files

```
lessons/index.json          the play order (format 2): units of items, {"level": id} or {"lesson": id}
lessons/<id>.json           one lesson: watch, guided, practice, twist, recap, hints
schemas/lesson.schema.json  the format; tools/check_lesson.py checks what a schema can't
levels/<id>.json            unchanged; a level may add "modes": ["drive", "code"] (default ["code"])
tests/test_lessons.py       contract tests for every lesson (§9), using tools/check_lesson.py
```

**The play order (built, Oct 2026).** `lessons/index.json` (format 2) is the play order; it
replaced `levels/index.json`.

- **Items:** each unit lists items. An item is a plain level (`{"level": id}`: the drive levels
  and the data levels) or a lesson (`{"lesson": id}`). A lesson expands to its guided level, its
  practice levels, then its twist.
- **One list in each language:** `tools/play_order.py` (Python) and `src/lessons/order.js` (JS)
  both produce the flat level list. `test_contracts.py` requires every level file to appear in
  it exactly once.
- **Finding a level's lesson:** a lesson is found by its guided level (one lesson per level).
  Opening that level plays the demo first, once, unless the level is already solved. `?demo=1`
  or the **Watch demo** icon replays it.
- **Gaps:** a lesson may still have an empty `practice` or no `twist`. The checker warns but
  doesn't fail; `from_clicks_to_code` is like this on purpose.
- **Demo code from the learner:** a watch step may name `"code_from": "<level id>"`. The demo
  then shows the learner's own solved code for that level, with `code` as the fallback. This is
  how the drive log becomes code: `from_clicks_to_code` replays the learner's `drive_pick` moves.

### Lesson file (format 1)

```json
{
  "format": 1,
  "id": "for_loops",
  "title": "Do it n times",
  "concept": "Repeat a block a fixed number of times with for and range",
  "topics": ["for_loops.range_count"],
  "watch": {
    "world": { "width": 3, "height": 1, "start": [0, 0, "E"], "bag": "infinite" },
    "steps": [
      { "say": "The robot needs 7 gems on this cell.", "focus": "world" },
      { "say": "Seven put() lines would work. That's a lot of typing.",
        "code": "put()\nput()\nput()\nput()\nput()\nput()\nput()\n", "focus": "editor" },
      { "say": "for repeats the indented lines. range(7) means 7 times.",
        "code": "for i in range(7):\n    put()\n", "focus": "editor:1" },
      { "say": "How many gems will be on the cell?",
        "predict": { "choices": ["1", "7", "8"], "answer": "7" } },
      { "say": "Run it.", "run": true }
    ]
  },
  "guided": {
    "level": "plant_row",
    "steps": [
      { "say": "Start a loop that runs 5 times: for i in range(5):",
        "done_when": [{ "has": "for", "range": 5 }],
        "example": "for i in range(5):\n    pass\n" },
      { "say": "Indent put() under the loop so it repeats.",
        "done_when": [{ "calls": "put", "inside": "for" }],
        "example": "for i in range(5):\n    put()\n" },
      { "say": "Add move() in the loop too. Indentation decides what repeats.",
        "done_when": [{ "calls": "move", "inside": "for" }],
        "example": "for i in range(5):\n    put()\n    move()\n" },
      { "say": "Run it and watch the row fill.",
        "done_when": [{ "run": "passed" }] }
    ],
    "done": "Five gems, one loop. Next: on your own."
  },
  "practice": ["stack_and_step", "square_walk"],
  "twist": "around_the_block",
  "recap": { "say": "for i in range(n): repeats the indented block n times.",
             "code": "for i in range(n):\n    ..." },
  "hints": {
    "stack_and_step": ["Compare your result with the Goal view.",
                       "Two stacks: two loops, one after the other.",
                       "for i in range(12):\n    put()\nmove()\nfor i in range(__):\n    ..."]
  }
}
```

Field rules:
- **`watch.steps[].code`** is the *whole* editor content after that step, not a diff. The player
  animates the change from the previous step. Back and Next are then trivial, and a step can be
  checked on its own.
- **`watch.steps[].world`** (optional) switches the demo to another world from that step on,
  for example the same code in a longer or a 1-cell corridor. Without it, the demo stays on `watch.world`.
- **`focus`** names what to highlight: `world`, `editor`, `editor:<line>`, `cell:<x>,<y>`,
  `button:<name>` (drive mode), `run`, `goal`. Only one highlight per step (G-02).
- **`predict`** is either `{"choices": [...], "answer": "<one of them>"}` or
  `{"cell": true, "answer": [x, y]}` (the learner picks a cell, by click or keyboard; the runtime
  announces it in words, as "column 3, row 1"). The caption must say in words what is being predicted. A wrong prediction is fine: the next step runs the code and shows what really happens.
  It is never a gate.
- **`guided.steps[].example`** is the learner's code after doing this step correctly. It is the
  content of "Show me", and the contract tests use it (§9).
- **`hints[level]`**: at most 3 rungs, from gentle to specific (§6). The last rung may be a code
  skeleton with `__` blanks, never the full solution.

## 3. Drive mode (Unit 0)

The learner presses command buttons instead of typing. The world and the goal are both visible.

**Built (Oct 2026).** Differences from the sketch below:
- **One key instead of two.** A level opts in with `"drive": {"buttons": [...]}` (any of `move`,
  `turn_left`, `pick`, `put`), and is then always played that way. `modes` was dropped.
- **A twin level for the corner.** The corner challenge is its own level, `corner_drive`. Its world
  is identical to `turn_right` (enforced by `test_drive_twins_share_their_world`), because the play
  order lists each level once.
- **The run.** Each press runs `check_level` (not `run_program`) on the whole button program. One
  call both animates the newest step and checks for a pass.
- **The log and the controls.** The "Your moves" log sits where the editor will later be, shown as
  numbered code lines. Undo and Reset are icons. Shortcuts work while focus is in the panel: ↑ moves,
  ← turns left, Backspace undoes.
- **The target cell.** A dashed ring on the main world marks the cell, for every level whose goal
  has `end_at`, not only drive levels.
- **On a phone** the world comes first, so the robot stays in view while you press.
- **Not built yet:** the L1.1 bridge, where the log becomes the editor's code.

- A level opts in with `"modes": ["drive"]`, or `["drive", "code"]` to be played both ways
  (`turn_right` is played in drive mode in L0.2 and in code mode in L1.2). The lesson item
  chooses which mode it uses: `{"level": "turn_right", "mode": "drive"}`.
- **Buttons:** one per allowed command, labelled with the code (`move()`), in `constraints`'
  allowed order. Sensors are not buttons. Keyboard: buttons are real `<button>`s in tab order.
  Shortcuts are optional extras, never the only way.
- **Each press** appends a line to the program. The page then runs the *whole* program through
  `run_program` in the worker and animates only the newest event. This keeps one engine (D2)
  and needs no JS game rules (CLAUDE.md "Don't"). A press is ignored while the previous one is animating.
- **Crash:** the robot bumps (the existing ✗ edge mark), a one-line message names the problem, further
  presses are disabled, and **Reset** and **Undo** are highlighted. Undo drops the last line and re-runs.
- **Your moves** log: the program so far, read-only, under the world. At the start of L1.1 it
  becomes the editor's content: the bridge to code.
- **Pass:** checked with `check_level` after every press; on pass, show the recap line.

## 4. Goal view (every level)

The learner always sees the goal state, not just reads it. A small second grid labelled **Goal**
next to the world shows the main world's goal:
- `gems_exactly`: the gem layout
- `all_gems_collected`: the world with no gems
- `end_at` / `facing`: a ghost robot
- `bag_at_least`: a bag badge

Hidden worlds' goals stay hidden. A pure function `goalWorld(world, goal)` (in `src/render/`,
unit-tested against the engine's `goal_for` fixtures) builds the world to draw. The renderer
draws it unchanged. Hint rung 1 ("Compare with the Goal view") depends on this feature, so build it first.

**Built (Oct 2026).** Two details differ from the sketch above. A bag goal with no gem goal draws an
empty floor, because the gems are meant to be picked up. And instead of a bag badge, a visible
sentence under the picture states the goal ("Goal: at least 1 gem in the bag and the robot on the
marked cell, facing east."). That sentence is also the accessible text, since the picture is
`aria-hidden`. See ARCHITECTURE.md.

## 5. The guided try and the "Step-by-step help" setting

The setting is called **Step-by-step help** (Settings: "Step-by-step help on first tries", on by
default). It is not called "hand-holding": the name should describe what you get, not judge the
person who uses it.

### 5.1 What it does
On a lesson's guided try, a **guide strip** above the editor shows one step at a time. It has
progress dots (no "2 of 4" text on screen; screen readers hear it), one instruction, and two icon
buttons: **Show me** (eye) and **Hide** (✕). Hide is also the skip: the level stays fully
playable without the guide. When the setting is off, or the guide was hidden, a small steps icon
next to "Your program" brings it back for this level. That icon is the pull path (G-06).

**Built (Oct 2026).** Differences from the first sketch:
- The setting applies at once (turning it off collapses the guide to its icon), rather than at the next try.
- Hide and Skip are one control.
- Progress fields live in the existing store with defaults, rather than needing a format-2 migration (§7).

### 5.2 State-based steps (no "Next" button)
After every edit (debounced about 400 ms) and every run, the page evaluates every step's
`done_when`. **The current step is the first one whose checks fail.** As a result:
- typing the right thing moves the guide on, whatever order the learner typed it in;
- pasting a full solution jumps to "Run it";
- deleting code moves the guide back;
- the guide never needs to know *how* the learner got there.

**Run-only steps go last.** A run result counts only for the code it ran (§5.3), so a step whose
only check is a run would undo itself on the next edit and pull the guide back. Put "run the
starter to see what happens" into the text of the next code step instead (`fencepost` does this).

A step that has been satisfied shows a ✓ for about 1 s before the next appears. The guide never
auto-advances on a timer. A step's text stays until its checks pass, or until the learner hides it.

### 5.3 Checks (`done_when`: all must hold)

These are evaluated in the worker by a new engine function, `check_code(code, checks)`. It uses
`ast` (stdlib, so it obeys invariant 1) and the last run result.

| Check | True when |
|---|---|
| `{"has": "for"\|"while"\|"if"\|"else"\|"def"}` | the construct appears (`"range": n` also requires `range(n)` in a `for`) |
| `{"defines": "turn_right"}` | `def turn_right` exists at the top level |
| `{"defines": "turn_right", "body_calls": {"turn_left": 3}}` | …and its body calls `turn_left` exactly 3 times |
| `{"calls": "put", "inside": "for"\|"while"\|"if"\|"def <name>", "min": 1}` | there is a call inside that construct (`min` defaults to 1) |
| `{"calls": "turn_right", "outside": "def"}` | the call is at the top level (it is used, not just defined) |
| `{"run": "any"\|"no_error"\|"passed"}` | the last run since this step began ran / finished without error / passed every world |
| `{"robot_at": [x, y]}` | the last run of the main world ended on that cell |
| `{"docstring": "<fn>"}` | `def <fn>` has a docstring (for pre/postconditions, Unit 7) |
| `{"not": <check>}` | the wrapped check is false (for example "no `for` left": `{"not": {"has": "for"}}`) |

Details:
- **`inside`** means the *body* of the construct, not its condition: `while gems_here():`
  does not put `gems_here` inside the `while`.
- **Nesting** is written as a path, outermost first: `"inside": "while>while"` means inside a
  `while` that is itself inside a `while`. A path matches any depth in between, so `"for>if"`
  also matches `for → while → if`.
- **Counts:** `has` and `calls` take `"min"` and `"max"` (count of matching nodes). For example,
  `{"has": "while", "min": 2}`.
- **Run checks are tied to code.** A run result counts only for the exact code it ran. Any edit
  makes it stale, and `run` / `robot_at` checks are then false until the next run. A step with only
  code checks is therefore never undone by a stale run, and a "Run it" step comes back after an edit.

A syntax error makes every code check false, and the guide shows "Fix the red line first". That
message comes from the editor's error mark, not from a new message. Checks look at structure,
never at exact text, so `for _ in range(5)` and `for k in range(5)` both pass.

### 5.4 Show me
**Show me** previews the step's `example` as a diff against the learner's code: added lines
highlighted, plus a **Use this** button. Accepting it replaces the editor content, and one
Ctrl/⌘+Z undoes it. The level is then recorded as solved `with: "guided+shown"`. It is not hidden
or penalised; progress just keeps the difference (Super Mario Galaxy 2's bronze star, G-07).

### 5.5 Fading and expertise reversal
- The guide only runs on a lesson's *guided* level. Practice and twist levels never get it;
  they get the hint ladder (§6) instead.
- **Ahead of the guide:** if a learner satisfies the last step's code checks before step 2 was
  ever shown, three times across lessons, offer once: "You're ahead of the guide. Turn off
  step-by-step help?" [Turn off] [Keep it]. Store the answer, and never ask again.

### 5.6 Leaving and returning
Navigating away saves the draft (existing behaviour) and the guide state. Returning to the level
shows the guide at the step its checks compute; there is nothing else to resume. Hidden stays
hidden for that level until **Show steps** is pressed.

## 6. Hint ladder (practice and twist levels)

**Built (Oct 2026).** Differences from the sketch below:
- **The offer** is a lightbulb icon at the top of the results panel, not a "Want a hint?" chip.
  Opening it shows the rung in the same strip as the guide: rung dots, one line, or a code skeleton
  with a copy icon.
- **The last rung** adds an icon that replays the lesson's demo.
- **Rung 3 unlocks on failed runs only.** The 5-minute timer was dropped, because time alone isn't
  evidence of being stuck.
- **A level with no authored hints** gets one default rung, "Compare your result with the Goal view."
  Any rung that mentions the Goal view pulses it.
- **The ladder state** (`progress.hints[level]`) survives reloads. Only unsolved levels offer hints.
- **Guided levels** have the guide instead, so they never offer hints.

Hints are offered, never pushed (G-06 help ladder, G-07 adaptive help):

| Rung | Offered after | Content |
|---|---|---|
| 0 | always | Brief, Goal view, failure messages per world (all exist or are in §4) |
| 1 | 2 failed runs on this level | Chip "Want a hint?" → the level's `hints[0]` (default: "Compare with the Goal view", which opens it) |
| 2 | rung 1 seen + 1 more failed run | `hints[1]`: names the concept or the mistake |
| 3 | rung 2 seen + 2 more failed runs, or 5 min since the last pass-free run | `hints[2]` (a skeleton with blanks), and "Watch the demo again" |

- One chip at a time. The chip never covers the editor or world. Dismissing it ("Not now")
  hides it until the next failed run.
- A solve after any hint is stored `with: "hint"`.
- Rungs climb only on evidence (a failed run is a run that doesn't pass). Idle time alone never
  triggers rung 1, because a learner reading is not a learner stuck.

## 7. Progress

**Built:** these fields live in the existing `gem-rover/progress/v1` store, and older stores load
with defaults, so nothing migrates: `settings.stepByStep`, `solved[id].with`,
`lessons[id].{watch, guided}`, `guide.hidden[levelId]`, `nudges.{aheadOfGuide, aheadOffer}`.
The sketch below was the original plan.

### Original sketch (format 2)


`src/progress/progress.js` gains the following, with a migration from format 1 (`{solved, drafts}`):
```json
{
  "format": 2,
  "solved": { "plant_row": { "at": 0, "code": "", "with": "none|hint|guided|guided+shown" } },
  "drafts": {},
  "lessons": { "for_loops": { "watched": true, "guided": "done|skipped", "at": 0 } },
  "settings": { "stepByStep": true },
  "nudges": { "ahead_of_guide": 0, "ahead_offer": "unasked|accepted|declined" }
}
```
**Unlocking (built, replaces D18): `Progress` in `src/progress/progress.js`, tested in
`tests/js/progress.test.mjs`.**
- **Items open in order.** A plain level is complete when it is solved.
- **When a lesson opens,** its guided level and its twist open together. The twist is the
  "I know this" placement path. Practice opens once the guided level is solved.
- **A lesson is complete** when its twist is solved, or when all its practice is solved. With
  neither, it is complete when its guided level is solved.
- **A solved level always stays open,** so old progress keeps its solves even where the order moved levels.
- **Where the learner goes:** `current()` is the first open, unsolved level of the first
  unfinished item. `next()` continues within the lesson (practice leads on to the twist), then
  moves to the next item.

## 8. Accessibility (acceptance criteria)

From G-08, applied to these surfaces:
- **Guide panel:** a non-modal `region` labelled "Step 2 of 4". Step text is announced through
  `aria-live="polite"` when it changes, and only once. Focus stays in the editor: the guide never
  steals it. Esc (when focus is in the panel) hides the guide. **Show steps** brings it back.
- **Demo player:** Next, Back, Replay and Skip are buttons. Nothing auto-advances. An optional
  Play mode advances step by step and can be paused. Typing animation is replaced by instant
  insertion under `prefers-reduced-motion`. The caption is a live region.
- **Predict:** the choices are radio buttons. A cell prediction can also be made with the
  keyboard (arrow keys over the grid, Enter).
- **Drive mode:** the buttons are buttons. After each press, a live region says what changed ("Moved
  to column 3", "Bumped a wall").
- **Hint chip:** a `button`. The hint opens as a non-modal dialog and Esc closes it.
- **Contrast:** guide highlight rings are at least 3:1, text at least 4.5:1, in both themes.
- **Reflow:** the guide stacks under the editor at narrow widths, and is never drawn on top of it.

## 9. Contract tests (`tests/test_lessons.py`)

The lesson equivalent of D19. For every lesson:
1. The JSON validates against `schemas/lesson.schema.json`. Every referenced level exists; every
   level in `hints` is in `practice` or `twist`.
2. **The demo works:** the code of every `watch` step that has `run: true` runs on the demo world
   without error. A `cell` prediction's answer is where the robot ends when that step's code runs.
   (`choices` answers can't be checked automatically, so the author checks them by watching.)
3. **Each guided step is reachable and not already done:** for step k, `example_k` satisfies the
   code checks of steps 1..k, and `example_{k-1}` (or the level's `starter_code` for k = 1) does
   *not* satisfy step k. The last example passes `check_level`. This catches checks that are too
   loose (a step done before it starts) and too strict (an example that fails its own step).
4. **Reference solutions satisfy the guide:** `tests/solutions/<guided level>.py` satisfies every
   code check of every step. A learner who writes the reference never sees a stuck guide.
5. Copy budgets: watch `say` is 25 words or fewer, guided `say` 20 or fewer, drive-mode prompts 8 or fewer.
   Every `done_when` uses only the check kinds in §5.3, and every `focus` uses only the forms in §2. A skeleton hint contains
   `__` and is not a passing solution: run it through `check_level` with the blanks filled by `0`,
   and again by `pass`, and require failure. Skeletons are whole programs, not fragments. A
   fragment fails trivially, which proves nothing. A skeleton with a single blank is suspect:
   check by hand that the blank isn't the whole answer.

## 10. Measuring it

**Built:** `src/progress/events.js` keeps the last 500 events in `gem-rover/events/v1`. Settings ›
**Playtest log** downloads them as JSON. Events recorded: `run {level, passed}`,
`level.solved {level, with}`, `lesson.beat_started {lesson, beat}`, `guide.step_shown`,
`guide.show_me`, `guide.hidden`, `hint.offered {level, rung}`, `hint.opened {level, rung}`.

The app has no server. Until it has one, record a capped local event log (key
`gem-rover/events/v1`, last 500 events). Its events are `lesson.beat_started`, `guide.step_shown`,
`guide.show_me`, `guide.hidden`, `hint.offered`, `hint.opened`, `run` (pass/fail) and
`level.solved {with}`. Export the log from a debug link for playtests.

The **success measure** is the share of learners who solve the first practice level *unaided*
(`with: "none"`) after the guided try, and how many runs it takes them. Guide completion is a
vanity metric (G-12). Playtest with true novices: watch silently, and note where they stall,
which captions they skip, and whether they can explain the concept afterwards. The setting is a
ready-made A/B: compare first-practice solves with step-by-step help on and off.

## 11. Build order

| # | Piece | Why this order |
|---|---|---|
| 1 | Goal view (§4): **built** | Helps every existing level now; hint rung 1 depends on it |
| 2 | Lesson files, the lesson list, the demo player (§2, Watch): **built** | Lessons can be authored and played before any guide exists |
| 3 | `check_code` in the engine, the guide panel, the setting, progress fields (§5, §7): **built** | The guided try; needs a protocol message (invariant 7) |
| 4 | Drive mode (§3): **built** | Unit 0; independent of 2–3 |
| 5 | Hint ladder (§6) and the local event log (§10): **built** | Needs authored hints and some playtest data |

Each piece is a separate change, with its tests, an ARCHITECTURE.md update, and a decision entry
if it alters a decision.
