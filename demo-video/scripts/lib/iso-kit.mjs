// 3D kit: an isometric world in CSS 3D for the iso-* templates. A perspective stage holds a tilted rig; the rig
// holds a track (the camera pans it in plane space) that carries the floor, a road, one platform per stop (with
// its object from iso-objects) and the packet. A zoom wrapper around the stage is the screen-space camera.
// Labels are billboards: counter-rotated so they stand upright. The palette comes from the theme (a dark world
// on dark themes, a light one on light themes). Never fade a preserve-3d element (opacity flattens its 3D):
// scale or move it, and fade only leaf elements. The camera, packet and reveal choreography is in iso-motion.
import { seededRandom } from "./direction.mjs";
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
const PERSPECTIVE = 2200;
const LABEL = { font: 34, gap: 40, onScreen: 28 };
const MOTES = { count: 24, seed: 99 };
// The stage fades into the canvas at the top (under the chapter tag and eyebrow) and toward the edges. A mask, not an
// overlay: the label checks reject text with an opaque element on top of it.
const FADE_LAYERS = "radial-gradient(ellipse 70% 62% at 50% 52%,#000 62%,rgba(0,0,0,.45) 100%),linear-gradient(180deg,transparent 0,transparent 6%,#000 11%)";
const FADE = `-webkit-mask-image:${FADE_LAYERS};-webkit-mask-composite:source-in;mask-image:${FADE_LAYERS};mask-composite:intersect`;
const BLACK = "#000000";
const WHITE = "#FFFFFF";

export const billboard = (z) => `translateZ(${z}px) rotateZ(${-TILT.z}deg) rotateX(${-TILT.x}deg)`;

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
  const { canvas, surface, ink, accent, accent2 } = theme.colors;
  const { dark } = theme;
  const edge = theme.derived.accentLarge;
  const grid = dark ? edge : accent2;
  const floor = dark ? mix(canvas, BLACK, 0.35) : mix(canvas, accent2, 0.1);
  const shade = (c) => (dark ? { top: mix(c, WHITE, 0.12), a: c, b: mix(c, BLACK, 0.32) } : { top: mix(c, WHITE, 0.4), a: mix(c, BLACK, 0.08), b: mix(c, BLACK, 0.26) });
  return {
    dark, canvas, ink, edge, edgeText: theme.derived.accentText, floor, shade,
    stage: dark ? `radial-gradient(ellipse at 50% 30%,${mix(canvas, accent, 0.09)} 0%,${floor} 70%)` : `radial-gradient(ellipse at 50% 30%,${mix(canvas, WHITE, 0.7)} 0%,${floor} 75%)`,
    gridMajor: rgba(grid, dark ? 0.2 : 0.24), gridMinor: rgba(grid, 0.07),
    slab: dark ? mix(canvas, accent, 0.16) : surface,
    body: dark ? mix(canvas, accent, 0.2) : mix(surface, accent2, 0.1),
    crate: accent, voxel: accent2, paper: dark ? ink : surface, led1: accent, led2: accent2,
    road: dark ? mix(floor, accent, 0.12) : mix(floor, accent2, 0.14),
    dash: dark ? mix(edge, WHITE, 0.5) : surface,
    pillFill: dark ? mix(canvas, BLACK, 0.3) : surface,
    glow: (alpha) => (dark ? `0 0 34px ${rgba(edge, alpha)}` : `0 8px 26px ${rgba(accent2, alpha * 0.7)}`),
  };
}

// A box of w x d footprint and height h standing at (x, y), lifted by z: a top plus the two walls that face the
// camera (the others are never seen). `face` is drawn on both walls.
export function box(k, pal, { x, y, w, d, h, z = 0, color, glow = "", face = "" }) {
  const { p } = k;
  const shade = pal.shade(color);
  const wall = (style, wallColor, inner = "") => `<div class="${p("f")}" style="${style};background:${wallColor};border:1px solid ${pal.edge}">${inner}</div>`;
  return `<div class="${p("g")}" style="left:${x}px;top:${y}px;width:${w}px;height:${d}px${z ? `;transform:translateZ(${z}px)` : ""}">
<div class="${p("f")}" style="left:0;top:0;width:${w}px;height:${d}px;transform:translateZ(${h}px);background:${shade.top};border:2px solid ${pal.edge}${glow ? `;box-shadow:${glow}` : ""}"></div>
${wall(`left:0;top:${d}px;width:${w}px;height:${h}px;transform-origin:top;transform:rotateX(90deg)`, shade.a, face)}
${wall(`left:${w}px;top:0;width:${h}px;height:${d}px;transform-origin:left;transform:rotateY(-90deg)`, shade.b, face)}
</div>`;
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

// Builds the world into the scene (css and html) and returns its stops with what the choreography needs:
// each has { i, cx, cy, height, act } beside the data it was declared with.
export function buildWorld(k, stops) {
  const pal = isoPalette(k.theme);
  const centers = stopCenters(stops.length);
  const parts = stops.map((stop, i) => buildStop(k, pal, { ...stop, i, ...centers[i] }));
  const { p } = k;
  k.css.push(worldCss(p, pal));
  k.html.push(`<div class="${p("stage")}"><div id="${p("cam3")}" class="${p("cam3")}"><div class="${p("rig")}"><div id="${p("track")}" class="${p("track")}">
<div class="${p("floor")}"></div>
${roadHtml(p, centers)}
${parts.map((part) => part.html).join("\n")}
${packetHtml(k, pal, centers[0].cx)}
</div></div></div></div>${motesHtml(k, pal)}`);
  return { pal, stops: parts.map((part) => part.stop) };
}

function buildStop(k, pal, stop) {
  const { p } = k;
  const { i, cx, cy } = stop;
  const ctx = { k, pal, box: (spec) => box(k, pal, spec), billboard, cx: PLAT.w / 2, cy: PLAT.d / 2, seed: 7 + i, name: (n) => p(`o${i}_${n}`) };
  const object = buildObject(stop.kind, ctx);
  const slab = box(k, pal, { x: 0, y: 0, w: PLAT.w, d: PLAT.d, h: PLAT.h, color: pal.slab, glow: `${pal.glow(0.35)}${pal.dark ? ",inset 0 0 40px " + rgba(pal.edge, 0.12) : ""}` });
  const centered = (size) => `left:${PLAT.w / 2 - size / 2}px;top:${PLAT.d / 2 - size / 2}px;width:${size}px;height:${size}px`;
  const marks = `<div class="${p("g")}" style="left:0;top:0;width:0;height:0;transform:translateZ(${PLAT.h + 2}px)">
<div id="${p(`lamp${i}`)}" class="${p("f")} ${p("lamp")}" style="left:0;top:0;width:${PLAT.w}px;height:${PLAT.d}px"></div>
<div id="${p(`pu${i}`)}" class="${p("pulse")}" style="${centered(440)}"></div></div>`;
  const label = `<div class="${p("lbl")}" style="left:${PLAT.w / 2}px;top:${PLAT.d / 2}px;transform:${billboard(PLAT.h + object.height + LABEL.gap)}"><div class="${p("lbrow")}"><div id="${p(`lbp${i}`)}" class="${p("pill")}">${k.esc(stop.title)}${noteHtml(k, stop)}</div></div></div>`;
  const html = `<div class="${p("g")}" style="left:${cx - PLAT.w / 2}px;top:${cy - PLAT.d / 2}px;width:${PLAT.w}px;height:${PLAT.d}px"><div id="${p(`pl${i}`)}" class="${p("g")}" style="left:0;top:0;width:${PLAT.w}px;height:${PLAT.d}px;transform-origin:50% 50%">
${slab}${marks}<div id="${p(`ob${i}`)}" class="${p("g")}" style="left:0;top:0;width:${PLAT.w}px;height:${PLAT.d}px;transform:translateZ(${PLAT.h}px)">${object.html}</div>
</div>${label}</div>`;
  return { html, stop: { ...stop, height: object.height, act: object.act } };
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

function worldCss(p, pal) {
  const { edge } = pal;
  return `.${p("stage")}{position:absolute;inset:0;overflow:hidden;background:${pal.stage};${FADE}}
.${p("stage")} *{pointer-events:none}
.${p("cam3")}{position:absolute;inset:0;transform-origin:50% 50%;perspective:${PERSPECTIVE}px;perspective-origin:50% 38%}
.${p("rig")}{position:absolute;left:${960 - CENTER}px;top:${540 - CENTER}px;width:${PLANE}px;height:${PLANE}px;transform-style:preserve-3d;transform:rotateX(${TILT.x}deg) rotateZ(${TILT.z}deg)}
.${p("track")}{position:absolute;inset:0;transform-style:preserve-3d}
.${p("floor")}{position:absolute;left:-2000px;top:-2000px;width:${PLANE + 4000}px;height:${PLANE + 4000}px;background-color:${pal.floor};background-image:linear-gradient(${pal.gridMajor} 3px,transparent 3px),linear-gradient(90deg,${pal.gridMajor} 3px,transparent 2px),linear-gradient(${pal.gridMinor} 1px,transparent 1px),linear-gradient(90deg,${pal.gridMinor} 1px,transparent 1px);background-size:240px 240px,240px 240px,60px 60px,60px 60px}
.${p("g")}{position:absolute;transform-style:preserve-3d}
.${p("f")}{position:absolute;box-sizing:border-box}
.${p("road")}{position:absolute;top:${ROAD_Y - 50}px;height:100px;background:${pal.road};border-top:4px solid ${edge};border-bottom:4px solid ${edge};box-shadow:${pal.glow(0.45)}}
.${p("dash")}{position:absolute;left:0;right:0;top:46px;height:6px;background:repeating-linear-gradient(90deg,${pal.dash} 0 40px,transparent 40px 90px)}
.${p("trail")}{position:absolute;top:${ROAD_Y - 36}px;height:72px;background:linear-gradient(90deg,${rgba(edge, 0)},${rgba(edge, 0.55)});transform-origin:left center;box-shadow:${pal.glow(0.5)}}
.${p("lbl")}{position:absolute;width:0;height:0;transform-style:flat}
.${p("lbrow")}{position:absolute;left:-500px;top:-90px;width:1000px;height:90px;display:flex;justify-content:center;align-items:flex-end}
.${p("pill")}{text-align:center;white-space:nowrap;padding:14px 30px;border-radius:40px;background:${pal.pillFill};border:2px solid ${edge};box-shadow:${pal.glow(0.5)};font:700 ${LABEL.font}px/1 var(--font-display);color:${pal.ink};transform-origin:50% 100%}
.${p("note")}{display:block;margin-top:8px;font:400 22px/1.2 var(--font-body);color:var(--muted)}
.${p("ring")}{position:absolute;border-radius:50%;border:8px solid ${edge};background:${rgba(edge, 0.08)};box-shadow:${pal.glow(0.6)}}
.${p("pulse")}{position:absolute;border-radius:50%;border:4px solid ${edge};opacity:0}
.${p("lamp")}{border:6px solid ${edge};background:${rgba(edge, 0.22)};box-shadow:${pal.glow(0.8)};opacity:0}
`;
}

const noteHtml = (k, stop) => (stop.note ? `<span class="${k.p("note")}">${k.esc(stop.note)}</span>` : "");
