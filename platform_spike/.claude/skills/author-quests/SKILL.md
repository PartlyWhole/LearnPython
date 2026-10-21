---
name: author-quests
description: Write or improve the sub-quests for a LearnPython level (quests/<id>.json): the optional breakdown of a challenge into smaller, automatically checked problems, opened from the puzzle icon. Use whenever a level is added or changed, when asked to "break a level down", add guidance that doesn't give the answer away, or when tools/check_quests.py or tests/test_quests.py fails.
---

# Authoring sub-quests

Sub-quests turn one challenge into 2–4 smaller **problems** a programmer would build and check
separately. They are not steps, and they never contain the answer. The full rules are in
`docs/quests.md`. Read §1 and §4 before writing, and look at the exemplars:
- `quests/around_the_block.json`: a helper tested alone, then chained
- `quests/collect_row.json`: short versions of the problem first
- `quests/turn_right.json`: a helper, then used in the level

## Workflow

1. **Read the level.** Read `levels/<id>.json` (brief, world, goal, starter, constraints, hidden
   worlds), `tests/solutions/<id>.py` and every `wrong_*` / `long_*`, and the level's lesson.
2. **Find the parts.** Decide which 2–4 pieces a programmer would build and test separately, and
   which piece each wrong solution gets wrong. Use the style for the concept (docs/quests.md §4.2):
   - functions bottom-up
   - one round of a loop first
   - an inner helper and its postcondition
   - each case of a condition alone
   - the short version of a `while` first
   - top-down helpers for stepwise refinement
3. **Write the problems.** Write each as an outcome (where the robot ends, which way it faces, the
   floor), never as commands. Use `test` for a helper the reference defines (in a tiny world,
   with `returns` for values), and `program` for a smaller world or `reach` on the level's own.
   Avoid `code`.
4. **Check.** Run `python3 tools/check_quests.py <id>`. It must say `ok`. Then make every
   `wrong_*` miss the part where its mistake lives.
5. **Look at it.** Serve the app, open the level, and press the puzzle icon. The pictures must
   read at a glance. Try it should show the part on its own.

## Don'ts

- No commands, counts, conditions or formulas in the text. Inline code is for names only
  (`fill_row()`); the checker rejects `range(4)` or a quoted line of the solution.
- No sub-quest that only re-states the level, unless putting the parts together is the hard part.
- No new names the reference solution doesn't use, in `test` checks.
