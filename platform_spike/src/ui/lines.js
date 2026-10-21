// Counting lines the way the engine does for max_lines (engine.count_lines): non-blank lines that
// aren't comments. Display only: the engine reports the line bonus (check_level "lines").
export function countLines(code) {
  return code.split("\n").filter((ln) => ln.trim() && !ln.trim().startsWith("#")).length;
}
