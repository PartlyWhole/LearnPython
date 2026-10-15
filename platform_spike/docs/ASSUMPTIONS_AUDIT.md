# Grid-world platform: assumptions audit

Audit of the recommended foundation (engine in Python, Pyodide in a Web Worker, record-then-replay renderer, levels mapped to the topic graph). Date: 13 Oct 2026.

**How things were checked**
- **Tested:** run in this folder. `engine.py` and `cases.py` were run under desktop CPython 3.12.13 (now `tools/make_golden.py` → `tests/golden_traces.json`). The same files were run in Pyodide 0.26.4 (Python 3.12.1) inside a Web Worker in Chromium, via `index.html` + `worker.js`, served without COOP/COEP headers.
- **Sourced:** checked against documentation or primary pages (links at the end).
- **Reasoned:** argued, not tested.
- **Open:** a hypothesis that needs user testing.

## Verdicts

| # | Assumption | Verdict | Evidence |
|---|---|---|---|
| A1 | Python can run entirely in the browser, in a Web Worker, with no server and no special headers | **Holds** (tested) | Pyodide 0.26.4 loaded in a worker with `crossOriginIsolated=false` and ran all cases. |
| A2 | One engine gives identical results in desktop Python and in the browser | **Holds** (tested) | 5 of 5 cases gave identical trace digests: normal run, wall error, runaway loop, seeded randomness and list-returning sensor. Keep both sides on the same Python minor version (3.12 here). |
| A3 | Every event and error can carry the learner's line number | **Holds** (tested) | Wall error reported on line 7, runaway loop on line 2, and events carry lines. Uses `sys._getframe` and traceback frames tagged with the `<student>` filename. |
| A4 | A step cap catches infinite loops | **Partly false** (tested) | It stopped `while True: turn_left()` at 10,000 steps. It cannot stop a loop that never calls the API (`while True: x += 1`). A wall-clock timeout that terminates the worker is also required. |
| A5 | "Stop" can simply terminate the worker | **Holds, with a cost** (tested) | Terminating stopped a pure-Python infinite loop. The page stayed responsive: its largest gap between 50 ms ticks was 52 ms. But restarting reloaded Pyodide, taking 3.4–4.9 s per stop. Fix: keep a spare pre-warmed worker, or use Pyodide's interrupt buffer, which needs A8's headers. |
| A6 | One warm worker can be reused for fast runs | **Holds only with isolation** (tested) | Naive `runPython` leaked state between runs: run 2 saw run 1's variable. Running each program in a fresh namespace through `run_program` isolated it (`NameError`). Learner `print()` output must also be captured per run. An earlier version of this spike leaked it into its results file, now fixed in `engine.py`. |
| A7 | Record-then-replay avoids the blocking problem; live mode would force solving it | **Overstated** (tested) | Live streaming works without shared memory: the page received 10 events about 100 ms apart while the program was still running, and `time.sleep(0.5)` works in the worker. What does need shared memory or a service worker is the page talking **to a program that is already running**: `input()`, changing speed mid-run, pausing, and interrupting without terminating. Replay is still recommended for scrubbing, stepping back and simplicity, but it is a choice, not a necessity. |
| A8 | Shared memory (`SharedArrayBuffer`) needs cross-origin isolation headers | **Holds** (tested and sourced) | Unavailable on our page without headers. MDN requires a secure, cross-origin-isolated context. Pyodide's interrupts require a worker plus `SharedArrayBuffer`. |
| A9 | Performance is not a concern | **Holds for compute** (tested); rendering not tested | 100,000 API calls took 0.47 s in Pyodide against 0.06 s in CPython, about 7× slower but ample. Animating very long traces and low-end phones are untested. |
| A10 | Startup cost is acceptable | **Qualified** (tested on a Mac only) | About 5.7 MB downloads before the first run (WebAssembly 3.1 MB + standard library 2.3 MB; about 14 MB uncompressed). Load took 1.5–4 s on this Mac. Phones and slow networks are untested. Mitigations: start loading on the intro screen, show the world before Python is ready, and cache with a service worker. |
| A11 | Running learner code in a worker is safe | **False for shared code** (tested) | Learner code can `import js` and reach `fetch`, the worker's location and IndexedDB. That is fine for your own code in your own browser. Programs or levels shared between users must run in a sandboxed, cross-origin iframe or worker with no credentials, or on a server. |
| A12 | `ast` checks can enforce level constraints (max lines, banned constructs) | **Holds for teaching, not for security** (reasoned) | Good enough to guide learners. They are easy to bypass (`exec`, `getattr`), so never rely on them as a security boundary. |
| A13 | CodeMirror 6 works better than Monaco on phones | **Supported, but by community reports** (sourced) | Monaco intercepts touch events, breaking scrolling and selection (GitLab issue, freeCodeCamp, Babylon.js forum); no official Monaco statement either way. CodeMirror says it uses the phone's native selection and editing. Test on real devices. |
| A14 | Saving progress locally (IndexedDB) is fine to start | **Qualified** (sourced, secondary) | Safari, and every browser on iOS, deletes script-writable storage including IndexedDB after 7 days of browser use without visiting the site. Fine for a prototype; real learners need export or accounts. |
| A15 | Hidden test worlds push learners toward general solutions | **Practice supported; effect not verified** (sourced) | Stanford CS106A's Karel assignment requires solutions to work in several worlds (Checkerboard lists 8, from 1×1 to 40×40). There they are listed, not hidden, and tested by hand. Whether hidden worlds help learning is untested. |
| A16 | Classic Karel can only teach control flow and functions; data-returning sensors extend it | **Fact holds** (sourced); **extension feasible** (tested); value open | Pattis's 1981 Karel had no variables, data, numbers or strings. `scan()` returning a list works and is identical in both runtimes. Its teaching value is untested. |
| A17 | Replay with scrubbing and step-back helps learning | **Open** | A plausible hypothesis; no evidence checked here. |
| A18 | Tagging levels with topic IDs enables mastery gating and review | **Open** | A design hypothesis. Levels practise several topics at once, so tagging probably needs to be at knowledge-point level. Untested. |
| A19 | Code in Place's `karel` package shouldn't be reused | **Holds** (checked) | Its wheel metadata declares no licence (Author "TJ", Code in Place). The source repo is private (`CodeinPlace/cip`, referenced in a code comment). The Karel idea itself dates from Pattis 1981 and is widely reimplemented. This is not legal advice. |
| A20 | Stack: TypeScript, React or Svelte, Vite, PixiJS or SVG, Playwright | **Preference** | Conventional choices; nothing here depends on them. |

## Changes to the recommendation

1. **Two stop mechanisms:** a step cap for loops that call the API, plus a wall-clock timeout that terminates the worker. Keep a spare pre-warmed worker so stopping doesn't cost a 3–5 s reload.
2. **Isolate every run:** a fresh namespace, a fresh world, and captured `print()` output (now in `engine.py`).
3. **Replay stays the default for its learning features,** not because live mode is impossible. Add live streaming later if wanted. Only `input()`, mid-run control and soft interrupts need COOP/COEP headers or a service worker.
4. **Sandbox shared code** before allowing sharing of programs or levels that contain code.
5. **Plan beyond local storage** (export or accounts) before real learners rely on it, because of Safari's 7-day deletion.
6. **Test early on phones:** load time, memory and the editor.

## Files

| File | What it is |
|---|---|
| `engine.py` | Minimal engine and student API (move, turn_left, front_is_clear, pick, gems_here, scan, coin_flip), with trace recording, line numbers, step cap and output capture |
| `cases.py` | The world and five test programs |
| `tools/make_golden.py` → `tests/golden_traces.json` | Desktop run; now the cross-runtime contract checked by `tests/test_contracts.py` (these files were renamed after the audit) |
| `index.html` + `worker.js` | Browser run (Pyodide 0.26.4 from jsDelivr). Serve the folder over http and open `index.html`; results appear on the page. |

## Sources

- [PyodideU (SIGCSE 2024)](https://sigcse2024.sigcse.org/details/sigcse-ts-2024-Papers-1/34/PyodideU-Unlocking-Python-Entirely-in-a-Browser-for-CS1)
- [Pyodide: interrupting execution](https://pyodide.org/en/stable/usage/keyboard-interrupts.html)
- [MDN: SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
- [CodeMirror](https://codemirror.net/)
- Monaco on touch devices:
  - [GitLab issue 28738](https://gitlab.com/gitlab-org/gitlab/-/issues/28738)
  - [freeCodeCamp forum](https://forum.freecodecamp.org/t/backspace-button-on-tablet-not-working/274828)
  - [Babylon.js forum](https://forum.babylonjs.com/t/playground-code-editor-support-for-touch-devices/52171)
- Safari's 7-day storage cap:
  - [Didomi](https://docs.didomi.io/releases-and-announcements/announcements/apple-implements-7-day-cap-on-script-writable-storage)
  - [Simo Ahava](https://www.simoahava.com/privacy/first-party-cookies-webkit-revisited/)
  - [The Register](https://www.theregister.com/2020/03/26/apple_relax_were_not_totally/)
- [Stanford CS106A, Assignment 1: Karel](https://web.stanford.edu/class/archive/cs/cs106a/cs106a.1268/assignments/1-karel/)
- Karel and Pattis (1981):
  - [Creative Computing, 1983](https://www.atarimagazines.com/creative/v9n4/154_Karel_the_robot.php)
  - [Computer History Museum](https://www.computerhistory.org/collections/catalog/102786601)
  - [Open Book Project](https://www.openbookproject.net/py4fun/karel/karel.html)
