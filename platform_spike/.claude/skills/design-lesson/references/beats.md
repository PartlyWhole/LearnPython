# The beats, in detail

Each section covers what the beat is for, its rules, and a good and a bad example. The G-numbers
point into `docs/research/guidance-design/`.

## Watch: a worked example the learner paces

**For:** showing the new construct working on a problem where it obviously helps, before the
learner has to produce it (the worked-example effect). Mario 1-1's first Goomba: a safe first
encounter (G-07).

Rules:
0. **Show, don't tell.** Run steps wait for the learner to press the real Run button (coach mark).
   The replay explains what a caption would only claim. The first lesson is just "Here is a program.
   Run it and watch it instruct the robot line by line" plus the coach mark: that one action teaches
   top-to-bottom execution and where Run is.
1. **Problem before construct, by running it.** Step 1 runs the old way so the learner sees it hurt:
   repetition, a count that stops short, a crash on an empty cell (`"expect": "error"`). Without that,
   the construct is an answer to no question.
2. **Code grows one idea per step.** Each step's `code` changes one thing: a line, an indent, a
   number. If a step's caption needs "and", split it.
3. **Point at what changed.** `focus: "editor:<line>"` on the new line, or `cell:x,y` where the
   effect shows. One focus per step.
4. **Predict, then run (optional).** At most one prediction, right before the learner presses Run.
   A wrong guess is fine, because the run is the feedback. Never grade it and never block on it.
5. **Show a variation.** After the run, change one value (`7` to `3`) and run again. This separates
   the construct from this particular problem.
6. **Captions say what and why, not how to type.** "range(7) means 7 times." Not "Now type r-a-n-g-e".
7. **No new commands in a demo** that the guided try then needs without explanation.

Good (L2.1, five steps): "Run it: seven `put()` lines." (the learner runs it) → `for i in range(7):` +
indented `put()` ("`for` repeats the indented line") → predict the count → "Run it." → "Change 7 to 3,
then run it."

Bad: "Here is a for loop" with the finished code in step 1, followed by three captions explaining the
syntax token by token. The construct arrives before the need, and the captions teach typing.

## Guided try: state-based steps on the real level

**For:** the learner's first production of the construct, with one subgoal visible at a time
(subgoal labelling; G-02 interactive walkthrough; G-05 "guided" mode).

Rules:
1. **Subgoals, not keystrokes.** "Repeat put() with a loop", not "Type for, space, i…".
2. **3–6 steps, cumulative and ordered.** Step k's `example` satisfies steps 1..k. Step k's checks
   fail on `example_{k-1}`. `check_lesson.py` enforces both.
3. **Check structure with the loosest check that proves the subgoal.** Over-strict checks
   (requiring `i` as the loop variable) strand correct learners. Over-loose checks (only `has: for`
   when the subgoal is "put() inside the loop") let the mistake through.
4. **One step is built around the headline mistake.** Its text states the rule ("Indentation
   decides what repeats"), and its check fails for exactly that mistake.
5. **End with a passing run, and put run-only steps nowhere else.** A run counts only for the code
   it ran, so a run-only step in the middle undoes itself on the next edit. Fold "run the starter
   first" into the next code step's text (`docs/lessons.md` §5.2). The guide's last screen is the
   replay succeeding, then `done`.
6. **Starter code counts as step 0.** Write the steps from the level's `starter_code`. If the
   starter already satisfies step 1, step 1 is wasted: drop it or change the starter (with author-level).
7. **The guided level must also work unguided.** Its brief alone must be enough for a learner who
   has step-by-step help turned off.

Good (L1.2, `turn_right`; the starter has a `def turn_right():` stub with `pass`):
1. "Fill in turn_right with three left turns." → `defines turn_right, body_calls {turn_left: 3}`
2. "Use turn_right() where the robot must turn right." → `calls turn_right, outside def`
3. "Run it." → `run passed`

Bad: one step, "Write the program", with `run: passed`. That is the level without a guide.

Bad: steps 2 and 3 both checked only by `has: def`. Step 3 is done before it's shown.

Bad: the headline mistake passes every code check and is caught only by the final run. In L6.1
the `if`-instead-of-`while` mistake needs `{"calls": "pick", "inside": "while>while"}`.
`{"calls": "pick", "inside": "while"}` lets the `if` version through.

## Practice: same concept, new surface

**For:** retrieval and transfer without help (fading). The first practice level is the measure
of whether the lesson worked.

Rules: near transfer first (same construct, different numbers and world), then a little further
(a longer body, the construct used twice). Practice levels come from author-level and carry their own
wrong solutions. One of them should be the headline mistake, so the level fails a learner who
only copied the shape of the guided try.

## Twist: bend it once

**For:** testing that the concept, not the memorised shape, was learned (kishōtenketsu "ten").

The kinds of twist that worked when the curriculum was designed:
- **A size it didn't expect:** the inner `range` depends on the outer loop variable (`staircase_build`)
- **The condition is about something new:** `if front_is_clear()` after only gem conditions (`detour`)
- **Combined with one earlier concept:** a loop that calls a function (`around_the_block` under `max_lines`)
- **The edge case:** a corridor of length 1, a column of height 0

The twist is also the placement test ("I know this": skip to here), so it must be impossible
without the concept. Use `required` if hidden worlds alone don't force it; `max_lines` only rewards the short version (a bonus, D24).

## Recap: one line and a pattern

"`for i in range(n):` repeats the indented block n times." The code pattern uses `...` for the
parts that vary. The recap also goes into the re-findable lesson list. It is the codex entry (G-07 re-learnability).

## Hints: offered, climbing on evidence

Rungs, in order:
1. **Where to look:** "Compare your result with the Goal view", or "Look at the 'one cell' world".
2. **The concept or the mistake, named:** "Two stacks: two loops, one after the other."
3. **A skeleton with `__` blanks:** the structure, never a passing solution.

The ladder climbs only after failed runs (`docs/lessons.md` §6). Write hints that make sense
without having read the previous rung, because learners skip rungs. A rung that mentions "Goal view"
pulses the Goal view on screen, which makes it a visual hint for free. A rung containing a newline
is shown as code with a copy icon.

## Stepwise refinement: a beat about process

Unit 7 teaches a *method*, so its guided steps check process milestones rather than constructs:
- the plan is there (the top-level calls exist and each function is defined, stubs allowed: `pass`)
- it runs (`run: no_error`), stubs and all
- one helper is refined and tested (`calls` inside its `def`, `robot_at` the first column after a run)
- a pre/postcondition docstring is written (`{"docstring": "<fn>"}`)
- the loop and the fencepost (`calls <helper>, inside while` + `run passed`)

Keep the demo's captions about the *why* of each move ("Test one column before you loop").
That sentence is the transferable part.
