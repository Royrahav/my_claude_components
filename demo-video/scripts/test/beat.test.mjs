// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The beat template: one to four words (or a number) punched in huge, plus its invert variant.
import { test } from "node:test";
import assert from "node:assert/strict";
import beat, { variants } from "../lib/scenes/beat.mjs";
import { buildScene, sceneTimeline, tweensOf } from "./helpers.mjs";

const sizeOf = (css) => Number(css.match(/\.s1-bt\{[^}]*font:900 (\d+)px/)[1]);

test("beat_text_isPunchedInAndReturnsNoChrome", () => {
  const { html, result, k } = buildScene(beat, { text: "Done" });

  assert.deepEqual([html.includes(">Done<"), tweensOf(k, "bt").length, result], [true, 1, { chrome: false }]);
});

test("beat_oneToFourWords_areAccepted", () => {
  for (const text of ["One", "One two", "One two three", "One two three four"]) assert.doesNotThrow(() => buildScene(beat, { text }), text);
});

test("beat_fiveWords_throwsNamingTheFieldAndTheLimit", () => {
  assert.throws(() => buildScene(beat, { text: "one two three four five" }), /s1: beat data\.text must be at most 4 words/);
});

test("beat_extraWhitespaceBetweenFourWords_stillCountsAsFour", () => {
  assert.doesNotThrow(() => buildScene(beat, { text: "  one   two \n three  four  " }));
});

test("beat_numberAsText_countsAsOneWordAndIsShown", () => {
  const { html } = buildScene(beat, { text: 42 });

  assert.ok(html.includes(">42<"));
});

test("beat_missingText_throwsNamingTheField", () => {
  assert.throws(() => buildScene(beat, {}), /s1: beat needs data\.text/);
});

test("beat_blankText_throwsNamingTheField", () => {
  assert.throws(() => buildScene(beat, { text: "   " }), /beat needs data\.text/);
});

test("beat_markupInText_isEscaped", () => {
  const { html } = buildScene(beat, { text: "<i>x</i>" });

  assert.equal(html.includes("<i>x</i>"), false);
});

test("beat_longerText_usesASmallerFont", () => {
  const sizes = [buildScene(beat, { text: "Go" }), buildScene(beat, { text: "x".repeat(7) }), buildScene(beat, { text: "x".repeat(33) })].map(({ css }) => sizeOf(css));

  assert.deepEqual(sizes, [320, 250, 120]);
});

test("beat_withoutSub_hasNoSubElement", () => {
  const { html } = buildScene(beat, { text: "Go" });

  assert.equal(html.includes('id="s1-bs"'), false);
});

test("beat_sub_fadesInAfterThePunch", () => {
  const { html, k } = buildScene(beat, { text: "Go", sub: "Then more" });

  assert.deepEqual([html.includes(">Then more<"), tweensOf(k, "bs")[0].start > tweensOf(k, "bt")[0].start], [true, true]);
});

test("beat_atTime_punchesInThere", () => {
  const { k } = buildScene(beat, { text: "Go", at: 3 });

  assert.equal(tweensOf(k, "bt")[0].start, 3);
});

test("beat_default_hasNoFillPanel", () => {
  const { html } = buildScene(beat, { text: "Go" });

  assert.equal(html.includes('id="s1-fill"'), false);
});

test("beatInvert_fillsTheFrameAndUsesTheInverseInk", () => {
  const { html, css, k } = buildScene(variants.invert, { text: "Go", sub: "More" });

  assert.deepEqual([html.includes('id="s1-fill"'), css.includes("color:var(--on-accent)"), tweensOf(k, "fill").length], [true, true, 1]);
});

test("beatInvert_sameValidationAsTheDefault", () => {
  assert.throws(() => buildScene(variants.invert, { text: "a b c d e" }), /beat data\.text must be at most 4 words/);
});

test("beat_playsOnePopSoundAtThePunch", () => {
  const { k } = buildScene(beat, { text: "Go", at: 2 });

  assert.deepEqual(k.sfx.map(({ sound, t }) => [sound, t]), [["pop", 2]]);
});

// short scenes and late cues ---------------------------------------------------------------------------

const endOf = (k, name) => {
  const [tween] = tweensOf(k, name);
  return tween.start + tween.duration;
};
const timelineOfLength = (duration) => sceneTimeline({ duration });

test("beat_defaultTiming_isUnchangedOnALongScene", () => {
  const { k } = buildScene(beat, { text: "Go", sub: "More" }, timelineOfLength(12));

  assert.deepEqual([tweensOf(k, "bt")[0].start, tweensOf(k, "bs")[0].start], [0.15, 0.65]);
});

test("beat_shortSceneWithASub_finishesThePunchAndTheSubFadeBeforeTheSceneEnds", () => {
  const { k } = buildScene(beat, { text: "Go", sub: "More" }, timelineOfLength(1));

  assert.deepEqual([endOf(k, "bt") <= 1, endOf(k, "bs") <= 1], [true, true]);
});

test("beat_shortSceneWithoutASub_finishesThePunchBeforeTheSceneEnds", () => {
  const { k } = buildScene(beat, { text: "Go" }, timelineOfLength(0.8));

  assert.ok(endOf(k, "bt") <= 0.8);
});

test("beat_lateAtTimeWithASub_isPulledBackSoBothFinishBeforeTheSceneEnds", () => {
  const { k } = buildScene(beat, { text: "Go", sub: "More", at: 9 }, timelineOfLength(3));

  assert.deepEqual([endOf(k, "bt") <= 3, endOf(k, "bs") <= 3], [true, true]);
});

test("beat_lateAtTimeWithoutASub_isPulledBackSoThePunchFinishesBeforeTheSceneEnds", () => {
  const { k } = buildScene(beat, { text: "Go", at: 9 }, timelineOfLength(3));

  assert.ok(endOf(k, "bt") <= 3);
});

test("beat_atTimeThatFits_isKeptAsWrittenEvenWithASub", () => {
  const { k } = buildScene(beat, { text: "Go", sub: "More", at: 2 }, timelineOfLength(6));

  assert.equal(tweensOf(k, "bt")[0].start, 2);
});

test("beatInvert_shortSceneWithASub_alsoFinishesBeforeTheSceneEnds", () => {
  const { k } = buildScene(variants.invert, { text: "Go", sub: "More" }, timelineOfLength(1));

  assert.deepEqual([endOf(k, "bt") <= 1, endOf(k, "bs") <= 1], [true, true]);
});

test("beat_shortScene_playsThePopAtThePunchTime", () => {
  const { k } = buildScene(beat, { text: "Go", sub: "More", at: 9 }, timelineOfLength(3));

  assert.equal(k.sfx[0].t, tweensOf(k, "bt")[0].start);
});
