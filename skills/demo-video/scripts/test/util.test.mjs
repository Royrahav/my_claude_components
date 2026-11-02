// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultBrief, formatDurations, onlySet } from "../lib/util.mjs";

const timeline = (...durations) => ({ scenes: durations.map((d, i) => ({ id: `s${i + 1}`, duration: d })) });

// formatDurations -----------------------------------------------------------------------------------

test("formatDurations_fullBuild_listsEverySceneWithoutMarkersOrLegend", () => {
  assert.equal(formatDurations(timeline(4.25, 6), null), "s1 4.3s | s2 6.0s");
});

test("formatDurations_onlySubset_marksRebuiltScenesAndAddsLegend", () => {
  assert.equal(formatDurations(timeline(4, 6, 8), onlySet("s2")), "s1 4.0s | s2 6.0s* | s3 8.0s (* rebuilt)");
});

test("formatDurations_onlyWithSeveralIds_marksEachOfThem", () => {
  assert.equal(formatDurations(timeline(1, 2, 3), onlySet("s1, s3")), "s1 1.0s* | s2 2.0s | s3 3.0s* (* rebuilt)");
});

test("formatDurations_onlyWithUnknownId_marksNothingButStillAddsLegend", () => {
  assert.equal(formatDurations(timeline(1, 2), onlySet("nope")), "s1 1.0s | s2 2.0s (* rebuilt)");
});

test("formatDurations_noScenes_isEmptyForFullBuild", () => {
  assert.equal(formatDurations(timeline(), null), "");
});

// defaultBrief --------------------------------------------------------------------------------------

test("defaultBrief_lengthDefault_is180Seconds", () => {
  assert.equal(defaultBrief({ name: "n", product: "p" }).length_s, 180);
});

test("defaultBrief_audienceDefault_isMixedDevsPmsAndCustomerFacing", () => {
  assert.equal(defaultBrief({ name: "n", product: "p" }).audience, "mixed: developers, product managers, customer-facing teams");
});

test("defaultBrief_nameAndProduct_areCarriedAndEyebrowIsUppercaseProduct", () => {
  const b = defaultBrief({ name: "demo-1", product: "labOS" });

  assert.deepEqual([b.name, b.product, b.eyebrow], ["demo-1", "labOS", "LABOS"]);
});

test("defaultBrief_withoutMusicPrompt_usesANonEmptyDefaultPrompt", () => {
  const b = defaultBrief({ name: "n", product: "p" });

  assert.match(b.music_prompt, /no vocals/);
});

test("defaultBrief_withMusicPrompt_usesTheGivenPrompt", () => {
  assert.equal(defaultBrief({ name: "n", product: "p", musicPrompt: "jazz" }).music_prompt, "jazz");
});

test("defaultBrief_switches_defaultOn", () => {
  const b = defaultBrief({ name: "n", product: "p" });

  assert.deepEqual([b.captions, b.music, b.sfx, b.quality], [true, true, true, "standard"]);
});

test("defaultBrief_voice_isMatildaAtNormalSpeed", () => {
  assert.deepEqual(defaultBrief({ name: "n", product: "p" }).voice, { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", speed: 1.0 });
});
