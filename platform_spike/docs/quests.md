# Sub-quests: design and authoring

**Status: built (D25).** Every code level has optional sub-quests: the challenge broken into
smaller *problems* the learner can solve and check one at a time. They are for learners who are
stuck piecing everything together, and they appear only when asked (the puzzle icon by Run).

## 1. What a sub-quest is (and isn't)

A sub-quest is a **smaller problem with its own goal**, not a step of instructions.

| A sub-quest is | A sub-quest is not |
|---|---|
| "One corner, on its own: from the middle of a side, walk to the corner, pick its gem, and end one step along the next side, facing along it." | "Type `move()` twice, then `pick()`, then `turn_right()`." |
| Checked automatically: it ticks itself off when the code solves that part | A checklist the learner ticks |
| Shown with a picture of its own world: start → goal | A paragraph |
| A part a real solution has (the reference solution completes it) | A detour, or extra work |

Why this shape (the evidence behind it, in docs/lessons.md §1):
- **Subgoal labelling.** Naming the parts of a solution helps learners build and transfer it
  (Margulieux, Catrambone and Morrison). Each sub-quest's *title* is a subgoal label.
- **Decomposition is the skill.** Novices who can write each line still can't plan the whole
  (the "plan composition" problem: Soloway; Spohrer and Soloway). Sub-quests model the plan
  without writing it, and the learner composes it.
- **Testing a piece on its own** is how programmers decompose. A `test` sub-quest runs one of
  the learner's functions alone in a tiny world: the first unit test they ever see, without the word.
- **Pull, not push** (G-00 P2): nothing opens by itself. Expertise reversal (Kalyuga): learners
  who don't need it never see it.
- **No answers** (desirable difficulty): the learner still writes every line. The sub-quest
  makes the problem smaller, not easier to copy.

## 2. The learner's view

- **The puzzle icon** sits by Run, on every code level that has sub-quests. It's hidden in
  demos and drive mode.
- **The panel** sits above the editor, like the guide. It shows numbered sub-quests, one open at a time:
  - the problem in one or two sentences, with code names (`go_around_corner()`) as the only code
  - a picture: the part's world as it starts → its goal (the Goal view's drawing), or the
    level's world with a marked cell (and the stack it asks for, when a part puts several gems
    on one cell). Drawn at a size per cell, so a long corridor stays readable: side by side when
    both fit at a readable size, otherwise one above the other
  - once the learner has run or tried something, one line on what happened, said against the
    picture, never in coordinates ("The robot doesn't end on the marked cell.", "2 gems are still
    on the floor.", "Stopped on line 12: There's a wall in front of you."), and never how to fix
    it. Opening the panel shows no red: it only ticks off what's already done. A function not
    written yet is said calmly, in grey, at any time
  - **Try it** (a part with a world of its own): runs just that part and replays it in the world
    panel, tagged with the sub-quest's name. It can be stepped like any run.
  - a bulb: one nudge, a way to *think* about it, still no code
- **Checks** run on opening the panel and after every Run (and on Try it). A part that is done
  gets a green check that pops in, and the next undone part opens. An edit can undo a part;
  it reopens.
- Events (playtest log): `quests.opened`, `quest.done`, `quest.try`, `quest.nudge`.

## 3. Files and checks

```
quests/<level id>.json        one file per code level (tests/test_quests.py requires them)
schemas/quests.schema.json    the format; engine.validate_quests mirrors it
engine.quest_state            the checks (also used by tools/check_quests.py)
src/lessons/quests.js         pure: picture, Try-it, text parts, tracker
src/lessons/quests-ui.js      the panel
tools/check_quests.py         python3 tools/check_quests.py <level id> | --all
```

```json
{
  "format": 1,
  "level": "around_the_block",
  "quests": [
    {
      "id": "one_corner",
      "title": "One corner, on its own",
      "ask": "Write `go_around_corner()`: from the middle of a side, walk to the corner, pick its gem, and end one step along the next side, facing along it.",
      "nudge": "Where it ends is where the next call starts. Picture both calls before you write it.",
      "check": {"test": {"call": "go_around_corner", "world": {...}, "goal": {"end_at": [3, 1], "facing": "S", "gems_exactly": {}}}}
    }
  ]
}
```

**Check kinds** (exactly one per sub-quest):

| Kind | What runs | Judged by | Use it for |
|---|---|---|---|
| `test` | `{call, args?, world, goal?, returns?}`: the learner's definitions only (every other top-level line blanked, so line numbers stay true), then `call(*args)` in `world` | `goal` (level goal keys) on the end state, and/or `returns` | a helper the solution needs: a turn, a corner, a column, a counting function |
| `program` | `{world?, goal?, reach?}`: the whole program, on `world` (a smaller version of the problem) or the level's own | `goal` and/or `reach`: `visit` a cell, `pick_at` / `put_at` a cell (`n` times, default 1) | "a short corridor first", "get to the first corner", "the first pile" |
| `code` | nothing runs | `check_code` checks (as in lesson guides) | rarely: only when the part *is* a shape (a named plan). Prefer the others |

A crash is always the only reason given (D14). A `test` on a function that doesn't exist says
"There's no f() to test yet." and marks it `missing` (grey, Try it disabled).

**`tools/check_quests.py` errors** (the tests fail on them):
- shape (engine.validate_quests): 2–5 sub-quests, unique ids, one check each, valid worlds and goals
- **the reference solution completes every sub-quest** (they are parts of a real solution)
- **the starter code doesn't complete them all**
- **no answer leaks**: no line of the reference solution (8+ characters, other than a bare
  `name()` call or `def name():`) appears in any text. Inline code is a name only: `turn_right()`,
  `while`, `range()`, never a statement or a number (`range(4)`).
- word budgets: title 6, ask 30, nudge 20
- a `test` calls a function the reference solution defines

Warnings: a sub-quest the starter already completes (fine for a first warm-up only); a wrong
solution that completes every sub-quest (the parts don't catch that mistake); a test world over 6x6.
For each `wrong_*` solution, the tool lists which sub-quests it misses: good sub-quests make a
mistake show up in the part where it lives.

## 4. Authoring: how to break a level down

1. **Solve it first, then find its parts.** Read the brief, the world, the goal, the starter and
   `tests/solutions/<id>.py`. Ask: what are the 2–4 pieces a programmer would build and check
   separately? Which piece do the `wrong_*` solutions get wrong?
2. **Pick the decomposition that fits the concept** (the level's lesson):
   - **Functions** (Programs and functions): *bottom-up*. Test each helper alone (`test`), then
     use it (`program` with `reach` on the level's world).
   - **Repeat** (`for`): *one round first*. What's the body? Test the body as a helper if the
     solution has one; otherwise a `program` on a world sized for one or two rounds.
   - **Decomposition / loops in loops**: *the inner piece alone, then the outer*. A `test` for
     the inner helper (a column, a row, a post) in a tiny world, then its *postcondition*: where
     it must leave the robot so the next call can start ("ends at the foot of the next column,
     facing east").
   - **Conditions** (`if`, `for`+`if`): *each case alone*. A `program` on a world with only the
     "gem here" case, then one with only the "no gem" case, then mixed.
   - **Repeat until** (`while`): *the short version first*. A `program` on a very short world
     (one or two cells), then one with the awkward case (an empty corridor, a pile at the start, a
     wall right away). Hidden worlds tell you which cases matter.
   - **Stepwise refinement**: *top-down*. The plan's helpers each get a `test`, in the order the
     plan calls them.
3. **Write the problem, not the method.** Say what must be true at the end (where the robot is,
   which way it faces, what's left on the floor), the way the Goal view would. Name a helper
   when the level needs one (`go_around_corner()`). Never list commands, counts or conditions
   the learner should work out ("turn right three times", "use `range(4)`", "check
   `front_is_clear()`").
4. **Small worlds.** A `test` or `program` world is the smallest that shows the part: a 3x3 for a
   turn, a two-cell corridor for a pile. It must look like a piece of the level (same walls, same
   kind of gems), so the learner sees where it fits.
5. **Titles are subgoal labels**: what the part achieves, 2–6 words ("Empty a pile of any size",
   "One column, there and back").
6. **The nudge is a question or a way of looking**, not a hint at the code: "Where it ends is where
   the next call starts." "How could the robot tell that the pile is empty?"
7. **The last sub-quest may be the whole level** only when putting the parts together is itself
   the hard part (around_the_block's "All the way home"); otherwise stop at the parts.
8. **Check it**: `python3 tools/check_quests.py <id>`. Read its notes: does each wrong solution
   miss the part where its mistake lives? If a mistake slips through every part, add or sharpen one.
