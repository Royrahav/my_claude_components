// direction.camera "drift": each scene's content drifts on its own slow camera move (a zoom of about 4-5.5 % and
// a small pan) instead of the same 2 % push. The move is dealt from the scene's position in the video: six
// distinct moves, stepped by 5 (coprime to 6), so consecutive scenes never move the same way and zoom in and out
// alternate. The size of each is seeded by the position, so builds repeat exactly.
import { seededRandom } from "./direction.mjs";

// [zoom in?, pan x, pan y] as unit directions.
const MOVES = [
  [true, -1, -0.5],
  [false, 1, 0],
  [true, 1, 0.5],
  [false, -1, 0.5],
  [true, 0, -1],
  [false, 0, 1],
];
const STEP = 5;
const ZOOM = { min: 0.04, spread: 0.015 };
const PAN_PX = { min: 6, spread: 4 };
const SEED = 101;

// The camera's start and end state for the scene at `index`: { from, to }, each { scale, x, y }.
export function driftMove(index) {
  const [zoomIn, dirX, dirY] = MOVES[(index * STEP + 1) % MOVES.length];
  const random = seededRandom(SEED + index);
  const zoom = ZOOM.min + random() * ZOOM.spread;
  const pan = PAN_PX.min + random() * PAN_PX.spread;
  const away = { scale: round(1 + zoom), x: Math.round(dirX * pan), y: Math.round(dirY * pan) };
  const home = { scale: 1, x: 0, y: 0 };
  return zoomIn ? { from: home, to: away } : { from: away, to: home };
}

const round = (x) => Math.round(x * 1000) / 1000;
