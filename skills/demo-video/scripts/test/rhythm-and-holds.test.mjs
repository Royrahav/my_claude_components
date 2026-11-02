// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// Scene lengths: the monotone-rhythm house-style rule, and the holds and silent lengths that beats and
// stings add to the timeline.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { houseStyleWarnings } from "../lib/house-style.mjs";
import { DEFAULT_HOLD, buildTimeline, holdFor, silentSeconds } from "../lib/timeline.mjs";
import { LEAD, projectFiles } from "../lib/util.mjs";

// rhythm -----------------------------------------------------------------------------------------------

const RHYTHM = (shortest, longest) => `house style: monotone rhythm (every scene ${shortest}-${longest} s); mix in a short beat or a longer showcase`;
const sceneTypes = ["title", "split", "steps", "cards", "metrics", "recap", "close"];

function rhythmWarnings(durations, types = sceneTypes.slice(0, durations.length)) {
  const scenes = types.map((type, i) => ({ id: `s${i + 1}`, type }));
  return houseStyleWarnings(scenes, { sources: scenes.map(() => "builtin"), transitions: scenes.map(() => null), durations }).filter((w) => w.includes("rhythm"));
}

test("houseStyleWarnings_middleSpreadJustUnderTheRatio_warnsWithTheRoundedRange", () => {
  assert.deepEqual(rhythmWarnings([8, 10, 15.9, 10, 10, 6]), [RHYTHM(10, 16)]);
});

test("houseStyleWarnings_middleSpreadExactlyAtTheRatio_isQuiet", () => {
  assert.deepEqual(rhythmWarnings([8, 10, 16, 10, 10, 6]), []);
});

test("houseStyleWarnings_middleSpreadWellOverTheRatio_isQuiet", () => {
  assert.deepEqual(rhythmWarnings([8, 4, 20, 10, 12, 6]), []);
});

test("houseStyleWarnings_firstAndLastSceneLengths_doNotCountTowardTheSpread", () => {
  assert.deepEqual(rhythmWarnings([1, 10, 11, 10, 11, 90]), [RHYTHM(10, 11)]);
});

test("houseStyleWarnings_sixScenes_areEnoughToCheckTheRhythm", () => {
  assert.equal(rhythmWarnings([6, 10, 10, 10, 10, 6]).length, 1);
});

test("houseStyleWarnings_fiveEvenScenes_skipTheRhythmRule", () => {
  assert.deepEqual(rhythmWarnings([6, 10, 10, 10, 6]), []);
});

test("houseStyleWarnings_noDurationsGiven_skipTheRhythmRule", () => {
  const scenes = sceneTypes.map((type, i) => ({ id: `s${i + 1}`, type }));

  const warnings = houseStyleWarnings(scenes, { sources: scenes.map(() => "builtin"), transitions: scenes.map(() => null) });

  assert.equal(warnings.some((w) => w.includes("rhythm")), false);
});

test("houseStyleWarnings_evenMiddleScenes_nameTheirSharedLength", () => {
  assert.deepEqual(rhythmWarnings([4, 12, 12, 12, 12, 12, 5]), [RHYTHM(12, 12)]);
});

// silentSeconds ----------------------------------------------------------------------------------------

test("silentSeconds_eachKind_hasItsOwnLength", () => {
  const lengths = [{ type: "beat" }, { type: "beat", variant: "invert" }, { type: "close", variant: "sting" }, { type: "close" }, { type: "close", variant: "cta" }, { type: "title" }].map(silentSeconds);

  assert.deepEqual(lengths, [1.6, 1.6, 2.5, 6, 6, 6]);
});

// holdFor ----------------------------------------------------------------------------------------------

test("holdFor_beat_isUnderOneSecond", () => {
  assert.equal(holdFor({ type: "beat" }), 0.8);
});

test("holdFor_closeSting_isShorterThanOtherCloses", () => {
  assert.deepEqual([holdFor({ type: "close", variant: "sting" }), holdFor({ type: "close", variant: "cta" }), holdFor({ type: "close" })], [1.5, DEFAULT_HOLD.close, DEFAULT_HOLD.close]);
});

test("holdFor_stingVariantOfAnotherTemplate_usesThatTemplatesHold", () => {
  assert.equal(holdFor({ type: "title", variant: "sting" }), DEFAULT_HOLD.title);
});

test("holdFor_closeStingWithBriskPacing_isScaled", () => {
  assert.equal(holdFor({ type: "close", variant: "sting" }, "brisk"), 1.5 * 0.8);
});

test("holdFor_closeStingWithItsOwnHold_keepsItAsWritten", () => {
  assert.equal(holdFor({ type: "close", variant: "sting", hold: 3 }, "brisk"), 3);
});

// buildTimeline ----------------------------------------------------------------------------------------

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dv-rhythm-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const lengths = (scenes, options) => buildTimeline(projectFiles(root), scenes, { level: false, ...options }).tl.scenes.map((s) => s.duration);

test("buildTimeline_silentScenes_useTheirKindsLength", () => {
  const scenes = [{ id: "s1", type: "title" }, { id: "s2", type: "beat" }, { id: "s3", type: "close", variant: "sting" }, { id: "s4", type: "close" }];

  assert.deepEqual(lengths(scenes), [6, 1.6, 2.5, 6]);
});

test("buildTimeline_silentSceneWithItsOwnDuration_keepsItWhateverItsKind", () => {
  const scenes = [{ id: "s1", type: "beat", duration: 3 }, { id: "s2", type: "close", variant: "sting", duration: 4 }];

  assert.deepEqual(lengths(scenes), [3, 4]);
});

test("buildTimeline_voicedBeatAndSting_holdTheirShortHolds", () => {
  const scenes = [{ id: "s1", type: "beat", say: "Boom." }, { id: "s2", type: "close", variant: "sting", say: "Bye." }];

  const actual = lengths(scenes);

  assert.deepEqual(actual.map((d) => Math.round(d * 1000) / 1000), [Math.round((LEAD + 0.8) * 1000) / 1000, Math.round((LEAD + 1.5) * 1000) / 1000]);
});

test("buildTimeline_pacing_doesNotScaleTheSilentLengths", () => {
  const scenes = [{ id: "s1", type: "beat" }, { id: "s2", type: "close", variant: "sting" }];

  assert.deepEqual(lengths(scenes, { pacing: "relaxed" }), [1.6, 2.5]);
});
