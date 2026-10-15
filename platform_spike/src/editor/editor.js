// Code editor: CodeMirror 6 (vendored, docs/decisions.md D8 and D15) with what a learner needs
// and nothing else: Python highlighting, line numbers, auto-indent, bracket matching, undo,
// completions for the robot API, and two line marks the app drives during replay:
//   showLine(n)            the line the replay is on
//   showError(n, message)  the line that crashed, with the message under it
// Any edit clears both marks, since they describe the last run, not the current code.
import {
  EditorState, StateEffect, StateField, Compartment, EditorView, keymap, lineNumbers,
  highlightActiveLineGutter, drawSelection, Decoration, WidgetType, defaultKeymap, history,
  historyKeymap, indentWithTab, indentOnInput, bracketMatching, syntaxHighlighting, HighlightStyle,
  indentUnit, autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, python, tags,
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

const marksField = StateField.define({
  create: () => Decoration.none,
  update(marks, tr) {
    for (const e of tr.effects) if (e.is(setMarks)) return buildMarks(tr.state, e.value);
    return tr.docChanged ? Decoration.none : marks;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function buildMarks(state, { line, kind, message }) {
  if (!line || line < 1 || line > state.doc.lines) return Decoration.none;
  const at = state.doc.line(line);
  const ranges = [Decoration.line({ class: kind === "error" ? "cm-run-error-line" : "cm-run-line" }).range(at.from)];
  if (kind === "error" && message) {
    ranges.push(Decoration.widget({ widget: new ErrorWidget(message), block: true, side: 1 }).range(at.to));
  }
  return Decoration.set(ranges, true);
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
 */
export function createEditor(parent, { doc = "", onRun = () => {}, onChange = () => {} } = {}) {
  const editable = new Compartment();
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
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
        EditorView.contentAttributes.of({ "aria-label": "Python code", autocapitalize: "off", autocorrect: "off", spellcheck: "false" }),
        // Tab indents (as in every code editor). Keyboard users leave the editor with Esc, then Tab.
        keymap.of([
          { key: "Mod-Enter", run: () => { onRun(); return true; } },
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
    showLine(line) { mark({ line, kind: "current" }); reveal(line); },
    showError(line, message) { mark({ line, kind: "error", message }); reveal(line); },
    clearMarks: () => mark({ line: null }),
    setReadOnly: (ro) => view.dispatch({ effects: editable.reconfigure(EditorView.editable.of(!ro)) }),
    focus: () => view.focus(),
    /** Limit completions to the commands this level allows. */
    setCommands: (names) => { availableCommands = [...names]; },
  };
}
