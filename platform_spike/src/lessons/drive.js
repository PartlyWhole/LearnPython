// Drive mode logic (docs/lessons.md section 3). Pure: no DOM. Each button press appends one
// command to a program; the engine runs the whole program (no game rules here), and this file
// only keeps the program and says in words what a press did, for screen readers.
import { describeCell } from "./demo.js";

const DIR_NAMES = { E: "east (→)", N: "north (↑)", W: "west (←)", S: "south (↓)" };

/** Keyboard shortcuts, active only while focus is inside the drive panel. */
export const DRIVE_KEYS = Object.freeze({ ArrowUp: "move", ArrowLeft: "turn_left" });

export class DriveProgram {
  constructor() { this.lines = []; }
  press(command) { this.lines.push(`${command}()`); return this.code; }
  undo() { this.lines.pop(); return this.code; }
  reset() { this.lines = []; return this.code; }
  get code() { return this.lines.map((l) => l + "\n").join(""); }
  get length() { return this.lines.length; }
}

/**
 * What changed after a press, in words: "Moved to column 3, row 1", "Turned to face north",
 * "Picked a gem. Bag: 1". error is the engine's learner error for a crash, or null.
 */
export function describePress(frame, error) {
  if (error) {
    return { wall: "Bumped into a wall.", no_gem: "No gem here.", empty_bag: "The bag is empty." }[error.kind]
      ?? error.message;
  }
  const action = frame.event?.action;
  if (action === "move") return `Moved forward one cell, facing ${DIR_NAMES[frame.dir]}.`; // no coordinates (D27)
  if (action === "turn_left") return `Turned to face ${DIR_NAMES[frame.dir]}.`;
  if (action === "pick") return `Picked a gem. Bag: ${frame.bag}.`;
  if (action === "put") return `Put a gem down. Bag: ${frame.bag}.`;
  return "";
}
