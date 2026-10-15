# 10 — Spec Template and State Machine

Fill one spec per guidance unit (a tip, a tour, a tutorial lesson, a hint). Agents: produce this before writing code or copy; reviewers: check against it.

## YAML spec

```yaml
id: tip.saved-filters.discovery            # stable, namespaced; used for persistence & analytics
type: teaching_tip                         # tooltip | toggletip | rich_tooltip | teaching_tip | hotspot |
                                           # coach_mark | tour | interactive_walkthrough | checklist |
                                           # empty_state | rescue_hint | game_prompt | game_hint
problem:
  evidence: "62% of users who filter >3x/week never save a filter (analytics, Sep 2026)"
  design_fix_considered: "Visible 'Save filter' button added; discovery still low"
learning_goal: "User saves a filter and reuses it"
success_behavior:                          # the downstream event that proves it worked (see 12)
  event: filter.saved
  window_days: 14
audience:
  include: ["role in [analyst, manager]"]
  exclude: ["has_event(filter.saved)", "account_age_days < 1"]
trigger:
  kind: event                              # arrival | event | intent | struggle | manual | change
  rules:                                   # ALL must be true
    - "event_count(filter.applied, last_7d) >= 3"
    - "screen == 'reports' and element_visible('#save-filter')"
  blockers:                                # ANY true suppresses
    - "other_guidance_visible"
    - "modal_open"
    - "user_typing"
    - "session_age_seconds < 30"
    - "in_onboarding_flow"
  priority: 40                             # higher shows first if several eligible
frequency:
  max_display_count: 2
  min_gap_hours: 72
  respects_global_cap: true                # e.g., ≤1 proactive tip/session, ≤1/day
invalidate_on:
  - dismissed
  - "event(filter.saved)"                  # did it without the tip
  - "feature_flag(saved_filters) == off"
  - "expires: 2026-12-31"
surface:
  anchor: "#save-filter"
  placement: bottom-start                  # flip/shift to fit viewport
  fallback_if_anchor_missing: skip         # skip | untargeted | defer
  dim_background: false
  blocking: false
content:
  title: "Reuse this view"
  body: "Save these filters to open the same view in one click."
  primary_action: { label: "Save filter", does: "open save-filter dialog" }
  secondary_action: { label: "Not now", does: dismiss }
  media: none
  progress: null                           # "2 of 4" for tours
  i18n_keys: [tip.saved_filters.title, tip.saved_filters.body]
re_findable_at: "Help menu › Tips › Saved filters"
accessibility:
  role: dialog (non-modal)
  focus_on_open: false                     # programmatic & non-blocking → announce via live region instead
  announce: "New tip: Reuse this view. Save these filters to open the same view in one click."
  esc_closes: true
  reduced_motion: "no entrance animation"
  touch_equivalent: n/a
measurement:
  exposure_event: guidance.shown
  interaction_events: [guidance.primary, guidance.dismissed, guidance.closed_x]
  holdout_percent: 10
  guardrails: ["report task completion rate", "support tickets tagged filters"]
owner: "@team-reports"
review_date: 2027-01-15                    # re-check value; retire if no lift
```

For **tours/walkthroughs**, add:
```yaml
steps:
  - id: 1
    anchor: "#new-project"
    instruction: "Create a project to hold your work."
    advance_on: "event(project.created)"   # interactive; for passive: 'next_clicked'
    on_target_missing: skip
  - id: 2
    ...
resume: true
replay_from: "Help › Tours › Getting started"
max_steps_unrequested: 4
```

For **game hints**, add:
```yaml
struggle_signal: "deaths_at_checkpoint(cp_12) >= 3 or idle_seconds(objective) > 90"
ladder: [highlight_object, short_text_hint, explicit_solution, offer_skip_or_assist]
escalate_after: { failures: 2, or_seconds: 60 }
opt_in: true          # offered, not forced
input_glyphs: dynamic # reflect current device & remaps
```

## State machine (per user × guidance id)

```
            rules met & no blockers & under caps
 PENDING ───────────────────────────────────────► ELIGIBLE
   ▲                                                 │ scheduler picks highest priority,
   │ cooldown elapsed & count < max                  │ global cap allows
   │                                                 ▼
 COOLDOWN ◄──── closed without action ────────── SHOWING ───► (tour) IN_PROGRESS ──► PAUSED (user left)
                                                    │                     │              │ resume
                                                    │ primary action /    │ last step    └──────► IN_PROGRESS
                                                    │ success event       ▼
                                                    └──────────────► COMPLETED (terminal)
 Any state ── invalidate_on fires ──► INVALIDATED (terminal)
 Any state ── explicit "Don't show tips" ──► SUPPRESSED (terminal until user resets)
 Manual replay from help ──► SHOWING (does not reset COMPLETED analytics)
```

Persist: `state`, `display_count`, `last_shown_at`, `last_step`, `completed_at`, `dismissed_at`, `source` (auto|manual). Store server-side keyed by user (and device-independent) so state survives reinstall and syncs.

## Scheduler rules
1. Evaluate on screen/route change, relevant event, and idle; never mid-input.
2. Collect eligible units; drop those blocked; pick highest priority; show **one**.
3. Increment global counters; enforce session/day caps.
4. Wait for anchor to exist and be visible (timeout → apply `fallback_if_anchor_missing`).
5. Re-anchor on scroll/resize/rotate; close if anchor disappears.

## Developer testing hooks (mirror TipKit)
- `showAll()` — ignore rules/caps for QA screenshots.
- `hideAll()` — for UI tests that don't involve guidance.
- `show(ids)` / `hide(ids)` — targeted.
- `resetStore()` — re-run eligibility from scratch.
- Launch arguments / query params to set these in builds.
