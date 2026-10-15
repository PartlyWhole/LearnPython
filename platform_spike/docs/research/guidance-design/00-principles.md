# 00 — Principles and the Evidence Behind Them

Everything in this set derives from a small body of evidence. Know it well enough to defend a decision.

## Vocabulary

| Term | Meaning |
|---|---|
| **Onboarding** | Umbrella for everything that brings a new user/player to competence and value. Not one screen; a journey over days/weeks. |
| **Walkthrough / product tour / guided tour** | An ordered sequence of steps that leads the person through the interface, usually highlighting one element per step. |
| **Coach mark / instructional overlay** | A hint layered on top of the UI pointing at a control (often with the rest of the screen dimmed — a "spotlight"). Standard mobile term. |
| **Tooltip** | Brief text shown on hover or keyboard focus of an element; user-triggered; non-interactive; disappears on leave. |
| **Toggletip / popup tip** | Click/tap-triggered small popup (usually from an "i" or "?" icon). The touch-friendly sibling of the tooltip. |
| **Rich tooltip / teaching tip / teaching popover** | Larger callout with title, body, optional image/actions, anchored to an element (Material rich tooltip, Fluent TeachingTip/TeachingPopover, Apple TipKit popover tip). |
| **Hotspot / beacon** | A pulsing dot or marker signaling "there's a tip here" that the person can choose to open. A pull-style entry point. |
| **Interactive tutorial** | The person performs the real actions while being guided (vs. reading about them). |
| **Stencil / blocking tutorial** | An interactive tutorial that disables everything except the target control until the step is done. |
| **Contextual help / JIT guidance** | Help that appears in the place and moment it's relevant. |
| **Push revelation** | Help pushed regardless of current context (launch tour, "what's new" modal). |
| **Pull revelation** | Help triggered by a signal that the person would benefit now (reached the feature, hovered, failed). |
| **FTUE** | First-time user experience — games/mobile term for the first session(s). |

## The core evidence

### E1. People skip instructions and start doing (the paradox of the active user)
Carroll & Rosson (IBM, 1987) observed that new users skip manuals and dive straight into their task, even though up-front learning would save time later. Carroll's response was **minimalism**: the *Minimal Manual* (short, task-oriented, supports active exploration) and the *Training Wheels* word processor (advanced functions disabled so novices can explore basics safely). Minimal-manual learners finished faster with fewer errors than learners given conventional manuals.
**Implication:** design for people who won't read; organize guidance around real tasks; let them act immediately; reduce the space they can get lost in rather than lecturing them.

### E2. Front-loaded app tutorials don't improve performance — and can hurt perception
NN/g tested deck-of-cards (swipe-through) tutorials on 4 mobile apps with 70 users split into tutorial vs. skip groups. The tutorial group did **not** do better: task success 91% vs. 94%, ease rating 4.92 vs. 5.49, mean task time ~93s vs. ~85s. Reading the tutorial made apps seem *more* complicated. The same effect was observed with coach marks and overlays.
NN/g's follow-up synthesis: tutorials interrupt, are often skipped, are quickly forgotten, and require memorizing out-of-context info. Exceptions: genuinely novel interaction paradigms (they cite AR) and interactive tutorials the user chooses to launch and can revisit.

### E3. In games, tutorial value depends on complexity; context helps; forcing doesn't; help buttons can backfire
Andersen et al., CHI 2012 — multivariate experiment, 8 tutorial conditions × 3 games, >45,000 players:
- **Complex, unconventional game (Foldit):** context-sensitive tutorials → +75% levels completed, +29% play time vs. none. Context-sensitive beat an up-front manual by +40% levels, +16% time.
- **Simpler, genre-typical games (Refraction, Hello Worlds):** tutorials had no significant positive effect; in one case slightly *lower* return rate.
- **Blocking/stencil tutorials** (forcing the player to perform the action): no evidence of improved engagement in any game.
- **On-demand help button** with no other tutorial: helped in Foldit (+~12% time), but in Refraction players completed 12% fewer levels and played 15% less; only 31% ever opened it.
- Authors' conclusion: players learn more from experimentation than from text; design early levels to maximize safe discovery; test tutorials because effects are counterintuitive (all four hypotheses were wrong or incomplete).
Contrast: Kelleher & Pausch (CHI 2005) found stencil tutorials let users *finish a tutorial* faster with fewer errors than paper. Finishing a tutorial ≠ engagement or retention.

### E4. Short tours get finished; long ones don't (vendor benchmarks — calibration only)
Chameleon (in-app guidance vendor) benchmark reports across hundreds of millions of interactions:
- 2019: average completion 61%; progress indicators +12% completion and −20% dismissals; **self-started tours completed 123% more often**; checklist-launched tours 21% more likely to complete; attention drops sharply after ~4 steps.
- 2020: 3-step tours ~66% completion; completion < 50% beyond ~5 steps; sharp drop past 8; launcher-started tours ~50% regardless of length.
- 2024: average completion ~33.5%; tours over four steps fall below average (five steps ≈ 21.6%); adding video slightly lowered completion (~29%); average step ≈ 23 words.
Method and customer mix change year to year, so don't compare years. Stable signals: **shorter is better; opt-in is far better; showing progress helps.**

### E5. Contextual/just-in-time guidance outperforms out-of-context guidance — when it's accurate
NN/g: favor pull over push; make help dismissible *and* re-findable; use progressive disclosure; never require memorization across steps; skip the obvious; trigger from real signals found via task analysis. Clippy is the canonical failure of pull revelation done badly: intrusive, didactic, and wrong about intent. Andersen (E3) and situated-learning theory (Lave & Wenger; Gee) concur: teach right before use.

### E6. Human attention and memory limits (game UX / cognitive psychology)
Hodent (former Epic/Fortnite UX director): perception is subjective, attention is scarce, memory is fallible (Ebbinghaus forgetting curve). People can barely attend to tutorial text while also under gameplay pressure — don't ask them to multitask. Spread learning over time; reinforce with practice; motivation via competence, autonomy, relatedness (Self-Determination Theory).

### E7. Platforms have converged on rule-driven, rate-limited tips
Apple TipKit (2023): tips have **eligibility rules** (parameter-based state and event-based "has the user done X N times") plus a **global display frequency** and per-tip **max display count**; tips invalidate when the person performs the action. Microsoft Fluent: teaching tips should not appear too often. Material: feature discovery uses one tap target per discovery, guided flows end with a completion confirmation. Encode the same discipline in custom systems.

## The ten principles

| # | Principle | Primary evidence |
|---|---|---|
| P1 | **Remove the need first.** Every tip is a bug report against the UI. Fix labels, affordances, defaults, empty states; then guide what remains. | E1, E2, NN/g tooltip guidance |
| P2 | **Pull over push.** Trigger on signals of need. Launch-time tours only for genuinely novel paradigms or when opted into. | E2, E4, E5 |
| P3 | **Do, don't read.** Real action on the real UI with immediate feedback. | E1, E3, E6 |
| P4 | **One concept at a time, just before it's needed.** Chunk; sequence by dependency; distribute over sessions. | E3, E6, games (07) |
| P5 | **Brief.** ≈ 1–2 sentences per step; ≤ ~4 steps for unrequested tours. | E4, copy (09) |
| P6 | **Respect autonomy.** Always skippable; never forced; never re-forced on restart; doesn't block the person's own task. | E3 (blocking no gain), E2, Adams |
| P7 | **Re-findable.** Anything dismissed can be recovered later in a predictable place. | E5, game accessibility guidelines |
| P8 | **Stateful and rate-limited.** Remember seen/done; cap frequency; don't stack multiple guidance surfaces at once; don't teach what they've already done. | E7 |
| P9 | **Accessible.** Hover ↔ focus ↔ touch parity; dismissible/hoverable/persistent; focus management; no auto-advancing text. | WCAG 1.4.13, APG (08) |
| P10 | **Prove it works.** Measure the downstream behavior against a holdout; playtest with true novices. | E3, E4, Valve/Portal (07) |

## When a front-loaded or forced tutorial *is* justified
- Interaction is genuinely novel to the audience (AR/gesture/physical-device pairing, unconventional game mechanics like Foldit).
- Errors are dangerous or expensive (medical, financial, safety-critical) — but prefer guarded flows and confirmations over lectures.
- Setup is mandatory before any value (permissions, device pairing) — then it's a *setup wizard*, not a tour; keep it task-shaped.
- The person explicitly asked ("Show me around", "Start tutorial").
Even then: make it interactive, short, resumable, replayable.
