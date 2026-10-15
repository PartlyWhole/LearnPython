# Guidance surfaces: structure, states, styling

One entry per surface. The behaviour is specified in `docs/lessons.md`. This file covers the markup,
the ARIA, the states and the styling. Follow G-08 (`docs/research/guidance-design/08-accessibility.md`)
where this file is silent.

**Minimal and visual first (D21):** progress dots instead of counts, icon buttons instead of word
buttons, one short line of text. The demo and the guide share one "strip" style (`.strip` in
`app.css`: an accent edge rule on a soft tint).

**Shared style rule:** guidance reads as *annotation*, not as product UI (G-02, G-03). Use one
accent token for all of it (`--guide-accent`, defined in light and dark), a soft panel background
(`--guide-bg`), and the same rounded callout shape everywhere. Highlight rings are at least 3:1 against
their background in both themes. Motion is opacity and transform only, and is dropped under
`prefers-reduced-motion` (as with the gem glow).

## Goal view
- `<figure class="goal-view"><figcaption>Goal</figcaption><svg …/></figure>` beside `#world`,
  about 40% of its size. It stacks under the world when the layout is narrow.
- **Built.** It is rendered by a second `GridRenderer` via `setGoal(goalWorld(world, goal))`. The
  ghost robot (for `end_at`) is the robot shape with a dashed outline. `bag_at_least` and facing-only
  goals are stated in the sentence under the picture.
- Accessibility: the svg is `aria-hidden`. The visible `#goal-summary` sentence (`goalWorld().summary`)
  is the text alternative, so the goal is read once.
- Hint rung 1 can pulse its outline twice (not under reduced motion).

## Lesson list
- It extends the existing Levels dialog: units → lessons → beats (Watch ✓, Guided ✓, levels with
  status). Each beat is a button (replay or open). The lesson's recap shows under its title. This
  is the re-findable codex (G-07).
- Locked lessons are listed but disabled, with the reason ("Solve Plant a row first").

## Demo player
- It replaces the editor's toolbar during Watch: `[◀ Back] [Next ▶] [Replay] [Skip demo]`, plus the step
  counter "3 of 6". The editor is read-only (CodeMirror `EditorState.readOnly`) and shows the step's `code`.
- **Next** animates the text change from the previous step (insertion at about 30 chars/s, with the
  inserted range highlighted). If Next is pressed during the animation, it finishes the animation
  instantly. Under reduced motion the change is applied instantly.
- The caption sits in `#caption-line` (it already exists for replay captions) and is announced through
  `aria-live="polite"`.
- `focus` targets: `editor:<line>` uses a line decoration; `cell:x,y` uses a ring on the cell in the
  SVG; `world`, `goal` and `run` use a ring on the container. One at a time; clear it on the next step.
- **Predict:** `choices` become a radio group plus a **Check** button. `cell` makes the grid cells
  clickable buttons (arrow keys move, Enter picks). The answer shows after the run step, never as a
  gate: "You said column 2. It ended in column 0."
- `run: true` runs through the normal controller and replay, so the speed setting still applies.

## Guide panel (guided try)
```
<section class="guide" role="region" aria-labelledby="guide-step">
  <p id="guide-step" class="guide-count">2 of 4</p>
  <p class="guide-say" aria-live="polite">Indent put() under the loop so it repeats.</p>
  <button>Show me</button> <button>Hide steps</button> <button>Skip</button>
</section>
```
- It sits beside the editor (wide layouts) or between the editor and the world (narrow). It never
  overlaps either.
- States: `step k` → `done ✓` (about 1 s, then step k+1) → … → `finished` (the `done` line plus
  **Next level**). `syntax-error` shows "Fix the red line first" and keeps the step text.
  `hidden` collapses it to a **Show steps** chip.
- Live-region discipline: announce only when the *step index* changes, not on every re-evaluation.
- Focus never moves into the panel by itself. Esc inside the panel hides it and returns focus to the
  editor.
- **Show me** opens an inline diff preview under the panel: added lines highlighted, plus **Use this** and
  **Close**. Use this replaces the doc as one undoable transaction.

## Step-by-step help setting
- A **Settings** button in the header opens a small dialog: a checkbox "Step-by-step help on first
  tries" with one line of explanation: "On a lesson's first exercise, show one step at a time."
- Changing the setting during a guided try applies to the next try. The current one keeps its
  Show steps / Hide steps state.
- The "You're ahead of the guide" offer (§5.5) is a one-time, non-modal callout in the guide
  panel with **Turn off** and **Keep it**. It is never a modal.

## Drive mode
- The editor area is replaced by `<div class="drive">`: a row of command buttons (`move()`,
  `turn_left()`, `pick()`, `put()`, only those allowed), **Undo**, **Reset**, and the **Your moves**
  log (`<ol>` of code lines, read-only, newest line scrolled into view).
- While a press animates, the buttons have `aria-disabled="true"` (they stay focusable). After a
  crash, only Undo and Reset are enabled, and both get the accent ring.
- The live region says what changed after each press: "Moved to column 3", "Turned to face north",
  "Picked a gem (bag 1)", "Bumped a wall: Undo or Reset".
- The prompt text (8 words or fewer) appears above the buttons, not over the world.

## Hint chip
- `<button class="hint-chip">Want a hint?</button>` sits in the results area, under the failing world's
  message. It never floats over the editor or world.
- Opening it shows a non-modal callout with the rung's text (skeletons in a read-only code block
  with a **Copy** button) and **Not now** / **Another hint** (when the next rung is unlocked).
- At most one chip. It is removed on pass.

## Highlight ring (shared)
- `outline: 3px solid var(--guide-accent); outline-offset: 2px; border-radius: inherit`. For SVG
  cells, use a `rect` with the same stroke in a top layer that doesn't take pointer events.
- It does not pulse by default. One gentle pulse (two cycles) only when a hint points at something.
