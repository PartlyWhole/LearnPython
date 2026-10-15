# Lesson review checklist

Report as `ID | pass/fail | evidence | fix`. This is adapted from G-11 for LearnPython lessons.
Blockers are marked ●.

## A. Target
- A1 ● Both target sentences exist (what the learner can do; the headline mistake).
- A2 The lesson teaches one concept. It needs only concepts taught earlier in `docs/curriculum.md`.
- A3 The concept is genuinely new at this point. Don't re-teach what an earlier lesson already established.

## B. Watch
- B1 Show, don't tell: the demo opens with something to run, and the runs (stopping short, a crash with `"expect": "error"`, a count) make the point instead of captions.
- B2 3–6 steps (refinement: about 10); captions are one short line (16 words or fewer). One idea and one focus per step.
- B3 At most one prediction, right before a run. It is never graded and never blocks.
- B4 The demo runs the construct at least once and shows one variation.
- B5 ● The guided try can't be solved by copying the demo's code.
- B6 Every step can be skipped. Nothing auto-advances.

## C. Guided try
- C1 3–6 steps, each a nameable subgoal.
- C2 ● Cumulative and ordered: `example_k` passes steps 1..k, and `example_{k-1}` fails step k (`check_lesson.py`).
- C3 ● The reference solution satisfies every step's code checks, so a correct learner is never stuck.
- C4 Checks are structural and as loose as the subgoal allows. No checks on variable names or exact text.
- C5 One step is built around the headline mistake.
- C6 The last step is a passing run. `done` confirms the result.
- C7 The level's brief works on its own, with step-by-step help off.
- C8 The starter code doesn't already satisfy step 1.

## D. Practice and twist
- D1 1–3 practice levels on the same concept. The first is a near transfer.
- D2 ● Every level exists, has reference and wrong solutions, and passes `test_levels.py`.
- D3 The twist bends the concept once and can't be solved without it (it is the placement test).
- D4 2–3 hint rungs per practice and twist level. The last rung is a skeleton with `__` blanks, never a solution.

## E. Copy (`references/copy.md`)
- E1 Within budget (`check_lesson.py` counts words).
- E2 Verb or outcome first. Code written as code. Controls named by label.
- E3 Consistent vocabulary (gem, robot, cell, bag, world, goal).
- E4 No praise inflation. Rescue copy names the problem and one fix.

## F. Accessibility (content side; the runtime covers the rest)
- F1 Captions don't rely on colour or position ("the blue gem", "on the right").
- F2 `focus` targets exist in the world or editor at that step (the line exists, the cell is in the grid).
- F3 A `cell` prediction has a text alternative (the cell is described in the caption, or choices are offered).

## G. Measurement
- G1 The first practice level is a fair measure of the guided try (the same construct, without help).
- G2 Anything you'd want to playtest (a step you suspect is confusing) is written down in your report.
