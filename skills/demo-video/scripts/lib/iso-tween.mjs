// Seek-safe tween emitters shared by the 3D kit's motion (iso-motion) and its objects (iso-objects, iso-actors): every
// tween is a fromTo with explicit values, and the animator chains an element's moves so each starts where the last ended.
export const TRAVEL = { seconds: 1.3, ease: "power2.inOut" };

const round = (v) => Math.round(v * 1000) / 1000;
const value = (v) => (typeof v === "number" ? round(v) : JSON.stringify(v));
const props = (o) => `{${Object.entries(o).map(([key, v]) => `${key}:${value(v)}`).join(",")}}`;
// What a property is before anything moves it (the transform identity), for the values an element never declared.
const REST = { scale: 1, scaleX: 1, scaleY: 1, scaleZ: 1, opacity: 1 };
const BASELINE_SECONDS = 0.01;
// A 3D group is hidden by collapsing all three axes: `scale` alone leaves its height standing as a vertical sliver.
export const HIDDEN = { scale: 0.001, scaleZ: 0.001 };
export const SHOWN = { scale: 1, scaleZ: 1 };
// A move on a property starts at least this long after the previous move on it ended: two tweens never touch.
const MOVE_GAP = 0.01;
// A move pushed later than this past its time is reported (k.warnings): it no longer lands on its cue.
const SLIP_WARN = 0.05;

const tweenLine = (k, id, from, to, t, { dur, ease = TRAVEL.ease, first = false }) => {
  const end = { ...to, duration: dur, ease, ...(first ? {} : { immediateRender: false }) };
  return `tl.fromTo("#${k.p(id)}",${props(from)},${props(end)},${round(t)});`;
};

export function fromTo(k, id, from, to, t, options) {
  k.js.push(tweenLine(k, id, from, to, t, options));
}

// An element that moves through states: `move(to, t, { dur, ease })` tweens the properties in `to` from where each one
// last was (`rest` gives the starting values). All the element's starting values are one baseline tween at time 0 (the
// only tween that renders before its own time, so the element waits in its start state until its cue); every move
// has explicit from values and never renders early. Moves go in time order; one that would touch or overlap the
// previous move on a property is started just after it.
export function animator(k, id, rest = {}) {
  const current = { ...rest };
  const free = {}; // per property: when its last move ends
  const baseline = {};
  let baselineAt = -1;
  const valueOf = (key) => current[key] ?? REST[key] ?? 0;
  const setBaseline = (key, start) => {
    baseline[key] = start;
    const line = tweenLine(k, id, baseline, baseline, 0, { dur: BASELINE_SECONDS, first: true });
    if (baselineAt < 0) baselineAt = k.js.push(line) - 1;
    else k.js[baselineAt] = line;
  };
  const startOf = (keys, t) => Math.max(t, ...keys.filter((key) => free[key] !== undefined).map((key) => free[key] + MOVE_GAP));
  return {
    move(to, t, { dur = TRAVEL.seconds, ease = TRAVEL.ease } = {}) {
      const keys = Object.keys(to);
      keys.filter((key) => !(key in baseline)).forEach((key) => setBaseline(key, valueOf(key)));
      const start = startOf(keys, t);
      if (start - t > SLIP_WARN) k.warnings?.push(`#${k.p(id)} ${keys.join(", ")} moves ${(start - t).toFixed(1)} s after its cue (it overlaps the previous move on it)`);
      const pick = (source) => Object.fromEntries(keys.map((key) => [key, source(key)]));
      fromTo(k, id, pick(valueOf), pick((key) => to[key]), start, { dur, ease });
      keys.forEach((key) => {
        current[key] = to[key];
        free[key] = start + dur;
      });
    },
    // The element stands in `state` from the start (a hidden or displaced start).
    hold(state) {
      Object.entries(state).forEach(([key, start]) => {
        current[key] = start;
        setBaseline(key, start);
      });
    },
    state: () => ({ ...current }),
  };
}
