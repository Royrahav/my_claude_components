// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The opt-in motion knobs: camera drift, flowing connectors and the pinned running example. Each is checked against
// its absence, because the default look must not change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createScene } from "../lib/kit.mjs";
import { describeDirection, resolveDirection } from "../lib/direction.mjs";
import { driftMove } from "../lib/drift.mjs";
import { mainLayers } from "../lib/layers.mjs";
import { loadTheme } from "../lib/theme.mjs";

const THEME = loadTheme(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "themes", "labos", "theme.json"));
const sceneWith = (direction, { index = 0, html = [], duration = 10 } = {}) => {
  const k = createScene({ id: "s1", theme: THEME, fontsCss: "", brief: {}, scene: {}, duration, direction: resolveDirection(direction), index });
  k.html.push(...html);
  return k;
};
const camTween = (k) => k.js.find((line) => line.includes('"#s1-cam"'));
const PUSH = 'tl.fromTo("#s1-cam",{scale:1},{scale:1.02,duration:10,ease:"none"},0);';

// direction knobs --------------------------------------------------------------------------------------------

test("resolveDirection_cameraFlowsThreadPin_areKeptWhenSetAndAbsentOtherwise", () => {
  const set = resolveDirection({ camera: "drift", flows: "on", thread_pin: "on" });

  assert.deepEqual([set.camera, set.flows, set.thread_pin], ["drift", "on", "on"]);
  assert.deepEqual(["camera", "flows", "thread_pin"].map((field) => field in resolveDirection({ camera: null })), [false, false, false]);
  assert.match(describeDirection(set), /, camera drift, flows on, thread_pin on$/);
});

test("resolveDirection_unknownCameraFlowsOrThreadPin_throwsNamingTheValues", () => {
  assert.throws(() => resolveDirection({ camera: "shake" }), { message: 'brief.json direction.camera must be one of push, drift, got "shake"' });
  assert.throws(() => resolveDirection({ flows: "yes" }), /direction\.flows must be one of off, on/);
  assert.throws(() => resolveDirection({ thread_pin: 1 }), /direction\.thread_pin must be one of off, on/);
});

// camera drift -----------------------------------------------------------------------------------------------

test("driftMove_consecutiveScenes_neverMoveTheSameWay", () => {
  const key = (index) => JSON.stringify(driftMove(index));

  for (let index = 0; index < 40; index++) assert.notEqual(key(index), key(index + 1));
  assert.deepEqual(driftMove(7), driftMove(7));
});

test("driftMove_everyScene_zoomsAboutFourToFivePercentAndPansLittle", () => {
  for (let index = 0; index < 40; index++) {
    const { from, to } = driftMove(index);
    const away = from.scale > to.scale ? from : to;

    assert.ok(away.scale >= 1.04 && away.scale <= 1.055);
    assert.ok(Math.abs(away.x) <= 10 && Math.abs(away.y) <= 10);
  }
});

test("driftMove_consecutiveScenes_alternateZoomInAndZoomOut", () => {
  const zoomsIn = (index) => driftMove(index).from.scale === 1;

  for (let index = 0; index < 40; index++) assert.notEqual(zoomsIn(index), zoomsIn(index + 1));
});

test("ambient_cameraUnset_keepsTheTwoPercentPush", () => {
  const k = sceneWith({});
  k.ambient();

  assert.equal(camTween(k), PUSH);
});

test("ambient_cameraDrift_usesTheScenesOwnMove", () => {
  const first = sceneWith({ camera: "drift" }, { index: 0 });
  const second = sceneWith({ camera: "drift" }, { index: 1 });
  first.ambient();
  second.ambient();

  assert.match(camTween(first), /^tl\.fromTo\("#s1-cam",\{scale:[\d.]+,x:-?\d+,y:-?\d+\},\{scale:[\d.]+,x:-?\d+,y:-?\d+,duration:10,ease:"none"\},0\);$/);
  assert.notEqual(camTween(first), camTween(second));
});

test("ambient_driftInASceneThatDrivesItsOwnStage_keepsThePush", () => {
  const k = sceneWith({ camera: "drift" });
  k.camera("stage", 1, { focus: { x: 500, y: 400 } });
  k.ambient();

  assert.equal(camTween(k), PUSH);
});

// flowing connectors -----------------------------------------------------------------------------------------

const LINE = '<div id="s1-l1" class="line" style="left:0px;width:100px"></div>';

test("flow_flowsUnset_changesNothing", () => {
  const k = sceneWith({}, { html: [LINE] });
  k.flow("l1", 2);

  assert.deepEqual([k.html, k.js, k.css], [[LINE], [], []]);
});

test("flow_flowsOn_ridesDotsInsideTheLineAndEveryTweenEndsWithinTheScene", () => {
  const k = sceneWith({ flows: "on" }, { html: [LINE] });
  k.flow("l1", 2);
  const tweens = k.js.map((line) => line.match(/duration:([\d.]+),ease:"none"(?:,yoyo:true)?,repeat:(\d+)\},([\d.]+)\);$/)).filter(Boolean);

  assert.equal(k.html[0].match(/<i id="s1-fl0_\d" class="s1-fcar s1-fx">/g).length, 3);
  assert.equal(tweens.length, 6);
  for (const [, duration, repeat, start] of tweens) assert.ok(Number(start) + (Number(repeat) + 1) * Number(duration) <= 10 + 1e-9);
});

test("flow_dotsDimToNothingAtTheEndOfEveryTrip", () => {
  const k = sceneWith({ flows: "on" }, { html: [LINE] });
  k.flow("l1", 2);
  const fades = k.js.filter((line) => line.includes("yoyo:true"));

  for (const line of fades) assert.equal(Number(line.match(/repeat:(\d+)/)[1]) % 2, 1); // an odd repeat count ends back at opacity 0
  assert.equal(fades.length, 3);
});

// Start times and scene lengths that left a dot's last trip running past the scene or parked visible mid-line.
for (const [start, duration] of [[5, 10], [2, 9], [7.3, 10], [8.4, 10], [0.5, 4.7]]) {
  test("flow_startAt" + start + "InA" + duration + "sScene_everyTweenEndsInsideTheSceneWithEveryDotInvisible", () => {
    const k = sceneWith({ flows: "on" }, { html: [LINE], duration });
    k.flow("l1", start);
    const tweens = k.js.map((line) => ({ yoyo: line.includes("yoyo:true"), ...line.match(/duration:(?<d>[\d.]+),ease:"none"(?:,yoyo:true)?,repeat:(?<r>\d+)\},(?<s>[\d.]+)\);$/).groups }));
    const ends = tweens.map(({ d, r, s }) => Number(s) + (Number(r) + 1) * Number(d));
    const fades = tweens.filter(({ yoyo }) => yoyo);

    assert.ok(Math.max(...ends) <= duration + 0.05);
    assert.ok(fades.every(({ r }) => Number(r) % 2 === 1));
  });
}

test("flow_startingTooLateForAFullTrip_leavesTheDotsOut", () => {
  const k = sceneWith({ flows: "on" }, { html: [LINE] });
  k.flow("l1", 9);

  assert.deepEqual([k.html[0], k.js], [LINE, []]);
});

test("flow_verticalLine_slidesOnY", () => {
  const k = sceneWith({ flows: "on" }, { html: ['<div id="s1-l1" class="vln"></div>'] });
  k.flow("l1", 1, { axis: "y" });

  assert.ok(k.js.filter((line) => line.includes("Percent")).every((line) => line.includes("yPercent")) && k.html[0].includes("s1-fy"));
});

test("flow_sameSceneBuiltTwice_isIdentical", () => {
  const build = () => {
    const k = sceneWith({ flows: "on" }, { html: [LINE] });
    k.flow("l1", 2);
    return [k.html, k.js, k.css];
  };

  assert.deepEqual(build(), build());
});

test("flow_lineMissingOrNotEmpty_throwsNamingIt", () => {
  assert.throws(() => sceneWith({ flows: "on" }).flow("l1", 1), /s1: flow needs an empty <div id="s1-l1">/);
  assert.throws(() => sceneWith({ flows: "on" }, { html: ['<div id="s1-l1">text</div>'] }).flow("l1", 1), /flow needs an empty/);
});

// pinned running example -------------------------------------------------------------------------------------

const SCENES = [
  { id: "s1", type: "title" },
  { id: "s2", type: "split", chapter: "A" },
  { id: "s3", type: "steps", chapter: "B", pin: "smb://srvfs1/Reception" },
  { id: "s4", type: "cards", chapter: "B" },
  { id: "s5", type: "recap", chapter: "Recap" },
  { id: "s6", type: "close" },
];
const timelineOf = (scenes) => ({ total: scenes.length * 5, scenes: scenes.map((scene, i) => ({ id: scene.id, start: i * 5, duration: 5 })) });
const pinFor = (direction, scenes = SCENES) => mainLayers({ direction: resolveDirection(direction), theme: THEME, tl: timelineOf(scenes), scenes, transitions: scenes.map(() => "push") });
const pinTweens = (layers) => layers.files.pin.split("\n").filter((line) => line.includes('"#layer-pin-t'));

test("mainLayers_threadPinUnset_addsNoPinLayer", () => {
  assert.deepEqual(pinFor({ thread: "one job" }).files, {});
});

test("mainLayers_threadPinOnWithoutAThread_warnsAndDrawsNothing", () => {
  const layers = pinFor({ thread_pin: "on" });

  assert.deepEqual([layers.files, layers.front, layers.warnings.length], [{}, [], 1]);
});

test("mainLayers_threadPin_showsOnContentScenesAndLeavesForTitleSummaryAndClose", () => {
  const tweens = pinTweens(pinFor({ thread_pin: "on", thread: "one job" }));

  assert.match(tweens[0], /"#layer-pin-t0",\{opacity:0,y:8\},\{opacity:1,y:0.*\},5\.5\);$/); // s2 starts at 5, shown 0.5 s in
  assert.match(tweens[1], /"#layer-pin-t0",\{opacity:0,y:-8,duration:0\.45.*\},10\.5\);$/); // s3's own pin replaces it
  assert.match(tweens[2], /"#layer-pin-t1",\{opacity:0,y:8\},\{opacity:1.*\},10\.5\);$/);
  assert.match(tweens[3], /"#layer-pin-t1",\{opacity:0,y:-8,duration:0\.3.*\},20\);$/); // s5 is the summary
  assert.equal(tweens.length, 4);
});

test("mainLayers_threadPin_mountsAboveTheRailTrackAndHoldsBothTexts", () => {
  const layers = pinFor({ thread_pin: "on", thread: "one job", rail: "on" });

  assert.match(layers.front.find((host) => host.includes("layer-pin")), /data-track-index="5"/);
  assert.ok(layers.files.pin.includes("one job") && layers.files.pin.includes("smb://srvfs1/Reception"));
});

test("mainLayers_pinBlankOrTooLong_throwsNamingTheScene", () => {
  for (const pin of [" ", "x".repeat(49)])
    assert.throws(() => pinFor({ thread_pin: "on", thread: "t" }, [{ id: "s1", type: "split", pin }]), /s1: pin must be 1-48 characters/);
});
