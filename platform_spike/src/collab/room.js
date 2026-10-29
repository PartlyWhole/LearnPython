// A shared room: one Automerge document that several browsers hold, plus who is here. A lean
// port of Botgineer's src/collab/room.ts (docs/collab.md has the long version).
//
//   doc       {learnpython: "room 1", v, level, quest, code, run}: the level (and sub-quest page)
//             the room is on, the editor's text (merged a character at a time) and the last run,
//             replaced wholesale by each new one. The marker tells our rooms from other apps'
//             documents on the same relay (PLP, Librarium)
//   presence  who is here: a name (typed, or made up), a colour, a caret, the replay step they're on.
//             Ephemeral messages, never in the doc
//
// **Every peer runs every run itself.** A run in the doc is only {id, by, level, source}: each
// browser runs `source` in its own sandbox (src/runtime/sandbox.js) and replays its own result.
// The engine is deterministic (seed 0), so everyone sees the same thing, and nothing a peer
// computed is ever drawn on another peer's page.
//
// **Nothing from the room is trusted.** Every field read from the doc or from presence is checked
// for shape and capped in size here (`readDoc`, `peers`); the page only ever puts it in the editor,
// in textContent, or into the sandbox.
//
// **The link is the key.** Anyone holding it can read and edit the room, and there is no taking it
// back. The relay (`RELAY`, PartlyWhole's own server) keeps the document, unencrypted, and deletes
// rooms nobody opens for 90 days. Decision D23.

import { BUILD } from "./build.js";

export const RELAY = "wss://sync.partlywhole.org";
export const TRANSPORTS = Object.freeze(["ws", "tabs"]);
export const LIMITS = Object.freeze({ code: 20_000, name: 40, level: 80 });
export const PEER_COLORS = Object.freeze(["#2a9d8f", "#9b5de5", "#e09f3e", "#43aa8b", "#3a86ff", "#e76f51", "#c9184a", "#6a994e"]);
const NAME_ADJ = ["Plucky", "Zesty", "Nimble", "Cheery", "Snazzy", "Bouncy", "Dapper", "Breezy", "Sunny", "Funky"];
const NAME_ANIMAL = ["Otter", "Panda", "Fox", "Heron", "Lynx", "Gecko", "Wombat", "Axolotl", "Puffin", "Quokka"];

/** A peer heard from within this long is here (checked when read: background tabs throttle the
 *  library's own pruning timer to once a minute). */
export const FRESH_MS = 20_000;
const MARKER = "room 1";
const CURSOR_MS = 40;

const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
export function colorFor(id) {
  let h = 0;
  for (const ch of String(id)) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
  return PEER_COLORS[Math.abs(h) % PEER_COLORS.length];
}

/** `?transports=tabs` (tests, debugging) > the link's `via` > both. */
export function transportsFrom(search, via) {
  const parse = (raw) => {
    if (!raw) return null;
    const got = new Set(String(raw).split(",").filter((t) => TRANSPORTS.includes(t)));
    return got.size ? got : null;
  };
  return parse(new URLSearchParams(search).get("transports")) ?? parse(via) ?? new Set(TRANSPORTS);
}

/** A name someone typed for the room: trimmed, one line, capped; "" if there is none. */
export function cleanName(raw) {
  return typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, LIMITS.name) : "";
}

const isPlace = (v) => v === null || (typeof v === "string" && v.length <= 200);
const isId = (v, cap = LIMITS.level) => typeof v === "string" && v.length > 0 && v.length <= cap && /^[\w.:-]+$/.test(v);

/** The room's document as this page may use it, or null if it isn't one. */
export function readDoc(d) {
  if (!d || typeof d !== "object" || typeof d.code !== "string" || !isId(d.level)) return null;
  if (d.learnpython !== undefined && d.learnpython !== MARKER) return null; // a newer shape, or not ours
  const quest = (v) => (isId(v) ? v : null);
  const r = d.run;
  const run = r && typeof r === "object" && isId(r.id) && isId(r.by) && isId(r.level) &&
    typeof r.source === "string" && r.source.length <= LIMITS.code
    ? { id: r.id, by: r.by, level: r.level, quest: quest(r.quest), source: r.source } : null;
  return { level: d.level, quest: quest(d.quest), code: d.code.slice(0, LIMITS.code), run };
}

/** One peer's presence as this page may show it, or null. */
export function readPeer(peerId, state, lastSeenAt, now) {
  const u = state?.user;
  if (!u || typeof u !== "object" || !isId(peerId) || now - lastSeenAt >= FRESH_MS) return null;
  const c = state.cursor;
  const cursor = c && typeof c === "object" && isPlace(c.anchor) && isPlace(c.head)
    ? { anchor: c.anchor, head: c.head } : null;
  return {
    id: peerId,
    name: typeof u.name === "string" && u.name.trim() ? u.name.slice(0, LIMITS.name) : "Someone",
    color: PEER_COLORS.includes(u.color) ? u.color : colorFor(peerId),
    build: typeof u.build === "string" ? u.build.slice(0, 40) : null,
    level: isId(state.at?.level) ? state.at.level : null,
    cursor,
  };
}

let libPromise = null;
const loadLib = () => (libPromise ??= import("../../vendor/collab.js"));

function makeMe(id, name) {
  return { id, name: cleanName(name) || `${pickOne(NAME_ADJ)} ${pickOne(NAME_ANIMAL)}`, color: colorFor(id) };
}

/** The transports for `via`; `relay` is the WebSocket to the relay, if there is one (its
 *  "peer-candidate" and "peer-disconnected" say when the relay is reached and lost). */
function network(lib, via) {
  const adapters = [];
  let relay = null;
  // A local relay for tests, on a local dev server only.
  const local = ["localhost", "127.0.0.1"].includes(location.hostname) && globalThis.__learnPythonRelay;
  if (via.has("ws")) adapters.push(relay = new lib.WebSocketClientAdapter(local || RELAY));
  if (via.has("tabs")) adapters.push(new lib.BroadcastChannelNetworkAdapter());
  return { adapters, relay };
}

const newId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export class Room {
  constructor(lib, repo, handle, me, via, relay) {
    this.lib = lib;
    this.repo = repo;
    this.handle = handle;
    this.me = me;
    this.url = handle.url;
    this.via = via;
    this.relay = relay;
    // Reached the relay? Known once it answers; a dropped socket retries by itself.
    this.connected = this.reached = Boolean(relay?.remotePeerId);
    this.presence = null;
    this.listeners = new Set();
    this.stepListeners = new Set();
    this.seenStep = new Map();
    this.stepN = 0;
    this.cursorN = 0;
    this.cursorTimer = null;
    this.pendingCursor = null;
    this.placed = new Map();
    this.ticker = null;
    this.emit = () => { for (const fn of this.listeners) fn(); };
    this.onPresence = () => this.readSteps();
    handle.on("change", this.emit);
    relay?.on("peer-candidate", () => { this.connected = this.reached = true; this.emit(); });
    relay?.on("peer-disconnected", () => { this.connected = false; this.emit(); });
  }

  /** Shares `code` for `level` in a new room. */
  static async create({ level, quest = null, code, name }, via) {
    const lib = await loadLib();
    const id = newId("lp");
    const { adapters, relay } = network(lib, via);
    const repo = new lib.Repo({ network: adapters, peerId: id });
    const handle = repo.create({ learnpython: MARKER, v: 1, level, quest, code: code.slice(0, LIMITS.code), run: null });
    await handle.whenReady();
    const room = new Room(lib, repo, handle, makeMe(id, name), via, relay);
    room.start();
    return room;
  }

  /** Joins the room at `url`, or null if it isn't a room or can't be reached in time. */
  static async join(url, via, { name, deadlineMs = 45_000 } = {}) {
    const lib = await loadLib();
    if (!lib.isValidAutomergeUrl(url)) return null;
    const id = newId("lp");
    const { adapters, relay } = network(lib, via);
    const repo = new lib.Repo({ network: adapters, peerId: id });
    try {
      // Take the handle in any state and wait: the relay may say "unavailable" before another
      // tab has answered, and that is not the last word.
      const found = await repo.find(url, { allowableStates: ["ready", "unavailable", "requesting", "loading"] });
      const handle = found.isReady() ? found : await Promise.race([
        found.whenReady().then(() => found),
        new Promise((done) => setTimeout(() => done(null), deadlineMs)),
      ]);
      if (!handle || !readDoc(handle.doc())) throw new Error("not a room");
      const room = new Room(lib, repo, handle, makeMe(id, name), via, relay);
      room.start();
      return room;
    } catch {
      try { repo.shutdown(); } catch { /* best effort */ }
      return null;
    }
  }

  /** "connected"; "connecting" (not reached the relay yet); "offline" (lost it: retrying by
   *  itself); or "tabs" (no relay: tests). */
  status() {
    if (!this.relay) return "tabs";
    if (this.connected && globalThis.navigator?.onLine !== false) return "connected";
    return this.reached ? "offline" : "connecting";
  }

  /** The link that joins this room, for a page at `base` (no query). */
  link(base, level) {
    const via = this.via.size === TRANSPORTS.length ? "" : `&via=${[...this.via].join(",")}`;
    return `${base}?level=${encodeURIComponent(level)}&room=${this.url}${via}`;
  }

  start() {
    this.presence = new this.lib.Presence({ handle: this.handle });
    this.presence.start({
      initialState: { user: { name: this.me.name, color: this.me.color, build: BUILD }, cursor: null, step: null, at: null },
      heartbeatMs: 5000,
      peerTtlMs: 15_000,
    });
    for (const ev of ["update", "snapshot", "goodbye", "heartbeat", "pruning"]) this.presence.on(ev, this.onPresence);
    // A peer that closed without a goodbye sends nothing: repaint on our own beat so they leave the roster.
    this.ticker = setInterval(this.emit, 5000);
  }

  // ------------------------------------------------------------ reading
  doc() { return readDoc(this.handle.doc()); }

  /** Everyone else here now. */
  peers() {
    if (!this.presence) return [];
    const now = Date.now();
    return Object.values(this.presence.getPeerStates().value)
      .map((p) => readPeer(p.peerId, p.value, p.lastSeenAt, now))
      .filter(Boolean)
      .map((p) => ({ ...p, cursor: this.placeOf(p.id, p.cursor) }));
  }

  /** Those here on another build than this page's (they may not understand each other). */
  otherBuilds() {
    if (BUILD === "dev") return [];
    return this.peers().filter((p) => p.build !== BUILD && p.build !== "dev");
  }

  /** A caret's place that survives everyone's typing: "just after this character" as an
   *  Automerge cursor, or null for the very start. */
  place(index) {
    const doc = this.handle.doc();
    if (!doc || index <= 0 || typeof doc.code !== "string") return null;
    try { return this.lib.getCursor(doc, ["code"], Math.min(index, doc.code.length) - 1, "before"); } catch { return null; }
  }

  find(c) {
    if (c === null) return 0;
    const doc = this.handle.doc();
    if (typeof c !== "string" || !doc) return undefined;
    try { return this.lib.getCursorPosition(doc, ["code"], c) + 1; } catch { return undefined; }
  }

  placeOf(peer, c) {
    if (!c) return null;
    const head = this.find(c.head);
    const anchor = this.find(c.anchor);
    if (head === undefined || anchor === undefined) return this.placed.get(peer) ?? null;
    const at = { anchor, head };
    this.placed.set(peer, at);
    return at;
  }

  // ------------------------------------------------------------ writing
  /** Records a run of `source` on `level`; every peer (this one too) runs it. Returns its id. */
  startRun(source, level, quest = null) {
    const id = newId(this.me.id);
    this.handle.change((d) => { d.run = { id, by: this.me.id, level, quest, source: source.slice(0, LIMITS.code) }; });
    return id;
  }

  /** Moves the room to `level`, with `code` in the editor. */
  setLevel(level, code) {
    this.handle.change((d) => {
      d.level = level;
      d.quest = null;
      d.code = code.slice(0, LIMITS.code);
      d.run = null;
    });
  }

  /** Moves the room to a sub-quest page of its level (`quest` an id), or back to the challenge (null). */
  setQuest(quest) {
    if (readDoc(this.handle.doc())?.quest === quest) return;
    this.handle.change((d) => { d.quest = quest; });
  }

  /** Tells the others which level this page is showing (a peer following a level change waits
   *  for whoever moved the room to be back on the new level, so someone always holds the room). */
  shareLevel(level) {
    this.presence?.broadcast("at", { level });
  }

  /** Tells the others which replay step of `runId` this peer moved to. */
  shareStep(runId, index) {
    this.presence?.broadcast("step", { runId, index, n: ++this.stepN });
  }

  /** Tells the others where this peer's caret is, at most every 40 ms. `where` is read when sent. */
  shareCursor(where) {
    this.pendingCursor = where;
    if (this.cursorTimer !== null) return;
    this.cursorTimer = setTimeout(() => {
      this.cursorTimer = null;
      const fn = this.pendingCursor;
      this.pendingCursor = null;
      if (!fn || !this.presence?.running) return;
      const { anchor, head } = fn();
      this.presence.broadcast("cursor", { anchor: this.place(anchor), head: this.place(head), n: ++this.cursorN });
    }, CURSOR_MS);
  }

  // ------------------------------------------------------------ listening
  /** Called on any change to the document or to who is here. */
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /** Called when another peer moves to a replay step. */
  onStep(fn) { this.stepListeners.add(fn); return () => this.stepListeners.delete(fn); }

  readSteps() {
    if (!this.presence) return;
    // Two peers with one colour can't be told apart: the later id takes a colour nobody has.
    const others = this.peers();
    if (others.some((p) => p.color === this.me.color && p.id < this.me.id)) {
      const free = PEER_COLORS.find((c) => !others.some((p) => p.color === c));
      if (free) {
        this.me = { ...this.me, color: free };
        this.presence.broadcast("user", { name: this.me.name, color: free, build: BUILD });
      }
    }
    for (const p of Object.values(this.presence.getPeerStates().value)) {
      const s = p.value?.step;
      if (s && Number.isInteger(s.n) && isId(s.runId) && Number.isInteger(s.index) && s.index >= 0 &&
          (this.seenStep.get(p.peerId) ?? -1) < s.n) {
        this.seenStep.set(p.peerId, s.n);
        for (const fn of this.stepListeners) fn(s.runId, s.index);
      }
    }
    this.emit();
  }

  // ------------------------------------------------------------ leaving
  /** Says goodbye, lets it reach the others, and shuts the transports. */
  async leave() {
    this.goodbye();
    await new Promise((done) => setTimeout(done, 200));
    this.close();
  }

  /** On tab close: the goodbye only (pagehide can't wait for the rest). */
  goodbye() {
    try { this.presence?.stop(); } catch { /* best effort */ }
  }

  close() {
    clearInterval(this.ticker);
    clearTimeout(this.cursorTimer);
    this.handle.off("change", this.emit);
    this.listeners.clear();
    this.stepListeners.clear();
    try { this.repo.shutdown(); } catch { /* best effort */ }
  }
}
