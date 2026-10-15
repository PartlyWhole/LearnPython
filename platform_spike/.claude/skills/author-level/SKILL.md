---
name: author-level
description: Author a new Gem Rover level (levels/<id>.json) end to end, with its reference and targeted wrong solutions, per-world goals, hidden edge-case worlds, topic tags, index and docs entries, and tests. Use whenever asked to add, design, adapt or fix a Gem Rover level or puzzle in platform_spike, including "make a level like Stone Mason / Checkerboard / Spread Beepers", even if the word "level" isn't used.
---

# Authoring a Gem Rover level

A level is a **teaching claim**: "a learner who passes this has used concept X correctly". The
hidden worlds, constraints and wrong solutions are what make the claim true, so most of the work
is there, not in the JSON. This workflow was distilled from building the first 13 levels by hand
(`docs/levels.md`, decisions D9, D11, D17-D19 in `docs/decisions.md`) and piloted on
`repair_columns` and `tile_floor`.

All paths below are relative to `platform_spike/`. Scripts are in this skill's `scripts/` folder:

| Script | Use it to |
|---|---|
| `find_topics.py <word>...` / `--used` | find topic IDs in `../topics/all_topics.json` |
| `show_world.py <id> [--goal] [--run FILE] [--world NAME]` | draw every world as ASCII, the goal layout, and where a program ends |
| `review_level.py <id>` | see why each solution passes or fails per world, check bookkeeping, hard-coding and edge-case coverage |

## 0. Ground rules

- **Don't copy Code in Place.** Adapt the problem *shape* from `docs/research/code_in_place_problems.md`
  (its table numbers the problems); write your own title, brief, world and story (CLAUDE.md invariant 13).
- **Don't change the engine or schema to make a level work.** If a level truly needs a new
  sensor, goal type or constraint, stop and follow the CLAUDE.md checklist for that as a separate change.
- Python in solutions must run on 3.9 and 3.12 (no `match`, no `X | Y` types).

## 1. Pick the teaching target

1. Write one sentence: *"This level teaches ___; the mistake it catches is ___."* The mistake
   becomes your first `wrong_*.py`. If you can't name a mistake, the level has no teeth.
2. Find its place in the ladder (`python3 tools/play_order.py`, the table in `docs/levels.md`): the level may
   only need concepts from earlier levels. Problem shapes not yet used (Oct 2026): Spread Beepers /
   "can't count" (#9), Copycat (#21), Border (#22), Ramp (#19), Fill (#10), Triple (#18), Double
   the pile (#32). Stone Mason became `repair_columns`, Checkerboard became `tile_floor`. Check the
   table before trusting this list.
3. Pick 1-3 topic IDs: `python3 .claude/skills/author-level/scripts/find_topics.py modulo parity`.
   `--used` shows what the existing levels tag. Tag what the learner *practises*, not every
   construct that appears.

## 2. Design the worlds

Coordinates: `[x, y]`, **x grows east, y grows SOUTH, (0, 0) is the top-left.** "The bottom row"
is `y = height - 1`; "north" is up the screen. Gem maps are keyed `"x,y"`. Start is `[x, y, "E"|"N"|"W"|"S"]`.

**Blocked cells are not Karel walls.** Karel's walls sit *between* corners; our `blocked` cells
fill a whole cell. A Karel "wall above the column" becomes a blocked cell above the column's top
stone; a Karel hurdle becomes a column of blocked cells the robot must climb *over the top of*
(one extra step each side). Draw the world (`show_world.py`) and trace the reference over it by
eye before trusting any Karel-derived solution.

**Main world**: the one the learner sees. Make it typical, not tricky, and big enough to show the
pattern (3+ repetitions of whatever repeats). **It must show the level's headline mistake**:
learners debug what they can watch, and a hidden world only gives them a sentence. In the
`repair_columns` pilot the last column started out whole, so "skip the last column" passed the
visible world; making that column need stones fixed it. (`review_level.py` warns about this. A
hard-coded wrong solution is the exception: it passes the main world by definition.)

**Make the structure visible.** The ASCII view hides how a world *reads*. In the pilot, beams
floating over invisible columns looked fine in ASCII and meaningless in the app; filling the
masonry around each column shaft with blocked cells made the columns obvious. Blocked cells are
cheap scenery. Generate repetitive ones with a few lines of Python rather than by hand.

**Hidden worlds** (D9): each one should exist to break a specific wrong program. Go down this list
and add a world for each item that applies, and `"name"` it after the case (names appear in
failure messages, e.g. `"one cell"`, `"single column"`):

| Case | Breaks |
|---|---|
| a different size / spacing from the main world | hard-coded move counts |
| 1x1 | anything that moves before checking `front_is_clear()` |
| single row (`height: 1`) / single column (`width: 1`) | turn logic in sweeps; "go up a row" code |
| no gems at all (or nothing to do) | `pick()` without checking; loops that assume one iteration |
| a gem / site on the start cell | fencepost: handling a cell only *after* `move()` |
| something on the last cell | fencepost at the other end |
| odd vs even width/height | parity and midpoint logic |
| pre-filled or partial state (some stones already placed) | blind `put()` that doubles up |
| varying heights/counts within one world | a fixed inner `for` count |

Skip a case only when the level makes it impossible or meaningless, and know which one you skipped
(`review_level.py` lists the uncovered ones; its tags describe the *starting* layout, so "gem on
start" never applies to a build-from-empty level, and `repair_columns` widths are always 4k+1, so
never even). If two wrong solutions fail identically in every world, the level can't tell those
mistakes apart: add a world that does (`tile_floor`'s "even width") or drop one. Keep worlds
small: a learner reads the failure message, not the world. 3-6 hidden worlds is typical.

**Drive levels** (played with buttons, `"drive": {"buttons": [...]}`, unit "Meet the robot"; see
`docs/levels.md`): use a fixed world and no hidden worlds, since the learner drives what they see.
The reference and wrong solutions are button programs (one command per line). The coverage
warnings don't apply. If a drive level is the twin of a code level, add the pair to
`test_drive_twins_share_their_world`.

Other world fields: `bag` (`0`, a number, or `"infinite"`; an exact bag is itself a lever, e.g.
`plant_row` gives exactly 5), `blocked`, `max_steps` (default 10000; raise only for big worlds).

## 3. Goal and constraints (the teaching levers)

**Goals** (`goal` on the level, overridable per world with a world `goal`):
`all_gems_collected`, `gems_exactly` (exact final layout), `end_at`, `facing`, `bag_at_least`,
`no_error` (default true). Building/pattern levels use `gems_exactly`; it almost always differs per
world, so it goes in each world's `goal` (step 5 fills it). Add `end_at`/`facing` only when the
finishing position is part of the lesson (postconditions, `fetch_gem`).

**Constraints** shape *how* it is solved:

| Lever | Use for | Example |
|---|---|---|
| `required: ["def"]` (or `for`, `while`, `if`) | make the target construct unavoidable | `turn_right`, `build_towers` |
| `banned: [...]` | close a shortcut (`while` in `richest_cell` forces `max`/`.index`) | `richest_cell` |
| `max_lines: n` | force a loop instead of copy-paste; counts non-blank, non-comment lines, **docstrings included** | `plant_row` (4) |
| `hidden_commands: ["scan"]` | keep "the robot can't count/see ahead" puzzles honest | most loop levels |
| `hidden_commands: ["scan", "gems_here"]` | the robot can't look at the floor, so it must *remember* in a variable (or, without variables, it's a pure Karel "can't count" puzzle) | `tile_floor` |
| `starter_code` | a scaffold, or a buggy program to fix (`gem_line`) | |

Constraints are teaching aids, not security (D7). A wrong solution that fails *only* on a
constraint means the worlds don't catch that mistake; that's fine if intended (`turn_right`).

## 4. Write the files

1. `levels/<id>.json`: copy a similar level as a template (building: `build_towers`,
   `repair_columns`; whole-grid pattern: `tile_floor`; sweep: `sweep`; data: `richest_cell`).
   Keys: `format: 1`, `id` (= file name, `[a-z0-9_]+`), `title`, `brief` (2-3 sentences, our
   own story, say what's varied: "rooms come in all shapes"), `starter_code`, `world`,
   `hidden_worlds`, `goal`, `constraints`, `topics`. Leave out world `goal`s that step 5 fills.
2. `tests/solutions/<id>.py`: the reference, written the way you want learners to write it
   (helpers with docstrings, the target concept front and centre). Learner API: `move()`,
   `turn_left()`, `front_is_clear()`, `pick()`, `put()`, `gems_here()`, `scan()` (list of gem
   counts ahead), `coin_flip()`. No `turn_right`: learners define it.
3. `tests/solutions/<id>.wrong_<mistake>.py`: one per targeted mistake, at least one. Make each a
   *plausible learner program*: the reference with one realistic change, not random breakage.
   Name it after the mistake (`wrong_skip_start`, `wrong_fixed_height`, `wrong_round_up`).
   Deriving it from the reference with a string replace, then `diff`-ing the two files, keeps the
   change to exactly the mistake.
4. Put the id in the play order, `lessons/index.json`: in its lesson's `practice` or `twist` (that lesson's file), or as a `{"level": id}` item in a unit. Then run `python3 tools/make_goal_fixtures.py`.
5. `docs/levels.md`: add a row to the table (renumber if inserting) with Teaches, Inspired by,
   Levers used, What the wrong solutions show.

## 5. Fill and check per-world goals

```bash
python3 tools/level_goals.py <id> --fields gems_exactly           # preview
python3 tools/level_goals.py <id> --fields gems_exactly --write   # also: end_at, facing (comma-separated)
python3 .claude/skills/author-level/scripts/show_world.py <id> --goal
```

The tool copies the reference's end state into each world's goal, so **goals agree with the
reference by construction and prove nothing about it.** Look at every goal panel and check it
against the brief by hand (the right cells, counts, no stray gem, the end cell). A reference bug
here becomes a level bug silently. Re-run `--write` whenever you change the reference or a world.
It doesn't touch the level-wide `goal`; fields you don't name are left as they were. `--write`
rewrites the whole file as `json.dumps(indent=2)` (one number per line), so author the JSON however
is convenient and let the tool normalise it; don't hand-edit goals afterwards.

## 6. Review, test, look

```bash
python3 .claude/skills/author-level/scripts/review_level.py <id>
python3 .claude/skills/author-level/scripts/show_world.py <id> --run tests/solutions/<id>.wrong_<mistake>.py
python3 tools/make_goal_fixtures.py   # the Goal view test checks your level's picture against its reference
python3 -m pytest -q tests
node --test "tests/js/*.test.mjs"
```

`review_level.py` must end with `0 error(s)`. Then read it, don't just count:
- each wrong solution fails **in the world aimed at its mistake, with a message that names it**.
  If it only fails by crashing somewhere unrelated, or only on a constraint, fix the world or the
  wrong solution. A crash can be the right failure (`wrong_fixed_height` walks into a beam), as
  long as it's the crash this mistake causes;
- every `warn:` is resolved or deliberate: a wrong solution that passes the main world, or two
  wrong solutions that fail identically everywhere;
- the hard-coded replay of the reference fails some hidden world (unless it's a fixed-world level
  on purpose);
- the coverage warnings are ones you chose to skip.

Finally, **look at it in the app** (`app.html?level=<id>`): tests can't tell whether a world reads
well. Check the brief and title fit, the world is legible at its size, a run of the reference
replays sensibly, and a wrong solution's failure (the headline one) is visible in the replay with
a message that makes sense to a learner. Recipe that worked in the pilot:

1. A server the agent starts may not be able to read `~/Desktop`, so serve a copy:
   `rsync -a --delete --exclude node_modules platform_spike/ <scratchpad>/site/`, then serve that
   folder with `python3 -m http.server` (via a `.claude/launch.json` entry and `preview_start` in
   the desktop app; that tool reads `launch.json` from the session's primary folder). **Re-run the
   rsync after every edit**; the copy doesn't follow the source.
2. Levels unlock in order, so unlock yours by marking its predecessor solved, then reload:
   `localStorage.setItem("gem-rover/progress/v1", JSON.stringify({solved: {<previous_id>: {at: 1, code: ""}}, drafts: {}}))`
3. On localhost the page exposes `window.__gemRover`: load a program with
   `__gemRover.editor.setCode(await fetch('/tests/solutions/<id>.py').then(r => r.text()))`, then
   click `#run`. Call `__gemRover.setSpeed("Instant")` (or tap the speed bars) to skip the replay. A pass shows a big ✓;
   a failure lists every world with ✓/✗ (hidden worlds by name) and the message where it failed.

If you can't open a browser, say so in your report and include the `show_world.py --goal` output.

## 7. Done when

- [ ] `review_level.py <id>` reports 0 errors and you've read its per-world output
- [ ] `python3 -m pytest -q tests` and `node --test "tests/js/*.test.mjs"` pass
- [ ] the level is in the play order (`lessons/index.json`, directly or via a lesson) and has a row in `docs/levels.md`
- [ ] it's been played in `app.html` (or you said why not)
- [ ] anything new you learned about authoring is added to this skill (or `docs/levels.md` gotchas)
