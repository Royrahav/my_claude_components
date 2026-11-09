// 3D kit: an isometric world in CSS 3D. A perspective stage holds a tilt wrapper (crane), a spin wrapper (orbit) and a
// track (the camera pans it in plane space) that carries the floor and whatever is built on it; a zoom wrapper around
// the stage is the screen-space camera. The primitives (createStage: palette, box, billboard sprites and labels, placed
// objects from iso-objects, links) work without a road: a scene places things at any x, y, z. The journey grammar (a
// road, one platform per stop, a packet) is buildWorld, on top of the same stage. Labels are billboards: counter-rotated
// so they stand upright, and re-turned by the camera when it orbits or cranes (iso-motion). The palette comes from the
// theme (a dark world on dark themes, a light one on light themes). Never fade a preserve-3d element (opacity flattens
// its 3D): scale or move it, and fade only leaf elements. Project templates reach all of this as `k.iso`.
import { seededRandom } from "./direction.mjs";
import { animator, HIDDEN, SHOWN } from "./iso-tween.mjs";
import { buildObject } from "./iso-objects.mjs";
import { mix, rgba } from "./theme.mjs";

export const PLANE = 3600;
export const CENTER = PLANE / 2;
export const TILT = { x: 56, z: -36 };
export const PLAT = { w: 470, d: 380, h: 26 };
export const SPACING = 600;
export const MIN_STOPS = 2;
export const MAX_STOPS = 6;
const PLAT_Y = CENTER - 270;
const ROAD_Y = CENTER + 60;
const ROAD_MARGIN = 300;
const PACKET = 56;
export const PERSPECTIVE = 2200;
const LABEL = { font: 34, gap: 40, onScreen: 28 };
const MOTES = { count: 24, seed: 99 };
const VANISH_SECONDS = 0.8;
const APPEAR = { dur: 0.6, ease: "back.out(1.6)" };
const LINK = { seconds: 0.7, thickness: 8 };
// The stage fades into the canvas at the top (under the chapter tag and eyebrow) and toward the edges. A mask, not an
// overlay: the label checks reject text with an opaque element on top of it.
const FADE_LAYERS = "radial-gradient(ellipse 70% 62% at 50% 52%,#000 62%,rgba(0,0,0,.45) 100%),linear-gradient(180deg,transparent 0,transparent 6%,#000 11%)";
const FADE = `-webkit-mask-image:${FADE_LAYERS};-webkit-mask-composite:source-in;mask-image:${FADE_LAYERS};mask-composite:intersect`;
const BLACK = "#000000";
const WHITE = "#FFFFFF";

// What a billboard turns by (against the rig's tilt) to face the camera, as the transform it starts with.
export const billboardTurn = (tilt) => `rotateZ(${-tilt.z}deg) rotateX(${-tilt.x}deg)`;

// Where each stop stands: evenly along the road, centered on the plane.
export const stopCenters = (count) => Array.from({ length: count }, (_, i) => ({ cx: Math.round(CENTER + (i - (count - 1) / 2) * SPACING), cy: PLAT_Y }));

// The track position that puts a stop at the middle of the frame, and the one that shows the whole map.
export const stopPose = ({ cx, cy }) => ({ x: CENTER - cx, y: CENTER - (cy + 120) });
const mapPose = { x: 0, y: CENTER - (PLAT_Y + ROAD_Y) / 2 };
// The map is not centered on the track's focus point (it runs along a tilted road), so the zoom wrapper shifts it
// back by this much per unit of zoom.
const MAP_OFFSET_X = 380;

// The whole map at `zoom`, its middle at screen x `centerX` and its vertical position shifted by `shiftY`.
export const overviewView = (zoom, { shiftY = 0, centerX = 960 } = {}) => ({ track: mapPose, cam: { scale: zoom, x: Math.round(zoom * MAP_OFFSET_X) + centerX - 960, y: shiftY } });

// How wide the whole map is on screen at zoom 1, and the zoom that fits it into `width` pixels.
const radians = (deg) => (Math.abs(deg) * Math.PI) / 180;
const mapWidth = (count) => (count - 1) * SPACING * Math.cos(radians(TILT.z)) + PLAT.w * Math.cos(radians(TILT.z)) + PLAT.d * Math.sin(radians(TILT.z));
export const fitZoom = (count, width) => Math.min(0.9, Math.max(0.3, width / mapWidth(count)));
// Labels grow as the camera pulls back, so they stay readable on screen.
export const labelZoom = (zoom) => Math.max(1, LABEL.onScreen / (LABEL.font * zoom));

export function isoPalette(theme) {
  const { canvas, surface, ink, accent, accent2, danger } = theme.colors;
  const { dark } = theme;
  const edge = theme.derived.accentLarge;
  const grid = dark ? edge : accent2;
  const floor = dark ? mix(canvas, BLACK, 0.35) : mix(canvas, accent2, 0.1);
  const shade = (c) => (dark ? { top: mix(c, WHITE, 0.12), a: c, b: mix(c, BLACK, 0.32) } : { top: mix(c, WHITE, 0.4), a: mix(c, BLACK, 0.08), b: mix(c, BLACK, 0.26) });
  return {
    dark, canvas, ink, edge, danger, edgeText: theme.derived.accentText, floor, shade,
    stage: dark ? `radial-gradient(ellipse at 50% 30%,${mix(canvas, accent, 0.09)} 0%,${floor} 70%)` : `radial-gradient(ellipse at 50% 30%,${mix(canvas, WHITE, 0.7)} 0%,${floor} 75%)`,
    gridMajor: rgba(grid, dark ? 0.2 : 0.24), gridMinor: rgba(grid, 0.07),
    slab: dark ? mix(canvas, accent, 0.16) : surface,
    body: dark ? mix(canvas, accent, 0.2) : mix(surface, accent2, 0.1),
    crate: accent, voxel: accent2, paper: dark ? ink : surface, onPaper: dark ? canvas : ink, led1: accent, led2: accent2,
    road: dark ? mix(floor, accent, 0.12) : mix(floor, accent2, 0.14),
    dash: dark ? mix(edge, WHITE, 0.5) : surface,
    pillFill: dark ? mix(canvas, BLACK, 0.3) : surface,
    glow: (alpha) => (dark ? `0 0 34px ${rgba(edge, alpha)}` : `0 8px 26px ${rgba(accent2, alpha * 0.7)}`),
  };
}

// A box of w x d footprint and height h standing at (x, y), lifted by z: a top plus the two walls that face the
// camera (the others are never seen). `face` is drawn on every wall. `all` adds the other two walls, for a box that
// turns about its vertical axis (a gear's bar) and so shows every side.
export function box(k, pal, { x, y, w, d, h, z = 0, color, glow = "", face = "", all = false }) {
  const { p } = k;
  const shade = pal.shade(color);
  const wall = (style, wallColor) => `<div class="${p("f")}" style="${style};background:${wallColor};border:1px solid ${pal.edge}">${face}</div>`;
  const far = all ? [wall(`left:0;top:0;width:${w}px;height:${h}px;transform-origin:top;transform:rotateX(90deg)`, shade.b), wall(`left:0;top:0;width:${h}px;height:${d}px;transform-origin:left;transform:rotateY(-90deg)`, shade.a)] : [];
  return `<div class="${p("g")}" style="left:${x}px;top:${y}px;width:${w}px;height:${d}px${z ? `;transform:translateZ(${z}px)` : ""}">
<div class="${p("f")}" style="left:0;top:0;width:${w}px;height:${d}px;transform:translateZ(${h}px);background:${shade.top};border:2px solid ${pal.edge}${glow ? `;box-shadow:${glow}` : ""}"></div>
${wall(`left:0;top:${d}px;width:${w}px;height:${h}px;transform-origin:top;transform:rotateX(90deg)`, shade.a)}
${wall(`left:${w}px;top:0;width:${h}px;height:${d}px;transform-origin:left;transform:rotateY(-90deg)`, shade.b)}${far.length ? `\n${far.join("\n")}` : ""}
</div>`;
}

// The stage of a 3D scene: build things on it (place, label, link, box, add), then `mount()` once. Its pieces keep
// fixed ids (cam3, tilt, spin, track), so a scene builds one stage; the camera (iso-motion) moves them.
export function createStage(k, { tilt = TILT, perspective = PERSPECTIVE, plane = PLANE, floor = true, motes = true } = {}) {
  if (k.is3d) throw new Error(`${k.id}: a scene builds one 3D stage`);
  k.is3d = true;
  const { p } = k;
  const pal = isoPalette(k.theme);
  const parts = [];
  const turners = []; // the billboards, which the camera re-turns when it orbits or cranes
  const stage = { k, pal, tilt, perspective, plane, center: plane / 2, turners };
  let mounted = false;
  const sprite = ({ x, y, z, html }) => {
    if (stage.camera) throw new Error(`${k.id}: build labels and objects before k.iso.camera(stage): the camera turns the billboards it knows`);
    const id = `bb${turners.length}`;
    turners.push(id);
    return `<div class="${p("g")}" style="left:${x}px;top:${y}px;width:0;height:0;transform:translateZ(${z}px)"><div id="${p(id)}" class="${p("lbl")}" style="transform:${billboardTurn(tilt)}">${html}</div></div>`;
  };
  return Object.assign(stage, {
    add(html) {
      if (mounted) throw new Error(`${k.id}: the stage is mounted; build everything before stage.mount()`);
      parts.push(html);
    },
    box: (spec) => box(k, pal, spec),
    sprite,
    label: (spec) => addLabel(stage, spec),
    place: (kind, spec) => placeObject(stage, kind, spec),
    link: (spec) => addLink(stage, spec),
    pad: (spec) => addPad(stage, spec),
    disc: (spec) => addDisc(stage, spec),
    mount() {
      mounted = true;
      k.css.push(stageCss(p, pal, { tilt, perspective, plane }));
      k.html.push(`<div class="${p("stage")}"><div id="${p("cam3")}" class="${p("cam3")}"><div id="${p("tilt")}" class="${p("tilt")}"><div id="${p("spin")}" class="${p("spin")}"><div id="${p("track")}" class="${p("track")}">
${floor ? `<div class="${p("floor")}"></div>` : ""}
${parts.join("\n")}
</div></div></div></div></div>${motes ? motesHtml(k, pal) : ""}`);
    },
  });
}

// A pill of text standing at (x, y) and z above the ground; `show(t)` rises it on its cue.
function addLabel(stage, { x, y, z, text, note = "", name }) {
  const { k } = stage;
  const { p } = k;
  const noteHtml = note ? `<span class="${p("note")}">${k.esc(note)}</span>` : "";
  stage.add(stage.sprite({ x, y, z, html: `<div class="${p("lbrow")}"><div id="${p(name)}" class="${p("pill")}">${k.esc(text)}${noteHtml}</div></div>` }));
  return { name, show: (t) => k.rise(name, t, 30, 0.5) };
}

// An object from the library standing at (x, y, z). `name` ids it; `hidden` keeps it scaled to nothing until
// `appear(t)`. Its position is the timeline's: `move({ x, y, z, rotation, scale }, t, opts)` goes to plane
// coordinates (z is height) and chains with its own actions (`run("open", t)`) in time order.
function placeObject(stage, kind, spec) {
  const { k } = stage;
  const { p } = k;
  const { x, y, z = 0, name, hidden = false } = spec;
  if (!name) throw new Error(`${k.id}: place(${JSON.stringify(kind)}) needs a name`);
  const object = buildObject(kind, objectContext(stage, { id: (n) => `${name}_${n}`, cx: 0, cy: 0, seed: spec.seed ?? 7, spec }));
  const start = { x, y, z, ...(hidden ? HIDDEN : {}) };
  const mover = animator(k, name);
  mover.hold(start);
  if (!hidden) k.revealAt(name, 0);
  stage.add(`<div id="${p(name)}" class="${p("g")}" style="left:0;top:0;width:0;height:0">${object.html}</div>`);
  const actions = object.actions ?? {};
  return {
    name, height: object.height, anchors: object.anchors ?? {}, actions: Object.keys(actions),
    move: (to, t, opts) => mover.move(to, t, opts),
    appear(t) {
      k.revealAt(name, t);
      mover.move(SHOWN, t, APPEAR);
    },
    // Collapses it again on its cue (optionally rising by `z` as it goes).
    vanish(t, { z = 0, dur = VANISH_SECONDS } = {}) {
      mover.move({ ...HIDDEN, ...(z ? { z: mover.state().z + z } : {}) }, t, { dur, ease: "power2.in" });
    },
    run(action, t, args = {}) {
      if (!Object.hasOwn(actions, action)) throw new Error(`${k.id}: ${kind} has no action ${JSON.stringify(action)} (has: ${Object.keys(actions).join(", ") || "none"})`);
      actions[action](t, args);
    },
  };
}

// What an object builds with: the kit, the palette, box and sprite, its footprint's center and the spec it came from.
// `id(n)` names a part of it, `name(n)` is the full element id.
const objectContext = (stage, { id, cx, cy, seed, spec }) => ({ k: stage.k, pal: stage.pal, box: stage.box, sprite: stage.sprite, cx, cy, seed, spec, id, name: (n) => stage.k.p(id(n)) });

// A glowing line on the ground from `from` to `to` ({ x, y }); `draw(t)` grows it from `from` on its cue.
function addLink(stage, { name, from, to, z = 0, color = stage.pal.edge, thickness = LINK.thickness }) {
  const { k } = stage;
  const { p } = k;
  const length = Math.round(Math.hypot(to.x - from.x, to.y - from.y));
  const angle = Math.round((Math.atan2(to.y - from.y, to.x - from.x) * 180 * 100) / Math.PI) / 100;
  const mover = animator(k, name, { scaleX: 0 });
  mover.hold({ scaleX: 0 });
  stage.add(`<div class="${p("g")}" style="left:${from.x}px;top:${from.y}px;width:0;height:0;transform:translateZ(${z}px) rotateZ(${angle}deg)"><div id="${p(name)}" class="${p("f")}" style="left:0;top:${-thickness / 2}px;width:${length}px;height:${thickness}px;border-radius:${thickness / 2}px;background:${color};box-shadow:${stage.pal.glow(0.8)};transform-origin:left center"></div></div>`);
  return {
    name, length,
    draw(t, { dur = LINK.seconds } = {}) {
      k.revealAt(name, t);
      mover.move({ scaleX: 1 }, t, { dur, ease: "power2.out" });
    },
  };
}

// A slab centered at (x, y) with a lamp over it: `light(t)` and `dim(t)` switch the lamp (a leaf fade) on cue.
function addPad(stage, { name, x, y, w, d, h = PLAT.h }) {
  const { k, pal } = stage;
  const { p } = k;
  const lamp = animator(k, name, { opacity: 0 });
  const slab = box(k, pal, { x: x - w / 2, y: y - d / 2, w, d, h, color: pal.slab, glow: pal.glow(0.35) });
  stage.add(`${slab}<div class="${p("g")}" style="left:0;top:0;width:0;height:0;transform:translateZ(${h + 2}px)"><div id="${p(name)}" class="${p("f")} ${p("lamp")}" style="left:${x - w / 2}px;top:${y - d / 2}px;width:${w}px;height:${d}px"></div></div>`);
  return { name, light: (t, { dur = 0.5 } = {}) => lamp.move({ opacity: 1 }, t, { dur }), dim: (t, { dur = 0.5 } = {}) => lamp.move({ opacity: 0 }, t, { dur }) };
}

// A flat disc of radius r at (x, y): a rune on the floor or an orbit path (`dashed` outlines it with dashes).
function addDisc(stage, { x, y, r, z = 0, dashed = false }) {
  const { k, pal } = stage;
  const { p } = k;
  stage.add(`<div class="${p("g")}" style="left:${x}px;top:${y}px;width:0;height:0;transform:translateZ(${z}px)"><div class="${p("f")}" style="left:${-r}px;top:${-r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;border:4px ${dashed ? "dashed" : "solid"} ${pal.edge};background:${rgba(pal.edge, 0.06)}"></div></div>`);
}

// The stops a scene declares: 2-6 of them (`max` lowers the top), each with a title and an object kind (checked when it is built).
export function readStops(k, data, max = MAX_STOPS) {
  const stops = Array.isArray(data.stops) ? data.stops : [];
  if (stops.length < MIN_STOPS || stops.length > max) throw new Error(`${k.id}: needs ${MIN_STOPS}-${max} data.stops, got ${stops.length}`);
  return stops.map((stop, i) => ({ ...stop, title: stopTitle(k, stop, i) }));
}

function stopTitle(k, stop, i) {
  const title = String(stop?.title ?? "").trim();
  if (title === "") throw new Error(`${k.id}: stop ${i + 1} needs a title`);
  return title;
}

// Builds the journey world into the scene (css and html) and returns its stops with what the choreography needs:
// each has { i, cx, cy, height, act } beside the data it was declared with.
export function buildWorld(k, stops) {
  const stage = createStage(k);
  const centers = stopCenters(stops.length);
  stage.add(roadHtml(k.p, centers));
  const built = stops.map((stop, i) => buildStop(stage, { ...stop, i, ...centers[i] }));
  stage.add(packetHtml(k, stage.pal, centers[0].cx));
  k.css.push(journeyCss(k.p, stage.pal));
  stage.mount();
  return { pal: stage.pal, stops: built };
}

function buildStop(stage, stop) {
  const { k, pal } = stage;
  const { p } = k;
  const { i, cx, cy } = stop;
  const object = buildObject(stop.kind, objectContext(stage, { id: (n) => `o${i}_${n}`, cx: PLAT.w / 2, cy: PLAT.d / 2, seed: 7 + i, spec: stop }));
  const slab = box(k, pal, { x: 0, y: 0, w: PLAT.w, d: PLAT.d, h: PLAT.h, color: pal.slab, glow: `${pal.glow(0.35)}${pal.dark ? ",inset 0 0 40px " + rgba(pal.edge, 0.12) : ""}` });
  const centered = (size) => `left:${PLAT.w / 2 - size / 2}px;top:${PLAT.d / 2 - size / 2}px;width:${size}px;height:${size}px`;
  const marks = `<div class="${p("g")}" style="left:0;top:0;width:0;height:0;transform:translateZ(${PLAT.h + 2}px)">
<div id="${p(`lamp${i}`)}" class="${p("f")} ${p("lamp")}" style="left:0;top:0;width:${PLAT.w}px;height:${PLAT.d}px"></div>
<div id="${p(`pu${i}`)}" class="${p("pulse")}" style="${centered(440)}"></div></div>`;
  stage.add(`<div class="${p("g")}" style="left:${cx - PLAT.w / 2}px;top:${cy - PLAT.d / 2}px;width:${PLAT.w}px;height:${PLAT.d}px"><div id="${p(`pl${i}`)}" class="${p("g")}" style="left:0;top:0;width:${PLAT.w}px;height:${PLAT.d}px;transform-origin:50% 50%">
${slab}${marks}<div id="${p(`ob${i}`)}" class="${p("g")}" style="left:0;top:0;width:${PLAT.w}px;height:${PLAT.d}px;transform:translateZ(${PLAT.h}px)">${object.html}</div>
</div></div>`);
  stage.label({ x: cx, y: cy, z: PLAT.h + object.height + LABEL.gap, text: stop.title, note: stop.note, name: `lbp${i}` });
  return { ...stop, height: object.height, act: object.act };
}

function roadHtml(p, centers) {
  const [from, to] = [centers[0].cx - ROAD_MARGIN, centers[centers.length - 1].cx + ROAD_MARGIN];
  return `<div class="${p("road")}" style="left:${from}px;width:${to - from}px"><div class="${p("dash")}"></div></div><div id="${p("trail")}" class="${p("trail")}" style="left:${centers[0].cx}px;width:${to - from - 2 * ROAD_MARGIN}px"></div>`;
}

function packetHtml(k, pal, x) {
  const { p } = k;
  const shade = pal.shade(pal.edge);
  const face = (style, color) => `<div class="${p("f")}" style="left:0;top:0;width:${PACKET}px;height:${PACKET}px;${style};background:${color}"></div>`;
  return `<div id="${p("pk")}" class="${p("g")}" style="left:0;top:0;width:0;height:0"><div class="${p("g")}" style="left:${x - PACKET / 2}px;top:${ROAD_Y - PACKET / 2}px;width:${PACKET}px;height:${PACKET}px">
${face(`transform:translateZ(${PACKET}px);box-shadow:0 0 40px ${pal.edge},0 0 80px ${rgba(pal.edge, 0.6)}`, mix(pal.edge, WHITE, 0.45))}
${face(`top:${PACKET}px;transform-origin:top;transform:rotateX(90deg)`, shade.a)}
${face(`left:${PACKET}px;transform-origin:left;transform:rotateY(-90deg)`, shade.b)}
</div></div>`;
}

// Slow motes drifting up in front of the world, for depth; seeded, so every build draws the same ones.
function motesHtml(k, pal) {
  const random = seededRandom(MOTES.seed);
  return Array.from({ length: MOTES.count }, (_, n) => {
    const [x, y, size, alpha, rise] = [Math.round(random() * 1920), Math.round(random() * 1080), (2 + random() * 4).toFixed(1), (0.25 + random() * 0.5).toFixed(2), Math.round(60 + random() * 160)];
    k.js.push(`tl.fromTo("#${k.p(`m${n}`)}",{y:0},{y:-${rise},duration:${k.duration},ease:"none"},0);`);
    return `<i id="${k.p(`m${n}`)}" style="position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:50%;background:${rgba(pal.edge, alpha)}"></i>`;
  }).join("");
}

function stageCss(p, pal, { tilt, perspective, plane }) {
  const { edge } = pal;
  return `.${p("stage")}{position:absolute;inset:0;overflow:hidden;background:${pal.stage};${FADE}}
.${p("stage")} *{pointer-events:none}
.${p("cam3")}{position:absolute;inset:0;transform-origin:50% 50%;perspective:${perspective}px;perspective-origin:50% 38%}
.${p("tilt")}{position:absolute;left:${960 - plane / 2}px;top:${540 - plane / 2}px;width:${plane}px;height:${plane}px;transform-style:preserve-3d;transform:rotateX(${tilt.x}deg)}
.${p("spin")}{position:absolute;inset:0;transform-style:preserve-3d;transform:rotateZ(${tilt.z}deg)}
.${p("track")}{position:absolute;inset:0;transform-style:preserve-3d}
.${p("floor")}{position:absolute;left:-2000px;top:-2000px;width:${plane + 4000}px;height:${plane + 4000}px;background-color:${pal.floor};background-image:linear-gradient(${pal.gridMajor} 3px,transparent 3px),linear-gradient(90deg,${pal.gridMajor} 3px,transparent 2px),linear-gradient(${pal.gridMinor} 1px,transparent 1px),linear-gradient(90deg,${pal.gridMinor} 1px,transparent 1px);background-size:240px 240px,240px 240px,60px 60px,60px 60px}
.${p("g")}{position:absolute;transform-style:preserve-3d}
.${p("f")}{position:absolute;box-sizing:border-box}
.${p("lbl")}{position:absolute;width:0;height:0;transform-style:flat}
.${p("lbrow")}{position:absolute;left:-500px;top:-90px;width:1000px;height:90px;display:flex;justify-content:center;align-items:flex-end}
.${p("pill")}{text-align:center;white-space:nowrap;padding:14px 30px;border-radius:40px;background:${pal.pillFill};border:2px solid ${edge};box-shadow:${pal.glow(0.5)};font:700 ${LABEL.font}px/1 var(--font-display);color:${pal.ink};transform-origin:50% 100%}
.${p("note")}{display:block;margin-top:8px;font:400 22px/1.2 var(--font-body);color:var(--muted)}
.${p("ring")}{position:absolute;border-radius:50%;border:8px solid ${edge};background:${rgba(edge, 0.08)};box-shadow:${pal.glow(0.6)}}
.${p("pulse")}{position:absolute;border-radius:50%;border:4px solid ${edge};opacity:0}
.${p("lamp")}{border:6px solid ${edge};background:${rgba(edge, 0.22)};box-shadow:${pal.glow(0.8)};opacity:0}
`;
}

function journeyCss(p, pal) {
  const { edge } = pal;
  return `.${p("road")}{position:absolute;top:${ROAD_Y - 50}px;height:100px;background:${pal.road};border-top:4px solid ${edge};border-bottom:4px solid ${edge};box-shadow:${pal.glow(0.45)}}
.${p("dash")}{position:absolute;left:0;right:0;top:46px;height:6px;background:repeating-linear-gradient(90deg,${pal.dash} 0 40px,transparent 40px 90px)}
.${p("trail")}{position:absolute;top:${ROAD_Y - 36}px;height:72px;background:linear-gradient(90deg,${rgba(edge, 0)},${rgba(edge, 0.55)});transform-origin:left center;box-shadow:${pal.glow(0.5)}}
`;
}
