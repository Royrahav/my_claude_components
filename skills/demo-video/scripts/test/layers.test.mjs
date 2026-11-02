// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The persistent layers of the main composition: the world behind the scenes and the chapter rail above them.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDirection } from "../lib/direction.mjs";
import { NO_LAYERS, mainLayers, writeLayerFiles } from "../lib/layers.mjs";
import { writeIndex } from "../lib/assemble.mjs";
import { loadTheme } from "../lib/theme.mjs";

const themeNamed = (name) => loadTheme(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "themes", name, "theme.json"));
const LABOS = themeNamed("labos");
const MIDNIGHT = themeNamed("midnight");

// Scenes of 5 s each, back to back.
const SCENES = [
  { id: "s1", type: "title" },
  { id: "s2", type: "split", chapter: "Problem" },
  { id: "s3", type: "steps", chapter: "Design" },
  { id: "s4", type: "cards", chapter: "Design" },
  { id: "s5", type: "recap", chapter: "Recap" },
  { id: "s6", type: "close" },
];
const timelineOf = (scenes) => ({ total: scenes.length * 5, scenes: scenes.map((scene, i) => ({ id: scene.id, start: i * 5, duration: 5 })) });
const layersFor = (direction, { theme = LABOS, scenes = SCENES } = {}) =>
  mainLayers({ direction: resolveDirection(direction), theme, tl: timelineOf(scenes), scenes, transitions: scenes.map((_, i) => (i === 0 ? null : "push")) });
const trackOf = (host) => Number(host.match(/data-track-index="(\d+)"/)[1]);
const countOf = (text, needle) => text.split(needle).length - 1;

// defaults --------------------------------------------------------------------------------------------------

test("mainLayers_originalLook_addsNothing", () => {
  assert.deepEqual(layersFor({}), { back: [], front: [], files: {}, warnings: [] });
});

test("mainLayers_otherBackgrounds_addNoWorld", () => {
  for (const background of ["grid", "plain", "soft"]) assert.deepEqual(layersFor({ background }).files, {});
});

// world -------------------------------------------------------------------------------------------------------

test("mainLayers_backgroundWorld_mountsOneWorldHostBehindTheScenes", () => {
  const { back, front, files } = layersFor({ background: "world" });

  assert.equal(back.length, 1);
  assert.match(back[0], /data-composition-src="compositions\/_layer-world.html" data-start="0" data-duration="30"/);
  assert.deepEqual([front, Object.keys(files)], [[], ["world"]]);
});

test("mainLayers_world_glidesTheCameraAtEverySceneBoundary", () => {
  const { world } = layersFor({ background: "world" }).files;

  assert.equal(countOf(world, 'tl.fromTo("#layer-world-cam"'), SCENES.length - 1);
  for (let boundary = 5; boundary <= 25; boundary += 5) assert.match(world, new RegExp(`\\},${boundary}\\);`));
});

test("mainLayers_world_onlyTheFirstGlideSetsTheRestingState", () => {
  const glides = layersFor({ background: "world" }).files.world.split("\n").filter((line) => line.includes('tl.fromTo("#layer-world-cam"'));

  assert.deepEqual(glides.map((line) => line.includes("immediateRender:false")), [false, true, true, true, true]);
});

test("mainLayers_world_isDeterministicAndNeverRandom", () => {
  const first = layersFor({ background: "world" }).files.world;

  assert.equal(layersFor({ background: "world" }).files.world, first);
  assert.doesNotMatch(first, /Math\.random/);
});

test("mainLayers_world_keepsOutOfTheTopRightCornerAndTheBottomStrip", () => {
  const { world } = layersFor({ background: "world" }).files;

  assert.match(world, /#layer-world-veil\{[^}]*at 100% 0%[^}]*to top/);
});

test("mainLayers_world_followsTheThemeColors", () => {
  const light = layersFor({ background: "world" }, { theme: LABOS }).files.world;
  const dark = layersFor({ background: "world" }, { theme: MIDNIGHT }).files.world;

  assert.ok(light.includes("0, 176, 138") && light.includes(LABOS.colors.canvas));
  assert.ok(dark.includes("45, 212, 191") && dark.includes(MIDNIGHT.colors.canvas));
});

test("mainLayers_world_lightThemeDrawsStrongerGridDotsThanDark", () => {
  const dotAlpha = (theme) => Number(layersFor({ background: "world" }, { theme }).files.world.match(/#layer-world-grid\{[^}]*radial-gradient\(circle,rgba\([^)]*, ([\d.]+)\) 2px/)[1]);

  assert.ok(dotAlpha(LABOS) > dotAlpha(MIDNIGHT));
});

// rail --------------------------------------------------------------------------------------------------------

test("mainLayers_railOn_mountsOneRailHostAboveTheScenes", () => {
  const { back, front, files } = layersFor({ rail: "on" });

  assert.deepEqual([back, front.length, Object.keys(files)], [[], 1, ["rail"]]);
  assert.ok(trackOf(front[0]) > 2);
});

test("mainLayers_rail_hasOneSegmentPerChapterRun", () => {
  const { rail } = layersFor({ rail: "on" }).files;

  assert.equal(countOf(rail, 'class="layer-rail-seg"'), 2);
});

test("mainLayers_rail_growsEachFillAcrossItsChapter", () => {
  const { rail } = layersFor({ rail: "on" }).files;

  assert.match(rail, /tl\.fromTo\("#layer-rail-fill0",\{scaleX:0\},\{scaleX:1,duration:5,ease:"none"\},5\);/);
  assert.match(rail, /tl\.fromTo\("#layer-rail-fill1",\{scaleX:0\},\{scaleX:1,duration:10,ease:"none"\},10\);/);
});

test("mainLayers_rail_summaryIsNotAChapterAndTheRailLeavesWithTheClose", () => {
  const { rail } = layersFor({ rail: "on" }).files;

  assert.doesNotMatch(rail, /layer-rail-fill2/);
  assert.match(rail, /tl\.fromTo\("#layer-rail",\{opacity:1\},\{opacity:0,[^}]*\},25\);/);
});

test("mainLayers_railWithoutChapterLabels_warnsAndMountsNothing", () => {
  const scenes = SCENES.map(({ chapter, ...scene }) => scene);

  const layers = layersFor({ rail: "on" }, { scenes });

  assert.deepEqual([layers.front, layers.files], [[], {}]);
  assert.match(layers.warnings[0], /direction\.rail is on but no scene has a "chapter" label/);
});

test("mainLayers_railAndWorld_mountBothLayers", () => {
  const layers = layersFor({ rail: "on", background: "world" });

  assert.deepEqual(Object.keys(layers.files).sort(), ["rail", "world"]);
  assert.notEqual(trackOf(layers.back[0]), trackOf(layers.front[0]));
});

// files and index.html ----------------------------------------------------------------------------------------

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dv-layers-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

test("writeLayerFiles_layerTurnedOff_removesItsStaleFile", () => {
  writeLayerFiles(root, layersFor({ rail: "on", background: "world" }));
  assert.ok(existsSync(join(root, "_layer-world.html")) && existsSync(join(root, "_layer-rail.html")));

  writeLayerFiles(root, layersFor({ rail: "on" }));

  assert.deepEqual([existsSync(join(root, "_layer-world.html")), existsSync(join(root, "_layer-rail.html"))], [false, true]);
});

test("writeIndex_layers_mountTheWorldBeforeTheScenesAndTheRailAfterThem", () => {
  const tl = timelineOf(SCENES);
  writeIndex(root, tl, SCENES, {}, { canvas: "#FFFFFF", captions: false, sfxOn: false, layers: layersFor({ rail: "on", background: "world" }) });
  const html = readFileSync(join(root, "index.html"), "utf8");

  const at = (id) => html.indexOf(`id="${id}"`);
  assert.ok(at("el-layer-world") < at("el-s1") && at("el-s6") < at("el-layer-rail"));
});

test("writeIndex_noLayers_isTheOriginalIndex", () => {
  const tl = timelineOf(SCENES);
  writeIndex(root, tl, SCENES, {}, { canvas: "#FFFFFF", captions: false, sfxOn: false });
  const html = readFileSync(join(root, "index.html"), "utf8");

  assert.doesNotMatch(html, /el-layer-world|el-layer-rail/);
  assert.equal(NO_LAYERS.back.length, 0);
});

// reserved names: a scene id can never collide with a layer ---------------------------------------------------

test("writeLayerFiles_layersOff_leavesACustomSceneNamedWorldOrRailAlone", () => {
  for (const id of ["world", "rail"]) writeFileSync(join(root, `${id}.html`), "<custom>");

  writeLayerFiles(root, layersFor({}));

  assert.deepEqual(["world", "rail"].map((id) => existsSync(join(root, `${id}.html`))), [true, true]);
});

test("mainLayers_layers_useNamesNoSceneIdCanProduce", () => {
  const layers = layersFor({ rail: "on", background: "world" });

  assert.ok([...layers.back, ...layers.front].every((host) => /id="el-layer-/.test(host) && /compositions\/_layer-/.test(host)));
});
