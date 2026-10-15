# Acceptance checks for guidance pieces

Run the shared checks (§A) plus the section for the piece you built. Do it in light and dark
(`resize_window` `colorScheme` in the browser pane) and at a narrow width (about 380 px).

**Stale modules:** the browser can keep running cached ES modules even after a hard reload. Before
testing, refresh every file you changed with `await fetch(path, {cache: "reload"})` in the page, then
reload. Check `performance.getEntriesByType("resource")` if a change seems to be missing.

**Serving:** the user's server may already be running at `http://localhost:8000` (check the
terminal). If you must start one yourself and it can't read `~/Desktop`, serve an rsync'd copy from the
scratchpad (author-level skill, step 6). **Automation:** use `window.__gemRover` on localhost.
Browser automation may send keys without `keyCode`, so verify Esc/Tab with real `KeyboardEvent`s
that carry `keyCode` before concluding something is broken (CLAUDE.md).

## A. Every piece
1. **Keyboard only:** reach every new control with Tab, use it with Enter/Space, and leave with
   Esc where the piece says so. Focus stays visible and never gets trapped. Focus is never taken
   from the editor without a key press.
2. **Screen-reader text:** live regions announce once per change (watch the region's text in
   `read_page` across two re-evaluations; it must not repeat). Controls have names.
3. **Reduced motion** (emulate it, or add `prefers-reduced-motion: reduce` in devtools): no typing
   animation, no pulses. Everything still works.
4. **Never blocking:** while the piece is visible, the editor accepts typing and Run works. Clicks
   on the world reach the world.
5. **Core loop intact:** a passing run, a failing run, a crash, `while True: x += 1` (stopped at 3 s), Stop.
6. **Light, dark, narrow:** nothing overlaps, and rings and text meet contrast.

## B. Goal view
- On `plant_row`, the goal shows exactly five gems. On `fetch_gem`, a ghost robot shows on `[1,1]` facing east.
- On a level with only hidden-world goals, the main world's goal is shown and nothing leaks from hidden worlds.
- `goalWorld` Node tests cover every goal type, against fixtures produced by the engine.

## C. Demo player
- Next, Back and Replay walk all steps. Back restores the exact previous code.
- Pressing Next during the typing animation completes it instantly. Under reduced motion there is no animation.
- A cell predict works with the keyboard. A wrong guess is shown after the run, never as a gate.
- Skip demo goes to the guided try. The lesson list then shows Watch as skipped, and it can be replayed.

## D. Guide
Use the lesson's own `example`s:
1. Load the starter: the guide shows step 1 of n.
2. For each k, `__gemRover.editor.setCode(example_k)`: the guide shows step k+1 (or `finished`
   after a passing run on the last step).
3. Paste the reference solution: the guide jumps to the run step.
4. Delete back to the starter: the guide returns to step 1.
5. Type a syntax error: "Fix the red line first", with the step text kept.
6. Show me → Use this → Ctrl/⌘+Z restores the learner's code. Progress records `guided+shown` on solve.
7. Hide steps → the chip appears. Show steps → the guide comes back at the computed step. Reload the
   page: hidden stays hidden for this level.
8. With the setting off, the guided try opens unguided, with the Show steps chip.
9. Announcements: the step text is announced once per step change, not on every keystroke.

## E. Drive mode
- On `turn_right` in drive mode, the presses (three lefts, and so on) solve it. The log matches the presses.
- Driving into a wall: the bump shows, presses are disabled, and Undo and Reset are highlighted. Undo re-runs
  and re-enables the buttons.
- The live region text follows each press.
- L1.1: the drive log appears as the editor's code, and running it replays the same drive.

## F. Hint ladder
- Fail `stack_and_step` (or any practice level) twice: the chip appears. Not now hides it until the next failed run.
- The rungs climb only after failed runs, never after idle time alone.
- A solve after a hint records `with: "hint"`. The chip is gone after a pass.

## G. Progress v2
- A format-1 store (`{solved, drafts}`) migrates without losing solved levels or drafts.
- The unlock rule: solving the twist, or all practice levels, unlocks the next lesson. Skipping to the twist and solving it counts.
- A corrupt store falls back to empty without throwing (existing behaviour, still tested).
