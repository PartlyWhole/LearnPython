# The Math Academy method, as it applies to topic design

Distilled from *The Math Academy Way* (Skycak & Roberts), justinmath.com and the
research notes in `~/Desktop/MathAcademyResearch/notes/` (notes 03 and 07 have the detail).
Read this when a sizing or linking decision is unclear.

## Contents
1. Units of content
2. Sizing rules and why
3. Prerequisites vs key prerequisites vs encompassings
4. Writing knowledge points
5. Core vs supplemental
6. What Math Academy deliberately avoids

## 1. Units of content
- **Topic** = one lesson, the atomic node of the graph. About 10 questions in total,
  roughly 10-20 minutes for an average serious learner including the follow-up reviews.
  A semester course is 150-300 topics; AP Calculus BC is about 300.
- **Knowledge point (KP)** = one worked example followed by 2-5 practice questions of
  the same type. A lesson has 3-4 KPs that ramp: KP1 is the simplest case, each later KP
  adds exactly one complication (2-digit addition, then with carrying, then carrying into
  the hundreds).
- **Multistep** = 8-12 scaffolded parts combining learned skills; Math Academy's
  equivalent of a project. Not produced by this skill, but note in a topic's summary when a
  concept is really project-shaped.

## 2. Sizing rules and why
- **At most 3-4 direct prerequisites per topic**, and at most 3-4 key prerequisites per
  KP. Working memory holds about 4 chunks; a topic drawing on more becomes a congested
  intersection. 15 prerequisites means "split this topic".
- **Problems take 1-2 minutes.** Reps should land on the new, error-prone step, not on
  7 minutes of setup. In programming terms: short snippets, not whole programs.
- **Split until almost everyone passes first time.** Math Academy refines content until
  about 95% pass a lesson first try. The fix for a hard lesson is more scaffolding (an extra
  KP, or splitting the topic), never lowering the bar. When unsure, err finer: over-
  scaffolding costs a fast learner a minute; under-scaffolding stops a slow learner.
- **Cover every problem type** a student who "knows the topic" should handle, not the
  easy cases. If a concept has a nasty case (mutating a list while iterating it), it gets a
  KP or a topic.

## 3. Three kinds of links
| Link | Level | Meaning | Used for |
|---|---|---|---|
| prerequisite | topic -> topic | must be mastered before this topic unlocks | unlocking, placement |
| key prerequisite | KP -> topic (may be several hops back) | the earlier skill this specific step uses most directly | remediation: failing this KP twice triggers a review of it |
| encompassing (weight 0-1) | advanced topic -> simpler topic | share of the simpler skill an average problem here practises | spaced-repetition credit (practising this counts as partial review of that) |

Encompassed topics are usually prerequisites, but many prerequisites are *not*
encompassed: needing to know about something is not the same as practising it. Math
Academy only sets weights where they are nontrivial and the topics are close in the graph;
far-apart pairs barely matter. Rough guide:
- 1.0: every problem here fully performs the simpler skill (writing an f-string with a
  format spec fully exercises writing a plain f-string).
- 0.5: about half the problems, or half the skill.
- 0.1-0.3: touched incidentally.
- 0 / omit: conceptual dependency only.

## 4. Writing knowledge points
- Simplest case first, concrete before abstract, compact notation only after examples.
- Motivate a more sophisticated technique with a case where the naive one fails
  (summing with a loop vs `sum()`; a dict lookup vs scanning a list of pairs).
- Practice must be auto-gradable: predict the output, fill in the blank, Parsons
  (reorder lines), find the bug, multiple choice designed so guessing fails, short
  write-code with tests.
- One explanation, battle-tested. No hint ladders, no "explain it three ways".

## 5. Core vs supplemental
Core topics are those many later topics depend on; they are served first so they get
more practice. Rule: if a topic is core, everything it depends on must be core.
Supplemental topics are still taught, just later (e.g. `print(sep=, end=)` options).

## 6. What it avoids
Discovery tasks, group work, hints that give away steps, long videos, topics that are
really "read about X". Every topic must end in the learner solving problems.
