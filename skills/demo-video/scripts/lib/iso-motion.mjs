// Choreography of the 3D kit (see iso-kit): the camera (createCamera: focus, orbit, crane, dolly), the packet and its
// trail, and a stop landing or lighting up. Every tween is a fromTo with explicit values, so the timeline is seek-safe;
// elements that start hidden or displaced render that state from time 0 (`first`), the rest only from their own time.
// 3D elements are scaled or moved, never faded: reveals are recorded with k.revealAt, and only the leaf elements
// (label, pulse, lamp) fade.
import { PLAT, stopPose } from "./iso-kit.mjs";
import { animator, fromTo, HIDDEN, SHOWN, TRAVEL } from "./iso-tween.mjs";

export { fromTo, TRAVEL };
// Close on a stop: zoomed in, and lower for a tall object so its label stays clear of the top of the frame.
const CLOSE = { zoom: 1.3, shiftY: 30, perHeight: 0.6 };
const RISE = { seconds: 0.7, ease: "back.out(1.6)" };
const DROP = { from: 260, delay: 0.35, seconds: 0.6, ease: "power3.in" };
export const LABEL_DELAY = 0.8;
const ACT_DELAY = 0.4;
const POP_VOLUME = 0.3;

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
  fromTo(k, `pl${i}`, HIDDEN, SHOWN, t, { dur: RISE.seconds, ease: RISE.ease, first: true });
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

// The 3D camera language for a stage built with createStage (iso-kit). Its moves are seek-safe and chain: each starts
// where the last one ended, so call them in the order they play and do not overlap two moves of one kind.
//   focus  slides the track so a point of the plane comes to the middle of the frame (and zooms the screen wrapper)
//   orbit  turns the world about its vertical axis (the billboards turn back, so labels stay upright)
//   crane  changes the tilt, from a flat top-down view to the isometric one and back
//   dolly  moves the world toward or away from the lens (a true move in perspective, not a zoom)
const DOLLY = { max: 900, min: -1200 };
const ORBIT = { seconds: 4, ease: "power1.inOut" };
const CRANE = { seconds: 2, ease: "power2.inOut" };
const DOLLY_SECONDS = 2.2;
const FOCUS = { seconds: TRAVEL.seconds, zoom: 1, lift: 0 };

const clampDolly = (z) => Math.min(DOLLY.max, Math.max(DOLLY.min, z));

export function createCamera(k, stage) {
  const track = animator(k, "track");
  const cam = animator(k, "cam3");
  const tilt = animator(k, "tilt", { rotationX: stage.tilt.x, z: 0 });
  const spin = animator(k, "spin", { rotation: stage.tilt.z });
  const turners = stage.turners.map((id) => animator(k, id, { rotation: -stage.tilt.z, rotationX: -stage.tilt.x }));
  const rotating = { rotation: false, rotationX: false };
  // The first orbit hands the spin wrapper and every billboard's turn to the timeline in their starting pose; the
  // first crane does the same for the tilt wrapper and every billboard's lean.
  const arm = (axis) => {
    if (rotating[axis]) return;
    rotating[axis] = true;
    (axis === "rotation" ? spin : tilt).hold({ [axis]: axis === "rotation" ? stage.tilt.z : stage.tilt.x });
    turners.forEach((turner) => turner.hold({ [axis]: axis === "rotation" ? -stage.tilt.z : -stage.tilt.x }));
  };
  const trackTo = ({ x, y }) => ({ x: stage.center - x, y: stage.center - y });
  stage.camera = {
    // The view from the start: `focus` ({ x, y } of the plane), `zoom` and `lift` (screen pixels the view sits lower).
    place({ focus, zoom = FOCUS.zoom, lift = FOCUS.lift, dolly = 0 } = {}) {
      if (focus) track.hold(trackTo(focus));
      cam.hold({ scale: zoom, y: lift });
      if (dolly) tilt.hold({ z: clampDolly(dolly) });
    },
    focus(t, focus, { dur = FOCUS.seconds, zoom, lift, ease } = {}) {
      track.move(trackTo(focus), t, { dur, ease });
      const screen = { ...(zoom === undefined ? {} : { scale: zoom }), ...(lift === undefined ? {} : { y: lift }) };
      if (Object.keys(screen).length) cam.move(screen, t, { dur, ease });
    },
    orbit(t, { degrees = 90, dur = ORBIT.seconds, ease = ORBIT.ease } = {}) {
      arm("rotation");
      const turn = spin.state().rotation + degrees;
      spin.move({ rotation: turn }, t, { dur, ease });
      turners.forEach((turner) => turner.move({ rotation: -turn }, t, { dur, ease }));
    },
    crane(t, { tilt: degrees, dur = CRANE.seconds, ease = CRANE.ease }) {
      arm("rotationX");
      tilt.move({ rotationX: degrees }, t, { dur, ease });
      turners.forEach((turner) => turner.move({ rotationX: -degrees }, t, { dur, ease }));
    },
    dolly(t, { z, dur = DOLLY_SECONDS, ease = CRANE.ease }) {
      tilt.move({ z: clampDolly(z) }, t, { dur, ease });
    },
  };
  return stage.camera;
}
