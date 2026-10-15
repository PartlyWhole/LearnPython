# Code in Place and CS106A Karel problems: research notes for level design

Researched 2026-10-13. Purpose: understand what Stanford's Code in Place (CIP) and CS106A Karel
problems teach, and why they work, so we can design our own gem-robot levels *inspired by* them.
Everything below is paraphrased. No problem text, worlds or code was copied (see D10/D13 in
`CLAUDE.md`). Sources are listed at the end and cited inline as [S1], [S2], and so on.

**Caveat on sources.** The CIP lesson and exercise pages (codeinplace.stanford.edu/cipN/learn/...)
require sign-in, so I did not read them directly. The CIP picture below is put together from:
section leaders' public repos and slides, students' public repos (which name every exercise and
group them by week), copies of the CIP problem statements in those repos, and the public CS106A
pages that CIP is built from. Lesson numbering is therefore approximate. The exercise names and
the week each one falls in are well supported, because several independent repos agree.

---

## 1. Weekly structure (CIP 2023–2025)

CIP runs 6 weeks (2025: Apr 21 – Jun 6), with one live section per week and a final project.
It covers roughly the first half of CS106A. The 2025 certificate describes three units:
**Unit 1 Karel**, **Unit 2 Console programming**, **Unit 3 Graphics, lists and dictionaries** [S1].
Lessons are short recorded lectures, about two to three a week. Their order follows the CS106A
lecture sequence: Welcome → Control Flow → Decomposition → Intro to Python → Arithmetic
Expressions → Control Flow Revisited → Functions Revisited → Parameters → Lists → Images/Canvas →
Dictionaries [S2]. A CIP lesson deck on problem solving (sometimes called "Art of Problem
Solving") works through Mountain Karel and then Rhoomba Karel, with Word Search Karel as an
optional extra [S3].

| Week | Section topic (2023 / 2025) | Lessons (approx.) | Exercises seen in public repos | Karel or Python? |
|---|---|---|---|---|
| 1 | Welcome / "Control Flow with Karel". Section problem: **Hospital Karel** | Welcome (Karel commands, functions, `turn_right`); Control Flow (`for`, `while`, `if/else`, fencepost); Decomposition (top-down design, pre/postconditions) | Warmup, *Year* Karel (2023/2024/2025 Karel), Karel's Home, Puzzle/Jigsaw Karel, Piles, Beeper Path, Stone Mason (CIP version) | Karel |
| 2 | "Art of Karel" / "The Art of Coding". Section problem: **Spread Beepers** (bonus: several rows; bonus 2: echo user input) | Problem solving with Karel (Mountain, Rhoomba, Word Search); **Intro to Python** starts at the end of the week | Fill Karel, Stone Mason, Checkerboard (optional), Midpoint (optional), Spread Beepers; *Hello Name* (first console program) | Karel → Python |
| 3 | Console programs / Variables. Section problem: weight on Mars (bonus: any planet) | Intro to Python, Expressions (variables, types, `input`, casting, `random`) | Hello Name, Multiply Two Numbers, Dog Years, Mars Weight, n-sided Dice, Mad Libs / Sunrise fill-in-the-blank, Haiku generator (2025, calls an AI helper) | Python console |
| 4 | Understanding variables / Control flow revisited. 2023 section: Graphics (Random Circles) | Control Flow Revisited, Functions Revisited, Parameters | Liftoff, Double It, Random Numbers, Joke Bot, **Khansole Academy**, Game of Nimm, Hailstone, High-Low | Python console |
| 5 | Graphics (2023: Animations, section "Scribble") | Canvas graphics, animation loop | Box Row, Draw Flag (Italian flag), Pyramid, Quilt, Scene with Functions, Random Circles | Python graphics |
| 6 | Lists + Dictionaries. Section: **Heads Up** (word game read from a file) | Lists, Dictionaries | Compute Average (file → list), Quizzlet (dict flash cards), Baby Vocab (word counts → histogram), Memory Game, list practice | Python data |
| after | Final project | — | Students built e.g. Breakout, Baby Snake, Nimm and quiz games | Python |

Sources for the table: 2023 section leader repo and slides [S4], 2023 student repo [S5], 2024 repos
[S6][S7], 2025 section leader repo (weekly dates and topics) [S8], 2025 student repo [S9], 2023
section leader blog [S10], 2024 participant (Midpoint in week 2) [S11].

**Where Karel stops.** Karel covers lessons 1–3 plus a problem-solving lesson: all of week 1
and most of week 2. Python console work starts at the end of week 2 (Hello Name appears in the
2023 week-2 exercise set) and owns week 3 onwards. CS106A proper follows the same arc. In Summer
2025, lectures 2–3 were "Karel Part 1/2", and lecture 4 was Python fundamentals [S12].

**Karel language limits.** CS106A forbids variables, parameters, `break` and `return` in Karel
programs, even though the IDE accepts them [S13][S14]. In exams the only variable allowed is a
`for` loop index [S15]. That rule is what makes many Karel puzzles interesting: **Karel cannot
count**. Problems like Spread Beepers, Midpoint and doubling a pile force students to use the
*world* (beepers, positions) as their memory.

---

## 2. Catalogue of Karel problems

Legend. **Src**: CIP = Code in Place, 106A = CS106A, R = Karel reader, L = lecture example,
S = section, A = assignment, X = exam/practice exam. **Diff**: 1 (trivial) to 5 (hard).
"Std" commands = `move`, `turn_left`, `put_beeper`, `pick_beeper`. "User-defined" means the
students write the helper themselves (`turn_right`, `turn_around`, `move_to_wall`). Karel's
built-in conditions are `front/left/right_is_clear|blocked`, `beepers_present`/`no_beepers_present`,
`beepers_in_bag`, and `facing_<dir>`/`not_facing_<dir>`. The extras are `paint_corner(color)` and
`corner_color_is(color)` [S16].

### 2a. Code in Place exercises and sections

| # | Name | Src | Task (paraphrased) | Varies across worlds | Concepts | Commands needed | Diff | What makes it good |
|---|---|---|---|---|---|---|---|---|
| 1 | Warmup | CIP wk1 [S6][S9] | Step forward, pick up the one beeper, step again. | Fixed | First program, sequencing, `main` | move, pick | 1 | Zero-friction first success. It shows the run/replay loop. |
| 2 | Year Karel ("2023/2024/2025 Karel") | CIP wk1 [S5][S6][S9] | Drop a big stack of beepers (about 20), step, drop another big stack (about 24), step. | Fixed | `for i in range(n)` | put, move | 1 | Writing 20 calls by hand is so painful that the student wants a loop. Exact counts are checked. |
| 3 | Karel's Home (CIP) = Collect Newspaper (106A A1 P1) | CIP wk1; 106A A1 [S6][S13][S14] | Leave the house through the door, grab the beeper just outside, return to the start. | **Fixed** (stated explicitly) | Sequencing + **required decomposition** (a helper for each phase) | move, turn_left, pick; user `turn_right`/`turn_around` | 1–2 | Short enough that decomposition is about *naming*, not difficulty. Usually the first use of `turn_right`. |
| 4 | Puzzle Karel / Jigsaw Karel | CIP wk1 2023 ("puzzle"), 2024 ("jigsaw"); CIP 2021 A1 Q1 [S5][S6][S17] | A beeper picture has one missing piece. The loose piece lies on the bottom row: pick it up, put it in the gap, return to the bottom-left corner facing east. | Fixed | Decomposition into 3 functions; **end position and facing are part of the goal** | move, turn_left, pick, put | 1–2 | Teaches that a postcondition includes where and which way you end, not just the world state. |
| 5 | Piles | CIP wk1/2 [S6][S9] | Clear every beeper from the first row. Some corners hold piles of several beepers. | Pile sizes (given world) | `while beepers_present(): pick` nested inside a row walk | move, pick, front_is_clear, beepers_present | 2 | First nested loop. `if` instead of `while` leaves beepers behind: a classic bug. |
| 6 | Beeper Path | CIP wk1 [S6][S9] | Follow a straight trail of beepers and stop just past its end (the row is never fully covered). | Trail length / home distance | `while` on a *beeper* condition, not a wall | move, beepers_present | 2 | Loop condition is about the data, not the boundary. Must work for unknown length. |
| 7 | Stone Mason Karel (CIP version) | CIP wk1/2 [S6] | Build the missing stone columns of a temple: columns at every 4th avenue, all exactly 5 high. | Fixed (4 columns, height 5) | `for` loops, a `build_column` helper, repeat-a-helper | move, turn_left, put; user turn_around | 2 | The easy version is designed for `for`. The 106A version (#22) is the generalised one. |
| 8 | Hospital Karel | CIP section 1 (2023–2025); 106A S1 [S10][S18][S19] | Walk east along the street. At each supply beeper, pick it up and build a small fixed-shape "hospital" of beepers (CIP: two 3-high columns. 106A: three columns, the middle one raised). Finish at the east end. | Number and positions of supply beepers; street length | Stepwise refinement, **pre/postconditions** on `build_hospital`, `while`+`if`, fencepost at the last cell, not crashing into the wall | move, turn_left, put, pick, front_is_clear, beepers_present; user turn_right/turn_around | 3 | A building may end in the final corner, so the "move after building" step must be guarded. That catches students who assumed there's always room. |
| 9 | Spread Beepers | CIP section 2 (2023, 2025) [S4][S9] | A single pile sits in front of Karel. Spread it into one beeper per corner along the row, so the total stays the same. | Pile size | **Algorithm without counting**: the bag is infinite, so it can't serve as a counter. The world has to be the memory. Loop invariants. | move, pick, put, beepers_present, front_is_clear; user turn_around | 4 | Infinite beepers is the deliberate catch: the obvious "pick all, then drop all" fails. Bonus: many rows. |
| 10 | Fill Karel | CIP wk2 (2023–2025) [S5][S6][S9] | Fill every corner with a beeper and finish in the top-right corner facing east. Walls block going up everywhere except the first column. | Width and height | Nested loops, row-to-row return trip, fencepost on each row, **final position/facing is graded** | move, turn_left, put, front_is_clear; user turn_right/turn_around | 3 | The wall layout rules out a zig-zag and forces a "return to the left, go up" shape. Many students only find this after crashing. |
| 11 | Checkerboard Karel | 106A A1; CIP wk2 optional [S9][S13][S14] | Lay an alternating beeper pattern over an empty rectangle. | 8×8, 5×3, 7×7, 6×5, 3×5, 40×40, **1×1, 1×8, 8×1** | Decomposition, parity across rows, edge cases | move, turn_left, put, front_is_clear, beepers_present / facing checks; user turn_right | 4–5 | Odd widths break naive row repetition, and single-row/column worlds break turn logic. The test worlds are chosen to hit each failure. |
| 12 | Midpoint Karel | 106A A1 (bonus or required); CIP wk2 optional [S11][S13][S14] | Leave exactly one beeper at the centre of the bottom row (either centre square if the width is even). Any temporary markers must be cleared. | Width (odd/even, including width 1 and 2); world at least as tall as wide | Pure algorithm design without counting: shrinking ends, diagonals, recursion, and so on. Cleaning up after yourself. | all std; often paint_corner / facing checks | 5 | Many valid algorithms. "Pick up your scratch beepers" teaches that intermediate state must not leak into the result. |
| 13 | Mountain Karel | CIP/106A decomposition lesson [S3][S20] | Walk to a stair-step mountain built from walls, climb it, plant a beeper flag on the summit, climb down the far side, and carry on to the end. | Mountain height and width (the lesson generalises from one mountain to bigger ones) | Top-down design (`climb`, `plant_flag`, `descend`), `while` on wall sensing | move, turn_left, put, front_is_clear, right_is_blocked (or turning to check); user turn_right | 3 | The lesson first solves one fixed mountain, then generalises. That models how to remove hard-coding. |
| 14 | Rhoomba Karel | CIP/106A decomposition lesson [S3] | Start bottom-left facing east and sweep a wall-free rectangle until no beepers remain. The ending spot doesn't matter. | Size and beeper layout | Serpentine traversal, decomposition (`clean_row`, `reposition`), test-as-you-go | move, turn_left, pick, front_is_clear, beepers_present, left/right_is_clear; user turn_right | 3–4 | Natural "your program must work in any world" problem, with clear subproblems. Odd or even row count trips up the turn-around logic. |
| 15 | Word Search Karel | CIP lesson, "if extra time" [S3] | (Details not public.) | — | — | — | ? | Listed only as an optional extension in the lesson plan. |

### 2b. CS106A assignments, sections and exams (closely related; CIP 2020 used the CS106A A1 itself [S21])

| # | Name | Src | Task (paraphrased) | Varies across worlds | Concepts | Commands needed | Diff | What makes it good |
|---|---|---|---|---|---|---|---|---|
| 16 | United Nations Karel | 106A S1 (2018–19) [S22] | At each debris beeper, build a small house on stilts *centred* on that beeper. End at the south-east corner facing east. | Number and positions of debris beepers | Same as Hospital, plus centring (back up one first) | std + front_is_clear, beepers_present | 3 | The ancestor of Hospital Karel. Centring adds an offset precondition. |
| 17 | Karel Defends Democracy | 106A S1 (2018–2025) [S19][S22] | Walk the middle row of a ballot made of 3-high columns. Where the middle cell is *empty*, clear every beeper from the cells above and below. Leave the other columns alone. End facing east at the right end. | Number of columns; which columns are "punched"; pile sizes (0..n) | Conditionals deciding *whether* to act, `while` to clear piles, return to the row (postcondition), fencepost on the last column | move, turn_left, pick, front_is_clear, beepers_present / no_beepers_present | 3 | Some beepers must **stay**, so "collect everything" is wrong. The student has to read the spec. |
| 18 | Triple Karel | 106A A1 2020 (= CIP 2020) [S14] | Paint three sides of each of three rectangular "buildings" made of walls by placing beepers along them. | Building sizes (always 3, same relative layout) | Build up in layers: paint one side → one building → all three. Reuse a function. Boundary detail (the last square is left unpainted). | std + front_is_clear, right/left_is_blocked | 3 | The handout spells out the incremental build: one side, then one building, then three. |
| 19 | Ramp Climbing Karel | 106A A1 (~2020–21) [S23] | Draw a beeper "ramp" of slope ½ (two steps across, one up) from the bottom-left corner. | Square, odd-sized worlds (even is an extension) | Loops with a compound step, stopping at the boundary | std + front_is_clear | 3 | A simple-looking pattern with a boundary stopping condition. |
| 20 | Stone Mason Karel (106A version) | 106A A1 2017–2026 [S13][S14][S24] | Repair the columns of the quad's arches. Columns sit every 4th avenue, a wall marks each column's top, and a wall follows the last column. Fill the missing stones. | Number of columns, **column heights (can differ within a world)**, which stones already exist | Generalisation, `while` until wall, `if no_beepers_present` (no doubling), fencepost on the last column | std + front_is_clear, no_beepers_present | 3–4 | The handout warns against hard-coding a height of 5 or a column count. Pre-filled stones punish blind `put_beeper`. |
| 21 | Copycat Karel | 106A practice midterm, Summer 2025 [S15] | Copy the 0/1 beeper pattern from columns 2–5 into columns 7–10. The world can be any height, even one row. | Height, pattern | Scanning and reproducing without memory (no variables!), coordinate offsets | std + beepers_present, front_is_clear | 4 | Without variables, Karel must shuttle cell by cell. With Python it becomes an easy list-copy problem, which makes a good "before/after variables" pair. |
| 22 | Border Karel | 106A practice midterm, Summer 2026 [S25] | Put exactly one beeper on every cell of a border inset one square from the outer walls. A 3×3 world gets just the centre. | Size (≥3×3) | Loop + fencepost on each side, the degenerate 3×3 case | std + front_is_clear | 3–4 | The 3×3 edge case catches "four equal sides" solutions. |

### 2c. Karel reader and lecture examples (worked examples; good for early tutorial levels)

| # | Name | Src | Task (paraphrased) | Varies | Concepts | Commands | Diff | Why it's there |
|---|---|---|---|---|---|---|---|---|
| 23 | Step Up / FirstKarel ledge | R ch2–3; L2 [S16][S26] | Pick up a beeper, climb onto a one-step ledge, put it down. | Fixed | Sequencing. Hits "there's no turn right", so you **define `turn_right` as three lefts** | std | 1 | The canonical first decomposition: build the missing command from the ones you have. |
| 24 | Pothole | R ch4 [S16] | Move up to a hole in the road, drop a beeper into it, carry on. | Fixed | Decomposition: `main` reads like the plan (`fill_pothole`) | std; user turn_right/turn_around | 1 | Shows that the main function should read like an outline. |
| 25 | Place 42 beepers / Beeper square | R ch5; L2 [S16][S27] | Put a fixed number of beepers. Put one at each corner of a square loop. | Fixed | `for` loop; **a loop's postcondition must match its precondition**; nested loops | put, move, turn_left | 1–2 | First explicit pre/post-matching lesson. |
| 26 | Move to wall | R ch6 [S16] | Walk to the wall, in any world (1×1 to 8×8). | Size (switchable) | `while front_is_clear()`; why `for` can't do it | move, front_is_clear | 1 | The reader offers a world dropdown so students *see* generality. |
| 27 | Beeper Line / FillRow (the "fix the bug" example) | R ch6; L2 (file marked buggy); 106A handout [S16][S27][S28] | Lay a beeper on every cell to the wall. The naive loop misses the last cell. | Size | **Fencepost / off-by-one** (n beepers, n−1 moves) | put, move, front_is_clear | 2 | The defining fencepost example. Reused later as a reusable "do X on every cell to the wall" pattern. |
| 28 | Invert beepers | R ch7 [S16] | Along a row, pick up beepers where they exist and put one where they don't. | Size | `if/else` | std + beepers_present | 2 | A minimal first if/else. |
| 29 | Beeper Towers (collect and stack) | R ch8 (stepwise refinement) [S16] | Columns hold towers of unknown height (some empty). Collect them all, stack every beeper on the east corner of row 1 (bag starts empty, unload with `beepers_in_bag`), return home. | Tower heights | Top-down design, test a single tower before the loop, **treat an empty tower as height 0** (no special case), pre/postconditions, the "do X on every cell to the wall" pattern | std + front_is_clear, beepers_present, beepers_in_bag | 4 | The reader's full worked example of stepwise refinement. |
| 30 | Steeple Chase | L2 (control flow), older handouts [S27][S28] | Run a fixed-length course. Hurdles of any height can stand between any two avenues: go up, over and down each one. | Hurdle heights and positions | `for` over a fixed length, `if/else` (clear vs hurdle), `while right_is_blocked` to climb, **pre/postconditions per helper** | move, turn_left, front_is_clear, right_is_blocked; user turn_right | 3 | The lecture's "put it all together" example. A "super steeple chase" world also exists. |
| 31 | Cleanup Karel | older 106A handout [S28] | Go through the whole world and pick up scattered beepers (at most one per corner). | Size, layout | Serpentine, row parity, `left/right_is_clear` to detect the last row | std + left/right_is_clear, beepers_present | 3 | The same pattern as Rhoomba. |
| 32 | Double the pile | older 106A handout [S28] | Double the number of beepers in the pile in front, then return to the original spot and facing. | Pile size | Arithmetic with the world as memory (move beepers to a temp cell, two per one) | std + beepers_present | 4 | Shows that "Karel can do maths" without variables. |
| 33 | Common-error examples ("fix the bug") | L3 Decomposition slides [S3] | (a) `while left_is_clear(): turn_left()` never ends: an **infinite loop**. (b) a hurdle loop whose helper ends in a different state from what the loop assumes: **pre/postcondition mismatch**. | — | Debugging, reasoning about state | — | 2 | Good material for "find and fix" levels. |

---

## 3. Post-Karel Code in Place exercises (brief)

| Exercise | Week | What it teaches |
|---|---|---|
| Hello Name | 2–3 | `input`, string concatenation or f-strings |
| Multiply Two Numbers, Dog Years, Mars Weight (Planetary Weights) | 3 | `int()`/`float()` casting, arithmetic, constants, `round`. The planets bonus adds `if/elif` lookup |
| Mad Libs / Sunrise fill-in-the-blank, Haiku generator | 3 | Several inputs → one formatted output. The 2025 haiku version calls a provided AI function |
| n-sided Dice, Random Numbers | 3–4 | `random.randint`, constants, `for` with a count |
| Liftoff | 4 | Countdown `for i in range(10, 0, -1)` |
| Double It | 4 | `while value < limit` with an update |
| Joke Bot | 4 | String comparison with `if/else` |
| **Khansole Academy** | 4 | Random two-number addition quiz: generate, ask, compare, report. CS106A extends it until 3 correct answers in a row [S12]. Practices random, input, conditionals and loop state |
| Game of Nimm, High-Low, Hailstone | 4 | Game loop with state, turn switching, input validation; Collatz loop with parity |
| Box Row, Draw Flag, Pyramid, Quilt, Scene with Functions, Random Circles | 5 | Canvas coordinates, loops computing positions, functions with parameters (`draw_patch(canvas, x, y)`) |
| Scribble / animations | 5 | Animation loop, mouse input |
| Compute Average | 6 | Read a file into a list, `sum/len`, empty-list guard |
| Quizzlet | 6 | Dict iteration as a flash-card quiz, a score counter |
| Baby Vocab | 6 | Counting with a dict → text histogram |
| Heads Up, Memory Game | 6 | Random choice from a list, list state, index validation |
| Final projects | after | Breakout, Baby Snake, and so on |

**Inspiration for our later levels.** Every one of these uses the same small set of moves:
*read data → keep a running value → decide → act or print*. Our data-returning sensors fit this
directly. For example: `gems_here()` gives a number to accumulate, `scan()` gives a list to
`sum`/`max`/`index`, and `coin_flip()` provides randomness the way Khansole/Nimm do. A "Khansole"-style
level could ask the robot to report (`print`) the total gems in the corridor ahead, and a
"Baby Vocab"-style level could tally the gem counts seen across rows into a dict.

---

## 4. Pedagogy notes

1. **Restricted commands, so the first decomposition is forced.** There are only four commands
   and no `turn_right`. The first "programming" insight is to build it from three `turn_left`s,
   then name it with `def` (reader ch2→3, lecture "StepUp") [S16][S26]. `turn_around` follows the same way.
   Our API also lacks `turn_right` on purpose: keep it that way.
2. **Order: sequence → functions → decomposition → `for` → `while` → `if` → stepwise
   refinement** (reader chapters 2–8) [S16]. CIP week 1 covers all of control flow, and week 2 is
   spent *applying* it to harder problems (the "art" of problem solving).
3. **"Must work in any world."** Every A1 problem except Collect Newspaper is graded in
   several hidden worlds. The handouts warn that many students submit programs that work in the
   default world and fail badly in others [S14]. The test worlds aim at the edge cases:
   1×1, single row, single column, odd/even size, an empty tower or column, a pre-filled cell, a
   hospital ending in the last corner. The reader shows a world dropdown on the `while` example
   to make generality visible [S16].
4. **Pre/postconditions.** Students are told to write a docstring with pre- and postconditions for
   every function [S13][S14]. The reader ties them to loops: the state at the end of a loop body must be
   a valid start for the next pass [S16]. The decomposition lecture shows a pre/post mismatch bug
   [S3].
5. **The fencepost pattern as a reusable idiom.** It appears first in the beeper line, is reused for
   towers, and generalises to "while front clear: do X; move — then do X once more" [S16].
6. **Stepwise refinement with incremental testing.** Write `main` as an outline of helpers that
   don't exist yet. Test a single tower or column before wrapping it in a loop. Remove special
   cases where you can (an empty tower is a height-0 tower) [S16]. Triple and Checkerboard hand
   students the exact incremental path [S14].
7. **Style counts.** Functions should do one thing, have a descriptive name, be about 10 lines
   at most and nest no more than 3 levels deep [S3]. Comments explain intent. Style is part of the grade.
8. **Common mistakes they target.** Off-by-one at the wall. Infinite `while` (a condition the body
   never changes). Crashing into a wall after the last action. `if` where `while` is needed (piles).
   Placing a second beeper on a pre-filled cell. Hard-coded sizes or counts. Wrong end facing or
   position. Leftover scratch markers (Midpoint).
9. **No variables in Karel** makes "Karel can't count" a design tool (Spread Beepers, Midpoint,
   Double, Copycat) [S13][S15]. Once variables arrive (week 3), the same problems become easy.
   CIP uses that contrast to motivate Python data.
10. **Fixed worlds have a role too.** The first 3–5 CIP exercises use one fixed world each. They
    teach syntax, sequencing and naming before generality is asked for.

---

## 5. Mapping to our API

**Our current API:** `move()`, `turn_left()`, `front_is_clear()`, `pick()`, `gems_here()` → int,
`scan()` → list of counts ahead up to the wall or a blocked cell, `coin_flip()`. **World:** blocked
*cells* (not walls between cells), gem counts per cell, the bag starts at 0, hidden worlds.
**Goals:** `all_gems_collected`, `end_at` (one cell for *all* worlds), `bag_at_least`,
`no_error`. **Constraints:** `max_lines`, banned AST constructs (`for`, `while`, `def`, …).

**Differences that matter when adapting:**
- *Walls vs blocked cells.* Karel's walls sit between corners, while ours fill whole cells. Mountains,
  hurdles, column tops, house walls and the Fill Karel shelves can all be drawn as blocked cells,
  but they take up grid space. Leave room in the layouts.
- *Our robot can count.* `gems_here()` returns a number and `scan()` returns a list. Python
  variables are allowed. That makes several Karel puzzles trivial: Midpoint becomes
  `len(scan())//2`, Spread Beepers becomes "read the count", and Piles becomes `for _ in range(gems_here())`.
  Either withhold these sensors per level, or use them on purpose as the "after variables"
  version of the same puzzle (as in note 9 above).
- *`end_at` is level-wide*, but in varying-size worlds the target cell changes with the world
  ("end at the east wall", "end at the midpoint").

### 5a. What fits which API

| Problem (#) | Works with current API? | What's missing |
|---|---|---|
| Warmup (1) | **Yes** (`bag_at_least: 1` or `all_gems_collected`) | — |
| Karel's Home / Collect Newspaper (3) | **Yes**: blocked cells form the house, `end_at` = start, `bag_at_least: 1` | facing goal (nice to have) |
| Piles (5) | **Yes** (nested `while gems_here()`) | — |
| Beeper Path (6), as a "collect the trail" variant | **Yes** | stop-past-the-end needs a **per-world `end_at`** |
| Move to wall (26) | Only with a per-world `end_at`, or a gem at the far wall | per-world `end_at` |
| Rhoomba (14), Cleanup (31) | **Yes** (`all_gems_collected`, serpentine with `turn_left` ×3) | left/right sensors are optional (students can write `right_is_clear()` by turning) |
| Steeple Chase (30) | **Yes**: hurdles are columns of blocked cells, the course has a fixed length so a level-wide `end_at` works | — (students define the side check by turning) |
| Mountain (13), as a "fetch the summit gem" variant | **Yes** | original "plant a flag" needs `put` |
| Beeper Towers (29), collect-only half | **Yes** | stacking at the corner needs `put` |
| Year Karel (2), Jigsaw (4), Pothole (24), Beeper square (25), Beeper line / fencepost (27), Invert (28) | No | `put` + **exact gem layout goal** |
| Stone Mason (7, 20), Fill (10), Checkerboard (11), Border (22), Ramp (19), Triple (18) | No | `put` + exact gem layout goal (per world, since sizes vary); Fill also needs end position and facing per world |
| Hospital (8), United Nations (16) | No | `put` (+ a bag that can supply gems) + exact layout + per-world `end_at` |
| Democracy (17) | No | an exact layout goal ("these gems must remain") — `pick` alone is enough |
| Spread Beepers (9), Double the pile (32), Copycat (21) | No | `put` + exact layout goal + a large or infinite bag. To keep the "can't count" puzzle, hide `gems_here`/`scan` and ban variables |
| Midpoint (12) | Partly: "stop at the midpoint" works with a per-world `end_at` | "a gem exactly at the midpoint" needs `put` + layout goal. Withhold `scan` |
| Towers full version (29) | No | `put` + layout goal (+ the `beepers_in_bag` equivalent: we have a numeric bag, so expose `bag()` or let students count) |

### 5b. Recommended minimal additions (in priority order)

1. **`put()`**: drop one gem from the bag onto the current cell, with a learner-facing
   `WorldError` if the bag is empty. Add a world field **`bag`** for the starting count. Allow a
   large number, or `"infinite"`, for Karel-style building problems. A finite bag is also a
   design lever: Spread Beepers with a finite bag is a *different*, easier puzzle. This one
   command unlocks every building and painting problem (about 20 of the 33 above).
2. **An exact gem-layout goal**, e.g. `"gems_exactly": {"x,y": n, ...}`: the final gem map must
   equal this one, no more and no fewer. Without it you can only grade "everything collected" or
   "bag ≥ n", which covers clean-up problems and nothing else. Democracy, Stone Mason's
   "don't double-stack" rule and Midpoint's "clean up your scratch gems" all depend on it.
3. **Per-world goals.** Let each world (main and hidden) carry its own goal fields, overriding
   the level goal, at least `end_at`, `gems_exactly` and an optional new `facing`. Varying-size
   worlds need this, and they are the whole point of the CIP pedagogy. Pair it with a small
   authoring tool that computes the expected layout from a reference solution, so authors don't
   type gem maps by hand.
4. **Per-level API allow-list** (or extend `constraints.banned` to API names): hide
   `gems_here`/`scan`/`coin_flip` on levels where counting would trivialise the puzzle. This is
   a cheap `ast.Name` check in `check_constraints`. It lets the same world appear twice: the
   "can't count" version, then the "with variables" version.

**Deliberately *not* recommended yet:**
- `turn_right`: students should write it, as in CIP. It is the first decomposition lesson.
- `left_is_clear` / `right_is_clear`: students can write them as helper functions that turn,
  check and turn back. That is a good level on its own (a helper that *returns* a bool, which
  Karel itself forbids). Add them later only if traces get too noisy.
- `facing_*`: students can track direction in a variable. If needed later, add one
  data-returning sensor, `heading()` → `"N"|"E"|"S"|"W"`, in line with D11, rather than eight
  predicates.
- Painting or markers: Midpoint-style scratch work can use gems once `put` exists.

With additions 1–3, roughly 30 of the 33 catalogued problems can be adapted. Only Word Search
(unknown spec) and the paint-based Midpoint variants remain. Today about 9 can be adapted:
Warmup, Home, Piles, the trail-collect variant, Rhoomba, Cleanup, Steeple Chase, the summit-gem
Mountain and the collect-only Towers.

### 5c. A suggested progression (our own levels, inspired by the above)

1. Sequencing on a fixed world (Warmup-like) → 2. a fixed errand with required helpers and a defined
`turn_right` (Home-like) → 3. `for` with exact counts (Year-like, needs `put`) → 4. `while` to the
wall in varying corridors (exists: `collect_row`) → 5. fencepost "gem on every cell" with a
deliberately buggy starter (needs `put` + layout) → 6. `while gems_here()` piles → 7. trail following
→ 8. hurdles/steeple chase with student-written `right_is_clear()` → 9. serpentine Rhoomba
sweep → 10. conditional clean-up that must leave some gems (Democracy-like) → 11. build at each marker
(Hospital-like) → 12. generalised columns (Stone Mason, varying heights, pre-filled) → 13. a
"can't count" puzzle with sensors hidden (Spread) → 14. the same puzzle with `gems_here()` and
variables → 15. `scan()` list problems (sum, max, index) as the bridge to CIP weeks 3–6.

---

## Sources

- [S1] Code in Place 2025 certificate page (units, dates, requirements): https://codeinplace.stanford.edu/cip5/certificate/3cnzhc
- [S2] CS106A Spring 2022 lecture sequence (nav on "Control Flow Revisited"): https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1226/lectures/06-control-flow-revisited/
- [S3] CS106A "Decomposition" slides, Piech & Sahami (lesson plan with Mountain, Rhoomba, Word Search; Rhoomba spec; style tips; common errors): https://web.stanford.edu/class/cs106a/lectures/3-Decomposition/3-Decomposition.pdf . A CIP-labelled copy ("Code in Place Lesson 2 slides", "Art of Problem Solving") is at https://www.scribd.com/document/871669351/Code-in-Place-Lesson-2-slides
- [S4] CIP 2023 section leader repo and slides (sections 1–6, Hospital, Spread Beepers, Mars weight, Random Circles, Scribble, Heads Up): https://github.com/Adamouization/Code-In-Place-2023
- [S5] CIP student repo, 2023 (2023 Karel, Fill, Jigsaw, Stone Mason, Khansole, Quilt, Baby Snake): https://github.com/Ambercita/CodeinPlace-Python
- [S6] CIP 2024 problem statements copied in a student repo (Warmup, 2024 Karel, Karel's Home, Jigsaw, Piles, Beeper Path, Stone Mason CIP version, Fill Karel): https://github.com/Bassamejlaoui/Stanford-Code-In-Place-2024
- [S7] CIP 2024 student repo (full exercise list): https://github.com/SafaZriba/Code-in-place-2024
- [S8] CIP 2025 section leader repo (weekly section schedule and topics, exercises by week): https://github.com/emrecoban/CodeinPlace-2025
- [S9] CIP 2025 student repo (exercises by week incl. Checkerboard, Midpoint, Spread Beepers, Nimm, Hailstone, Heads Up, Breakout): https://github.com/diegogerwig/Stanford_CodeInPlace_2025
- [S10] CIP 2023 section leader blog, week 1 (Hospital Karel in section, turn_right): https://www.jessicadeneearley-cha.com/blog/code-in-place-week-1
- [S11] CIP 2024 participant on week 2 / Midpoint (Medium; blocked to the fetcher, seen via search snippet): https://medium.com/@AdamDoingTech/second-week-of-code-in-place-2024-aka-stanfords-cs106a-3b31dbc9109d
- [S12] CS106A Summer 2025 lecture/assignment list (Karel Parts 1–2, Khansole Academy): https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1258/lectures/03-karel2/
- [S13] CS106A Assignment 1 (recent: Collect Newspaper, Stone Mason, Checkerboard, Midpoint): https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1268/assignments/1-karel/ and https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1226/handouts/05-assignment1.html
- [S14] CS106A Assignment 1, Summer 2020 (Triple Karel, testing advice, pre/postcondition style): https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1208/assn/05-assignment1.pdf
- [S15] CS106A Summer 2025 practice midterm 2 (Copycat Karel, variable restriction): https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1268/assessments/1-midterm/practice_midterm_2.pdf
- [S16] Karel the Robot Learns Python reader (chapters 1–9 and reference): https://compedu.stanford.edu/karel-reader/docs/python/en/intro.html
- [S17] CIP 2021 Assignment 1 Q1 "Jigsaw Puzzle Karel" (search snippet only; page access-restricted): https://www.coursehero.com/file/110911428/Assignment-1-Karelpdf/
- [S18] CS106A Section 1 (Hospital Karel, Democracy): https://web.stanford.edu/class/cs106a/section/section1/section1.html
- [S19] CS106A Summer 2025 Section 1 (Hospital: 3 columns, middle raised; Democracy): https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1258/section/section1
- [S20] CS106A 2012 "Programming in Karel" handout (Mountain Karel and its generalisation): https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1126/handouts/06-ProgrammingInKarel.pdf
- [S21] CIP 2020 student repo (A1 = Collect Newspaper, Triple, Stone Mason, Checkerboard, Midpoint): https://github.com/srivastav-ayush/Code-in-Place
- [S22] CS106A Section 1 handouts 2018–19 (United Nations Karel, Democracy): https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1192/handouts/10-section1.pdf , https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1198/section/1/Section1.pdf
- [S23] CS106A Assignment #1 (Ramp Climbing Karel, Midpoint bonus): https://web.stanford.edu/class/cs106a/assn/karel-handout.html
- [S24] CS106A Assignment 1, Fall 2017: https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1182/handouts/07-assignment-1.pdf
- [S25] CS106A Summer 2026 practice midterm 1 (Border Karel): https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1268/assessments/1-midterm/practice_midterm_1.pdf
- [S26] CS106A Summer 2025 Lecture 2 page and code (StepUp, FillRow buggy, SteepleChase): https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1258/lectures/02-karel1/
- [S27] CS106A Spring 2022 "Control Flow" slides (beeper square, fencepost, steeple chase, condition list): https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1226/lectures/02-control-flow/2-ControlFlow.pdf
- [S28] CS106A 2013 "Example Karel Problems" handout (Steeple Chase, beeper line fencepost, Cleanup, Double pile): https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1136/handouts/09-karel-examples.pdf
