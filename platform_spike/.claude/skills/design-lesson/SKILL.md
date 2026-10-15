---
name: design-lesson
description: Design a LearnPython lesson (lessons/<id>.json) that introduces one programming concept through the app's beat (a learner-paced demo with one prediction, a guided first try with state-based step-by-step help, practice levels, a twist, a recap) plus hints for the practice levels. Use whenever asked to teach, introduce, sequence, tutorialise or scaffold a concept (functions, for, decomposition, nested loops, if/else, while, stepwise refinement, or later topics) in platform_spike, or to write demos, guide steps, hints, captions or onboarding for it, even if the word "lesson" isn't used. Levels inside the lesson are authored with the author-level skill.
---

# Designing a LearnPython lesson

A lesson is a **teaching claim**: "a learner who watches this demo and does this guided try
can then solve the practice level on their own". Its parts follow one beat:

**Watch** (demo) → **Guided try** (step-by-step help) → **Practice** → **Twist** → **Recap**

Read these first. Paths are relative to `platform_spike/`.
- `docs/lessons.md`: the format, the guide's state-based steps and `done_when` checks, the hint
  ladder, and the contract tests. **It is the spec; this skill is how to use it well.**
- `docs/curriculum.md`: where this lesson sits, which levels it wraps, and what is still to author.
- `references/beats.md` (this skill): rules and good/bad examples for each beat. Read it before writing.
- `references/copy.md`: how to write captions, steps and hints.
- `references/checklist.md`: the review you run at the end.
- Deeper evidence, if you need to justify a choice: `docs/research/guidance-design/` (G-00 to G-12).

Script: `python3 tools/check_lesson.py <id>` (the skill's `scripts/check_lesson.py` wraps it) runs the
§9 contract checks that can run today. `tests/test_lessons.py` runs the same checks on every lesson. It says which ones it skipped because the engine has no `check_code` yet.

## 0. Ground rules

- **One concept per lesson.** If the demo needs two new ideas, it is two lessons, or the second
  idea belongs to an earlier one.
- **Only earlier concepts.** The demo, the guided level and the practice levels may use only what
  `docs/curriculum.md` has taught before this lesson. The twist may combine it with *one* earlier concept.
- **Don't copy Code in Place or the Karel Reader.** Adapt problem *shapes* and *methods*. Write
  your own worlds, story and words (CLAUDE.md invariant 13).
- **Levels come from `author-level`.** If the curriculum marks a level **new**, author it with that
  skill (reference and wrong solutions, hidden worlds) before wiring it into a lesson. Demo
  worlds are not levels: they live inline in the lesson and are never graded.
- **Don't change the engine, schemas or app to make a lesson work.** If a lesson needs a new
  check kind, focus target or step field, write down why and propose it as a separate change to
  `docs/lessons.md`.

## 1. Pin the target

Write two sentences before anything else:
1. *"After this lesson the learner can ___ (observable, in code)."* For example: "write a `for`
   loop whose body is several lines, with the right indentation".
2. *"The mistake the guided try is built around is ___."* For example: "only the first line is
   indented, so only `put()` repeats". This mistake drives one guided step and the practice
   level's wrong solution.

Then check the prerequisite chain in `docs/curriculum.md`. The things the demo shows must be
things the guided try needs, and nothing more (G-07 skill chains).

## 2. Watch (the demo)

The demo is a worked example the learner *does*, not a lecture. **Show, don't tell.** The first
lesson is the model. It is one step: a program, the caption "Here is a program. Run it and watch it
instruct the robot line by line", and a coach mark on the real Run button. Pressing Run and
watching the robot follow the code, line by line, explains "a program runs top to bottom" better
than any sentence. It also teaches where Run is, and it makes code → robot an experience rather
than a claim. Apply the same idea to every demo:
- **A `run` step waits for the learner to press the real Run button** (a pulsing coach mark points
  at it; Ctrl/⌘+Enter works). Let the run make the point: the robot stopping short, the crash,
  the count. Don't describe what the replay will show.
- **Open with something to run, not a sentence about the problem.** Show the pain (seven
  `put()` lines) or the failure (a `for` that's too short) by running it. A crash may be the
  point: mark that run step `"expect": "error"` instead of narrating the crash in a caption.
- **Captions are one short line** (16 words or fewer; most are 3-8). Each names the one idea the
  picture can't, such as "`for` repeats the indented line", or says "Run it".
- **3–6 steps** (refinement up to about 10). Fewer is better if the runs carry the meaning.
- **At most one `predict`**, just before a run, and only where guessing adds something. Prefer a
  `cell` prediction (the learner clicks where the robot will end): the contract test can check it.
- **Printed output shows itself** under the caption after a run, so `print()` demos need no explanation.
- **A similar problem, not the same one.** The guided try must not be solvable by copying the
  demo. It should be the same *shape* with different details (L1.2 demos `turn_around`; the guided
  try needs `turn_right`).

## 3. Guided try

Pick the guided level from the curriculum: an existing or newly authored level with a reference
solution. Write `guided.steps`:
- **3–6 steps.** Each one is a *subgoal* a learner could name ("Repeat put() with a loop"), not
  a keystroke ("Press Tab").
- **`done_when` checks structure, never text.** Use the smallest check that proves the subgoal
  (`docs/lessons.md` §5.3). Check that the `example` passes and that the previous example fails.
- **One step targets the headline mistake.** The step text names the rule, and its check is the
  one the mistake fails ("Add move() in the loop too. Indentation decides what repeats").
- **The last step is always a run** (`{"run": "passed"}`). The learner should see the replay succeed.
- **`example` per step:** the learner's code after doing that step, built up from the level's
  `starter_code`. It is what "Show me" offers, so write it the way you'd want it learned.
- **`done`:** one line that confirms the result and points to what's next.

Remember the guide is state-based: the current step is the first one whose checks fail. Steps
therefore need to be *cumulative* and *ordered*, and a later step's checks shouldn't pass before
an earlier step's do. `check_lesson.py` tests that.

## 4. Practice, twist, recap

- **Practice:** 1–3 levels, unguided, on the same concept. Vary the surface (world size, body
  length, what's repeated), not the concept. The first practice level is the success measure
  (`docs/lessons.md` §10), so make it a fair, near transfer of the guided try.
- **Twist:** one level that bends the concept: an unexpected size, an edge case, or a combination
  with one earlier concept. It is also the "I know this" placement test, so it should be
  impossible to solve without the concept.
- **Hints:** 2–3 rungs per practice and twist level, from gentle to specific: (1) where to look
  (usually the Goal view or a named world), (2) the concept or the mistake, (3) a skeleton with
  `__` blanks. Never the full solution.
- **Recap:** one sentence plus a code pattern with `...` for the parts that vary.

## 5. Write, check, look

1. Write `lessons/<id>.json` following `docs/lessons.md` §2, and add its id to `lessons/index.json`.
   For a dry run or a draft, write it anywhere and pass the path to the script; leave the docs alone.
   For now a lesson attaches to its guided level (one lesson per level). Opening that level plays the
   demo once. Try it with `app.html?level=<guided level>&demo=1`.
2. Add the row or update the status in `docs/curriculum.md` (levels move from **new** to ✓ as you author them).
3. `python3 .claude/skills/design-lesson/scripts/check_lesson.py <id>`. It must end with
   `0 error(s)`. Read the skipped checks and do them by hand: for each guided step, check its
   `example` against the `done_when`. A few lines of `ast` will do it.
   **Check that the guided level can be solved with only what this lesson and earlier ones teach.**
   Run the simplest solution a learner could write with exactly those concepts through
   `check_level`. A dry run of L6.1 found that `collect_row` needs a `while` nested in the walk,
   because its piles defeat an `if`, and the original curriculum missed that.
4. `python3 -m pytest -q tests` (the levels you authored must pass `test_levels.py`).
5. **Play it.** If the app has the lesson runtime, step through Watch, do the guided try once
   *correctly* and once making the headline mistake, then open a practice level and fail twice
   to see the hint chip. If it doesn't, play the guided and practice levels in `app.html` (see
   the author-level skill, step 6) and walk through the demo by reading its steps in order.
6. Run `references/checklist.md` and report each failed item with its fix.

## 6. Done when

- [ ] Both target sentences are written down (put them in your report)
- [ ] `check_lesson.py <id>` shows 0 errors, and you checked by hand what it skipped
- [ ] Every level the lesson uses exists and passes `test_levels.py`
- [ ] The checklist passes, or each failure is named with a reason
- [ ] `docs/curriculum.md` is updated
- [ ] Anything new you learned about lesson design is added to `references/beats.md`
