// Learner-facing descriptions of the robot API, used for editor completions and the hint line.
// Keys must equal API_NAMES in engine.py (checked by tests/js/api-docs.test.mjs).
export const API_DOCS = Object.freeze({
  move: { returns: "", text: "Move one cell forward. Crashes if a wall is in front." },
  turn_left: { returns: "", text: "Turn 90° to the left, staying on the same cell." },
  front_is_clear: { returns: "→ bool", text: "True if the robot can move forward without hitting a wall." },
  pick: { returns: "", text: "Pick up one gem from this cell and put it in your bag. Crashes if there is none." },
  put: { returns: "", text: "Put one gem from your bag on this cell. Crashes if the bag is empty." },
  gems_here: { returns: "→ int", text: "How many gems are on this cell." },
  scan: { returns: "→ list", text: "A list of gem counts for each cell ahead, up to the next wall." },
  coin_flip: { returns: "→ bool", text: "True or False at random (repeatable: the same run gives the same flips)." },
});
