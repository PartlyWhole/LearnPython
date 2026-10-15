# 06 — Contextual / Just-in-Time Help

Contextual help appears **where and when** it's relevant. Its quality depends almost entirely on **trigger accuracy** — help at the wrong moment is a push revelation in disguise (Clippy).

## Push vs. pull (NN/g)
| | Push revelation | Pull revelation |
|---|---|---|
| Trigger | System's convenience (launch, update, timer) | Signal the person would benefit *now* |
| Examples | Launch tour, "What's new" modal, random tip of the day | Tip when the feature's screen is first opened, tooltip on hover, hint after repeated error |
| Typical result | Ignored, dismissed, annoying | Read, applied immediately, remembered |
| Rule | Use only for info needed regardless of context; make trivially dismissible | Default |

NN/g's five guidelines for pull revelations:
1. Easy to **dismiss and recall** (e.g., persistent "What's new" entry).
2. **Progressive disclosure** — signal help exists; detail only on request ("Learn how").
3. **No memorization** — show help beside each step of a multi-step flow.
4. **Skip the obvious** — conventions don't need explaining.
5. **Understand the journey** — use research/task analysis to find the real signals of need.

## The help ladder (scale intrusiveness with evidence of need)

| Level | Form | Shown when |
|---|---|---|
| 0. Passive | Visible labels, inline helper text, placeholders, examples, empty states, "?" toggletips, help search | Always available |
| 1. Ambient nudge | Hotspot/badge, subtle inline hint ("Tip: drag to reorder") | First reach of feature; not yet used |
| 2. Contextual tip | Teaching tip / coach mark anchored to control | Eligibility rules met (below) |
| 3. Guided assist | Interactive flow offered ("Want a hand setting this up?") | Person started task and stalled or asked |
| 4. Rescue | Specific fix for the detected problem; contact support; for games, skip/assist | Repeated failure, error loops, long idle on a step |

Climb only on evidence; drop back down once the person succeeds.

## Trigger signals (catalog)
- **Arrival:** first visit to screen/feature; first time element scrolled into view.
- **Intent:** hover/focus on a control; opened a menu; started a flow; typed in a field.
- **Prerequisite met:** has ≥ N items (e.g., tip about bulk-select appears once a list has ≥ 10 items); has used X 3 times (TipKit-style event rule).
- **Inefficiency:** repeats a manual action that a shortcut covers (renamed 5 files one by one → tip about batch rename).
- **Struggle:** repeated validation error on a field; undo loops; rage-clicks; back-and-forth navigation; long idle on a step; search for a term with no results; in games, deaths/retries at the same spot.
- **Change:** a control they used has moved/changed since their last use ("Export moved to Share").

## Eligibility, frequency, and state (implement this — don't hand-roll each tip)
Model each guidance unit with:
- `rules`: all must be true (parameter conditions + event counts within a time window).
- `blockers`: any true suppresses (another guidance surface visible, modal open, typing in progress, user in onboarding flow already, first 60 s of session, error state on screen).
- `priority` for when several are eligible — show one.
- **Global frequency cap**: e.g., at most 1 proactive tip per session and per day; minimum gap between tours.
- `maxDisplayCount` per tip (often 1–3) and **invalidation** on: dismissed, action performed (even without the tip), feature removed, user too experienced.
- Persist **per user, server-side** where possible so it follows devices and survives reinstall.
- Testing overrides: show all / hide all / reset datastore (TipKit has these; build equivalents).

See `10-spec-template.md` for the schema and state machine.

## Empty states (first-use teaching surfaces)
NN/g: use empty states to (1) communicate system status, (2) provide learning cues — in-context help is more memorable because it can be applied right away, and (3) give direct pathways to key tasks.
Anatomy of a first-use empty state:
- Headline: what this place is for ("No projects yet").
- One line: what appears here once populated / why it's useful.
- Primary CTA that creates the first item; optional secondary "Use sample data" or "See an example".
- Optional small illustration; never only an illustration.
Distinguish types: **first-use** (teach), **user-cleared** (congratulate/neutral), **no results** (help fix the query), **error/unavailable** (status + recovery), **no permission** (who to ask).

## "What's new" for existing users
- Prefer: tip at the changed place on first encounter; badge on new control; persistent changelog entry (Evernote-style "What's new" link).
- Avoid: launch modal carousels during urgent tasks (NN/g's bank example).
- If a familiar control **moved**, say where it went at the old location ("Export is now under Share").

## Reactive help (help the person pulls)
- In-product search over help content, scoped to current screen; answers inline.
- Contextual help panel/side sheet keyed to the current page (deep link to the exact article/section).
- AI assistants: same rules apply — answer from current context, don't interrupt uninvited, cite actions as clickable steps, never pop up on your own without strong signals.
- Note Andersen et al.: a standalone help button didn't help (and sometimes hurt) in simple games; reactive help is a supplement, not a teaching strategy.

## Anti-patterns
- Tip shown on page load before data renders (points at a skeleton).
- Tip about a feature the person used yesterday.
- Two tips plus a banner plus a chat bubble at once ("overlay overload").
- "Need help?" chat popup after 5 seconds on every page.
- Help that misreads intent (Clippy) — if your signal precision is low, stay at level 0–1.
