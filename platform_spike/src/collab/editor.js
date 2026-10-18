// What the editor wears in a shared room (editor.setShared): the text kept in step with the room,
// the others' carets, this peer's caret sent to them, and a cap on the text's size. Ported from
// Botgineer's src/collab/editor.ts. One calm caret per peer: a 2px bar in their colour, a light
// tint over their selection, and their name, which shows when it moves and then fades.
import { EditorState, StateEffect, StateField, EditorView, ViewPlugin, Decoration, WidgetType } from "../../vendor/codemirror.js";
import { LIMITS } from "./room.js";

export const setPeers = StateEffect.define();

class Caret extends WidgetType {
  constructor(name, color) { super(); this.name = name; this.color = color; }
  eq(other) { return other.name === this.name && other.color === this.color; }
  toDOM() {
    const caret = document.createElement("span");
    caret.className = "cm-peer-caret";
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

function decorate(doc, peers) {
  const out = [];
  const clamp = (n) => Math.max(0, Math.min(doc.length, n));
  for (const p of peers) {
    if (!p.cursor) continue;
    const anchor = clamp(p.cursor.anchor);
    const head = clamp(p.cursor.head);
    if (anchor !== head) {
      out.push(Decoration.mark({ class: "cm-peer-selection", attributes: { style: `--peer: ${p.color}` } })
        .range(Math.min(anchor, head), Math.max(anchor, head)));
    }
    out.push(Decoration.widget({ widget: new Caret(p.name, p.color), side: -1 }).range(head));
  }
  return Decoration.set(out, true);
}

/** Everything the editor needs for `room`. The editor's text must equal the room's code first. */
export function sharedEditor(room) {
  const ours = room.lib.reconcileAnnotationType;
  const sendCaret = (view) => room.shareCursor(() => {
    const { anchor, head } = view.state.selection.main;
    return { anchor, head };
  });
  return [
    room.lib.automergeSyncPlugin({ handle: room.handle, path: ["code"] }),
    // Someone else's typing never moves your caret.
    EditorState.transactionFilter.of((tr) => (tr.annotation(ours) !== undefined && !tr.docChanged && tr.selection ? [] : tr)),
    // A program longer than the room holds is refused (the room's own edits always go through).
    EditorState.changeFilter.of((tr) => tr.annotation(ours) !== undefined || tr.newDoc.length <= LIMITS.code),
    StateField.define({
      create: (state) => decorate(state.doc, room.peers()),
      update(set, tr) {
        for (const e of tr.effects) if (e.is(setPeers)) return decorate(tr.state.doc, e.value);
        return tr.docChanged ? set.map(tr.changes) : set;
      },
      provide: (f) => EditorView.decorations.from(f),
    }),
    ViewPlugin.define((view) => { sendCaret(view); return {}; }),
    EditorView.updateListener.of((u) => { if (u.selectionSet || u.focusChanged) sendCaret(u.view); }),
  ];
}
