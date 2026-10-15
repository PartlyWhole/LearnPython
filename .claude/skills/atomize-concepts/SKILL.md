---
name: atomize-concepts
description: Break programming concepts from the Python course knowledge graph into Math Academy-sized topics (one lesson of about 10-25 minutes, 3-4 knowledge points each with a worked example and auto-gradable practice, at most 3-4 prerequisites, key prerequisites per knowledge point, and weighted "encompassing" links for spaced repetition). Use this whenever working in the PythonKnowledgeGraph project on topics/, a batch from topics/plan.json (B01-B20), or any request to decompose, atomize, split, granularize or scaffold a concept such as "dictionaries" or "recursion" into lessons, topics, knowledge points or a prerequisite graph, even if Math Academy is not mentioned.
---

# Atomize concepts into Math Academy-sized topics

The course graphs in this project describe *concepts* ("dictionaries", "recursion"). That is
about 10x too coarse to teach from. Math Academy's unit is a **topic**: one short lesson with
3-4 knowledge points, gated by mastery and linked into a prerequisite graph. This skill turns a
batch of concepts into such topics, written as a JSON file the rest of the pipeline can merge
and validate.

Paths below are relative to the project root (`/Users/alan/Desktop/PythonKnowledgeGraph`).
Skill scripts live in `.claude/skills/atomize-concepts/scripts/`; run them from the project root
with `python3 -I`.

## Assumptions about the learner and platform

- **Platform:** like Math Academy, a browser platform with a built-in editor and runner, so
  learners can write and run Python from the first lesson. Local setup, terminals, REPLs and
  editors are useful but supplemental (`core: false`), and core topics must not depend on them.
- **Learner:** an adult or teen with no programming experience, who can read and do
  primary-school arithmetic. Batch B01 may assume exactly that and nothing more, so its
  examples can use string and number literals without teaching them.
- **Python version:** 3.12+. The system `python3` is 3.9, so check snippets with the 3.13
  interpreter at `~/.local/share/uv/python/cpython-3.13.5-macos-aarch64-none/bin/python3.13`
  (run it with `-I`). Run every worked example that produces output or an error, and quote
  what it prints. `scripts/run_snippet.py` does this: pipe the code in, pass canned answers
  for `input()` as arguments, and it prints the output plus the final error line. Show an
  error in the worked example as a trailing comment (`# TypeError: can only concatenate
  str (not "int") to str`). If that interpreter is missing, check with `python3` and paraphrase
  version-specific error text.
- **Imports before modules are taught** (B13): earlier batches may use `import csv`,
  `import json`, `import copy` etc. as memorised one-line incantations, without a prerequisite.
  Say so in `notes` so B13 can link back. The same goes for any syntax used as a memorised
  template before it is taught (`class MyError(Exception): pass`, `with pytest.raises(...)`,
  `pip install x`): no `pending_prerequisites` needed. Use pending only when the topic's skill
  depends on *understanding* the concept.
- **Tools that run as files** (pytest, mypy, doctest): `run_snippet.py` can't show their
  output; write the file to the scratch directory and run the tool on it directly.
- **Libraries that aren't installed:** do not install packages. Write the snippet from the
  library's documented behaviour, describe its output instead of inventing exact text unless
  you are certain of it, and say "not run" in the concept's `notes`.
- **Out-of-scope concepts an in-scope topic needs** (HTML for Flask, SQL injection for
  sqlite3): fold in the minimum as knowledge points of the in-scope topic and record it in
  `notes`. Don't create topics for out-of-scope concepts.
- **A new language inside the course** (SQL, regex): give it a full topic ladder like any
  core skill; the evidence table's counts don't apply.
- **Showing invisible results** (empty strings, trailing spaces): show them with a comparison
  (`s == ""` prints `True`) or a comment, not `repr()`, until `repr` has been taught.

## Inputs you have

- `topics/plan.json`: waves of batches (B01-B20). Each batch lists the concepts it owns. Waves
  run in order; batches in the same wave run in parallel, so they cannot see each other.
- `aggregate/aggregate.json` and `courses/*.json`: what 8 real courses (Helsinki MOOC, CS50P,
  Py4E, MIT 6.100L, 100 Days of Code, Boot.dev, Code in Place, Codecademy) teach for each
  concept, including the section titles of every module. This is your evidence for which
  sub-skills exist.
- `topics/B*.json`: topics already written by earlier batches. Link to these.
- `references/math_academy_method.md`: the design rules and the reasons behind them. Read it
  once before your first batch.
- `references/example_dictionaries.json`: three fully worked topics showing the expected depth.

## Procedure for one batch

1. **Gather evidence.** Run both and read the output in full:
   ```bash
   python3 -I .claude/skills/atomize-concepts/scripts/concept_context.py . --batch B05 > <scratch>/<BATCH>_context.txt
   python3 -I .claude/skills/atomize-concepts/scripts/list_topics.py . --before-wave <this wave> > <scratch>/<BATCH>_existing.txt
   ```
   The output is long, so save it to a file (named per batch: other batches run in parallel
   and share the scratch directory) and read it in chunks. The first file shows, per
   concept, which courses teach it, how deeply, the section titles of every module that
   covers it, and how the concept relates to others ("comes before", "is part of", ...). The
   second lists the topic IDs you may use as prerequisites, with each concept-map note
   from earlier batches. Read those notes: earlier batches record what they deliberately
   left for later batches.

2. **List the sub-skills for each concept.** Take the union of what the courses cover (section
   titles, projects, depth), plus the cases a competent Python programmer must handle that
   courses tend to skip: the error case, the edge case, the common bug. Write each as a
   concrete thing a learner can *do*, e.g. "slice with a negative step", not "understand
   slicing".

3. **Decide ownership.** Concepts in a batch overlap (`lists`, `list_methods`,
   `list_slicing`). Every sub-skill belongs to exactly one topic, owned by the most specific
   concept. Before creating a topic, check the existing-topic list so you don't duplicate one
   from an earlier batch. If a concept is fully covered elsewhere, map it with `covered_by`
   instead of inventing filler.

   When an earlier topic already teaches part of a skill you need (B01 teaches `\n` in
   `print_output.newlines_and_tabs`), make it a prerequisite or an encompassed topic rather
   than re-teaching it. When you leave something for a later batch, say so in that concept's
   `notes`, so the later batch picks it up.

4. **Group sub-skills into topics.** A topic is 3-4 knowledge points that form a ramp: the
   first is the simplest case, each next one adds exactly one complication. Size each to about
   10-25 minutes of work (`minutes`, including the reviews it will generate; 15-20 is typical).
   How many topics a concept gets should follow the evidence:

   | Evidence | Typical topic count |
   |---|---|
   | Taught by 6-8 courses, practiced or deep | 4-8 |
   | Taught by 3-5 courses | 2-5 |
   | 1-2 courses, a core language feature | 2-3 |
   | A third-party library taught by 1-2 courses | 1-3 (install/import + its central use) |
   | A meta-skill (decomposition, abstraction, computational thinking, clean code, OO design) | 1-3 problem-based topics, e.g. "split a task into functions" via Parsons or fill-in |

   These are starting points. Ownership (step 3) wins: a broad concept such as `data_types`
   may end up with only 1-2 topics because more specific concepts own its sub-skills. The
   rule that matters is the next step's prerequisite limit.

5. **Link it.** For each topic:
   - `prerequisites`: at most 4 direct ones, and only those whose skill is genuinely needed to
     start. A topic needing more is too big: split it. Prerequisites must be topic IDs from an
     earlier wave or this batch.
   - If a topic truly needs a concept that only a sibling or later batch will write, put
     `concept:<id>` in `pending_prerequisites`; a stitching pass resolves it later. Use this
     sparingly. The waves were ordered so it should be rare.
   - **Parallel sibling batches** (same wave) write their own concepts at the same time. If
     a skill clearly belongs to a concept in a sibling batch (returning several values belongs
     to `return_values`, not `unpacking`), do not write your own version of it: that creates
     duplicates. Narrow your topic's scope instead, and say in `notes` what you expect the
     sibling's topic to provide. Ownership follows the plan: a skill belongs to the batch whose
     concept list names it (generator expressions belong to `generators`), even if an earlier
     batch's note handed it to someone else.
   - `key_prerequisites` per knowledge point: the 0-3 earlier topics that specific step leans
     on most. These drive remediation (failing a step twice sends the learner to review them),
     so pick the skill a struggling learner is most likely missing, even if it is several hops
     back. A key prerequisite must be an ancestor of the topic (reachable through
     `prerequisites`) or an earlier topic of the same batch it depends on; a merely related
     sibling is not one. If the step really needs it, add it to the prerequisite chain;
     if it is only incidental (an f-string inside an example about enumerate), drop the link
     or simplify the example rather than spending one of the 4 prerequisite slots.
   - `encompasses`: earlier topics that problems here actually *practise*, with a weight 0-1
     (see the method reference; 1.0 = every problem fully performs that skill). Only list
     near, nontrivial ones; usually 1-4 per topic. A prerequisite that is only conceptually
     needed gets no encompassing.

6. **Write the knowledge points.** Each has a title naming the step, a `worked_example` (a
   short code snippet, 2-8 lines, plus one line of explanation; real Python 3.12 that runs),
   a `practice` line describing what the 2-5 questions ask, and `formats` drawn from:
   `multiple_choice`, `predict_output`, `fill_in_blank`, `write_code`, `fix_the_bug`,
   `parsons`, `short_answer`, `trace_table`, `numeric`. Prefer formats that can be
   auto-graded and resist guessing; `predict_output` and `fix_the_bug` work for almost
   everything. For concepts that are not Python code (terminal use, installing packages,
   editors, hardware, design principles), the worked example may be a shell transcript or a
   short numbered procedure, graded with `multiple_choice`, `parsons`, `trace_table` or
   `short_answer`; these are usually not core.

   A complete algorithm (binary search, merge) may need 10-14 lines; that is fine. A knowledge
   point may also be a hand trace, a table or a short proof graded with `trace_table`,
   `numeric` or `multiple_choice`. Fix random output with `random.seed(...)` and mark timing
   output as "e.g.". To reuse a function from an earlier topic, say so in the explanation and
   test the snippet with that function prepended.

   For algorithm or class-based examples that would run past ~10 lines, define the shared
   class or helper once in the first knowledge point that needs it, then refer to it ("Node as
   defined in KP1") and show only the lines that change. Long code spreads attention thin,
   which is exactly what a worked example should avoid.

   Worked examples may only use skills from the topic's ancestors or earlier knowledge
   points. `scripts/ancestors.py . <topic_id>` lists those ancestors (or
   `--prereqs a.b,c.d` for a topic you are still drafting); check each snippet's syntax
   against it. If a snippet needs something not yet taught, simplify it or add the
   prerequisite.

7. **Mark core topics.** `core: true` when many later topics will depend on it (the everyday
   skills). If a topic is core, its prerequisites must be core too. If your core topic
   genuinely needs an earlier topic that was marked non-core, link it anyway and accept the
   validator warning: a final reconciliation pass promotes such prerequisites to core. Do not
   re-teach the skill or demote your own topic just to dodge the rule.

8. **Write the file** `topics/<BATCH>_<slug>.json` using the schema below, then validate:
   ```bash
   python3 -I .claude/skills/atomize-concepts/scripts/validate_topics.py . <BATCH>
   ```
   Fix every ERROR. Read each WARN and either fix it or be ready to say why it is fine.
   Re-run until clean.

9. **Report** briefly: topics per concept, total minutes, any `covered_by` or
   `pending_prerequisites`, and judgment calls a reviewer should check.

## Output schema

```json
{
  "batch": "B07",
  "title": "Dictionaries, sets and comprehensions",
  "concept_map": {
    "<concept_id>": {"topics": ["<topic ids in teaching order>"], "entry_topic": "<first>", "notes": "optional"},
    "<concept_id>": {"covered_by": ["<existing topic ids>"], "notes": "why no new topics"},
    "<concept_id>": {"umbrella": true, "notes": "a grouping concept; its children own the topics"}
  },
  "topics": [
    {
      "id": "<concept_id>.<snake_case_slug>",
      "title": "Learner-facing title",
      "concept": "<concept_id>",
      "summary": "One sentence: what the learner can do after this topic.",
      "minutes": 15,
      "core": true,
      "prerequisites": ["<topic id>", "..."],
      "pending_prerequisites": ["concept:<concept_id>"],
      "knowledge_points": [
        {
          "title": "The step, named",
          "worked_example": "code\nplus one line of explanation",
          "practice": "What the 2-5 practice questions ask the learner to do.",
          "formats": ["predict_output", "write_code"],
          "key_prerequisites": ["<topic id>"]
        }
      ],
      "encompasses": [{"topic": "<topic id>", "weight": 0.5}],
      "taught_in": ["<course ids whose material covers this topic; [] if you added it>"]
    }
  ]
}
```

- Topic IDs are permanent handles that later batches link to: make the slug specific and
  stable (`lists.slice_with_step`, not `lists.topic3`). The prefix must be the owning concept.
- Every topic appears in exactly one concept's `topics` list.
- An encompassed topic is normally an ancestor. If problems here genuinely practise an
  equivalent skill that is not an ancestor, add `"non_ancestor": true` to that entry. Check
  ancestry first: an indirect ancestor does not need the flag.
- Topics within a concept are listed in teaching order. A topic in the same batch may be a
  prerequisite of another as long as there is no cycle.
- Write the JSON with a script or the Write tool. Keep it valid: escape newlines inside
  strings as `\n`.

## Quality bar

A good decomposition reads like a well-sequenced textbook chapter cut into 15-minute
lessons. Check before validating:
- Could a learner who has mastered only the listed prerequisites pass KP1 after reading its
  worked example? If not, a prerequisite or an intermediate KP is missing.
- Is every common bug or edge case for the concept covered somewhere (off-by-one in `range`,
  aliasing when copying a list, mutable default arguments, `is` vs `==`)? These are where
  learners fail, so they deserve knowledge points.
- Does any topic just describe something without problems the learner solves? Rewrite it as
  practice or drop it.
- Are topics consistent in size? A 6-minute topic should probably merge with a neighbour; a
  30-minute one should split.

## After all batches: reconcile

Parallel batches inevitably leave duplicates, gaps and placeholder links. Collect them in
`topics/reconcile_todo.md` as batches report, then run one sequential pass that:
replaces every `pending_prerequisites` entry with a specific topic; keeps one owner per
duplicated skill; adds missing topics; makes the core set downward closed (every
prerequisite of a core topic is core); and logs each change to `topics/reconcile_log.md`.
Finish with `validate_topics.py . --all` (0 errors) and `merge_topics.py .` (no UNRESOLVED).
After reconciliation, early batches may link forward to later ones, so validate with
`--all` rather than one batch at a time.
