// Direction vectors. Must match DELTA in engine.py: x grows east, y grows south.
export const DELTA_BY_DIR = Object.freeze({ E: [1, 0], N: [0, -1], W: [-1, 0], S: [0, 1] });

const TURNS = { E: 0, S: 1, W: 2, N: 3 }; // quarter turns clockwise from east

/** Can one robot action take it from a to b? One cell forward, or one quarter turn in place
 *  (or nothing). The renderer animates only these, and snaps any bigger jump (scrubbing, a
 *  replay restarting), so the robot never spins while it slides. */
export function isOneAction(a, b) {
  const cells = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  const quarters = (TURNS[b.dir] - TURNS[a.dir] + 4) % 4;
  return (cells === 1 && quarters === 0) || (cells === 0 && quarters !== 2);
}
