# 08 — Accessibility Requirements for Guidance

Guidance surfaces are among the most common accessibility failures because they're visual, transient, and pointer-driven. Treat these as acceptance criteria.

## WCAG 2.1/2.2 SC 1.4.13 Content on Hover or Focus (Level AA)
For any content that appears on hover or focus (tooltips, hover cards, hover-revealed hints):
- **Dismissible:** can be dismissed without moving pointer or focus (typically Esc), unless it conveys an input error or doesn't obscure other content.
- **Hoverable:** if hover triggers it, the pointer can move onto the content without it disappearing.
- **Persistent:** stays until the trigger is removed, the person dismisses it, or it's no longer valid. **No timeout.**
- Content triggerable by hover should also be triggerable by keyboard focus.

## Other WCAG criteria that commonly bite
| SC | Applies to | Requirement |
|---|---|---|
| 2.1.1 Keyboard | All guidance | Every tour step, tip, close and "Next" operable by keyboard |
| 2.1.2 No Keyboard Trap | Tours, overlays | Focus can always leave (Esc/close) |
| 2.4.3 Focus Order | Tours | Focus moves into step in logical order; returns to trigger/target on close |
| 2.4.7 / 2.4.11 Focus Visible / Not Obscured | Overlays | Focused element visible, not hidden under the callout |
| 2.2.1 Timing Adjustable | Auto-advancing tours, timed tips | Avoid auto-advance; if unavoidable, allow pause/extend |
| 2.2.2 Pause, Stop, Hide | Pulsing beacons, animated tips | Motion > 5 s must be pausable; respect `prefers-reduced-motion` |
| 1.4.3 Contrast (Minimum) | Tip text | ≥ 4.5:1 (normal text) |
| 1.4.11 Non-text Contrast | Highlights/outlines, beacons | ≥ 3:1 for the highlight ring indicating the target |
| 1.3.1 Info and Relationships | Callouts | Relationship to target exposed programmatically (`aria-describedby`, labelled dialog) not only by arrow |
| 1.4.4 / 1.4.10 Resize & Reflow | Callouts | Works at 200% zoom and 320 CSS px width without clipping |
| 2.5.1 Pointer Gestures | Gesture coach marks | Path-based/multipoint gestures need single-pointer alternative — say so in the tip |
| 3.2.1 On Focus | Focus-triggered tips | No context change on focus |
| 4.1.3 Status Messages | Programmatic tips/toasts | Announced via live region without moving focus (when non-modal) |

## ARIA patterns by surface
- **Tooltip:** `role="tooltip"`, referenced by `aria-describedby` from trigger; never focusable; Esc dismisses; focus remains on trigger. (APG pattern is still marked "work in progress" — verify current guidance.)
- **Toggletip:** button with `aria-expanded`/`aria-controls`; content in a live region (e.g., `role="status"`) so it's announced; Esc/outside click closes.
- **Rich/persistent tip with actions, teaching tip, tour step:** non-modal dialog — `role="dialog"`, `aria-labelledby` (title), `aria-describedby` (body); move focus to the dialog (or its first action) when opened programmatically; Esc closes; return focus sensibly (to the target for interactive steps, to the trigger otherwise). Include step count in the label ("Step 2 of 4: Add a teammate").
- **Blocking overlay / stencil:** if you truly block the rest of the UI, it's modal — `aria-modal="true"`, inert background (`inert` attribute), focus trapped *within dialog + target*, Esc exits the tutorial.
- **Hotspot:** real `<button>` with accessible name ("New feature: Saved filters, show tip"), not a decorative animated div.
- **Spotlight/dim:** the dim layer is `aria-hidden`; never hide the target from assistive tech.

## Screen readers and mobile AT
- The callout text must name the control in words — "Tap here →" is meaningless without vision.
- Announce programmatic tips once; don't re-announce on every re-render.
- Gesture instructions: VoiceOver/TalkBack change gestures; mention the actions rotor / custom actions alternative.
- Native platform components (TipKit, Fluent TeachingTip, Material tooltips) get much of this for free; custom overlays usually don't.

## Touch parity
Tooltips are hover-only by nature. On touch: use toggletips, long-press (non-standard; poor discoverability), persistent helper text, or inline display. Never make hover the only path.

## Cognitive accessibility
- Plain language; one idea per step; consistent placement and style.
- Never auto-advance; let people re-read.
- Everything dismissed can be found again (help menu, "Show tips again" setting).
- Option to turn proactive tips off entirely, and to reset/replay them.

## Game accessibility guidelines (gameaccessibilityguidelines.com) relevant to teaching
- Include contextual in-game help/guidance/tips.
- Indicate/allow reminder of controls during gameplay (memory impairment — let players display controls on the HUD; provide summaries of mechanics taught in tutorials for later reference).
- Configurable hint system: objective reminders, highlight interactive elements by name + visual cue, inventory-combination hints.
- Allow controls to be remapped; prompts must reflect remapping.
- Adjustable game speed; bypass non-core gameplay elements.
- Repeatable, modular tutorials; player-paced text; don't force re-starting a save to re-see a tutorial.
- Test gamepad navigation of every tip (Fluent recommends testing teaching tips with gamepad in all UI configurations).

## Acceptance test script (run for every guidance unit)
1. Keyboard only: open, read, act, advance, go back, close. Focus visible throughout; returns sensibly.
2. Screen reader (VoiceOver + NVDA/JAWS, TalkBack on Android): content announced once, target named, step count announced, close reachable.
3. Esc closes hover/focus content and tours without moving focus.
4. Pointer can move onto tooltip without it closing; no auto-hide.
5. 200% zoom and 320px width: callout readable, not clipped, target not obscured.
6. Reduced motion: no pulsing/large animation.
7. Touch only: every tooltip's info reachable.
8. Contrast checks on text and highlight ring.
9. Gamepad (games/TV/Xbox apps): reachable and dismissible.
