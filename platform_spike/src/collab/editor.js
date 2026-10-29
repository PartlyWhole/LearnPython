// What the editor wears in a shared room (editor.setShared): the text kept in step with the room,
// the others' carets, this peer's caret sent to them, and a cap on the text's size. Ported from
// Botgineer's src/collab/editor.ts. One calm caret per peer: a 2px bar in their colour, a light
// tint over their selection, and their name, which shows when they arrive or move after a pause,
// then fades (never while they type: PLP's design/collab-presence.md), and on hover.
// A partner's typing is not in your undo history: Ctrl-Z undoes only your own.
import { EditorState, StateEffect, StateField, EditorView, ViewPlugin, Decoration, WidgetType, Transaction } from "../../vendor/codemirror.js";
import { LIMITS } from "./room.js";

export const setPeers = StateEffect.define();

/** A name shows for this long when a peer arrives, or moves after being still for PAUSE_MS. */
export const NAME_MS = 1600;
export const PAUSE_MS = 2500;

/** When each peer's name should show: `seen` remembers each peer's caret and when it last moved.
 *  Returns how long ago the name started showing, or null if it isn't showing. */
export function nameShowing(seen, peer, now) {
  const head = peer.cursor?.head ?? null;
  const was = seen.get(peer.id);
  let shownAt = was?.shownAt ?? null;
  if (!was || (was.head !== head && now - was.movedAt > PAUSE_MS)) shownAt = now;
  seen.set(peer.id, { head, movedAt: !was || was.head !== head ? now : was.movedAt, shownAt });
  return shownAt !== null && now - shownAt < NAME_MS ? now - shownAt : null;
}

class Caret extends WidgetType {
  /** `since`: how long the name has been showing (ms), or null when it's hidden. */
  constructor(name, color, since) { super(); this.name = name; this.color = color; this.since = since; }
  eq(other) { return other.name === this.name && other.color === this.color && (other.since === null) === (this.since === null); }
  toDOM() {
    const caret = document.createElement("span");
    caret.className = this.since === null ? "cm-peer-caret" : "cm-peer-caret announce";
    // Redrawn mid-fade (the caret moved): carry on the same fade, don't start it again.
    if (this.since !== null) caret.style.setProperty("--shown", `${-this.since}ms`);
    caret.style.setProperty("--peer", this.color); // a colour from PEER_COLORS (room.js checks)
    caret.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "cm-peer-name";
    label.textContent = this.name;
    caret.append(label);
    return caret;
  }
  ignoreEvent() { return true; }
}

function decorate(doc, peers, seen) {
  const out = [];
  const now = Date.now();
  const clamp = (n) => Math.max(0, Math.min(doc.length, n));
  for (const p of peers) {
    if (!p.cursor) continue;
    const anchor = clamp(p.cursor.anchor);
    const head = clamp(p.cursor.head);
    if (anchor !== head) {
      out.push(Decoration.mark({ class: "cm-peer-selection", attributes: { style: `--peer: ${p.color}` } })
        .range(Math.min(anchor, head), Math.max(anchor, head)));
    }
    out.push(Decoration.widget({ widget: new Caret(p.name, p.color, nameShowing(seen, p, now)), side: -1 }).range(head));
  }
  return Decoration.set(out, true);
}

/** Everything the editor needs for `room`. The editor's text must equal the room's code first. */
export function sharedEditor(room) {
  const ours = room.lib.reconcileAnnotationType;
  const seen = new Map();
  const sendCaret = (view) => room.shareCursor(() => {
    const { anchor, head } = view.state.selection.main;
    return { anchor, head };
  });
  return [
    room.lib.automergeSyncPlugin({ handle: room.handle, path: ["code"] }),
    // Someone else's typing never moves your caret.
    EditorState.transactionFilter.of((tr) => (tr.annotation(ours) !== undefined && !tr.docChanged && tr.selection ? [] : tr)),
    // Someone else's typing is theirs to undo, not yours.
    EditorState.transactionExtender.of((tr) => (tr.annotation(ours) !== undefined ? { annotations: Transaction.addToHistory.of(false) } : null)),
    // A program longer than the room holds is refused (the room's own edits always go through).
    EditorState.changeFilter.of((tr) => tr.annotation(ours) !== undefined || tr.newDoc.length <= LIMITS.code),
    StateField.define({
      create: (state) => decorate(state.doc, room.peers(), seen),
      update(set, tr) {
        for (const e of tr.effects) if (e.is(setPeers)) return decorate(tr.state.doc, e.value, seen);
        return tr.docChanged ? set.map(tr.changes) : set;
      },
      provide: (f) => EditorView.decorations.from(f),
    }),
    ViewPlugin.define((view) => { sendCaret(view); return {}; }),
    EditorView.updateListener.of((u) => { if (u.selectionSet || u.focusChanged) sendCaret(u.view); }),
  ];
}
