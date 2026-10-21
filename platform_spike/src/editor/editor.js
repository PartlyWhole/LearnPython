// Code editor: CodeMirror 6 (vendored, docs/decisions.md D8 and D15) with what a learner needs
// and nothing else: Python highlighting, line numbers, auto-indent, bracket matching, undo,
// completions for the robot API, and two line marks the app drives during replay:
//   showLine(n, {calls, pass})  the line the replay is on: a band, an arrow in the gutter (a
//                               debugger's "you are here"), the call sites it is inside (a hollow
//                               arrow each) and, in a loop, which pass this is ("2 of 4")
//   showError(n, message)       the line that crashed, with the message under it
// Any edit clears both marks, since they describe the last run, not the current code.
import {
  EditorState, StateEffect, StateField, RangeSetBuilder, Compartment, EditorView, keymap, lineNumbers,
  highlightActiveLineGutter, drawSelection, Decoration, WidgetType, defaultKeymap, history,
  historyKeymap, indentWithTab, indentOnInput, bracketMatching, syntaxHighlighting, HighlightStyle,
  indentUnit, gutter, GutterMarker, autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, acceptCompletion, python, tags,
} from "../../vendor/codemirror.js";
import { API_DOCS } from "./api-docs.js";

// ---------------------------------------------------------------- replay / error marks
const setMarks = StateEffect.define();

class ErrorWidget extends WidgetType {
  constructor(message) { super(); this.message = message; }
  eq(other) { return other.message === this.message; }
  toDOM() {
    const el = document.createElement("div");
    el.className = "cm-run-error";
    el.textContent = this.message;
    el.setAttribute("role", "alert");
    return el;
  }
}

class PassWidget extends WidgetType {
  constructor(n, of, call = false) { super(); this.n = n; this.of = of; this.call = call; }
  eq(other) { return other.n === this.n && other.of === this.of && other.call === this.call; }
  toDOM() {
    const el = document.createElement("span");
    el.className = `cm-run-pass${this.call ? " call" : ""}`;
    el.textContent = `${this.n} of ${this.of}`;
    el.title = this.call ? `Inside call ${this.n} of ${this.of} made on this line` : `This line is running for time ${this.n} of ${this.of}`;
    return el;
  }
}

class ArrowMarker extends GutterMarker {
  constructor(kind) { super(); this.kind = kind; }
  eq(other) { return other.kind === this.kind; }
  toDOM() {
    const el = document.createElement("span");
    el.className = `cm-step-arrow ${this.kind}`;
    el.setAttribute("aria-hidden", "true");
    return el;
  }
}
const HERE = new ArrowMarker("here"), CALL = new ArrowMarker("call"), FAIL = new ArrowMarker("fail");

const NO_MARKS = { deco: Decoration.none, arrows: [] };
const marksField = StateField.define({
  create: () => NO_MARKS,
  update(marks, tr) {
    for (const e of tr.effects) if (e.is(setMarks)) return buildMarks(tr.state, e.value);
    return tr.docChanged ? NO_MARKS : marks;
  },
  provide: (f) => EditorView.decorations.from(f, (m) => m.deco),
});

function buildMarks(state, { line, kind, message, calls = [], pass = null, callPasses = [] }) {
  if (!line || line < 1 || line > state.doc.lines) return NO_MARKS;
  const ok = (n) => Number.isInteger(n) && n >= 1 && n <= state.doc.lines && n !== line;
  const at = state.doc.line(line);
  const ranges = [Decoration.line({ class: kind === "error" ? "cm-run-error-line" : "cm-run-line" }).range(at.from)];
  const arrows = [[line, kind === "error" ? FAIL : HERE]];
  const seen = new Set();
  calls.forEach((c, k) => {
    if (!ok(c) || seen.has(c)) return;
    seen.add(c);
    const at = state.doc.line(c);
    ranges.push(Decoration.line({ class: "cm-call-line" }).range(at.from));
    arrows.push([c, CALL]);
    const p = callPasses[k];
    if (p && p.of > 1) ranges.push(Decoration.widget({ widget: new PassWidget(p.n, p.of, true), side: 1 }).range(at.to));
  });
  if (kind === "error" && message) {
    ranges.push(Decoration.widget({ widget: new ErrorWidget(message), block: true, side: 1 }).range(at.to));
  } else if (pass && pass.of > 1) {
    ranges.push(Decoration.widget({ widget: new PassWidget(pass.n, pass.of), side: 1 }).range(at.to));
  }
  return { deco: Decoration.set(ranges, true), arrows };
}

/** The "you are here" gutter; clicking it (or a line number) asks for that line's next step. */
function stepGutter(onLineClick) {
  return gutter({
    class: "cm-step-gutter",
    markers: (view) => {
      const b = new RangeSetBuilder();
      const { arrows } = view.state.field(marksField);
      for (const [n, m] of [...arrows].sort((a, c) => a[0] - c[0])) b.add(view.state.doc.line(n).from, view.state.doc.line(n).from, m);
      return b.finish();
    },
    initialSpacer: () => HERE,
    domEventHandlers: { mousedown: (view, block) => onLineClick(view.state.doc.lineAt(block.from).number) },
  });
}

// ---------------------------------------------------------------- completions
// Commands offered as completions; the app narrows this per level (hidden commands).
let availableCommands = Object.keys(API_DOCS);

function apiCompletions(context) {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return {
    from: word.from,
    options: Object.entries(API_DOCS).filter(([name]) => availableCommands.includes(name)).map(([name, doc]) => ({
      label: name, type: "function", apply: `${name}()`, detail: doc.returns, info: doc.text,
    })),
    validFor: /^\w*$/,
  };
}

// ---------------------------------------------------------------- theme (colours from CSS variables)
const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "14px", backgroundColor: "var(--surface)", color: "var(--ink)" },
  ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "1.6" },
  ".cm-content": { padding: "8px 0", caretColor: "var(--ink)" },
  ".cm-gutters": { backgroundColor: "var(--bg)", color: "var(--muted)", border: "none" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--ink)" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--ink)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "var(--band) !important" },
  ".cm-run-line": { backgroundColor: "var(--band)" },
  ".cm-run-error-line": { backgroundColor: "var(--band-error)" },
  ".cm-run-error": { color: "var(--danger)", font: "13px var(--sans)", padding: "2px 8px 4px 24px" },
  // Stepping: a call site the current line is inside, the pass badge, the gutter arrows.
  ".cm-call-line": { backgroundColor: "var(--band-call)" },
  ".cm-run-pass": { marginLeft: "12px", padding: "0 7px", borderRadius: "999px", font: "600 11px/1.6 var(--sans)",
    color: "var(--accent)", backgroundColor: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--accent)", verticalAlign: "1px" },
  ".cm-run-pass.call": { color: "var(--muted)", boxShadow: "inset 0 0 0 1px var(--line)" },
  ".cm-step-gutter .cm-gutterElement": { width: "14px", padding: "0 0 0 4px", cursor: "pointer" },
  ".cm-lineNumbers .cm-gutterElement": { cursor: "pointer" },
  ".cm-step-arrow": { display: "inline-block", width: "0", height: "0", verticalAlign: "-1px",
    borderTop: "5.5px solid transparent", borderBottom: "5.5px solid transparent", borderLeft: "8px solid var(--accent)" },
  ".cm-step-arrow.call": { borderLeftColor: "var(--muted)", opacity: "0.55" },
  ".cm-step-arrow.fail": { borderLeftColor: "var(--danger)" },
  ".cm-tooltip": { backgroundColor: "var(--surface)", color: "var(--ink)", border: "1px solid var(--line)" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--accent)", color: "var(--accent-ink)" },
  ".cm-completionInfo": { maxWidth: "260px", font: "13px var(--sans)" },
});

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--code-keyword)", fontWeight: "600" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--code-string)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--code-number)" },
  { tag: tags.comment, color: "var(--muted)", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--code-call)" },
  { tag: tags.definition(tags.variableName), color: "var(--code-def)" },
  { tag: tags.operator, color: "var(--muted)" },
]);

// ---------------------------------------------------------------- public API
/**
 * @param {HTMLElement} parent
 * @param {object} opts
 * @param {string} [opts.doc]
 * @param {() => void} [opts.onRun]     Ctrl/Cmd+Enter
 * @param {() => void} [opts.onChange]  any edit
 * @param {(line: number) => boolean} [opts.onLineClick]  a click on a line number or the arrow
 *        gutter; return true if it was used (jumped the replay to that line)
 */
export function createEditor(parent, { doc = "", onRun = () => {}, onChange = () => {}, onLineClick = () => false } = {}) {
  const editable = new Compartment();
  const shared = new Compartment(); // a room's extensions (src/collab/editor.js), empty alone
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        stepGutter(onLineClick),
        lineNumbers({ domEventHandlers: { mousedown: (view, block) => onLineClick(view.state.doc.lineAt(block.from).number) } }),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        indentOnInput(),
        indentUnit.of("    "),
        EditorState.tabSize.of(4),
        bracketMatching(),
        closeBrackets(),
        python(),
        syntaxHighlighting(highlight),
        autocompletion({ override: [apiCompletions], icons: false }),
        marksField,
        theme,
        editable.of(EditorView.editable.of(true)),
        shared.of([]),
        EditorView.contentAttributes.of({ "aria-label": "Python code", autocapitalize: "off", autocorrect: "off", spellcheck: "false" }),
        // Tab accepts a visible suggestion, otherwise indents (as in every code editor).
        // Keyboard users leave the editor with Esc, then Tab.
        keymap.of([
          { key: "Mod-Enter", run: () => { onRun(); return true; } },
          { key: "Tab", run: acceptCompletion }, // false when no suggestion is open: falls through to indent
          ...closeBracketsKeymap, ...completionKeymap, ...historyKeymap, ...defaultKeymap, indentWithTab,
        ]),
        EditorView.updateListener.of((u) => { if (u.docChanged) onChange(); }),
      ],
    }),
  });

  const mark = (value) => view.dispatch({ effects: setMarks.of(value) });
  const reveal = (line) => {
    if (line >= 1 && line <= view.state.doc.lines) {
      view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.line(line).from, { y: "nearest" }) });
    }
  };

  return {
    view,
    getCode: () => view.state.doc.toString(),
    setCode: (code) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } }),
    showLine(line, { calls = [], pass = null, callPasses = [] } = {}) { mark({ line, kind: "current", calls, pass, callPasses }); reveal(line); },
    showError(line, message, { calls = [], callPasses = [] } = {}) { mark({ line, kind: "error", message, calls, callPasses }); reveal(line); },
    clearMarks: () => mark({ line: null }),
    setReadOnly: (ro) => view.dispatch({ effects: editable.reconfigure(EditorView.editable.of(!ro)) }),
    focus: () => view.focus(),
    /** Put a room's extensions on (or [] to take them off). The text must already be the room's. */
    setShared: (ext) => view.dispatch({ effects: shared.reconfigure(ext) }),
    /** Limit completions to the commands this level allows. */
    setCommands: (names) => { availableCommands = [...names]; },
  };
}
