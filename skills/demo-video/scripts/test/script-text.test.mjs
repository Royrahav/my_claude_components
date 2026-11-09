// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// SCRIPT.md carries the narration and each scene's on-screen text; the speed fit keeps a comfortable pace.
import { test } from "node:test";
import assert from "node:assert/strict";
import { onScreenText, scriptMarkdown } from "../lib/script-text.mjs";
import { PACE_HEADROOM, TONE_SPEED, speedFit } from "../lib/voice.mjs";

test("onScreenText_nestedData_keepsReadableStringsInOrderAndDropsCuesAndStyling", () => {
  const data = { title: "Why it exists", left: { label: "Today", items: [{ text: "No hook", icon: "cross", tone: "bad", at: "hook" }] }, lockup_at: "home" };

  assert.equal(onScreenText(data), "Why it exists | Today | No hook");
});

test("onScreenText_repeatedString_isListedOnce", () => {
  assert.equal(onScreenText({ cards: [{ title: "Begin" }, { title: "Begin" }, { title: "End" }] }), "Begin | End");
});

test("onScreenText_noData_isEmpty", () => {
  assert.equal(onScreenText(undefined), "");
});

test("onScreenText_veryLongData_isCutWithAnEllipsis", () => {
  const text = onScreenText({ items: Array.from({ length: 60 }, (_, i) => `item number ${i}`) });

  assert.deepEqual([text.length, text.endsWith("...")], [400, true]);
});

test("scriptMarkdown_scene_showsQuestionNarrationAndOnScreenText", () => {
  const scenes = [{ id: "s01", type: "split", chapter: "Why", question: "Why?", say: "Because it breaks.", data: { title: "It breaks" } }];

  const { md, words } = scriptMarkdown({ product: "Thing" }, scenes, 2);

  assert.deepEqual([words, md.includes("## 1. Why (s01, split)"), md.includes("Question: Why?"), md.includes("Because it breaks."), md.includes("On screen: It breaks")], [3, true, true, true, true]);
});

test("scriptMarkdown_silentSceneWithoutData_saysSilentAndHasNoOnScreenLine", () => {
  const { md } = scriptMarkdown({ product: "Thing" }, [{ id: "s01", type: "beat" }], 2);

  assert.deepEqual([md.includes("(silent)"), md.includes("On screen:")], [true, false]);
});

const fitArgs = { speed: 1, rate: 2.5, overhead: 20, tone: "balanced" };

test("speedFit_scriptFitsAtAComfortablePace_returnsTheFittingSpeedAndNoOverrun", () => {
  const fit = speedFit({ ...fitArgs, words: 500, target: 220 });

  assert.deepEqual([fit.speed, fit.over], [1, null]);
});

test("speedFit_scriptTooLong_capsAtTheTonePacePlusHeadroomAndSaysWhatToTrim", () => {
  const fit = speedFit({ ...fitArgs, words: 1000, target: 220 });

  assert.equal(fit.speed, TONE_SPEED.balanced + PACE_HEADROOM);
  assert.deepEqual(fit.over, { trim: 1000 - Math.floor(200 * 2.5 * 1.04), length: Math.ceil(20 + 400 / 1.04) });
});

test("speedFit_seriousTone_capsBelowTheBalancedCeiling", () => {
  assert.equal(speedFit({ ...fitArgs, tone: "serious", words: 1000, target: 220 }).speed, TONE_SPEED.serious + PACE_HEADROOM);
});

test("speedFit_scriptFarTooShort_staysAboveTheFloor", () => {
  assert.equal(speedFit({ ...fitArgs, words: 50, target: 220 }).speed, TONE_SPEED.balanced - 2 * PACE_HEADROOM);
});
