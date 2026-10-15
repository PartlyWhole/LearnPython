<!-- Imported 2026-10-14 from guidance-design.zip (supplied by the project owner). General, not
LearnPython-specific: the app-specific rules derived from it live in docs/lessons.md and the
design-lesson / build-guidance skills. File names below are relative to this folder. -->
# In-Product Guidance Design — Agent Reference Set

This folder is a working reference for agents asked to **design, specify, review, or build** the ways a product teaches people to use it: walkthroughs, coach marks, tooltips and hotspots, interactive tutorials, and contextual / just-in-time (JIT) help, in both **software apps** and **video games**.

It is opinionated and evidence-weighted. Where a rule comes from controlled research it says so; where it comes from vendor benchmarks, platform guidelines, or practitioner craft it says that too. Treat numbers as calibration, not law.

## How to use this set

| If the task is… | Read first | Then |
|---|---|---|
| "Add onboarding / a tour to X" | `01-choosing-a-pattern.md` | the pattern file it points to, then `10-spec-template.md` |
| Review / critique existing guidance | `11-review-checklist.md` | pattern files for any failed item |
| Write the words in tips/tours | `09-copy.md` | |
| Build it (code) | the pattern file + `08-accessibility.md` | `10-spec-template.md` for state/trigger logic |
| Game tutorial / FTUE | `07-games.md` | `05-interactive-tutorials.md`, `08-accessibility.md` |
| Decide whether it's working | `12-measurement.md` | |
| Need to justify a decision | `00-principles.md` (evidence) | `sources.md` |

## Files

- `00-principles.md` — the core evidence and the ten principles everything else derives from
- `01-choosing-a-pattern.md` — decision tree + pattern selection matrix
- `02-walkthroughs.md` — product tours / guided walkthroughs
- `03-coach-marks.md` — coach marks, instructional overlays, spotlights, feature-discovery tap targets
- `04-tooltips-hotspots.md` — tooltips, toggletips, popup tips, rich tooltips, hotspots/beacons, teaching tips
- `05-interactive-tutorials.md` — learn-by-doing tutorials, stencils/blocking, sandboxes, checklists
- `06-contextual-help.md` — pull revelations, triggers, eligibility & frequency rules, empty states, rescue help
- `07-games.md` — teaching through level design, skill atoms, kishōtenketsu, FTUE, adaptive help
- `08-accessibility.md` — WCAG/ARIA requirements and game accessibility guidance
- `09-copy.md` — microcopy rules for all guidance surfaces
- `10-spec-template.md` — fill-in spec (YAML) for any guidance unit, with state machine
- `11-review-checklist.md` — numbered audit checklist with anti-patterns
- `12-measurement.md` — metrics, benchmarks, experiments, playtesting
- `sources.md` — annotated bibliography with evidence grades

## The short version (if you read nothing else)

1. **First try to not need it.** Fix the UI (labels, affordances, defaults, empty states) before adding guidance. Most guidance is a patch over a design problem.
2. **Pull beats push.** Show help when a signal says the person needs it now (they reached the feature, hovered it, failed at it, sat idle), not at launch.
3. **Doing beats reading.** Have people perform the real action on the real UI; don't make them memorize a slideshow.
4. **One thing at a time, short.** One concept per step, ≈ 1–2 sentences, ≤ ~4 steps per tour unless the person opted in.
5. **Always skippable, always re-findable.** Easy dismiss, never forced, and a way to get it back later (help menu, "replay tutorial", "?" toggletip).
6. **Show once, remember it.** Persist seen/dismissed/completed state; cap frequency; invalidate tips when the person already did the thing.
7. **Accessible by default.** Hover content must also work on focus and touch, be dismissible (Esc), hoverable, persistent; focus is managed in tours.
8. **Games: teach through play.** Safe first encounter → practice → twist/test; text is a last resort; offer escalating help only after repeated failure.
9. **Measure behavior, not completion.** Tour completion is a vanity metric; track whether the taught action happens afterward and whether retention/success improves vs. a holdout.
10. **Tutorial value scales with novelty/complexity.** Conventional, discoverable mechanics may gain nothing (or lose) from tutorials; novel/complex ones gain the most.
