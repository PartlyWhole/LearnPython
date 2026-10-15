# Curriculum: the lesson progression

This is the order in which LearnPython teaches its concepts. A **lesson** introduces one concept and
wraps a few **levels**: the learner watches a demo, tries a first exercise with step-by-step help,
then practises on their own. How lessons are built and stored is in `docs/lessons.md`. The rules
for designing one are in the `design-lesson` skill.

Status keys: ✓ = the level exists (`levels/`; all of them do, Oct 2026); **new** = it still had to be authored with the
`author-level` skill. A planned world is a sketch, not a spec: the authoring skill decides the
details and the hidden worlds.

## The beat every lesson follows

| Beat | What the learner does | Guidance | Story role (kishōtenketsu) |
|---|---|---|---|
| **Watch** | Steps through a demo: code appears line by line, with one caption per step. They predict once, then run it. | Demo player, paced by the learner (Next) | Introduce |
| **Guided try** | Solves the first exercise themselves. With *Step-by-step help* on (the default), a guide gives one instruction at a time and moves on when the code or the world shows the step is done. | Guide panel; off when the setting is off | Develop |
| **Practice** | 1–3 levels on their own | Hint ladder, offered only after failure | Develop |
| **Twist** | A level that bends the concept: a size it didn't expect, or combined with an earlier one | Hint ladder | Twist |
| **Recap** | A one-line card: what they can now do, plus the code pattern | None | Conclude |

Every beat can be skipped ("I know this: go to the practice") and replayed from the lesson list.
Only practice and twist levels count as *solved* for unlocking. A guided try passes too, but
progress records it as `guided`, so mastery can later be judged on unaided solves.

## Unit 0. Meet the robot (no code yet)

Built as four plain levels in the play order (no lesson files): `drive_to_star`, `drive_pick`,
`drive_put` and `corner_drive`. L0.1 and L0.2 below describe their intent.

The learner uses buttons, not code. This is *drive mode* (`docs/lessons.md` §3). The world
and the goal are both on screen. Each button press adds the matching line (`move()`) to a
read-only **Your moves** log under the world. **Reset** puts the world back and clears the log.

### L0.1 Drive (drive mode)
- **Watch:** none. Three short drive-mode levels teach through the world itself. Prompts are 8 words or fewer.
  1. `drive_to_star` ✓: a 5×1 corridor. The goal shows an end marker on the last cell.
     Buttons: `move`. Prompt: "Press move() to drive forward."
  2. `drive_pick` ✓: a 5×3 world with a gem two cells ahead, then a turn. Buttons:
     `move`, `turn_left`, `pick`. Driving into a wall is safe: the robot bumps, a message names
     the wall, and Reset is highlighted. (This is the first crash, made cheap on purpose.)
  3. `drive_put` ✓: carry one gem (bag 1) to a marked cell. Buttons: `move`, `turn_left`, `put`.
- **Recap:** "Each button is a command. Your moves log is a program."

### L0.2 Only left turns: first challenge (drive mode)
- **Level:** `corner_drive` ✓, a drive twin of `turn_right` with the same world (a contract test keeps them equal), with buttons `move`, `turn_left`, `pick`. The world needs
  two right turns. Discovery: three lefts face the same way as one right. Expect the learner to try
  and reset a few times. That is the point: no prompt explains it.
- **On solve:** the log shows `turn_left()` three times, twice. The caption reads "Three lefts make a right.
  Next: teach the robot that as one command." This sets up L1.2.
- Built as a twin level rather than one level with two modes (`docs/lessons.md` §3).

## Unit 1. Programs and functions

### L1.1 From clicks to code
- **Watch:** the learner's own L0.1 log turns into editable code. "This is your program. Run
  it." The robot repeats their drive.
- **Guided try:** `first_steps` ✓. Steps: type `move()` → add lines until the robot reaches the
  gem → add `pick()` → Run.
- **Recap:** "A program is commands that run top to bottom."

### L1.2 Name a move (`def`)
- **Watch:** the demo world (demo only) has a gem two cells east, and the robot must
  come back. The demo writes `def turn_around():` with two `turn_left()` calls, and uses it
  twice. Captions: "def names a new command." · "Indented lines are what it does." ·
  "Calling it runs those lines." Predict: "Which way does the robot face at the end?"
  - We deliberately do not demo `turn_right`: the learner will write that. `turn_around` has the
    same shape, so the guided try transfers it to a near problem (a worked example followed by a
    similar problem).
- **Guided try:** `turn_right` ✓ in code mode. It is the same world they solved by clicking in
  L0.2 ("Same corner as before. Now teach the robot to turn right."). Steps: write
  `def turn_right():` → indent three `turn_left()` → replace your three lefts with
  `turn_right()` → Run.
- **Practice:**
  - `fetch_gem` ✓ (uses `turn_right` and `turn_around`; end position and facing are graded)
  - `climb_stairs` ✓: climb a 3-step staircase of blocked cells to a gem on top. The neat
    solution is `def climb_step()`, which itself calls `turn_right()`: functions calling functions.
- **Twist:** `around_the_block` ✓: walk all the way around a 2×2 block of blocked cells
  and finish on the start cell, facing the start way. The learner discovers that the same
  `go_around_corner()` repeats four times. That is the hook for loops.
- **Recap:** `def name():` + indented body; call it with `name()`.

## Unit 2. Repeat (`for`)

### L2.1 Do it n times
- **Watch:** the robot must stack 7 gems on one cell. The demo writes `put()` seven times and
  stops: "That's a lot of typing." It then deletes them and writes `for i in range(7):` with
  `put()` indented. Predict: "How many gems end up on the cell?" Next it changes `7` to `3`,
  runs again, and shows the count changed.
- **Guided try:** `plant_row` ✓ (`max_lines` 4, bag exactly 5). Steps: type `for i in range(5):`
  → indent `put()` → add `move()` in the loop (the guide points out that indentation decides
  what repeats) → Run.
- **Practice:**
  - `stack_and_step` ✓: two stacks of different sizes, 12 and 9, with `max_lines`. Two
    loops one after the other.
  - `square_walk` ✓: walk around a square four times. The loop body is several lines,
    including `turn_left()`.
- **Twist:** `loop_the_block` ✓: the `around_the_block` idea on a bigger 3×3 block, under `max_lines`, so the
  four repeats must become `for i in range(4): go_around_corner()`, a loop that calls a function. It is its own
  level because each level appears once in the play order.
- **Recap:** `for i in range(n):` repeats the indented block n times.

## Unit 3. Decomposition (where it actually helps)

The point of this unit is *when* to make functions, not how. Its exercises are written so that
the version without functions is long and hard to debug, while the decomposed one reads like
the brief.

### L3.1 Plan with names first
- **Watch:** build three short towers (demo world). The demo writes the *plan* first:
  `for i in range(3):` then `build_tower()` then `go_to_next_spot()`. It runs, crashes with
  "build_tower is not defined", and shows that this is expected. Then it defines each piece in turn
  and re-runs after each one. Captions: "Write what you want in names, then teach each name."
  · "Run after each piece."
- **Guided try:** `fence_posts` ✓ (shaped like Stone Mason, CIP version: posts at fixed
  intervals, all the same height, fixed world). Steps: write the plan (loop + two calls) → define
  `build_post()` → Run (a post appears, then a crash or a wrong position) → define
  `next_post()` → Run.
- **Practice:**
  - `flower_beds` ✓: three identical small gem patterns. Each bed is a function, and the
    robot must end where the next bed starts. This is the first explicit "where do you end up?" (a
    postcondition): the goal includes `end_at` and `facing`.
  - `fetch_gem` ✓ can be replayed here if it was skipped.
- **Twist:** `two_kinds` ✓: two different patterns, alternating. It needs two helpers and
  a plan that calls both.
- **Recap:** split a task into named steps; check where each step leaves the robot.

## Unit 4. Loops in loops (nested `for`)

### L4.1 Rows of rows
- **Watch:** fill a 4×3 grid (demo world). The demo first reuses `plant_row()` from Unit 2 and
  writes `for row in range(3): plant_row(); go_to_next_row()`. Then it inlines `plant_row`, so the
  inner `for` sits inside the outer one, and the robot behaves the same. Predict: "How many gems
  in total?"
- **Guided try:** `gem_grid` ✓: fixed 5×3, fill every cell, then return to the left of the
  next row. Steps: write `fill_row()` with a `for` → test one row → wrap it in the outer `for` → add
  `next_row()` → Run.
- **Practice:**
  - `stripes` ✓: fill every *other* row (a twist on the outer loop's body)
  - `square_of_squares` ✓: four 2×2 blocks (a `for` inside a `for` inside a function)
- **Twist:** `staircase_build` ✓: row `i` gets `i + 1` gems. The inner `range` uses the outer
  loop variable. This is the first time a loop variable matters.
- **Recap:** the inner loop runs completely, once for each pass of the outer loop.

## Unit 5. Decisions (`if` / `else`)

This unit comes before `while`. Its worlds have a **fixed length**, so `for` still works, but
gem positions vary between the hidden worlds. Hard-coding therefore fails, and the `if` is what
earns the solve.

### L5.1 Look before you act
- **Watch:** a 6-cell row with gems on some cells. The demo first writes `for` + `pick()` +
  `move()`. It crashes on an empty cell ("there is no gem here"). Then it adds
  `if gems_here():` before `pick()`. Predict: "Which cells still have gems at the end?"
- **Guided try:** `pick_where_found` ✓: an 8-cell row. The hidden worlds have the same length and
  different positions, including none and every cell. Steps: write the walk with `for` → add
  `if gems_here():` → indent `pick()` under it → Run (the hidden worlds show why the `if` matters).
- **Practice:**
  - `fill_gaps` ✓: put a gem only where there isn't one (`if not gems_here():`)
  - `flip_row` ✓: pick where there is one and put where there isn't (`if`/`else`, bag starts with enough)
- **Twist:** `detour` ✓: a fixed-length walk with *one* blocked cell somewhere in each
  world. `if front_is_clear(): move()` / `else:` step around it. The condition is about walls, not gems.
- **Recap:** `if condition:` runs its block only when the condition is True; `else:` covers the other case.

## Unit 6. Repeat until (`while`)

Four short lessons rather than one. A dry run of the design-lesson skill showed that one
lesson could not hold it all. `collect_row` needs a `while` *inside* the walk, because its
piles defeat an `if`. `gem_line` needs the fencepost idea. `keep_one` needs comparisons
(`>`), and `hurdles` needs functions that `return` True/False. Each of those is a concept of
its own.

### L6.1 Keep going while…
- **Watch:** first a `for i in range(5): move()` corridor solution, run in a *longer* corridor so the
  robot stops short. Then `while front_is_clear(): move()` in the same corridor, and in a 1-cell one
  (a `world` switch, `docs/lessons.md` §2). Then `while gems_here(): pick()` on a pile. Captions:
  "for counts. while checks." · "The condition is checked before every pass." Predict (cell):
  where the robot stops.
- **Guided try:** `collect_row` ✓. Its starter already walks to the wall, so the steps begin
  inside the walk: check the cell after `move()` → pick *while* there are gems (the headline
  mistake is Unit 5's `if`, which leaves part of a pile; check: `pick` inside `while>while`) →
  Run.
- **Practice:** `piles` ✓ (the same nested shape, a near transfer)
- **Twist:** `follow_trail` ✓: walk along a trail of gems and stop just past its end. The
  loop condition is about gems, not walls (Code in Place shape #6, Beeper Path).
- **Recap:** `while condition:` repeats until the condition is False.

### L6.2 The last cell (fencepost)
- **Watch:** a "put a gem on every cell up to the wall" demo. The `while front_is_clear(): put(); move()`
  version misses the last cell. The demo shows that, then adds one `put()` after the loop. Caption: "n
  cells, n − 1 moves." Predict (cell): which cell is left empty.
- **Guided try:** `gem_line` ✓ (fix the buggy starter)
- **Practice:** `plant_to_wall` ✓ (corridors of varying length, including 1)
- **Twist:** `edge_gems` ✓: gems only on the first and last cells, so both ends of the fencepost matter
- **Recap:** "Loop, then handle the last cell": do something at every cell up to a wall.

### L6.3 Compare
- **Watch:** `gems_here() > 1` as a condition, printed first (`print(gems_here() > 1)` shows
  `True`/`False` in the output), then used in a `while`. Introduce `==`, `>`, `<` and `!=`.
- **Guided try:** `keep_one` ✓ (a comparison in the loop condition)
- **Practice:** `big_piles_only` ✓: take piles of 3 or more, leave smaller ones (a comparison in an `if`)
- **Twist:** `level_piles` ✓: make every pile exactly 2 (`<` adds, `>` removes, in one walk)
- **Recap:** a comparison is a condition: `while gems_here() > 1:`.

### L6.4 Your own conditions (`return`)
- **Watch:** `def wall_on_right():` turns, checks, turns back and `return`s `not front_is_clear()`.
  It is then used as `if wall_on_right():`. Caption: "A function can answer a question with return."
- **Guided try:** `hurdles` ✓ (bool-returning helpers + `while` + `if`)
- **Practice:** `wall_follower` ✓: follow a wall of irregular blocked cells using `wall_on_right()`
- **Twist:** `stairs_up_and_down` ✓ (climb, then descend, until the end; `required: ["return"]`)
- **Recap:** `def question(): return <condition>` lets you name a condition.

## Unit 7. Stepwise refinement

Adapted from the method in the Karel Reader, chapter 8 ("Stepwise Refinement"): top-down design,
testing as you go, pre- and postconditions, and spotting a known pattern. The problem shape is
"collect towers of unknown height along a row, then return home". The world and story are our own
(CLAUDE.md invariant 13).

### L7.1 From the top down
- **Demo world (new, `harvest`):** crystal columns of unknown height (some empty) stand on the
  bottom row. The robot must collect every crystal and return to its start, facing east.
  - Karel's version also drops everything at the end. Our robot can't read its bag, so that phase
    becomes `leave_shed()` at the start. If a `bag()` sensor is ever added (D11: data-returning),
    the original three phases come back.
- **Watch** (longer, about 8 steps, and the learner can stop at any point):
  1. Write the top level: `leave_shed()`, `harvest_all_columns()`, `return_home()`, each defined
     as `pass`. Run: nothing breaks. "Start from the top. Each name is a promise."
  2. Give `harvest_all_columns` a *temporary* body: `harvest_column()` then `move()`. "Test one
     column before you loop."
  3. Refine `harvest_column()` into five steps: turn to the column, collect the line, turn around,
     go back down to the row, and turn to face along it again. Write its precondition and
     postcondition as a docstring ("starts and ends on the bottom row, facing east"). Run on the
     first column and watch.
  4. Swap the temporary body for `while front_is_clear(): harvest_column(); move()`. Run: the
     last column is missed. "Same fencepost as L6.2." Add the final `harvest_column()`.
  5. Finish `return_home()` with `move_to_wall()`. Run all worlds.
  - Caption on the pattern: "Do something at every cell up to a wall: loop, then once more."
- **Guided try:** `harvest_rows` ✓ (the same method, a different world: gem *rows* hang
  from the ceiling over each cell, or a similar shape the author picks). The guide gives the
  process steps, not code: write the plan with stubs → Run → refine one helper and test it on the
  first column → write its pre/postcondition → loop it → handle the last one → Run all worlds.
  Checks are structural (the helpers are defined and called, the program runs), never exact text.
- **Practice:**
  - `build_towers` ✓ (pre/postconditions in docstrings)
  - `repair_columns` ✓
  - `sweep` ✓
- **Twist:** `tile_floor` ✓ (capstone: refinement plus state carried in a variable)
- **Recap:** start from the top, stub, test the inside of a loop before the loop, write down
  where each function starts and ends.

## After Unit 7

`midpoint` ✓ and `richest_cell` ✓ (Using data) follow, then the topic graph takes over
(`docs/decisions.md` D18).

## The play order as built (Oct 2026)

`lessons/index.json` (format 2) is the play order. Print it with `python3 tools/play_order.py`.

| Unit | Item | Levels: guided, practice, twist (★) |
|---|---|---|
| Meet the robot | level | `drive_to_star` |
|  | level | `drive_pick` |
|  | level | `drive_put` |
|  | level | `corner_drive` |
| Programs and functions | lesson `from_clicks_to_code` | `first_steps` |
|  | lesson `name_a_move` | `turn_right`, `fetch_gem`, `climb_stairs`, `around_the_block` ★ |
| Repeat | lesson `for_loops` | `plant_row`, `stack_and_step`, `square_walk`, `loop_the_block` ★ |
| Decomposition | lesson `decomposition` | `fence_posts`, `flower_beds`, `two_kinds` ★ |
| Loops in loops | lesson `nested_loops` | `gem_grid`, `stripes`, `square_of_squares`, `staircase_build` ★ |
| Decisions | lesson `conditionals` | `pick_where_found`, `fill_gaps`, `flip_row`, `detour` ★ |
| Repeat until | lesson `while_loops` | `collect_row`, `piles`, `follow_trail` ★ |
|  | lesson `fencepost` | `gem_line`, `plant_to_wall`, `edge_gems` ★ |
|  | lesson `compare` | `keep_one`, `big_piles_only`, `level_piles` ★ |
|  | lesson `own_conditions` | `hurdles`, `wall_follower`, `stairs_up_and_down` ★ |
| Stepwise refinement | lesson `refinement` | `harvest_rows`, `build_towers`, `repair_columns`, `sweep`, `tile_floor` ★ |
| Using data | level | `midpoint` |
|  | level | `richest_cell` |

43 levels and 11 lessons. Changes from the plan above, made while authoring:
- **Lessons:** L0.1 and L0.2 are plain drive levels, not lessons. L1.1 is the lesson `from_clicks_to_code`: its demo shows the learner's own `drive_pick` moves as code (`code_from`), and its guided try is `first_steps`.
- **New and changed levels:**
  - `loop_the_block` is the L2.1 twist.
  - `piles` and `collect_row` use `while gems_here():` instead of `> 0`, because comparisons come in L6.3.
  - Unit 5 rows start on an empty "dock" cell, so "move, then look" reaches every cell without the fencepost idea from L6.2.
- **New constraints:** two constructs were added for `required`:
  - `compare`, used by `big_piles_only` and `level_piles`, so the comparison can't be dodged;
  - `return`, used by `wall_follower` and `stairs_up_and_down`, so the bool helper can't be inlined.
- **Known gaps** (see the authors' notes in `docs/levels.md`):
  - Decomposition can't be enforced: a flat loop plus any trivial `def` passes the Unit 3 levels. A `min_defs`-style constraint would close it.
  - The `sweep` and `tile_floor` references use `break` and parameters, which the curriculum never teaches. Learners can solve both without them, and their hints show how.
