# 02 — Walkthroughs / Product Tours

A walkthrough is an ordered sequence of steps that leads the person through the interface, typically highlighting one element per step. There are two very different kinds; name which one you're building.

| Kind | What the person does | Evidence | Use |
|---|---|---|---|
| **Passive tour** ("Next → Next → Done") | Reads and clicks Next | Weak: skipped, forgotten, can make the product feel harder (NN/g); completion falls fast with length (Chameleon) | Orientation to a dense, unfamiliar layout; opt-in only ideally |
| **Interactive walkthrough** | Performs the real action; step advances when the action happens | Stronger: learning by doing; still forgotten if out of context | Multi-step tasks; first run of a complex workflow |

Default to **interactive**, **opt-in**, **task-shaped**.

## When to use
- The person chose to start a task that is genuinely multi-step and non-obvious (configure an integration, build a first report).
- The layout is novel enough that a 3-step orientation prevents a likely failure (e.g., a canvas editor with unusual panel model).
- The person asked: "Show me around", "Take the tour", a checklist item, an empty-state CTA.

## When NOT to use
- Conventional apps (lists, forms, settings) — fix the UI instead.
- To announce features ("We've redesigned!") — use contextual tips at the changed place.
- As a substitute for labels.
- When the person arrived with an urgent task (logins mid-incident, bank dispute) — never interrupt.

## Structure rules
1. **Length:** ≤ 3–4 steps if not requested; opt-in task walkthroughs can be longer *because each step is a real action*, but split anything > ~7 into chapters.
2. **One concept per step.** One highlighted element, one instruction.
3. **Order by the task**, not by the screen layout (top-left to bottom-right tours are a smell).
4. **Start with value:** first step should move toward the person's goal, not describe the logo.
5. **Progress indicator** ("2 of 4") on every step — measurably reduces abandonment.
6. **Exit everywhere:** visible close (×), Esc, "Skip tour". Skipping is not failure; don't nag.
7. **Resume / replay:** store progress; offer "Resume tour" or "Restart" in help menu/launcher.
8. **End with a next action**, not "You're all set!" alone: show where to go next or confirm the result ("Report created — find it in Reports").
9. **Don't stack**: never show a tour while another modal, toast, cookie banner, or tip is up. Queue it.

## Trigger rules
- Prefer **person-initiated**: launcher/"?" menu, checklist item, empty-state button, feature-first-use.
- If auto-triggered: only on first reach of the relevant screen, only once, only when idle (not mid-typing), after the screen has rendered and data loaded, and **never on every login**.
- Suppress for: returning users who already performed the target actions; users who dismissed it; sessions where they arrived via deep link with an evident task.

## Step anatomy

```
[Highlight]  Target element outlined/spotlighted; rest of UI still visible (dim ≤ 50%)
[Anchor]     Callout attached with a caret/arrow pointing at target
[Title]      Optional, 2–5 words, names the outcome ("Add your first teammate")
[Body]       1–2 sentences, imperative, ≤ ~25 words
[Action]     Interactive: the target itself (advance on real event)
             Passive: "Next" (primary), "Back" (secondary)
[Meta]       "2 of 4" · Skip · ×
```

## Advancing logic (interactive)
- Advance on the **real event** (item created, field valid, panel opened) — not on clicking the highlighted element's area.
- If the person does something else, **don't block**: pause the walkthrough, keep a small "Resume" chip; resume when they return.
- If the target element is missing (permissions, feature flag, viewport), **skip the step or end gracefully** — never point at nothing.
- Handle responsive layouts: re-anchor on resize/scroll; scroll target into view; if target is in a closed menu, open it as part of the step or instruct "Open the menu".

## Highlighting/overlay
- Dimming emphasizes, but a full modal overlay that blocks the rest of the UI turns it into a stencil (no evidence of benefit; high annoyance). Allow clicking outside to pause/close unless the step is safety-critical.
- Make the highlighted control actually operable during the step (common bug: overlay swallows the click).
- Visual style should read as **annotation**, distinct from product UI (distinct callout color or style), so people don't confuse the hint with a real control.

## Multi-page / multi-route tours
- Persist the step pointer server-side or in durable storage; resume after navigation and reloads.
- Wait for the target route and element to exist (with timeout) before showing the step.

## Anti-patterns
- Launch tour of 6+ steps describing every panel.
- Tour that restarts on every login or every app update.
- Forced tour with no skip.
- Steps auto-advancing on a timer.
- Tour pointing at elements off-screen or hidden behind a menu.
- Celebratory confetti that delays the actual task.
- Video embedded in step (tends to lower completion; use a link to optional video).

## Implementation notes
- Libraries exist (e.g., Shepherd.js, Driver.js, Intro.js, React Joyride; native: Android TapTargetView/feature-discovery, iOS coach-mark libs like Instructions) — check they meet 08-accessibility before adopting: focus moves into the step, Esc closes, focus returns to the trigger, content announced, not just visual.
- Feature-flag every tour; you'll want to holdout-test it (12).
