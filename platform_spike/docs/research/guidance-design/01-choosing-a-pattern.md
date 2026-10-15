# 01 — Choosing a Pattern

Pick the *least intrusive* pattern that solves the actual learning problem. Work through the tree top to bottom and stop at the first fit.

## Decision tree

```
0. Is there a real learning problem? (evidence: usability test, support tickets,
   funnel drop, feature never used by people who would benefit)
   └─ No  → Don't add guidance. Stop.
   └─ Yes ↓
1. Can a design change remove it? (visible label, clearer affordance, better default,
   sensible empty state, inline helper text, undo instead of warning)
   └─ Yes → Do that. Re-test. Stop if solved.
   └─ No ↓
2. Is the information REQUIRED to complete the task? (format rules, consequences)
   └─ Yes → Persistent inline text near the field/control. NOT a tooltip/tour.
   └─ No ↓
3. Is it a label/explanation for ONE element the person is already looking at?
   ├─ Pointer/keyboard UI, ≤ ~1 short sentence → Tooltip (04)
   ├─ Touch UI, or needs links/longer text     → Toggletip / popup tip / rich tooltip (04)
   └─ Optional "learn more" the person may seek → Hotspot/beacon or "?" toggletip (04)
4. Is it ONE action the person hasn't discovered (gesture, hidden menu, new feature)?
   → Contextual tip / coach mark / teaching tip, shown when they reach that screen
     or perform a related action, once (03, 06)
5. Is it a MULTI-STEP task the person is trying to do right now?
   → Interactive guided flow on the real UI, step shown beside each step (05, 02)
     – Started by the person (launcher, checklist, empty-state CTA) preferred
6. Is the whole paradigm NOVEL to this audience (new interaction model, unconventional
   mechanics, physical device)?
   → Short interactive tutorial, skippable, replayable (05; games: 07)
7. Is it a set of setup tasks needed to reach first value?
   → Onboarding checklist + task-shaped setup flow (05)
8. Is it "what's new" for existing users?
   → Contextual tip at the changed place on first encounter + a persistent
     "What's new" entry. Avoid launch modals (06).
9. Is the person stuck (repeated failure, idle, error, rage-clicking)?
   → Rescue help: escalating hints, offered not imposed (06; games: 07)
```

## Pattern selection matrix

| Pattern | Trigger | Intrusiveness | Content size | Best for | Avoid when |
|---|---|---|---|---|---|
| Inline helper text | Always visible | None | 1 line | Required info, field rules | Info is rarely needed by anyone |
| Tooltip | Hover / focus | Very low | 1–8 words (≤ ~150 chars) | Naming icons, brief clarification | Touch-only, critical info, interactive content |
| Toggletip / popup tip | Click / tap on ⓘ/? | Low | 1–3 sentences + link | Optional detail, touch UIs | Info everyone needs |
| Hotspot / beacon | Visible marker → opt-in | Low | Small card | Advertising optional learning | Many on one screen |
| Rich tooltip / teaching tip | Programmatic or on interaction | Medium | Title + 1–2 sentences + ≤2 actions | Feature discovery at point of use | More than one at a time |
| Coach mark / spotlight | Programmatic (screen reached) | Medium–high | 1 short sentence | Single hidden gesture/control | Sequences; launch-time stacks |
| Product tour (passive "next, next") | Launch or opt-in | High | 3–4 steps, ~20 words each | Orientation in a dense, novel layout | Tasks — use interactive flow instead |
| Interactive walkthrough | Opt-in or task start | Medium | One step per real action | Multi-step tasks, complex setup | Simple/conventional actions |
| Blocking stencil | Programmatic | Very high | One step | Safety-critical, irreversible first action | General teaching (no measured benefit) |
| Checklist | Persistent widget | Low | 3–7 items | Activation milestones, self-paced | Single-step products |
| Empty state | Container has no data | None | Headline + 1 line + CTA | First-use teaching & first action | — always design these |
| Rescue help / hints | Failure/idle signals | Low → escalating | Hint ladder | Stuck users/players | Before any failure has occurred |
| Game level-design teaching | Encounter in world | None (diegetic) | Zero text | Core mechanics | Abstract system rules (use UI) |

## Combining patterns (common good stacks)

- **SaaS new user:** welcome screen that asks 1–2 questions → empty state with CTA → checklist (3–5 items) → each item launches a short interactive flow → contextual tips appear later when features are first reached → help center/search always available.
- **Mobile consumer app:** no launch tutorial; permission priming at the moment of need; one coach mark for a non-obvious gesture on first reach of that screen; TipKit-style tips with frequency caps.
- **Game:** diegetic first level (safe encounter → practice → test) → on-screen control prompts that fade after successful use → contextual prompts for new mechanics at first encounter → codex/"how to play" re-readable → escalating hints/assist after repeated failure.

## Red flags that the wrong pattern was chosen
- A tour step says "Here you can…" about a control the person isn't using → should be a contextual tip later or nothing.
- A tooltip contains a password rule → inline text.
- A coach mark sequence of 5+ marks at launch → split into contextual tips or remove.
- A stencil tutorial for a conventional action (tap Save) → remove.
- Guidance that explains what a well-labeled control already says → remove.
