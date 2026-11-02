// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The 3D kit and its templates (iso-journey, iso-map): the object library, recorded reveals, determinism and the
// rule that a preserve-3d element is never faded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createScene } from "../lib/kit.mjs";
import { makeCue } from "../lib/timeline.mjs";
import { emptyScreenWarnings } from "../lib/screen-gaps.mjs";
import { contrast, loadTheme } from "../lib/theme.mjs";
import { isoPalette } from "../lib/iso-kit.mjs";
import { OBJECT_KINDS } from "../lib/iso-objects.mjs";
import isoJourney from "../lib/scenes/iso-journey.mjs";
import isoMap from "../lib/scenes/iso-map.mjs";

const THEMES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "themes");
const labos = loadTheme(join(THEMES, "labos", "theme.json"));
const midnight = loadTheme(join(THEMES, "midnight", "theme.json"));
const DURATION = 24;

const stop = (title, kind, extra = {}) => ({ title, kind, ...extra });
const journeyData = (extra = {}) => ({ stops: [stop("Users", "users", { at: 1 }), stop("Server", "server", { at: 5, panel: { code: "POST /print" } }), stop("Printer", "printer", { at: 9 })], ...extra });
const mapData = () => ({ stops: [stop("Users", "users", { at: 1 }), stop("Cloud", "cloud", { at: 3 }), stop("Gate", "shield", { at: 5 })], takeaways: [{ title: "One", example: "A", at: 8 }, { title: "Two", example: "B", at: 11 }] });

// A silent scene (no words), so cues without a time fall back to the narration window.
function build(template, data, { theme = labos, duration = DURATION, warnings = [] } = {}) {
  const k = createScene({ id: "s1", theme, fontsCss: "", brief: {}, scene: {}, duration });
  const timeline = { id: "s1", type: "x", start: 0, duration, speechEnd: duration - 3, words: [] };
  template(k, data, makeCue(timeline, warnings));
  return k;
}

const warningsOf = (k) => emptyScreenWarnings({ id: "s1", scene: {}, intervals: k.visibleIntervals(), duration: DURATION });

test("isoJourney_unknownKind_stopsTheBuildNamingTheValidKinds", () => {
  const data = journeyData();
  data.stops[1].kind = "toaster";

  assert.throws(() => build(isoJourney, data), (error) => error.message.includes('"toaster"') && OBJECT_KINDS.every((kind) => error.message.includes(kind)));
});

test("objectKinds_everyKind_buildsOnBothThemes", () => {
  for (const theme of [labos, midnight])
    for (const kind of OBJECT_KINDS) {
      const k = build(isoJourney, { stops: [stop("A", kind, { at: 1 }), stop("B", kind, { at: 5 })] }, { theme });

      assert.ok(k.html.join("").includes("A</div>"), kind);
    }
});

test("stops_outsideTwoToSix_stopTheBuild", () => {
  const oneStop = { stops: [stop("A", "users")] };
  const sevenStops = { stops: Array.from({ length: 7 }, (_, i) => stop(`S${i}`, "users")) };

  assert.throws(() => build(isoJourney, oneStop), /needs 2-6 data\.stops, got 1/);
  assert.throws(() => build(isoJourney, sevenStops), /needs 2-6 data.stops, got 7/);
  assert.throws(() => build(isoMap, { stops: sevenStops.stops.slice(0, 5), takeaways: mapData().takeaways }), /needs 2-4 data.stops, got 5/);
});

test("isoMap_takeawaysOutsideTwoToFour_stopTheBuild", () => {
  const data = { ...mapData(), takeaways: [{ title: "Only one", example: "x" }] };

  assert.throws(() => build(isoMap, data), /needs 2-4 data\.takeaways, got 1/);
});

test("isoJourney_stopWithoutTitle_stopsTheBuild", () => {
  const data = journeyData();
  data.stops[1].title = "  ";

  assert.throws(() => build(isoJourney, data), /stop 2 needs a title/);
});

test("isoJourney_stopWithoutKind_stopsTheBuildNamingTheValidKinds", () => {
  const data = journeyData();
  delete data.stops[0].kind;

  assert.throws(() => build(isoJourney, data), (error) => OBJECT_KINDS.every((kind) => error.message.includes(kind)));
});

test("isoJourney_panelWithNeitherCodeNorChips_stopsTheBuild", () => {
  const data = journeyData();
  data.stops[0].panel = {};

  assert.throws(() => build(isoJourney, data), /stop 1 panel needs/);
});

test("iso_sameDataTwice_buildsIdenticalHtmlAndTimeline", () => {
  for (const [template, data] of [[isoJourney, journeyData()], [isoMap, mapData()]]) {
    const [first, second] = [build(template, data), build(template, data)];

    assert.deepEqual(first.js, second.js);
    assert.equal(first.html.join(""), second.html.join(""));
  }
});

test("iso_reveals_areRecordedFromTimeZero_soTheEmptyScreenWarningStaysQuiet", () => {
  for (const [template, data] of [[isoJourney, journeyData()], [isoMap, mapData()]]) {
    const k = build(template, data);

    assert.ok(k.visibleIntervals().some(({ from }) => from === 0));
    assert.deepEqual(warningsOf(k), []);
  }
});

test("iso_rising_laterStopsAreRevealedOnTheirOwnCue", () => {
  const k = build(isoJourney, journeyData());

  const reveals = k.visibleIntervals().map(({ from }) => from).sort((a, b) => a - b);

  assert.ok(reveals.includes(5) && reveals.includes(9));
});

test("revealAt_recordsAReveal_withoutTweeningTheElement", () => {
  const k = createScene({ id: "s1", theme: labos, fontsCss: "", brief: {}, scene: {}, duration: 10 });

  k.revealAt("pl1", 3);

  assert.deepEqual(k.visibleIntervals(), [{ from: 3, until: Infinity }]);
  assert.equal(k.js.length, 0);
});

test("iso_preserve3dElements_areNeverFaded", () => {
  for (const [template, data] of [[isoJourney, journeyData()], [isoMap, mapData()]]) {
    const k = build(template, data);
    const html = k.html.join("");
    const containers = [...html.matchAll(/id="(s1-[\w-]+)" class="s1-(?:g|track|cam3|stage|rig)[ "]/g)].map((match) => match[1]);

    assert.ok(containers.length > 6);
    for (const id of containers) assert.deepEqual(k.js.filter((line) => line.includes(`"#${id}"`) && line.includes("opacity")), [], id);
  }
});

test("isoPalette_labelText_passesAAOnBothThemes", () => {
  for (const theme of [labos, midnight]) {
    const pal = isoPalette(theme);

    assert.ok(contrast(pal.ink, pal.pillFill) >= 4.5, theme.name);
    assert.ok(contrast(theme.derived.mutedText, pal.pillFill) >= 4.5, theme.name);
  }
});

test("isoPalette_darkTheme_hasADarkFloor_andALightThemeALightOne", () => {
  assert.ok(contrast(isoPalette(midnight).floor, "#000000") < contrast(isoPalette(labos).floor, "#000000"));
});

const pullsBack = (k) => k.js.some((line) => line.includes('"#s1-lbp0"') && line.includes("scale"));

test("isoJourney_pullBack_isOnFromThreeStops_andFalseTurnsItOff", () => {
  const two = { stops: [stop("A", "users", { at: 1 }), stop("B", "server", { at: 5 })] };

  assert.ok(pullsBack(build(isoJourney, journeyData())));
  assert.ok(!pullsBack(build(isoJourney, journeyData({ pull_back: false }))));
  assert.ok(!pullsBack(build(isoJourney, two)));
  assert.ok(pullsBack(build(isoJourney, { ...two, pull_back: true })));
});

// Timing rules under realistic pacing (stops 1-3 s apart, short holds). A tween is a k.js line ending "...duration:D...,T);".
const parseTween = (line) => {
  const [start, duration] = [line.match(/,([\d.]+)\);?$/), line.match(/duration:([\d.]+)/)];
  return start && duration ? { start: Number(start[1]), end: Number(start[1]) + Number(duration[1]) } : null;
};
const tweensOf = (k, id) => k.js.filter((line) => line.includes(`"#${id}"`)).map(parseTween);
const pullBackEnd = (k) => Math.max(...tweensOf(k, "s1-lbp0").filter(Boolean).map(({ end }) => end));
const stopsAt = (...times) => times.map((at, i) => stop(`S${i}`, i % 2 ? "server" : "users", { at }));

test("isoJourney_panelWithLessThanItsMinimumBeforeTheNextLeg_stopsTheBuildNamingTheStop", () => {
  const data = { stops: stopsAt(1, 3) };
  data.stops[0].panel = { code: "POST /print" };

  assert.throws(() => build(isoJourney, data), /stop 1 panel has .* before the camera leaves/);
});

test("isoJourney_panelWithRoom_isShownBeforeItLeaves_andLeavesBeforeTheNextStop", () => {
  const data = { stops: stopsAt(1, 4, 8) };
  data.stops[0].panel = { code: "POST /print" };

  const [rise, exit] = tweensOf(build(isoJourney, data, { duration: 14 }), "s1-pn0");

  assert.ok(rise.end <= exit.start);
  assert.ok(exit.end < 4);
});

test("isoJourney_sixStopsAboutOneSecondApartInAShortScene_stopsTheBuildNamingTheLateStop", () => {
  const data = { stops: stopsAt(1, 2.1, 3.2, 4.3, 5.4, 6.5) };

  assert.throws(() => build(isoJourney, data, { duration: 9.5 }), /stop 6 "S5" would arrive at/);
});

test("isoJourney_stopsCloserThanTheMinimumGap_warnsAboutTheSlipButBuilds", () => {
  const warnings = [];

  build(isoJourney, { stops: stopsAt(1, 2.1, 3.2, 4.3), pull_back: false }, { duration: 14, warnings });

  assert.ok(warnings.some((message) => /stop 4 "S3" arrives .* s after its cue/.test(message)));
});

test("isoJourney_lastStopLateInTheScene_pullBackIsShortenedToTheTimeLeft", () => {
  const warnings = [];

  const k = build(isoJourney, { stops: stopsAt(1, 3, 7) }, { duration: 9.5, warnings });

  assert.ok(pullsBack(k));
  assert.ok(pullBackEnd(k) <= 9.5);
  assert.deepEqual(warnings, []);
});

test("isoJourney_lastStopTooLateForAPullBack_skipsItWithAWarning", () => {
  const warnings = [];

  const k = build(isoJourney, { stops: stopsAt(1, 3, 8) }, { duration: 9.5, warnings });

  assert.ok(!pullsBack(k));
  assert.ok(warnings.some((message) => /pull-back is skipped/.test(message)));
});

test("isoMap_earlyTakeawayCue_waitsForTheDockToEnd_andWarns", () => {
  const warnings = [];
  const data = { ...mapData(), stops: [stop("A", "users", { at: 1 }), stop("B", "cloud", { at: 2.5 })] };
  data.takeaways[0].at = 2;

  const k = build(isoMap, data, { warnings });

  // overview pull-back starts at 1.8 and lasts 2.2 s, then a 0.2 s gap and the 1.0 s dock: 5.2 s
  assert.ok(tweensOf(k, "s1-r0")[0].start >= 5.2);
  assert.ok(warnings.some((message) => /takeaway 1 .* waits .* s for the map to move aside/.test(message)));
});

test("isoMap_takeawayCuedNearTheSceneEnd_stopsTheBuild", () => {
  const data = mapData();
  data.takeaways[1].at = 23.5;

  assert.throws(() => build(isoMap, data), /takeaway 2 .* too close to the scene's end/);
});

// The one-line JSON scenes documented under a `### <type>:` heading of scenes.md.
function documentedScene(type) {
  const section = readFileSync(join(THEMES, "..", "..", "references", "scenes.md"), "utf8").split(`### ${type}:`)[1].split(/\r?\n### /)[0];
  return JSON.parse(section.match(/^\{ ?"type":.*\}$/m)[0]);
}

test("scenesDoc_isoExamples_buildWithCuesResolvedAndNothingEmpty", () => {
  for (const [type, template, hold] of [["iso-journey", isoJourney, 3.0], ["iso-map", isoMap, 2.0]]) {
    const scene = documentedScene(type);
    const words = scene.say.split(/\s+/).map((text, i) => ({ text, start: 0.6 + i * 0.4, end: 0.9 + i * 0.4 }));
    const speechEnd = words.at(-1).end;
    const warnings = [];
    const timeline = { id: "s1", type, start: 0, duration: speechEnd + hold, speechEnd, words };
    const k = createScene({ id: "s1", theme: labos, fontsCss: "", brief: {}, scene, duration: timeline.duration });

    template(k, scene.data, makeCue(timeline, warnings));

    assert.deepEqual(warnings, [], type);
    assert.deepEqual(emptyScreenWarnings({ id: "s1", scene, intervals: k.visibleIntervals(), duration: timeline.duration }), [], type);
  }
});
