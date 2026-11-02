// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The signature-scene effects of the kit (glow, sparks, camera) and the world background's transparent scenes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createScene, baseCss } from "../lib/kit.mjs";
import { resolveDirection } from "../lib/direction.mjs";
import { loadTheme } from "../lib/theme.mjs";

const THEME = loadTheme(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "themes", "labos", "theme.json"));
const newKit = (direction) => createScene({ id: "s1", theme: THEME, fontsCss: "", brief: {}, scene: {}, duration: 10, ...(direction ? { direction: resolveDirection(direction) } : {}) });
const durationOf = (line) => Number(line.match(/duration:([\d.]+)/)[1]);
const startOf = (line) => Number(line.match(/,(-?[\d.]+)\);$/)[1]);

// glow ----------------------------------------------------------------------------------------------------------

test("glow_swellsThenFades_inTwoBackToBackTweensOfOneElement", () => {
  const k = newKit();

  k.glow("a", 2);

  assert.equal(k.js.length, 2);
  assert.ok(k.js.every((line) => line.includes('"#s1-a"')));
  assert.equal(startOf(k.js[1]), startOf(k.js[0]) + durationOf(k.js[0]));
});

test("glow_neverShowsBeforeItsTime_andFollowsTheThemeAccent", () => {
  const k = newKit();

  k.glow("a", 2);

  assert.ok(k.js.every((line) => line.includes("immediateRender:false")));
  assert.match(k.js[0], /rgba\(0, 176, 138, 0\.6\)/);
});

test("glow_lively_playsFaster", () => {
  const calm = newKit();
  const lively = newKit({ motion: "lively" });
  calm.glow("a", 2);
  lively.glow("a", 2);

  assert.ok(durationOf(lively.js[0]) < durationOf(calm.js[0]));
});

// sparks --------------------------------------------------------------------------------------------------------

test("sparks_burst_emitsOneHiddenParticlePerCountAtThePoint", () => {
  const k = newKit();

  k.sparks({ x: 400, y: 300 }, 1, { count: 6 });

  assert.equal(k.html.length, 6);
  assert.ok(k.html.every((html) => html.includes("left:400px;top:300px")));
  assert.match(k.css.join(""), /\.s1-spark\{[^}]*opacity:0/);
});

test("sparks_sameBurstTwice_drawsTheSameParticles", () => {
  const [first, second] = [newKit(), newKit()];

  first.sparks({ x: 400, y: 300 }, 1);
  second.sparks({ x: 400, y: 300 }, 1);

  assert.deepEqual(first.js, second.js);
});

test("sparks_twoBursts_useDifferentParticlesAndOneStylesheetRule", () => {
  const k = newKit();

  k.sparks({ x: 400, y: 300 }, 1);
  k.sparks({ x: 400, y: 300 }, 3);

  assert.equal(new Set(k.html.map((html) => html.match(/id="([^"]+)"/)[1])).size, k.html.length);
  assert.equal(k.css.length, 1);
});

test("sparks_neverDrawsARandomNumber", () => {
  const k = newKit();

  k.sparks({ x: 10, y: 10 }, 0);

  assert.doesNotMatch(k.js.join("\n"), /Math\.random/);
});

test("sparks_eachParticleFliesOutThenFadesWithoutOverlappingItself", () => {
  const k = newKit();

  k.sparks({ x: 10, y: 10 }, 2.6, { count: 1 });

  const [out, fade] = k.js;
  assert.equal(startOf(fade), startOf(out) + durationOf(out));
});

// camera --------------------------------------------------------------------------------------------------------

test("camera_focus_centersThePointAtTheZoom", () => {
  const k = newKit();

  k.camera("stage", 3, { focus: { x: 1440, y: 480 }, zoom: 1.5 });

  assert.match(k.js[0], /\{x:0,y:0,scale:1,transformOrigin:"0 0"\},\{x:-1200,y:-180,scale:1.5,transformOrigin:"0 0"/);
});

test("camera_withoutFocus_pullsBackToTheFullPictureFromWhereItWas", () => {
  const k = newKit();

  k.camera("stage", 3, { focus: { x: 1440, y: 480 }, zoom: 1.5 });
  k.camera("stage", 6);

  assert.match(k.js[1], /\{x:-1200,y:-180,scale:1.5,transformOrigin:"0 0"\},\{x:0,y:0,scale:1,/);
});

test("camera_onlyTheFirstMoveSetsTheRestingState", () => {
  const k = newKit();

  k.camera("stage", 3, { focus: { x: 100, y: 100 } });
  k.camera("stage", 6);

  assert.deepEqual(k.js.map((line) => line.includes("immediateRender:false")), [false, true]);
});

// the world background -------------------------------------------------------------------------------------------

test("baseCss_backgroundWorld_paintsNoCanvasSoTheWorldShowsThrough", () => {
  assert.match(baseCss(newKit({ background: "world" })), /\.s1-bg\{[^}]*background:transparent/);
});

test("baseCss_otherBackgrounds_stillPaintTheCanvas", () => {
  for (const background of ["grid", "soft", "plain"]) assert.match(baseCss(newKit({ background })), /\.s1-bg\{[^}]*background:var\(--canvas\)/);
});

test("ambient_backgroundWorld_onlyPushesTheCamera", () => {
  const k = newKit({ background: "world" });

  k.ambient();

  assert.equal(k.js.length, 1);
  assert.match(k.js[0], /#s1-cam/);
});

test("baseCss_backgroundWorld_backsTheChapterTagOpaquelySoItsContrastIgnoresTheWorld", () => {
  assert.match(baseCss(newKit({ background: "world" })), /\.s1-tag\{[^}]*background:color-mix\(in srgb,var\(--accent\) 10%,var\(--canvas\)\)/);
});

test("baseCss_otherBackgrounds_keepTheTranslucentChapterTag", () => {
  assert.match(baseCss(newKit()), /\.s1-tag\{[^}]*background:var\(--tint2\)/);
});
