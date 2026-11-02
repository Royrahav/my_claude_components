// Persistent layers that sit outside every scene: the world (direction.background "world") behind the scenes,
// the chapter rail (direction.rail "on") and the pinned running example (direction.thread_pin "on") above them.
// Each is its own sub-composition, mounted by
// index.html over the whole video, with seek-safe fromTo tweens and no Math.random.
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TRANSITION_SECONDS, seededRandom } from "./direction.mjs";
import { isClose, isSummary } from "./house-style.mjs";
import { esc } from "./kit.mjs";
import { rgba } from "./theme.mjs";
import { r3 } from "./util.mjs";

// `back` and `front` are the hosts index.html mounts behind and above the scenes; `files` maps a layer's
// composition name to its html.
export const NO_LAYERS = Object.freeze({ back: [], front: [], files: {}, warnings: [] });
const LAYER_NAMES = ["world", "rail", "pin"];

const WORLD_TRACK = 3;
const RAIL_TRACK = 4;
const PIN_TRACK = 5;
const WORLD = {
  stage: { width: 3720, height: 2280, left: -900, top: -600 }, // centered on the 1920x1080 frame
  orbs: 9,
  motes: 34,
  zone: { x: 650, y: 380, zoom: 0.18 }, // how far the camera may travel from the center at a boundary
  travelSeconds: 0.8,
  seed: 11,
  drift: { grid: { x: -90, y: -45 }, orbs: { x: 70, y: -40 }, motes: { x: -30, y: -160 } },
  // Keep-out for small light text: the top-right corner (chapter tag) and the bottom strip (close ref, captions).
  keepOut: { cornerWidth: 520, cornerHeight: 150, bottomSolid: 170, bottomFade: 260 },
};
const RAIL = { left: 96, right: 96, top: 22, height: 8, gap: 10, fadeSeconds: 0.4, litSeconds: 0.3, dimOpacity: 0.5 };

// The pin is a pill at the top center: clear of the rail (y 22-30), the eyebrow on the left, the chapter tag on the
// right, the chapter intro's flight, the content band and the captions. It appears `delay` after a scene starts.
const PIN = { top: 46, height: 40, maxWidth: 640, maxChars: 48, delay: 0.5, leaveSeconds: 0.3, morphSeconds: 0.45, shift: 8 };

const px = (n) => `${Math.round(n)}px`;

// The layers the direction asks for, merged. Absent knobs add nothing, so a default build is unchanged.
export function mainLayers({ direction, theme, tl, scenes, transitions, fontsCss = "" }) {
  const parts = [
    direction.background === "world" && worldLayer({ theme, tl, transitions }),
    direction.rail === "on" && railLayer({ theme, tl, scenes }),
    direction.thread_pin === "on" && pinLayer({ theme, tl, scenes, thread: direction.thread, fontsCss }),
  ].filter(Boolean);
  return {
    back: parts.flatMap((part) => part.back ?? []),
    front: parts.flatMap((part) => part.front ?? []),
    files: Object.assign({}, ...parts.map((part) => part.files)),
    warnings: parts.flatMap((part) => part.warnings ?? []),
  };
}

// Writes the layers' compositions and removes those a knob has since turned off.
export function writeLayerFiles(compsDir, layers) {
  for (const name of LAYER_NAMES) {
    const file = join(compsDir, `_layer-${name}.html`);
    if (layers.files[name]) writeFileSync(file, layers.files[name]);
    else rmSync(file, { force: true });
  }
}

const host = (name, track, total) =>
  `<div id="el-layer-${name}" class="scene" data-composition-id="layer-${name}" data-composition-src="compositions/_layer-${name}.html" data-start="0" data-duration="${total}" data-track-index="${track}" data-width="1920" data-height="1080"></div>`;

// A layer's sub-composition: its css, its markup, and its tweens on one paused timeline.
function layerComposition(name, total, { css, html, js }, fontsCss = "") {
  return `<template id="layer-${name}-template">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
${fontsCss ? `${fontsCss}
` : ""}#root{position:absolute;inset:0;overflow:hidden;pointer-events:none}
${css.join("\n")}
</style>
<div id="root" data-composition-id="layer-${name}" data-start="0" data-duration="${total}" data-width="1920" data-height="1080">
${html}
</div>
<script>
(function () {
  var tl = gsap.timeline({ paused: true });
  ${js.join("\n  ")}
  tl.to({}, { duration: ${total} }, 0);
  window.__timelines["layer-${name}"] = tl;
})();
</script>
</template>
`;
}

// ---- world ----------------------------------------------------------------------------------------------

// A depth grid, drifting orbs and motes on a stage larger than the frame; at each scene boundary the camera
// glides to a new zone of it. Orbs and motes stay faint so text over them keeps its contrast.
function worldLayer({ theme, tl, transitions }) {
  const total = tl.total;
  const stage = WORLD.stage;
  const zones = cameraZones(tl.scenes.length);
  const orbAlpha = theme.dark ? 0.08 : 0.10;
  const dotAlpha = theme.dark ? 0.1 : 0.32;
  const random = seededRandom(WORLD.seed);
  const orbs = Array.from({ length: WORLD.orbs }, (_, n) => orbHtml(n, random, stage, rgba(n % 2 ? theme.colors.accent2 : theme.colors.accent, orbAlpha)));
  const motes = Array.from({ length: WORLD.motes }, (_, n) => moteHtml(n, random, stage));
  const { keepOut } = WORLD;
  const canvas = theme.colors.canvas;
  const composition = layerComposition("world", total, {
    css: [
      `#layer-world-cam{position:absolute;left:${px(stage.left)};top:${px(stage.top)};width:${px(stage.width)};height:${px(stage.height)};transform-origin:50% 50%}`,
      `#layer-world-grid{position:absolute;inset:0;background-image:radial-gradient(circle,${rgba(theme.colors.accent, dotAlpha)} 2px,transparent 2.5px);background-size:46px 46px}`,
      `#layer-world-orbs,#layer-world-motes{position:absolute;inset:0}`,
      `.layer-world-orb{position:absolute;border-radius:50%}`,
      `.layer-world-mote{position:absolute;width:6px;height:6px;border-radius:50%;background:${rgba(theme.colors.accent, 0.2)}}`,
      `#layer-world-veil{position:absolute;inset:0;background:radial-gradient(${keepOut.cornerWidth}px ${keepOut.cornerHeight}px at 100% 0%,${canvas} 40%,transparent),linear-gradient(to top,${canvas} ${keepOut.bottomSolid}px,transparent ${keepOut.bottomFade}px)}`,
    ],
    html: `<div id="layer-world-cam"><div id="layer-world-grid"></div><div id="layer-world-orbs">${orbs.join("")}</div><div id="layer-world-motes">${motes.join("")}</div></div><div id="layer-world-veil"></div>`,
    js: [...worldDrift(total), ...worldTravel(tl, transitions, zones)],
  });
  return { back: [host("world", WORLD_TRACK, total)], files: { world: composition } };
}

function orbHtml(n, random, stage, color) {
  const size = 700 + random() * 400;
  const [x, y] = [random() * (stage.width - size), random() * (stage.height - size)];
  return `<i id="layer-world-orb${n}" class="layer-world-orb" style="left:${px(x)};top:${px(y)};width:${px(size)};height:${px(size)};background:radial-gradient(circle,${color},transparent 68%)"></i>`;
}

function moteHtml(n, random, stage) {
  return `<i id="layer-world-mote${n}" class="layer-world-mote" style="left:${px(random() * stage.width)};top:${px(random() * stage.height)}"></i>`;
}

// Zone 0 is the frame as laid out; each later scene gets its own seeded offset and zoom.
function cameraZones(count) {
  const random = seededRandom(WORLD.seed + 1);
  const { x, y, zoom } = WORLD.zone;
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? { x: 0, y: 0, scale: 1 } : { x: Math.round((random() * 2 - 1) * x), y: Math.round((random() * 2 - 1) * y), scale: r3(1 + random() * zoom) });
}

function worldDrift(total) {
  return Object.entries(WORLD.drift).map(([layer, { x, y }]) => `tl.fromTo("#layer-world-${layer}",{x:0,y:0},{x:${x},y:${y},duration:${r3(total)},ease:"none"},0);`);
}

// The glide runs under the scene change, as long as its transition (a cut still glides, so the move shows).
function worldTravel(tl, transitions, zones) {
  return tl.scenes.slice(1).map((scene, i) => {
    const [from, to] = [zones[i], zones[i + 1]];
    const render = i === 0 ? "" : ",immediateRender:false"; // only the first glide sets the resting state
    const seconds = Math.max(TRANSITION_SECONDS[transitions[i + 1]] ?? 0, WORLD.travelSeconds);
    const state = (z) => `{x:${z.x},y:${z.y},scale:${z.scale}`;
    return `tl.fromTo("#layer-world-cam",${state(from)}},${state(to)},duration:${r3(seconds)},ease:"power2.inOut"${render}},${r3(scene.start)});`;
  });
}

// ---- rail -----------------------------------------------------------------------------------------------

// One segment per chapter (a run of scenes with the same `chapter` label; summary and close scenes are not
// chapters). It appears with the first chapter, lights each segment as its chapter starts, grows the fill
// across the chapter, stays full for the summary and leaves with the close.
function railLayer({ theme, tl, scenes }) {
  const chapters = chaptersOf(scenes, tl.scenes);
  if (chapters.length === 0) return { warnings: ['direction.rail is on but no scene has a "chapter" label, so there is no rail'] };
  const width = 1920 - RAIL.left - RAIL.right;
  const segment = (width - RAIL.gap * (chapters.length - 1)) / chapters.length;
  const segments = chapters.map((_, n) => `<div id="layer-rail-seg${n}" class="layer-rail-seg" style="left:${px(RAIL.left + n * (segment + RAIL.gap))};width:${px(segment)}"><i id="layer-rail-fill${n}" class="layer-rail-fill"></i></div>`);
  const close = tl.scenes.find((_, i) => isClose(scenes[i]));
  const composition = layerComposition("rail", tl.total, {
    css: [
      `.layer-rail-seg{position:absolute;top:${RAIL.top}px;height:${RAIL.height}px;border-radius:${RAIL.height / 2}px;background:${rgba(theme.colors.accent, 0.22)};overflow:hidden;opacity:${RAIL.dimOpacity}}`,
      `.layer-rail-fill{position:absolute;inset:0;border-radius:${RAIL.height / 2}px;background:${theme.colors.accent};transform-origin:left center;transform:scaleX(0)}`,
    ],
    html: `<div id="layer-rail">${segments.join("")}</div>`,
    js: railTimeline(chapters, close),
  });
  return { front: [host("rail", RAIL_TRACK, tl.total)], files: { rail: composition } };
}

function chaptersOf(scenes, timelineScenes) {
  const chapters = [];
  scenes.forEach((scene, i) => {
    const label = String(scene.chapter ?? "").trim();
    if (label === "" || isSummary(scene) || isClose(scene)) return;
    const { start, duration } = timelineScenes[i];
    const last = chapters[chapters.length - 1];
    if (last?.label === label) last.end = start + duration;
    else chapters.push({ label, start, end: start + duration });
  });
  return chapters;
}

function railTimeline(chapters, close) {
  const js = [`tl.fromTo("#layer-rail",{opacity:0},{opacity:1,duration:${RAIL.fadeSeconds},ease:"power2.out"},${r3(chapters[0].start)});`];
  chapters.forEach(({ start, end }, n) => {
    js.push(`tl.fromTo("#layer-rail-seg${n}",{opacity:${RAIL.dimOpacity}},{opacity:1,duration:${RAIL.litSeconds},ease:"power2.out"},${r3(start)});`);
    js.push(`tl.fromTo("#layer-rail-fill${n}",{scaleX:0},{scaleX:1,duration:${r3(end - start)},ease:"none"},${r3(start)});`);
  });
  if (close) js.push(`tl.fromTo("#layer-rail",{opacity:1},{opacity:0,duration:${RAIL.fadeSeconds},ease:"power2.in",immediateRender:false},${r3(close.start)});`);
  return js;
}

// ---- pin ------------------------------------------------------------------------------------------------

// A pill with the running example (direction.thread), from the first scene that is not a title, summary or close
// until the next one that is. A scene's `pin` text replaces it from that scene on: the old pill leaves as the new one
// arrives. One pill per distinct text, all at the same spot.
function pinLayer({ theme, tl, scenes, thread, fontsCss }) {
  if (String(thread ?? "").trim() === "") return { warnings: ["direction.thread_pin is on but direction.thread is empty, so there is no pin"] };
  const texts = pinTextsOf(scenes, String(thread).trim());
  const distinct = [...new Set(texts)];
  const pills = distinct.map((text, n) => `<div class="layer-pin-row"><div id="layer-pin-t${n}" class="layer-pin-pill"><i class="layer-pin-dot"></i><span>${esc(text)}</span></div></div>`);
  const accent = theme.colors.accent;
  const composition = layerComposition("pin", tl.total, {
    css: [
      `.layer-pin-row{position:absolute;left:0;width:1920px;top:${PIN.top}px;display:flex;justify-content:center}`,
      `.layer-pin-pill{display:flex;align-items:center;gap:10px;height:${PIN.height}px;max-width:${PIN.maxWidth}px;box-sizing:border-box;padding:0 22px;border-radius:100px;opacity:0;font:700 20px/1 "${theme.fonts.body}",sans-serif;color:${theme.derived.accentText};background:color-mix(in srgb,${accent} 10%,${theme.colors.canvas});white-space:nowrap}`,
      `.layer-pin-pill span{overflow:hidden;text-overflow:ellipsis}`,
      `.layer-pin-dot{flex:none;width:10px;height:10px;border-radius:50%;background:${accent}}`,
    ],
    html: pills.join(""),
    js: pinTimeline(scenes, tl, texts.map((text) => distinct.indexOf(text))),
  }, fontsCss);
  return { front: [host("pin", PIN_TRACK, tl.total)], files: { pin: composition } };
}

const isTitle = (scene) => scene.type === "title";
const hidesPin = (scene) => isTitle(scene) || isSummary(scene) || isClose(scene);

// The pin text in force at each scene: the thread until a scene sets its own `pin`, which holds from there on.
function pinTextsOf(scenes, thread) {
  let current = thread;
  return scenes.map((scene) => {
    if (scene.pin != null) current = validPin(scene);
    return current;
  });
}

function validPin(scene) {
  const text = String(scene.pin).trim();
  if (text === "" || text.length > PIN.maxChars) throw new Error(`${scene.id}: pin must be 1-${PIN.maxChars} characters, got ${JSON.stringify(scene.pin)}`);
  return text;
}

// Each time the shown pill changes at a scene boundary: a pill arrives (its first time from below, later ones back
// in place), the one it replaces leaves upward as it does, and a title, summary or close takes the pill away.
function pinTimeline(scenes, tl, indexes) {
  const js = [];
  const seen = new Set();
  let shown = null;
  scenes.forEach((scene, i) => {
    const want = hidesPin(scene) ? null : indexes[i];
    if (want === shown) return;
    const at = r3(tl.scenes[i].start + (want === null ? 0 : PIN.delay));
    if (shown !== null) js.push(`tl.to("#layer-pin-t${shown}",{opacity:0,y:${-PIN.shift},duration:${want === null ? PIN.leaveSeconds : PIN.morphSeconds},ease:"power2.in"},${at});`);
    if (want !== null) js.push(pinArrival(want, at, seen.has(want)));
    if (want !== null) seen.add(want);
    shown = want;
  });
  return js;
}

const pinArrival = (n, at, again) =>
  again
    ? `tl.to("#layer-pin-t${n}",{opacity:1,y:0,duration:${PIN.morphSeconds},ease:"power2.out"},${at});`
    : `tl.fromTo("#layer-pin-t${n}",{opacity:0,y:${PIN.shift}},{opacity:1,y:0,duration:${PIN.morphSeconds},ease:"power2.out"},${at});`;
