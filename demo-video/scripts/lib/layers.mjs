// Persistent layers that sit outside every scene: the world (direction.background "world") behind the scenes
// and the chapter rail (direction.rail "on") above them. Each is its own sub-composition, mounted by
// index.html over the whole video, with seek-safe fromTo tweens and no Math.random.
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TRANSITION_SECONDS, seededRandom } from "./direction.mjs";
import { isClose, isSummary } from "./house-style.mjs";
import { rgba } from "./theme.mjs";
import { r3 } from "./util.mjs";

// `back` and `front` are the hosts index.html mounts behind and above the scenes; `files` maps a layer's
// composition name to its html.
export const NO_LAYERS = Object.freeze({ back: [], front: [], files: {}, warnings: [] });
const LAYER_NAMES = ["world", "rail"];

const WORLD_TRACK = 3;
const RAIL_TRACK = 4;
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

const px = (n) => `${Math.round(n)}px`;

// The layers the direction asks for, merged. Absent knobs add nothing, so a default build is unchanged.
export function mainLayers({ direction, theme, tl, scenes, transitions }) {
  const parts = [
    direction.background === "world" && worldLayer({ theme, tl, transitions }),
    direction.rail === "on" && railLayer({ theme, tl, scenes }),
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
function layerComposition(name, total, { css, html, js }) {
  return `<template id="layer-${name}-template">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
#root{position:absolute;inset:0;overflow:hidden;pointer-events:none}
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
