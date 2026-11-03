// Signature scene example (3D): one central object with satellites around it on an orbit path. On each satellite's cue
// a line grows from the center to its spot, the satellite pops in on its lit pad and its name rises; the center can
// act once they are all connected (a lock opening). The camera orbits the whole scene and pushes in slowly. For
// anything with one thing in the middle and parts that join it: participants of a scope, clients of a hub, plugins.
// Copy to <project>/scenes/<name>.mjs and adapt (references/custom-scene.md, 3D signature scene recipe).
//
// data: { center: { title, kind?, note?, at?, do?: { action, at? } },
//         satellites: [{ title, kind, note?, at? }] (3-5), degrees? (the camera's orbit; by default the turn near 140
//         degrees that ends with no satellite directly behind or in front of the hub) }
// `kind` is an object of the library (k.iso.kinds); `do.action` an action of the center's kind (a lock's "open").
// Only k.iso pieces move things: stage, camera, placed objects, pads, links and labels.

const MIN_SATELLITES = 3;
const MAX_SATELLITES = 5;
const TILT = { x: 58, z: -20 };
const RADIUS = 360;
const START_ANGLE = 30; // degrees: where the first satellite stands on the orbit
const PAD = { w: 280, d: 250 };
const HUB_RADIUS = 170;
const STEP = 1.1; // closest two satellites can arrive
const LINK_LEAD = 0.55; // the line starts this long before its satellite pops in
const LABEL_GAP = 40;
const ORBIT_DEGREES = 140;
const START_BACK = -110; // the dolly starts this far from the lens and pushes in slowly
const PUSH_IN = 30;
const ZOOM = 0.92;
const LIFT = 75; // the view sits lower: the names above the back satellites stay clear of the top
const END_ROOM = 0.8; // the camera stops this long before the scene ends
const LABEL_OUT = 150; // a satellite's name stands this far outside it, away from the center, so names stay clear of the hub's

export default function signatureIsoOrbit(k, d, c) {
  const { hub, satellites } = readScene(k, d);
  const stage = k.iso.stage({ tilt: TILT });
  const at = stage.center;
  stage.disc({ x: at, y: at, r: RADIUS, dashed: true });
  stage.disc({ x: at, y: at, r: HUB_RADIUS });
  const centerObject = stage.place(hub.kind, { name: "hub", x: at, y: at, z: 4 });
  const hubLabel = stage.label({ x: at, y: at, z: centerObject.height + LABEL_GAP, text: hub.title, note: hub.note, name: "hubl" });

  const spots = satellites.map((_, i) => spotOf(at, i, satellites.length));
  const parts = satellites.map((sat, i) => buildSatellite(stage, sat, i, spots[i], at));
  stage.mount();

  const times = arrivals(c, satellites);
  hubLabel.show(Math.max(0.3, c.cue(hub.at, c.first + 0.2)));
  parts.forEach((part, i) => arrive(k, part, times[i]));
  if (hub.do) centerObject.run(hub.do.action, Math.max(c.cue(hub.do.at, times.at(-1) + 1), times.at(-1) + 0.6));
  moveCamera(k, stage, c, d.degrees ?? endTurn(satellites.length));
  return { chrome: true };
}

function readScene(k, d) {
  const satellites = Array.isArray(d.satellites) ? d.satellites : [];
  if (satellites.length < MIN_SATELLITES || satellites.length > MAX_SATELLITES) throw new Error(`${k.id}: needs ${MIN_SATELLITES}-${MAX_SATELLITES} data.satellites, got ${satellites.length}`);
  const hub = { kind: "lock", ...d.center, title: k.need(d.center ?? {}, "title", "the center") };
  return { hub, satellites: satellites.map((sat, i) => ({ ...sat, title: k.need(sat, "title", `satellite ${i + 1}`) })) };
}

// The camera's turn that ends with the direction away from the camera (and so the one toward it) a quarter gap off the
// nearest satellite: one directly behind the hub would hide in it, one directly in front would cover it. The turn
// nearest ORBIT_DEGREES.
const endTurn = (count) => {
  const gap = 360 / count;
  const bisecting = -90 - TILT.z - START_ANGLE - gap / 4;
  return Math.round(bisecting + Math.round((ORBIT_DEGREES - bisecting) / gap - 1e-9) * gap);
};

const spotOf = (at, i, count) => {
  const angle = ((START_ANGLE + (360 * i) / count) * Math.PI) / 180;
  return { x: Math.round(at + RADIUS * Math.cos(angle)), y: Math.round(at + RADIUS * Math.sin(angle)) };
};

const outward = (spot, center) => {
  const [dx, dy] = [spot.x - center, spot.y - center];
  const length = Math.hypot(dx, dy);
  return { x: Math.round(spot.x + (dx / length) * LABEL_OUT), y: Math.round(spot.y + (dy / length) * LABEL_OUT) };
};

// Each satellite: a pad, the object on it (hidden until its cue), the line from the center and its label.
function buildSatellite(stage, sat, i, spot, center) {
  const pad = stage.pad({ name: `pad${i}`, x: spot.x, y: spot.y, w: PAD.w, d: PAD.d });
  const object = stage.place(sat.kind, { name: `sat${i}`, x: spot.x, y: spot.y, z: 20, hidden: true });
  const link = stage.link({ name: `ln${i}`, from: { x: center, y: center }, to: spot, z: 6 });
  const out = outward(spot, center);
  const label = stage.label({ x: out.x, y: out.y, z: object.height + LABEL_GAP + 20, text: sat.title, note: sat.note, name: `lb${i}` });
  return { pad, object, link, label };
}

// Spread over the narration unless cued, and at least STEP apart.
function arrivals(c, satellites) {
  const auto = c.spread(satellites.length, c.first + 1, Math.max(c.first + 1, c.last - 1.5));
  return satellites.map((sat, i) => c.cue(sat.at, auto[i])).reduce((out, t, i) => [...out, i ? Math.max(t, out[i - 1] + STEP) : t], []);
}

function arrive(k, { pad, object, link, label }, t) {
  link.draw(t - LINK_LEAD, { dur: LINK_LEAD });
  object.appear(t);
  pad.light(t);
  label.show(t + 0.2);
  k.sound("pop", t, 0.3);
}

// The orbit runs through the whole scene at an even pace (a camera on a rail); the dolly pushes in while it turns.
function moveCamera(k, stage, c, degrees) {
  const camera = k.iso.camera(stage);
  const span = Math.max(1, c.duration - END_ROOM - 0.3);
  camera.place({ focus: { x: stage.center, y: stage.center }, zoom: ZOOM, lift: LIFT, dolly: START_BACK });
  camera.orbit(0.3, { degrees, dur: span, ease: "none" });
  camera.dolly(0.3, { z: PUSH_IN, dur: span, ease: "none" });
}
