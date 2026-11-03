// Signature scene example (3D): layers stacked in space; a token descends through them in order (each layer lights as
// the token reaches it, its name rises beside it), then rises back through them in reverse order (each layer dims).
// The camera cranes toward a side-on view during the descent and orbits during the rise. For anything that wraps
// something else: middleware, a request scope, a call stack, protocol layers.
// Copy to <project>/scenes/<name>.mjs and adapt (references/custom-scene.md, 3D signature scene recipe).
//
// data: { layers: [{ name, note?, down?, up? }] (3-5, outermost first), token?: { appear_at? } }
// `down` is the cue where the token reaches the layer going in, `up` where it reaches it coming back (its End).
// Only k.iso pieces move things: stage, camera, placed objects (layers, token) and labels.

const MIN_LAYERS = 3;
const MAX_LAYERS = 5;
const TILT = { x: 64, z: -28 };
const SIDE_ON = 78; // the crane's end: nearly side-on, so the gaps between layers read
const ORBIT_DEGREES = 50;
const MAX_ZOOM = 1.3;
const BAND_HEIGHT = 640; // the stack and its labels fit this many screen pixels
const STEP = 1.3; // closest two arrivals can follow each other: the token needs a beat to travel
const TRAVEL = { most: 1.0, least: 0.5 };
const ENTRY_LEAD = 0.9; // the token appears this long before it reaches the first layer
const ENTRY_HEIGHT = 150; // where it starts, above the outermost layer
const THREAD = 20; // the token's base sits this far under a layer's top face, so it passes through the slab
const LABEL_OFFSET = 500; // from the stack's center along x: the side the orbit turns toward the camera, so labels stay in front
const FOCUS_SHIFT = LABEL_OFFSET / 2; // the view centers on the stack and its labels together
const TOKEN_SIZE = 80;
const EXIT_LIFT = 180;
const FOCUS_LIFT = 0.55; // the stack's middle sits this share of the stack height above the plane

export default function signatureIsoStack(k, d, c) {
  const layers = readLayers(k, d);
  const count = layers.length;
  const stage = k.iso.stage({ tilt: TILT });
  const at = stage.center;
  const stack = stage.place("layers", { name: "stack", x: at, y: at, count });
  const token = stage.place("token", { name: "token", x: at, y: at, z: tokenZ(stack, slot(count, 0)) + ENTRY_HEIGHT, hidden: true });
  const names = layers.map((layer, i) => stage.label({ x: at + LABEL_OFFSET, y: at, z: stack.anchors.layerTop(slot(count, i)) + 20, text: layer.name, note: layer.note, name: `nm${i}` }));
  stage.mount();

  const { down, up } = plan(c, layers);
  const camera = k.iso.camera(stage);
  const zoom = Math.min(MAX_ZOOM, BAND_HEIGHT / (stack.height + stack.anchors.size.d));
  const focus = { x: at + FOCUS_SHIFT, y: at };
  camera.place({ focus, zoom, lift: liftFor(stack, TILT.x, zoom) });

  descend({ stack, token, names, count }, down, d.token?.appear_at ? c.cue(d.token.appear_at, down[0] - ENTRY_LEAD) : down[0] - ENTRY_LEAD, k);
  rise({ stack, token, count }, up, down.at(-1), k);
  camera.crane(down[0] - 0.4, { tilt: SIDE_ON, dur: down[count - 1] - down[0] + 0.8 });
  camera.focus(down[0] - 0.4, focus, { lift: liftFor(stack, SIDE_ON, zoom), dur: down[count - 1] - down[0] + 0.8 });
  camera.orbit(up[count - 1] - 0.2, { degrees: ORBIT_DEGREES, dur: Math.max(2, up[0] - up[count - 1] + 1.4) });
  return { chrome: true };
}

// Layer i of the data (outermost first) is the object's layer count-1-i: the object counts from the bottom.
const slot = (count, i) => count - 1 - i;
// How far the view sits lower so the stack's middle (not its base) is at the middle of the frame.
const liftFor = (stack, tiltDegrees, zoom) => Math.round(FOCUS_LIFT * stack.height * Math.sin((tiltDegrees * Math.PI) / 180) * zoom);
const tokenZ = (stack, index) => stack.anchors.layerTop(index) - THREAD - TOKEN_SIZE * 0.2;

function readLayers(k, d) {
  const layers = Array.isArray(d.layers) ? d.layers : [];
  if (layers.length < MIN_LAYERS || layers.length > MAX_LAYERS) throw new Error(`${k.id}: needs ${MIN_LAYERS}-${MAX_LAYERS} data.layers, got ${layers.length}`);
  return layers.map((layer, i) => ({ ...layer, name: k.need(layer, "name", `layer ${i + 1}`) }));
}

// The token's arrival at each layer going in (in order) and coming back (in reverse), each on its cue and at least STEP
// after the one before. Uncued times spread over the narration: the way in over the first half, the way out the rest.
function plan(c, layers) {
  const n = layers.length;
  const mid = c.first + (c.last - c.first) * 0.5;
  const inAuto = c.spread(n, c.first + 0.8, Math.max(c.first + 0.8, mid));
  const outAuto = c.spread(n, Math.max(mid + STEP, inAuto[n - 1] + STEP), Math.max(mid + STEP, c.last - 1));
  const down = spacedOut(layers.map((layer, i) => c.cue(layer.down, inAuto[i])), STEP);
  const comingBack = layers.map((_, j) => c.cue(layers[n - 1 - j].up, outAuto[j])); // the innermost layer is reached first
  const ordered = spacedOut([Math.max(comingBack[0], down[n - 1] + STEP), ...comingBack.slice(1)], STEP);
  return { down, up: ordered.reverse() };
}

// The token appears over the outermost layer, drops to each in turn and lights it as it arrives; its name rises.
function descend({ stack, token, names, count }, down, appearAt, k) {
  token.appear(Math.max(0.1, appearAt));
  for (let i = 0; i < count; i++) {
    const dur = i === 0 ? ENTRY_LEAD : travelTime(down[i] - down[i - 1]);
    token.move({ z: tokenZ(stack, slot(count, i)) }, down[i] - dur, { dur, ease: "power2.inOut" });
    stack.run("light", down[i], { index: slot(count, i) });
    names[i].show(down[i]);
    token.run("pulse", down[i]);
    k.sound(i === 0 ? "whoosh" : "pop", down[i], 0.3);
  }
}

// Coming back, the token rises to each layer in reverse order and dims it; it leaves over the top.
function rise({ stack, token, count }, up, lastDown, k) {
  for (let i = count - 1; i >= 0; i--) {
    const from = i === count - 1 ? lastDown : up[i + 1];
    const dur = travelTime(up[i] - from);
    if (i < count - 1) token.move({ z: tokenZ(stack, slot(count, i)) }, up[i] - dur, { dur, ease: "power2.inOut" });
    stack.run("dim", up[i], { index: slot(count, i) });
    token.run("pulse", up[i]);
    k.sound("pop", up[i], 0.3);
  }
  token.vanish(up[0] + 0.5, { z: EXIT_LIFT });
  stack.run("light", up[0] + 1.3, { index: slot(count, 0) }); // the outermost layer ends lit: the request is done
  k.sound("chime", up[0] + 1.3, 0.3);
}

const travelTime = (gap) => Math.min(TRAVEL.most, Math.max(TRAVEL.least, gap - 0.2));
// Each time kept, or moved later so it stands at least `step` after the one before.
const spacedOut = (times, step) => times.reduce((out, t, i) => [...out, i ? Math.max(t, out[i - 1] + step) : t], []);
