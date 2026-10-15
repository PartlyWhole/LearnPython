# 11 — Review Checklist

Use to audit existing guidance or a proposed design. Each item is pass/fail; a failure links to the file that explains the fix. Report as: `ID | Pass/Fail | Evidence | Fix`.

## A. Need
- A1 There is evidence of a real learning problem (test, analytics, tickets). → 01
- A2 A design fix (label, affordance, default, inline text, empty state) was considered first. → 00 P1
- A3 The guided information is not required to complete a task (else it's inline, persistent). → 04
- A4 The thing taught isn't already conventional/obvious. → 06 rule 4
- A5 For games: the mechanic isn't discoverable via safe experimentation (else teach through level design). → 07

## B. Timing & trigger
- B1 Shown when relevant (pull), not at launch/login by default. → 06
- B2 Trigger rules use real signals; blockers prevent stacking and mid-input interruptions. → 10
- B3 Shown once (or ≤ max count) and remembered across devices/reinstalls. → 10
- B4 Invalidated when the person already performs the action. → 06
- B5 Global frequency cap exists; only one guidance surface visible at a time. → 06
- B6 Not shown during urgent/stressful tasks (errors, checkout, incident). → 02
- B7 Waits for content to render; never points at skeletons or missing elements. → 02

## C. Form
- C1 Least-intrusive suitable pattern chosen (matrix). → 01
- C2 Tours ≤ ~4 steps unless opt-in; progress shown. → 02
- C3 Interactive (person performs real action) rather than read-and-next where teaching a task. → 05
- C4 Not blocking unless safety-critical. → 05
- C5 One concept per step/tip; one highlighted target. → 02/03
- C6 Callout doesn't cover its target or related content; arrow when ambiguous. → 04
- C7 Visually distinct from product UI (annotation, not control). → 03
- C8 Highlighted target is operable during the step. → 02

## D. Control
- D1 Skip/close visible on every step; Esc works. → 02, 08
- D2 Never forced, never re-forced (new game, update, re-login). → 07
- D3 Re-findable: replay/resume from help/menu; dismissed tips recoverable. → 06
- D4 Leaving mid-tour pauses rather than breaks; resume offered. → 02
- D5 Setting to turn proactive tips off and to reset them. → 08
- D6 Tutorial cannot be failed or soft-locked. → 05/07

## E. Content
- E1 Within length budget. → 09
- E2 Leads with verb/benefit; specific; user's words. → 09
- E3 Doesn't repeat visible label; names controls by label not position. → 09
- E4 No marketing tone; neutral dismiss labels. → 09
- E5 Localizable; no text in images. → 09
- E6 Ends with a next action / confirmation of result. → 02

## F. Accessibility
- F1 Hover content also on focus; touch equivalent exists. → 08
- F2 WCAG 1.4.13: dismissible, hoverable, persistent; no auto-hide timer. → 08
- F3 Correct roles (tooltip/dialog/live region); relationships exposed. → 08
- F4 Focus management: in, through, out; no trap; focus not obscured. → 08
- F5 Screen reader announces content and step count once. → 08
- F6 Contrast: text 4.5:1, highlight ring 3:1. → 08
- F7 Reduced motion respected; no auto-advance. → 08
- F8 Works at 200% zoom / 320px; gamepad where relevant. → 08
- F9 Games: controls reminder, codex, remap-aware prompts, configurable hints. → 07/08

## G. Measurement
- G1 Exposure and interaction events instrumented with stable ids. → 12
- G2 Success defined as downstream behavior, not completion. → 12
- G3 Holdout/A-B in place or planned. → 12
- G4 Guardrails tracked (task success, time-on-task, support load, retention). → 12
- G5 Owner and review/retirement date set. → 10
- G6 Playtested/usability-tested with true novices (and with experienced users for annoyance). → 12

## Severity guide
- **Blocker:** D1, D2, D6, F2, F4, A3 (critical info hidden in tooltip), B6.
- **Major:** B1, B3, B5, C2, C4, F1, F3, F5, G2.
- **Minor:** remaining.

## Quick anti-pattern scan (any present = finding)
- Launch carousel / chalkboard overlay of many arrows
- "Next, next, next" tour describing every panel
- Tooltip containing password/format rules
- Tooltip on hover only, or vanishes when pointer moves onto it
- Tip about a feature the person already uses
- Several tips/banners/chat bubbles at once
- Tour restarts each login or each version
- Auto-advancing steps or timed tips
- Forced, unskippable game tutorial; re-forced on new save
- Wall of mentor dialogue before play
- Help button as the only teaching strategy
- "Need help?" chat popup after seconds on every page
