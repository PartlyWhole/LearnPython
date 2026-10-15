# 12 — Measuring Guidance

Guidance is a hypothesis: "showing X at moment Y causes behavior Z." Measure Z, against a control.

## Metrics hierarchy
| Level | Metric | Notes |
|---|---|---|
| 1. Exposure | Shown count, unique users shown, eligible-but-capped count | Sanity check that triggers fire |
| 2. Interaction | Primary-action rate, dismiss rate, close-× rate, step drop-off | Diagnostic only — **completion is a vanity metric** |
| 3. **Behavior (primary)** | Taught action performed within window (e.g., feature used within 14 days); repeated use (2nd, 3rd time) | The real goal |
| 4. Outcome | Activation, task success, time-to-value, retention (D1/D7/D30), conversion | What the business cares about |
| 5. Guardrails | Task completion/time on unrelated tasks, error rates, support tickets, satisfaction/ease ratings, uninstalls/churn | Catch harm (NN/g: tutorials lowered perceived ease) |

## Experiment design
- **Holdout**: randomly withhold the guidance (e.g., 10–50%) — the only way to know if people would have discovered it anyway. Andersen et al. found all four of their intuitive hypotheses wrong or incomplete; assume yours may be too.
- Randomize at user level; analyze intent-to-treat (all assigned, not just those who saw it).
- Run long enough for the behavior window and novelty effects.
- Watch heterogeneous effects: novices vs. experienced, segment, platform. A tour that helps novices may hurt experts.
- Multivariate when testing several dimensions (presence × context × blocking × help availability, as in Andersen).

## Benchmarks (calibration, not targets)
- Product tours (Chameleon): avg completion ~61% (2019 report), ~47% (2020 data), ~33.5% (2024); completion drops sharply after ~4 steps (5 steps ≈ 21.6% in 2024); progress indicators +12% completion/−20% dismissal; self-serve/opt-in +123% completion; checklist-launched +21%; average step ≈ 23 words.
- Mobile tutorials (NN/g, n=70): no task-success benefit; lower perceived ease.
- Games (Andersen, n>45k): +29% play time / +75% progress for a complex game; no effect for simpler ones; −12%/−15% from a help button in one game.
- Mobile game D1 retention ~45% cited as a strong FTUE start (practitioner figure; varies by genre).

## Funnels
- **Tour/tutorial step funnel**: shown → step 1 … step n → completed → success behavior. Find the leakiest step; usual causes: step too long, target hard to find, technical issue (load time, bug).
- **Game FTUE funnel**: install → first launch → tutorial start → each tutorial step → tutorial complete → first session end → D1 return. Leaks often come from load times and bugs, not design (devtodev case: slow tutorial loading fixed → +10% D1).
- **Activation checklist funnel**: per-item completion and order.

## Qualitative methods
- **Usability tests with true novices** (never colleagues): watch whether people read, skip, or misread; whether they can do the task 10 minutes later without the tip; ask them to explain what the tip said.
- **Retention test**: re-test a day later — tutorials are "quickly forgotten" (NN/g).
- **Playtesting (games)**: observe silently, don't help; note where players fail, stall, or skip text; Valve playtested Portal from the first room and changed level order and pacing in response.
- **Experienced-user check**: confirm guidance doesn't annoy people who already know.
- **Skill-chain verification (games)**: compare intended teaching order with empirically derived skill chains from telemetry.

## Instrumentation schema
```
guidance.eligible   {id, user, reason}
guidance.shown      {id, user, step?, source: auto|manual, surface}
guidance.step       {id, step, action: next|back|target_completed}
guidance.primary    {id, step?}
guidance.dismissed  {id, step?, method: x|esc|outside|not_now|skip}
guidance.completed  {id, duration_ms}
guidance.invalidated{id, reason}
<success_event>     {…}   # e.g., filter.saved — joined by user & time window
```

## Retirement
Every guidance unit has an owner and a review date. Retire it if: no lift vs. holdout; the UI fix made it redundant; the feature changed; or it's shown to < a meaningful share of eligible users. Guidance debt accumulates like code debt.
