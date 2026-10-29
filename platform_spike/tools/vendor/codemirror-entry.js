// Everything the app uses from CodeMirror, re-exported so esbuild can bundle ONE copy into
// vendor/codemirror.js (several copies of @codemirror/state break CodeMirror). Add exports
// here, then run `npm run vendor`. See docs/decisions.md D15.
export { EditorState, StateEffect, StateField, RangeSetBuilder, Compartment, Annotation, ChangeSet, Transaction } from "@codemirror/state";
export {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, Decoration, WidgetType, gutter, GutterMarker, ViewPlugin,
} from "@codemirror/view";
export { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
export {
  indentOnInput, bracketMatching, syntaxHighlighting, HighlightStyle, indentUnit,
} from "@codemirror/language";
export { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, acceptCompletion } from "@codemirror/autocomplete";
export { python } from "@codemirror/lang-python";
export { tags } from "@lezer/highlight";
