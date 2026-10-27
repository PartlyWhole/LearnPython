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

## 2. The learner's view (D26: each part is a page of its own)

- **The puzzle icon** sits by Run, on every code level that has sub-quests. It's hidden in
  demos and drive mode. It opens **the strip**, a row of tabs under the header: ★ the
  challenge, then ① ② ③ for the parts. Each tab shows the part's state:
  - green ✓: the code as it is now solves it
  - amber number: it was solved before, but the code has changed since and doesn't any more
  - plain number: not done yet
- **A part is a page of its own** (`?level=<id>&quest=<quest id>`; Back and Forward work, a
  reload stays there, nothing reloads Python). A purple frame and title say "you're in a part".
  - The header shows the part's title and its problem, with code names (`go_around_corner()`)
    as the only code.
  - A line says what Run does here, so the part's world never gets mixed up with the
    challenge's: "Run tests only `go_around_corner()`, on its own, in this small world." /
    "Run tries your whole program in this smaller world." / "…in the challenge's world."
  - The bulb next to it holds one nudge: a way to *think* about it, still no code.
  - The world panel shows the part's world and the Goal view its goal: an end picture, or a
    marked cell with the goal in words ("the robot picks up a gem on the marked cell").
  - **Run** runs that part's check and replays it (steppable like any run). At the end, a ✓ and
    **Next part** (the next part not done after this one, then any skipped earlier, then **Back
    to the challenge**), or one line on what happened, said against the picture, never in
    coordinates and never how to fix it.
  - The challenge's own help steps aside inside a part: the step-by-step guide, hints, the
    line-count bonus, the demo button, the hidden-world dots.
- **One program for everything.** The editor holds the level's one program, shared by the
  challenge and every part, so what solves part 1 is still there in part 2 and in the
  challenge. The parts are designed as pieces of one real solution (the reference completes
  them all), so this is what makes them add up.
- **Any order.** Every part can be opened at any time. Opening one whose earlier parts aren't
  solved says so ("Builds on part 1, which your code doesn't solve yet. You can still try this
  one."), without blocking.
- **Checks** run on opening the strip, on entering a part, and after every Run. Solved parts are
  remembered (`progress.questsDone`), which is how an edit that breaks one shows as amber, not
  as never done.
- In a shared room, a part's runs stay local (they aren't sent to the room).
- Events (playtest log): `quests.opened`, `quest.entered`, `quest.run`, `quest.done`, `quest.nudge`.

## 3. Files and checks

```
quests/<level id>.json        one file per code level (tests/test_quests.py requires them)
schemas/quests.schema.json    the format; engine.validate_quests mirrors it
engine.quest_state            the checks (also used by tools/check_quests.py)
src/lessons/quests.js         pure: picture, goal words, Run note, next part, tab state, tracker
src/lessons/quests-ui.js      the strip of tabs (the pages themselves: enterQuest in src/app.js)
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
| `program` | `{world?, goal?, reach?}`: the whole program, on `world` (a smaller version of the problem) or the level's own | `goal` and/or `reach`: `visit` a cell, `pick_at` / `put_at` a cell (`n` times, default 1); with `gems_then`, the whole floor at the moment of that put/pick must match (so a wrong program can't pass by landing one gem there). A reach reached before a later crash counts | "a short corridor first", "get to the first corner", "the first pile" |
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
