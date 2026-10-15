# 03 — Coach Marks, Instructional Overlays, Spotlights, Feature-Discovery Targets

A **coach mark** is a short annotation layered over the live UI pointing at a specific control, usually on mobile. An **instructional overlay** is the full-screen version (often a dimmed screen with several hand-drawn arrows). A **spotlight / tap target** (Material feature discovery) circles one control and dims the rest.

## Verdict from evidence
- NN/g: overlays that annotate many controls at once overwhelm short-term memory and make the app look complicated; people dismiss them instantly. A *single* short tip at the moment an action becomes possible is effective, and people often imitate the action right away to check they understood.
- NN/g found coach marks/overlays suffer the same "made it seem harder" effect as deck-of-cards tutorials when used as launch-time stacks.
→ **One coach mark, one action, at the moment it's relevant.**

## When to use
- A non-obvious **gesture** (swipe to archive, long-press, pinch) or hidden control that can't reasonably be made visible.
- A **new or moved** control, shown the first time the person visits that screen after the change.
- A control that unlocks clear value and analytics show it's undiscovered by people who'd benefit.

## When NOT to use
- To label conventional controls (back, share, settings gear).
- As a launch sequence of several marks.
- When the person is mid-task with time pressure.
- On top of other overlays (keyboard up, sheet open, permission dialog).

## Design rules
1. **One mark per screen visit.** If more than one is truly needed, they belong on different screens/moments.
2. **≤ ~10 words** where possible; lead with the verb ("Swipe left to archive").
3. **Point precisely** — arrow/caret to the control; spotlight cutout matches its shape.
4. **Make the target live**: tapping the highlighted control performs its action *and* dismisses the mark (Material: tapping the target proceeds). Tapping elsewhere dismisses.
5. **Visually distinct from UI:** NN/g suggests a different font/hand-drawn style signals "annotation, not a control." Don't reuse that style for real UI.
6. **Don't block for long:** dim modestly; no timer-based disappearance before the person can read it (accessibility); no auto-advance.
7. **Explain the benefit, not the widget**: "Pin chats you check often" > "This is the pin button".
8. **Once means once:** persist dismissed state; invalidate if the person performs the action unprompted.
9. **Motion** (Material): a subtle reveal shows where the target originates; pulse sparingly and respect reduce-motion.

## Material feature discovery (reference pattern)
- **Single-tap actions** → tap target (+ hint text).
- **Actions needing more than one interaction** → guided flow: tap target introduces the benefit, ripples guide subsequent steps (match tap target color), a **completion toast** confirms success and offers a way back to where it started.

## Mobile specifics
- Respect safe areas, notches, and orientation changes; re-anchor on rotate/resize/keyboard.
- Ensure the spotlighted element stays reachable by thumb and isn't covered by the callout.
- Platform frameworks: iOS **TipKit** (`popoverTip`, `TipView`) gives rules, frequency, max count and invalidation for free — prefer it over custom overlays on Apple platforms. Android: TapTargetView-style feature discovery or Compose `RichTooltip` (persistent).

## Accessibility
- Screen readers: announce the mark when shown (live region or move focus to it), provide a labeled dismiss button; the visual-only arrow means nothing to VoiceOver/TalkBack users — the text must name the control ("Double-tap and hold a message to react").
- Gesture coach marks must state an alternative where one exists (VoiceOver users can't swipe the same way; mention the actions menu).
- See 08.

## Anti-patterns
- The "chalkboard overlay": a dimmed launch screen covered with arrows to every button.
- Mark that covers the control it describes.
- Mark that requires tapping "Got it" before the real control works.
- Same mark reappearing after reinstall/login when the server knows they used the feature.
