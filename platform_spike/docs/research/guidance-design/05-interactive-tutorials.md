# 05 — Interactive Tutorials, Stencils, Sandboxes, Checklists

Interactive tutorials have the person **perform** the real actions with guidance and feedback. This is the strongest learning format — when the thing being taught genuinely needs teaching.

## Evidence summary
- Learning by doing with immediate feedback beats reading (minimalism — Carroll; situated learning; Gee; Hodent).
- NN/g: a tutorial that required doing the task and was *available from the sidebar* rather than auto-launched (ArcGIS) was a better example; novel paradigms (AR) benefited from walkthroughs.
- Andersen et al. 2012: context-sensitive tutorials helped a complex game a lot and simple games not at all; **restricting freedom (stencils) showed no engagement benefit**; on-demand help sometimes harmed.
- Kelleher & Pausch 2005: stencils helped people finish a tutorial faster with fewer errors (a narrower outcome).

→ Interactive yes; blocking only when there's a safety reason; and only for things that aren't discoverable.

## Spectrum of control

| Mode | Description | When |
|---|---|---|
| **Free discovery** | No instruction; design makes the next action obvious; safe to experiment | Conventional mechanics, simple apps, early game levels |
| **Suggested** | Non-blocking prompt ("Press Space to jump") in background; ignored if they do something else (Braid style) | Default for most tutorials |
| **Guided** | Step instructions beside the real UI; advance on real event; person can leave and resume | Multi-step tasks |
| **Stenciled / blocking** | Everything except target disabled until done | Irreversible/dangerous first-run steps; extremely novel inputs. Use sparingly. |
| **Sandbox** | Separate practice space with sample data where mistakes don't matter | Destructive operations, complex tools (spreadsheet formulas, trading, editors), training-mode in games |

## Design rules
1. **Teach a real task the person wants**, with a real result at the end ("Send your first invoice" — and the invoice exists).
2. **Sample data** when the person has none yet (pre-populated example project they can delete) so they don't have to build inputs just to learn.
3. **One mechanic per step; sequence by dependency** (prerequisites first — see skill chains in 07).
4. **Immediate feedback** for each action: success state, what changed, what's next.
5. **Errors are lessons, not walls:** detect the common mistakes and respond specifically ("That splitter divides power in half — try a bender here"); Refraction-style JIT messages on illegal actions with "don't show again".
6. **Player-paced:** never auto-advance text; wait for input.
7. **Skippable and modular:** each lesson stand-alone; a skipped lesson can be taken later.
8. **Replayable:** "Replay tutorial" / lesson list in help or settings, without resetting progress or making a new account/save.
9. **Exit to real work** at the end, in the state they created — not to an empty home screen.
10. **Don't over-teach conventional stuff** (tap a button, scroll a list).

## Checklists (onboarding task lists)
- 3–7 items that represent **activation milestones** (e.g., "Connect a data source", "Invite a teammate"), not feature tours.
- Each item launches the relevant guided flow or deep-links to the place; checks itself off from **real events**, including actions done outside the checklist.
- Show progress (endowed progress: pre-check "Create account" honestly) — Chameleon found checklist-launched tours ~21% more likely to complete.
- Dismissible and re-openable; disappears when complete (with a brief confirmation).
- Ordering: easiest high-value item first.

## Setup wizards vs. tutorials
A wizard collects necessary input (account details, permissions, pairing). Keep it separate from teaching: few screens, each with a clear reason ("We need location to show nearby stops"), ask permissions **at the moment of need**, allow "Skip for now" whenever the step isn't truly required.

## Mobile games & apps: "show the fun first"
Get the person to the core value/loop in the first minute; defer system explanations (economy, settings, social) to when each becomes relevant (see 07 on FTUE).

## Anti-patterns
- "Click here. Now click here." on controls that are obvious.
- A blocking stencil that forbids exploration of the rest of the UI.
- Tutorial that teaches with fake UI that differs from the real UI.
- Tutorial failure states (person can get stuck or soft-locked) — if the person fails the tutorial, the tutorial failed (Ernest Adams).
- Forced re-run on new game/new device.
- Tutorial that must be completed before any value.
