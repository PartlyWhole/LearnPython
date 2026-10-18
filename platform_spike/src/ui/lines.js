// Counting lines the way the engine's max_lines does (engine.check_constraints): non-blank lines that
// aren't comments. Display only: the engine still decides whether a level passes.
export function countLines(code) {
  return code.split("\n").filter((ln) => ln.trim() && !ln.trim().startsWith("#")).length;
}
