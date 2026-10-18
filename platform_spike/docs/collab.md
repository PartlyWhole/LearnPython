# Shared rooms

Two or more people can work on one level together, live: the people icon in the header ("Work
together") creates a link. Whoever opens it joins the room: the code is merged as both type, the
others' carets show in their colours, Run runs for everyone, scrubbing a replay moves everyone's,
and Continue (or a level from the list) moves the whole room on. Leave goes back to working
alone. A lean port of Botgineer's rooms (`~/Botgineer/docs/COLLAB.md`). Decision D23.

| Path | What |
|---|---|
| `src/collab/room.js` | `Room`: create, join, presence, shape checks on everything received, leave |
| `src/collab/editor.js` | what the editor wears in a room: the sync plugin, the others' carets, a size cap |
| `src/collab/build.js` | this page's build (`dev`; `tools/build_site.py` stamps the commit) |
| `src/runtime/sandbox.js` | the sandbox frame the workers run in, in a room |
| `src/runtime/validate.js` | checks on what a sandboxed worker sends back |
| `vendor/collab.js` | Automerge and automerge-repo, bundled (`npm run vendor:collab`). Generated: never edit. Loaded only on Share or on opening a room link |
| `tests/js/room.test.mjs`, `sandbox.test.mjs`, `validate.test.mjs` | the checks above |

## The room

One Automerge document per room; its URL is the room's name and its key.

```
{ v: 1, level, code, run: { id, by, level, source } | null }
```

**Every peer runs every run itself.** A run in the room is only the program and the level. Each
browser runs it in its own sandbox and replays its own result. The engine is deterministic (seed
0, invariant 8), so everyone sees the same replay, and nothing one peer computed is ever drawn on
another peer's page (Botgineer shares packed traces instead; we don't need to). A partner's run
that arrives during your own waits for it. A joiner is shown the last run if the code hasn't
changed since.

**Presence** (ephemeral, never in the doc): a made-up name ("Plucky Otter"), a colour from a fixed
palette, the caret as an Automerge cursor (a place that survives typing), the replay step, and the
level the page is showing.

**Levels.** The room's `level` is authoritative: a room link opens the room's level, locked or
not. Moving on writes the new level and its starter code, then reloads into it. The others follow
once the mover is back in the room on the new level (or after 8 s), so somebody always holds the
document; with tabs-only transport, everyone reloading at once lost the room.

**Not shared:** demos (off in a room), the step-by-step guide's state, hints, drafts (a room's code
is not saved as your draft), drive-mode levels (Share is hidden there).

## Safety: the relay is a private server, and a partner's code runs on your page

1. **Partner code runs only in the sandbox** (`src/runtime/sandbox.js`). In a room (and from the
   moment you press Create link) the Python workers run inside a hidden iframe with
   `sandbox="allow-scripts"` and no `allow-same-origin`, so an opaque origin: no cookies, no
   localStorage or IndexedDB of this site (your progress), no access to the page. Its own CSP
   allows network only to the Pyodide CDN: code can't send anything anywhere, not even to the
   relay. Checked in the browser: `fetch`, `XMLHttpRequest`, `WebSocket` and `importScripts` to
   other hosts never reached them; `localStorage` and `document` aren't there.
2. **What the sandbox sends back is data** (`validate.js`): a result not shaped like engine output
   (actions, integer coordinates, capped sizes) is refused and reported, never drawn. Code can
   still fake a believable *passing* result, which marks the level solved in that browser: rooms
   are for working together, not for grading.
3. **Everything received from the room is checked** (`readDoc`, `readPeer`): types, id shapes,
   names capped at 40 characters, colours only from our palette, code at 20,000 characters (also
   enforced in the editor). Room data goes into the editor, `textContent` or the sandbox, never
   into HTML (`tests/js/room.test.mjs` checks the room code has no `innerHTML`).
4. **The relay** is PartlyWhole's own server, `wss://sync.partlywhole.org`
   (automerge-repo-sync-server behind Caddy, origin allowlist: `partlywhole.github.io` and
   localhost). It has no accounts: **the link is the key**. Anyone holding it can read and edit
   the room, and it can't be revoked. Documents are stored unencrypted and deleted 90 days after
   last use. The Share dialog says so, and names are made up: nothing personal is sent unless
   someone types it. The page connects to the relay only on Share or a room link; a solo page
   loads no Automerge and opens no socket.
5. Only a local dev server can point the room at another relay (`window.__learnPythonRelay`).

## Transports and testing

The relay plus BroadcastChannel between tabs of one browser, both at once. `?transports=tabs` on
the page (or `via=tabs` in a link) uses tabs only, with no network: how to test.

Browser check (two tabs of one browser): open `app.html?level=first_steps&transports=tabs`, Create
link, open the link in a second tab. Check that typing shows in both, with a caret; Run in one
replays in both; stepping back in one moves the other; a solved level's Continue moves both; Leave
returns to solo (no iframe on the page).
