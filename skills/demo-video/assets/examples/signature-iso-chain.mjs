// Summary scene (3D): the whole chain of events as a zigzag of stops on the floor, read left to right like a chart.
// On each stop's cue the link from the previous stop grows, the object rises on its lit pad and its name shows; an
// object can act on its own cue (the server crate cracks and breaks, the clock runs, the gears turn, the lock opens).
// The camera starts nearly top-down, like a flat chart, and cranes into the isometric world while it pushes in.
//
// data: { stops: [{ title, kind, note?, at?, act?: { action, at?, args? } }] (4-6) }

const MIN_STOPS = 4;
const MAX_STOPS = 6;
const TILT = { x: 30, z: -10 };
const END_TILT = 56;
const GAP_X = 330; // plane units between stops along the chain
const ZIG = 240; // each stop sits this far in front of or behind the chain's middle line
const PAD = { w: 250, d: 220 };
const STEP = 1.0;
const LINK_LEAD = 0.5;
const LABEL_Z = 290; // every name at one height, so the zigzag alone keeps neighbours apart
const ZOOM = 0.72;
const LIFT = -10;
const START_BACK = -90;
const PUSH_IN = 30;
const END_ROOM = 0.8;

export default function eventChain(k, d, c) {
  const stops = readStops(k, d);
  const stage = k.iso.stage({ tilt: TILT });
  const spots = stops.map((_, i) => spotOf(stage.center, i, stops.length));
  const parts = stops.map((stop, i) => buildStop(stage, stop, i, spots));
  stage.mount();

  const times = arrivals(c, stops);
  parts.forEach((part, i) => arrive(k, part, times[i], i));
  stops.forEach((stop, i) => {
    if (stop.act) parts[i].object.run(stop.act.action, Math.max(c.cue(stop.act.at, times[i] + 0.8), times[i] + 0.5), stop.act.args);
  });
  moveCamera(k, stage, c);
  return { chrome: true };
}

function readStops(k, d) {
  const stops = Array.isArray(d.stops) ? d.stops : [];
  if (stops.length < MIN_STOPS || stops.length > MAX_STOPS) throw new Error(`${k.id}: needs ${MIN_STOPS}-${MAX_STOPS} data.stops, got ${stops.length}`);
  return stops.map((stop, i) => ({ ...stop, title: k.need(stop, "title", `stop ${i + 1}`), kind: k.need(stop, "kind", `stop ${i + 1}`) }));
}

const spotOf = (center, i, count) => ({
  x: Math.round(center + (i - (count - 1) / 2) * GAP_X),
  y: Math.round(center + (i % 2 === 0 ? -ZIG : ZIG)),
});

// Each stop: a pad, its object (hidden until its cue), the link from the previous stop, and its name above it.
function buildStop(stage, stop, i, spots) {
  const spot = spots[i];
  const pad = stage.pad({ name: `pad${i}`, x: spot.x, y: spot.y, w: PAD.w, d: PAD.d });
  const object = stage.place(stop.kind, { name: `obj${i}`, x: spot.x, y: spot.y, z: 18, hidden: true });
  const link = i > 0 ? stage.link({ name: `ln${i}`, from: spots[i - 1], to: spot, z: 6 }) : null;
  const label = stage.label({ x: spot.x, y: spot.y, z: Math.max(LABEL_Z, object.height + 40), text: stop.title, note: stop.note, name: `lb${i}` });
  return { pad, object, link, label };
}

function arrivals(c, stops) {
  const auto = c.spread(stops.length, c.first + 0.3, Math.max(c.first + 0.3, c.last - 1.2));
  return stops.map((stop, i) => c.cue(stop.at, auto[i])).reduce((out, t, i) => [...out, i ? Math.max(t, out[i - 1] + STEP) : t], []);
}

function arrive(k, { pad, object, link, label }, t, i) {
  if (link) link.draw(t - LINK_LEAD, { dur: LINK_LEAD });
  object.appear(t);
  pad.light(t);
  label.show(t + 0.2);
  k.sound(i === 0 ? "whoosh" : "pop", t, 0.3);
}

// From a flat, chart-like view the camera cranes into the 3D world over the whole scene, pushing in a little.
function moveCamera(k, stage, c) {
  const camera = k.iso.camera(stage);
  const span = Math.max(1, c.duration - END_ROOM - 0.3);
  camera.place({ focus: { x: stage.center, y: stage.center }, zoom: ZOOM, lift: LIFT, dolly: START_BACK });
  camera.crane(0.3, { tilt: END_TILT, dur: span, ease: "sine.inOut" });
  camera.dolly(0.3, { z: PUSH_IN, dur: span, ease: "none" });
}

