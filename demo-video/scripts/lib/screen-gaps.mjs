// Empty-screen check: a scene's reveals are all timed to the narration, so the seconds before its first
// cue (or after elements have left) can show nothing but the background. `build` warns about them.
//
// What counts as content: every element a template reveals through the kit's reveal helpers (headline
// included), from its reveal time until a template fades it out. What fills the screen without being
// content: a backdrop word, and the chapter intro.
// Chrome (eyebrow, chapter tag) and the background never count. Only gaps that end in a reveal are
// reported, so the close's closing fade-out is exempt, and a beat is punctuation and exempt as a whole.
import { isBeat } from "./house-style.mjs";

export const MIN_EMPTY_SECONDS = 1.0;

const seconds = (x) => (Math.round(x * 10) / 10).toFixed(1);

// intervals: [{ from, until }] in scene seconds (until may be Infinity). Returns the stretches of [0, duration]
// that nothing covers and that last longer than MIN_EMPTY_SECONDS, each ending where the next interval begins.
export function emptyStretches(intervals, duration) {
  const stretches = [];
  let covered = 0;
  for (const { from, until } of [...intervals].sort((a, b) => a.from - b.from)) {
    const next = Math.min(from, duration);
    if (next - covered > MIN_EMPTY_SECONDS) stretches.push({ from: covered, to: next, revealAt: from });
    covered = Math.max(covered, until);
  }
  return stretches;
}

// Warnings for one scene built from the kit (a custom scene has no kit and is not checked).
export function emptyScreenWarnings({ id, scene, intervals, duration }) {
  if (isBeat(scene)) return [];
  if (intervals.length === 0) return [`${id}: nothing is revealed (empty for ${seconds(duration)} s)`];
  return emptyStretches(intervals, duration).map(({ from, to, revealAt }) => {
    const length = seconds(to - from);
    return from === 0 ? `${id}: empty for ${length} s at the start (first reveal at ${seconds(revealAt)} s)` : `${id}: empty for ${length} s from ${seconds(from)} s (next reveal at ${seconds(revealAt)} s)`;
  });
}
