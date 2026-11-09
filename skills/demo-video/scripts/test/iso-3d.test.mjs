// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The 3D kit's primitives without the road (k.iso): the animator that chains moves, the stage (place, label, link, pad,
// disc), the camera language (focus, orbit, crane, dolly), the objects that act on cue, and the 3D flag the house-style
// rules read.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createScene } from "../lib/kit.mjs";
import { makeCue } from "../lib/timeline.mjs";
import { contrast, loadTheme } from "../lib/theme.mjs";
import { animator } from "../lib/iso-tween.mjs";
import { OBJECT_KINDS } from "../lib/iso-objects.mjs";
import isoJourney from "../lib/scenes/iso-journey.mjs";
import isoMap from "../lib/scenes/iso-map.mjs";

const THEMES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "themes");
const THEME_NAMES = ["labos", "labos-dark", "midnight"];
const themes = Object.fromEntries(THEME_NAMES.map((name) => [name, loadTheme(join(THEMES, name, "theme.json"))]));
const labos = themes.labos;
const DURATION = 20;

const newKit = (theme = labos) => createScene({ id: "s1", theme, fontsCss: "", brief: {}, scene: {}, duration: DURATION });
// The tweens an element received: { from, to, start, duration, immediate } in emission order.
const tweensOf = (k, id) => k.js
  .filter((line) => line.startsWith(`tl.fromTo("#s1-${id}",`))
  .map((line) => ({ from: line.match(/",(\{[^}]*\}),\{/)[1], to: line.match(/\},(\{.*\}),[\d.]+\);$/)[1], start: Number(line.match(/,([\d.]+)\);$/)[1]), duration: Number(line.match(/duration:([\d.]+)/)[1]), immediate: !line.includes("immediateRender:false") }));
const startsOf = (tweens) => tweens.map(({ start }) => start);

// animator ------------------------------------------------------------------------------------------------

test("animator_chainedMoves_eachStartsWhereThePreviousEnded", () => {
  const k = newKit();
  const lift = animator(k, "box");

  lift.move({ z: 100 }, 2, { dur: 1 });
  lift.move({ z: 40 }, 5, { dur: 1 });

  const [, up, down] = tweensOf(k, "box");
  assert.equal(up.from, "{z:0}");
  assert.equal(down.from, "{z:100}");
});

test("animator_firstMoveAtALaterTime_isPrecededByOneBaselineAtTimeZeroAndNeverRendersEarly", () => {
  const k = newKit();
  const mover = animator(k, "box", { opacity: 0 });

  mover.move({ opacity: 1 }, 4, { dur: 0.5 });
  mover.move({ z: 30 }, 6, { dur: 0.5 });

  const tweens = tweensOf(k, "box");
  assert.deepEqual(tweens.filter(({ immediate }) => immediate).length, 1);
  assert.equal(tweens[0].start, 0);
  assert.equal(tweens[0].from, "{opacity:0,z:0}");
  assert.ok(tweens.slice(1).every(({ immediate }) => !immediate));
});

test("animator_holdState_isTheBaselineAndTheStartOfTheNextMove", () => {
  const k = newKit();
  const mover = animator(k, "box");

  mover.hold({ scale: 0.001 });
  mover.move({ scale: 1 }, 3, { dur: 0.6 });

  const [baseline, grow] = tweensOf(k, "box");
  assert.equal(baseline.from, "{scale:0.001}");
  assert.equal(grow.from, "{scale:0.001}");
});

test("animator_moveThatWouldTouchThePreviousOneOnTheSameProperty_startsJustAfterIt", () => {
  const k = newKit();
  const mover = animator(k, "box");

  mover.move({ rotation: 90 }, 2, { dur: 1 });
  mover.move({ rotation: 0 }, 3, { dur: 1 });
  mover.move({ x: 50 }, 3, { dur: 1 });

  const [, first, second, other] = tweensOf(k, "box");
  assert.ok(second.start > first.start + first.duration);
  assert.equal(other.start, 3);
});

test("animator_moves_areSeekSafeFromTosOfTransformsAndOpacityOnly", () => {
  const k = newKit();
  const mover = animator(k, "box", { opacity: 0 });

  mover.move({ x: 10, y: 20, z: 30, rotation: 45, scale: 2, scaleX: 0.5, opacity: 1 }, 1, { dur: 1 });

  assert.ok(k.js.every((line) => line.startsWith("tl.fromTo(") && !/[{,](left|top|width|height):/.test(line)));
});

// the stage ----------------------------------------------------------------------------------------------

test("stage_isBuilt_marksTheSceneAs3dAndASecondStageIsRefused", () => {
  const k = newKit();
  assert.equal(k.is3d, false);

  const stage = k.iso.stage();
  stage.mount();

  assert.equal(k.is3d, true);
  assert.throws(() => k.iso.stage(), /builds one 3D stage/);
});

test("stage_aSceneWithoutOne_staysNot3d", () => {
  const k = newKit();

  k.rise("t", 1);

  assert.equal(k.is3d, false);
});

test("stage_builtInTemplates_markTheSceneAs3d", () => {
  for (const [template, data] of [[isoJourney, { stops: [{ title: "A", kind: "users" }, { title: "B", kind: "server" }] }], [isoMap, { stops: [{ title: "A", kind: "users" }, { title: "B", kind: "server" }], takeaways: [{ title: "x" }, { title: "y" }] }]]) {
    const k = newKit();

    template(k, data, makeCue({ id: "s1", type: "x", start: 0, duration: DURATION, speechEnd: 17, words: [] }, []));

    assert.equal(k.is3d, true);
  }
});

test("stage_mount_buildsTheCameraWrappersInOrderWithOwnTransformRoles", () => {
  const k = newKit();
  const stage = k.iso.stage({ tilt: { x: 70, z: -10 } });

  stage.mount();

  const html = k.html.join("");
  const order = ["cam3", "tilt", "spin", "track"].map((name) => html.indexOf(`id="s1-${name}"`));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.match(k.css.join(""), /\.s1-tilt\{[^}]*transform:rotateX\(70deg\)/);
  assert.match(k.css.join(""), /\.s1-spin\{[^}]*transform:rotateZ\(-10deg\)/);
});

test("stage_place_putsAnObjectAtAnyXYZ_andRecordsItsRevealAtZero", () => {
  const k = newKit();
  const stage = k.iso.stage();

  const lock = stage.place("lock", { name: "lk", x: 1500, y: 1700, z: 40 });
  lock.move({ x: 1600, z: 90 }, 6, { dur: 1 });
  stage.mount();

  const [baseline, move] = tweensOf(k, "lk");
  assert.equal(baseline.from, "{x:1500,y:1700,z:40}");
  assert.deepEqual([move.from, move.to.startsWith("{x:1600,z:90,")], ["{x:1500,z:40}", true]);
  assert.ok(lock.height > 0);
  assert.ok(k.visibleIntervals().some(({ from }) => from === 0));
});

test("stage_hiddenObject_waitsScaledToNothingUntilItsAppearCue", () => {
  const k = newKit();
  const stage = k.iso.stage();

  const gear = stage.place("gear", { name: "gr", x: 1800, y: 1800, hidden: true });
  gear.appear(6);

  const [baseline, grow] = tweensOf(k, "gr");
  assert.equal(baseline.from, "{x:1800,y:1800,z:0,scale:0.001,scaleZ:0.001}");
  assert.equal(grow.start, 6);
  assert.deepEqual(k.visibleIntervals(), [{ from: 6, until: Infinity }]);
});

test("stage_placeWithoutAName_orWithAnUnknownKind_stopsTheBuildNamingTheValidKinds", () => {
  const stage = newKit().iso.stage();

  assert.throws(() => stage.place("lock", { x: 0, y: 0 }), /needs a name/);
  assert.throws(() => stage.place("toaster", { name: "t", x: 0, y: 0 }), (error) => OBJECT_KINDS.every((kind) => error.message.includes(kind)));
});

test("stage_runUnknownAction_stopsTheBuildNamingTheActionsTheKindHas", () => {
  const lock = newKit().iso.stage().place("lock", { name: "lk", x: 0, y: 0 });

  assert.throws(() => lock.run("explode", 1), /lock has no action "explode" \(has: open, close\)/);
});

test("stage_label_risesOnItsCueAndTurnsWithTheCamera", () => {
  const k = newKit();
  const stage = k.iso.stage();

  const label = stage.label({ x: 1800, y: 1800, z: 200, text: "Scope", name: "lb" });
  label.show(4);
  stage.mount();
  k.iso.camera(stage).orbit(2, { degrees: 90, dur: 3 });

  assert.ok(tweensOf(k, "lb").some(({ start }) => start === 4));
  assert.equal(tweensOf(k, "bb0").length, 2);
  assert.match(k.html.join(""), /id="s1-bb0" class="s1-lbl" style="transform:rotateZ\(36deg\) rotateX\(-56deg\)"/);
});

test("stage_link_growsFromItsStartOnItsCueAsALeafTransform", () => {
  const k = newKit();
  const stage = k.iso.stage();

  stage.link({ name: "ln", from: { x: 1800, y: 1800 }, to: { x: 2100, y: 1800 } }).draw(5, { dur: 0.5 });

  const [baseline, draw] = tweensOf(k, "ln");
  assert.equal(baseline.from, "{scaleX:0}");
  assert.deepEqual([draw.start, draw.duration, draw.to.includes("scaleX:1")], [5, 0.5, true]);
});

test("stage_padAndDisc_padLightsAndDimsALeafLampOnCue", () => {
  const k = newKit();
  const stage = k.iso.stage();

  stage.disc({ x: 1800, y: 1800, r: 300, dashed: true });
  const pad = stage.pad({ name: "pd", x: 1800, y: 1800, w: 280, d: 250 });
  pad.light(3);
  pad.dim(8);

  assert.ok(k.html.length === 0);
  assert.deepEqual(tweensOf(k, "pd").map(({ to }) => to.match(/opacity:(\d)/)[1]), ["0", "1", "0"]);
});

// the camera ---------------------------------------------------------------------------------------------

const withCamera = (theme = labos, labels = 2) => {
  const k = newKit(theme);
  const stage = k.iso.stage();
  for (let i = 0; i < labels; i++) stage.label({ x: 1800 + i * 100, y: 1800, z: 100, text: `L${i}`, name: `lb${i}` });
  stage.mount();
  return { k, stage, camera: k.iso.camera(stage) };
};
const valueOf = (text, key) => Number(text.match(new RegExp(`${key}:(-?[\\d.]+)`))[1]);

test("camera_orbit_turnsTheSpinWrapperAndEveryBillboardTheOtherWay", () => {
  const { k, camera } = withCamera();

  camera.orbit(2, { degrees: 90, dur: 4 });

  const [spinTween] = tweensOf(k, "spin").slice(1);
  assert.equal(valueOf(spinTween.to, "rotation") - valueOf(spinTween.from, "rotation"), 90);
  for (const id of ["bb0", "bb1"]) {
    const [turn] = tweensOf(k, id).slice(1);
    assert.equal(valueOf(turn.to, "rotation"), -valueOf(spinTween.to, "rotation"));
  }
});

test("camera_secondOrbit_startsWhereTheFirstEnded", () => {
  const { k, camera } = withCamera();

  camera.orbit(2, { degrees: 60, dur: 2 });
  camera.orbit(6, { degrees: -30, dur: 2 });

  const [, first, second] = tweensOf(k, "spin");
  assert.equal(valueOf(second.from, "rotation"), valueOf(first.to, "rotation"));
  assert.equal(valueOf(second.to, "rotation"), valueOf(first.to, "rotation") - 30);
});

test("camera_crane_changesTheTiltAndLeansEveryBillboardBack", () => {
  const { k, camera } = withCamera();

  camera.crane(3, { tilt: 80, dur: 2 });

  const [, tilt] = tweensOf(k, "tilt");
  const [, lean] = tweensOf(k, "bb0");
  assert.deepEqual([valueOf(tilt.from, "rotationX"), valueOf(tilt.to, "rotationX"), valueOf(lean.to, "rotationX")], [56, 80, -80]);
});

test("camera_dolly_isClampedWellInsideThePerspectiveDistance", () => {
  const { k, camera } = withCamera();

  camera.dolly(1, { z: 5000 });
  camera.dolly(5, { z: -9000 });

  const [, near, far] = tweensOf(k, "tilt");
  assert.ok(valueOf(near.to, "z") < 1000);
  assert.ok(valueOf(far.to, "z") > -1500);
});

test("camera_startedFromAPlacedDolly_holdsItFromTimeZero", () => {
  const { k, camera } = withCamera();

  camera.place({ focus: { x: 1800, y: 1800 }, zoom: 0.9, lift: 40, dolly: -100 });

  assert.equal(tweensOf(k, "tilt")[0].from, "{z:-100}");
  assert.equal(tweensOf(k, "cam3")[0].from, "{scale:0.9,y:40}");
});

test("camera_craneThenDollyThenOrbit_eachMoveTweensOnlyItsOwnPropertiesSoNothingJumpsBack", () => {
  const { k, camera } = withCamera();

  camera.crane(1, { tilt: 80, dur: 1 });
  camera.dolly(3, { z: -200, dur: 1 });
  camera.orbit(5, { degrees: 45, dur: 1 });

  const [baseline, , dolly] = tweensOf(k, "tilt");
  const [spinBaseline, orbitSpin] = tweensOf(k, "spin");
  const orbitTurn = tweensOf(k, "bb0").pop();
  assert.equal(valueOf(dolly.from, "z"), valueOf(baseline.to, "z"));
  assert.ok(!dolly.from.includes("rotationX") && !dolly.to.includes("rotationX"));
  assert.equal(valueOf(orbitSpin.from, "rotation"), valueOf(spinBaseline.to, "rotation"));
  assert.ok(!orbitTurn.from.includes("rotationX") && !orbitTurn.to.includes("rotationX"));
});

test("camera_focus_slidesTheTrackSoThePointComesToTheMiddle", () => {
  const { k, stage, camera } = withCamera();

  camera.focus(2, { x: stage.center + 200, y: stage.center - 100 }, { dur: 1 });

  const [, move] = tweensOf(k, "track");
  assert.deepEqual([valueOf(move.to, "x"), valueOf(move.to, "y")], [-200, 100]);
});

test("camera_withoutOrbitOrCrane_leavesTheWrappersToTheirStaticTransforms", () => {
  const { k, camera } = withCamera();

  camera.focus(2, { x: 1700, y: 1800 });

  assert.deepEqual([tweensOf(k, "tilt").length, tweensOf(k, "spin").length, tweensOf(k, "bb0").length], [0, 0, 0]);
});

// the objects that act ------------------------------------------------------------------------------------

const ACTORS = ["lock", "gear", "layers", "scanner", "crash", "key", "token", "clock"];

test("actors_everyKind_isInTheLibraryAndBuildsOnLightAndDarkThemes", () => {
  for (const name of THEME_NAMES)
    for (const kind of ACTORS) {
      const k = newKit(themes[name]);
      const stage = k.iso.stage();

      const placed = stage.place(kind, { name: "ob", x: stage.center, y: stage.center });
      stage.mount();

      assert.ok(OBJECT_KINDS.includes(kind), kind);
      assert.ok(placed.height > 0, kind);
      assert.match(k.html.join(""), /id="s1-ob"/, kind);
    }
});


// The ids of the elements that hold 3D children (the classes the stage css gives preserve-3d).
function preserve3dIds(k) {
  const classes = new Set([...k.css.join("\n").matchAll(/\.s1-(\w+)\{[^}]*transform-style:preserve-3d/g)].map((match) => `s1-${match[1]}`));
  return [...k.html.join("\n").matchAll(/id="(s1-[\w-]+)" class="([^"]*)"/g)].filter((match) => match[2].split(" ").some((name) => classes.has(name))).map((match) => match[1]);
}

const runEveryAction = (kind, name = "ob", at = 1800) => {
  const k = newKit();
  const stage = k.iso.stage();
  const placed = stage.place(kind, { name, x: at, y: at });
  stage.mount();
  placed.actions.forEach((action, n) => placed.run(action, 2 + n * 4));
  return k;
};

test("actors_everyActionOfEveryKind_neverFadesAPreserve3dElementAndTweensTransformsAndOpacityOnly", () => {
  for (const kind of ACTORS) {
    const k = runEveryAction(kind);
    const containers = preserve3dIds(k);

    assert.ok(containers.length > 3, kind);
    for (const id of containers) assert.deepEqual(k.js.filter((line) => line.includes(`"#${id}"`) && line.includes("opacity")), [], `${kind} ${id}`);
    assert.ok(k.js.filter((line) => line.startsWith("tl.fromTo(")).every((line) => !/[{,](left|top|width|height):/.test(line)), kind);
  }
});

test("actors_sameKindBuiltTwice_isIdentical", () => {
  for (const kind of ACTORS) {
    const [first, second] = [runEveryAction(kind), runEveryAction(kind)];

    assert.deepEqual([first.html.join(""), first.js], [second.html.join(""), second.js], kind);
  }
});

test("lock_openThenClose_liftsAndSwingsTheShackleThenReversesItInOrder", () => {
  const k = newKit();
  const lock = k.iso.stage().place("lock", { name: "lk", x: 1800, y: 1800 });

  lock.run("open", 3);
  lock.run("close", 9);

  const moves = tweensOf(k, "lk_shackle").slice(1);
  assert.deepEqual(moves.map(({ to }) => to.match(/^\{(\w+):/)[1]), ["z", "rotation", "rotation", "z"]);
  assert.deepEqual(startsOf(moves).slice(0, 2), [3, 3.3]);
  assert.ok(moves[2].from.includes("rotation:100") && moves[3].from.includes("z:52"));
});

test("layers_lightAndDim_switchTheNamedLayersLampAndAnchorsGiveEachLayersHeight", () => {
  const k = newKit();
  const stack = k.iso.stage().place("layers", { name: "st", x: 1800, y: 1800, count: 4 });

  stack.run("light", 4, { index: 2 });
  stack.run("dim", 8, { index: 2 });

  assert.deepEqual(tweensOf(k, "st_lamp2").map(({ to }) => to.match(/opacity:(\d)/)[1]), ["0", "1", "0"]);
  assert.equal(tweensOf(k, "st_lamp0").length, 0);
  assert.ok(stack.anchors.layerTop(3) > stack.anchors.layerTop(2) && stack.height === stack.anchors.layerTop(3));
});

test("layers_countOutsideTwoToSix_isClamped", () => {
  const stage = newKit().iso.stage();

  assert.equal(stage.place("layers", { name: "a", x: 0, y: 0, count: 1 }).anchors.count, 2);
  assert.equal(stage.place("layers", { name: "b", x: 0, y: 0, count: 99 }).anchors.count, 6);
});

test("gear_spinTwice_turnsTheGearsAgainstEachOtherAndAccumulates", () => {
  const k = newKit();
  const gears = k.iso.stage().place("gear", { name: "gr", x: 1800, y: 1800 });

  gears.run("spin", 2, { turns: 1 });
  gears.run("spin", 6, { turns: 1 });

  const [, , big2] = tweensOf(k, "gr_big");
  const [, small1] = tweensOf(k, "gr_small");
  assert.equal(valueOf(big2.to, "rotation"), 720);
  assert.ok(valueOf(small1.to, "rotation") < 0);
});

test("crash_shards_waitScaledToNothingAndBurstOnlyOnTheCrash", () => {
  const k = newKit();
  const crate = k.iso.stage().place("crash", { name: "cr", x: 1800, y: 1800 });

  crate.run("crack", 3);
  crate.run("crash", 5);

  const shard = tweensOf(k, "cr_sh0");
  assert.ok(shard[0].from.startsWith("{scale:0.001,") && shard[0].immediate && shard[0].start === 0);
  assert.ok(shard.slice(1).every(({ start }) => start >= 5));
  assert.ok(tweensOf(k, "cr_crack").length > 0 && tweensOf(k, "cr_left").some(({ to }) => to.includes("rotation:-24")));
});

test("scanner_sweepTwice_goesOneWayThenBackAndLightsEachCrateAsTheBeamPasses", () => {
  const k = newKit();
  const scanner = k.iso.stage().place("scanner", { name: "sc", x: 1800, y: 1800 });

  scanner.run("sweep", 3, { dur: 2 });
  scanner.run("sweep", 9, { dur: 2 });

  const [, there, back] = tweensOf(k, "sc_gantry");
  assert.deepEqual([valueOf(there.to, "x"), valueOf(back.to, "x")], [150, -150]);
  const hits = ["-90", "0", "90"].map((slot) => tweensOf(k, `sc_hit${slot}`)[1].start);
  assert.ok(hits[0] < hits[1] && hits[1] < hits[2] && hits[0] > 3);
});

test("clock_advance_turnsTheMinuteHandTwelveTimesAsFarAsTheHourHand", () => {
  const k = newKit();
  const clock = k.iso.stage().place("clock", { name: "ck", x: 1800, y: 1800 });

  clock.run("advance", 2, { by: 60 });

  assert.equal(valueOf(tweensOf(k, "ck_minute")[1].to, "rotation"), 360);
  assert.equal(valueOf(tweensOf(k, "ck_hour")[1].to, "rotation"), 30);
});

test("tokenAndKey_pulseAndTurn_areTransformMovesOfTheirOwnWrappers", () => {
  const k = newKit();
  const stage = k.iso.stage();

  stage.place("token", { name: "tk", x: 1800, y: 1800 }).run("pulse", 2);
  stage.place("key", { name: "ky", x: 2000, y: 1800 }).run("turn", 4, { degrees: 180 });

  assert.deepEqual([tweensOf(k, "tk_swell").length, valueOf(tweensOf(k, "ky_turn")[1].to, "rotation")], [3, 180]);
});

// hidden objects collapse on every axis ------------------------------------------------------------------

test("hidden_everyScaleToNothingCarriesScaleZSoNoSliverStands", () => {
  const k = newKit();
  const stage = k.iso.stage();
  const satellite = stage.place("server", { name: "sv", x: 1800, y: 1800, hidden: true });
  satellite.appear(4);
  satellite.vanish(9, { z: 120 });
  stage.place("crash", { name: "cr", x: 2000, y: 1800 }).run("crash", 6);

  const collapsing = k.js.filter((line) => /scale:0\.001/.test(line));

  assert.ok(collapsing.length >= 3);
  for (const line of collapsing) assert.match(line, /scaleZ:0\.001/);
  assert.match(tweensOf(k, "sv").find(({ start }) => start === 4).to, /scale:1,scaleZ:1/);
});

test("vanish_collapsesInPlaceOrRisingAndChainsFromWhereTheObjectStood", () => {
  const k = newKit();
  const placed = k.iso.stage().place("token", { name: "tk", x: 1800, y: 1800, z: 100 });

  placed.vanish(5, { z: 80, dur: 0.5 });

  const exit = tweensOf(k, "tk").at(-1);
  assert.ok(exit.to.startsWith("{scale:0.001,scaleZ:0.001,z:180,"));
  assert.equal(exit.from, "{scale:1,scaleZ:1,z:100}");
});

test("journeyStopRise_collapsesAllAxesToo", () => {
  const k = newKit();

  isoJourney(k, { stops: [{ title: "A", kind: "users", at: 1 }, { title: "B", kind: "server", at: 5 }] }, makeCue({ id: "s1", type: "x", start: 0, duration: DURATION, speechEnd: 17, words: [] }, []));

  assert.ok(k.js.some((line) => line.includes('"#s1-pl1",{scale:0.001,scaleZ:0.001},{scale:1,scaleZ:1')));
});

// guards --------------------------------------------------------------------------------------------------

test("camera_askedForTwice_isTheSameCameraSoMovesChain", () => {
  const { k, stage, camera } = withCamera();

  assert.equal(k.iso.camera(stage), camera);
  camera.orbit(2, { degrees: 90, dur: 2 });
  k.iso.camera(stage).orbit(8, { degrees: 30, dur: 2 });

  const [, first, second] = tweensOf(k, "spin");
  assert.equal(valueOf(second.from, "rotation"), valueOf(first.to, "rotation"));
});

test("stage_buildingAfterMountOrAfterTheCamera_stopsTheBuild", () => {
  const k = newKit();
  const stage = k.iso.stage();
  stage.label({ x: 1800, y: 1800, z: 50, text: "A", name: "la" });
  k.iso.camera(stage);

  assert.throws(() => stage.label({ x: 1900, y: 1800, z: 50, text: "B", name: "lb" }), /before k\.iso\.camera/);
  stage.mount();
  assert.throws(() => stage.link({ name: "ln", from: { x: 1, y: 1 }, to: { x: 2, y: 2 } }), /mounted/);
  assert.throws(() => stage.add("<i></i>"), /build everything before stage\.mount/);
});

test("animator_moveThatSlipsPastItsCue_isReportedThroughKWarnings", () => {
  const k = newKit();
  const mover = animator(k, "box");

  mover.move({ z: 10 }, 2, { dur: 3 });
  mover.move({ z: 0 }, 3, { dur: 1 });
  mover.move({ x: 5 }, 3, { dur: 1 });

  assert.equal(k.warnings.length, 1);
  assert.match(k.warnings[0], /#s1-box z moves 2\.0 s after its cue/);
});

test("clock_ticksAndHourHand_contrastWithTheDialOnLightAndDarkThemes", () => {
  for (const name of THEME_NAMES) {
    const k = newKit(themes[name]);
    const pal = k.iso.palette();

    assert.ok(contrast(pal.onPaper, pal.paper) >= 3, name);
    const stage = k.iso.stage();
    stage.place("clock", { name: "ck", x: 1800, y: 1800 });
    stage.mount();
    assert.ok(k.html.join("").includes(`background:${pal.onPaper}`), name);
  }
});
