// Choreography of the 3D kit (see iso-kit): the camera, the packet and its trail, and a stop landing or lighting up.
// Every tween is a fromTo with explicit values, so the timeline is seek-safe; elements that start hidden or
// displaced render that state from time 0 (`first`), the rest only from their own time. 3D elements are scaled or
// moved, never faded: reveals are recorded with k.revealAt, and only the leaf elements (label, pulse, lamp) fade.
import { PLAT, stopPose } from "./iso-kit.mjs";

export const TRAVEL = { seconds: 1.3, ease: "power2.inOut" };
// Close on a stop: zoomed in, and lower for a tall object so its label stays clear of the top of the frame.
const CLOSE = { zoom: 1.3, shiftY: 30, perHeight: 0.6 };
const RISE = { seconds: 0.7, ease: "back.out(1.6)" };
const DROP = { from: 260, delay: 0.35, seconds: 0.6, ease: "power3.in" };
export const LABEL_DELAY = 0.8;
const ACT_DELAY = 0.4;
const POP_VOLUME = 0.3;

const round = (v) => Math.round(v * 1000) / 1000;
const value = (v) => (typeof v === "number" ? round(v) : JSON.stringify(v));
const props = (o) => `{${Object.entries(o).map(([key, v]) => `${key}:${value(v)}`).join(",")}}`;

export function fromTo(k, id, from, to, t, { dur, ease = TRAVEL.ease, first = false }) {
  const end = { ...to, duration: dur, ease, ...(first ? {} : { immediateRender: false }) };
  k.js.push(`tl.fromTo("#${k.p(id)}",${props(from)},${props(end)},${round(t)});`);
}

const hold = (k, id, state) => fromTo(k, id, state, state, 0, { dur: 0.01, first: true });

export const closeView = (stop) => ({ track: stopPose(stop), cam: { scale: CLOSE.zoom, x: 0, y: CLOSE.shiftY + CLOSE.perHeight * stop.height } });

// A view is the track's position in plane space plus the zoom wrapper's { scale, x, y } on screen.
export function placeView(k, { track, cam }) {
  hold(k, "track", track);
  hold(k, "cam3", cam);
  hold(k, "trail", { scaleX: 0 });
}

export function moveView(k, from, to, t, dur = TRAVEL.seconds) {
  fromTo(k, "track", from.track, to.track, t, { dur });
  fromTo(k, "cam3", from.cam, to.cam, t, { dur });
}

// The packet rides the road from stop i-1 to stop i, and the trail behind it grows to match.
export function sendPacket(k, stops, i, t, dur = TRAVEL.seconds) {
  const share = (n) => n / (stops.length - 1);
  fromTo(k, "pk", { x: stops[i - 1].cx - stops[0].cx }, { x: stops[i].cx - stops[0].cx }, t, { dur });
  fromTo(k, "trail", { scaleX: share(i - 1) }, { scaleX: share(i) }, t, { dur });
}

// Every label scales with the zoom change that follows it, so it stays readable (zoomed in or out).
export function scaleLabels(k, count, from, to, t, dur) {
  for (let i = 0; i < count; i++) fromTo(k, `lbp${i}`, { scale: from }, { scale: to }, t, { dur });
}

// A stop that was not on the map rises on its cue, its object drops onto it, then it is announced.
export function riseStop(k, stop, t) {
  const { i } = stop;
  k.revealAt(`pl${i}`, t);
  fromTo(k, `pl${i}`, { scale: 0.001 }, { scale: 1 }, t, { dur: RISE.seconds, ease: RISE.ease, first: true });
  fromTo(k, `ob${i}`, { z: DROP.from }, { z: PLAT.h }, t + DROP.delay, { dur: DROP.seconds, ease: DROP.ease, first: true });
  announceStop(k, stop, t + LABEL_DELAY);
}

// A stop already on the map (stands there from the start) is shown as standing.
export function standStop(k, stop) {
  k.revealAt(`pl${stop.i}`, 0);
}

// A standing stop lights: its lamp comes on and it is announced.
export function lightStop(k, stop, t) {
  k.fade(`lamp${stop.i}`, t, 0.5);
  announceStop(k, stop, t);
}

// Its label rises, a pulse ring spreads from it, and its object plays its own motion (if it has one).
export function announceStop(k, stop, t) {
  k.rise(`lbp${stop.i}`, t, 30, 0.5);
  fromTo(k, `pu${stop.i}`, { opacity: 0.9, scale: 0.4 }, { opacity: 0, scale: 1.6 }, t + 0.1, { dur: 1.1, ease: "power2.out" });
  k.sound("pop", t, POP_VOLUME);
  (stop.act?.(t + ACT_DELAY) ?? []).forEach((line) => k.js.push(line));
}
