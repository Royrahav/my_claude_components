// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// direction.tone / freedom / notes, the voice delivery each tone sets, and the narration stamp that keys
// a cached take. No ElevenLabs call is made: only pure functions are exercised.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { TONES, describeDirection, resolveDirection } from "../lib/direction.mjs";
import { TONE_DELIVERY, deliveryFor, narrationStamp } from "../lib/voice.mjs";

// direction fields -------------------------------------------------------------------------------------

test("resolveDirection_noCreativeFields_leavesThemOutOfTheResult", () => {
  const direction = resolveDirection({ preset: "calm-technical" });

  assert.deepEqual(["tone" in direction, "freedom" in direction, "notes" in direction], [false, false, false]);
});

test("resolveDirection_everyTone_isAccepted", () => {
  assert.deepEqual(TONES.map((tone) => resolveDirection({ tone }).tone), ["playful", "light", "balanced", "serious", "critical"]);
});

test("resolveDirection_everyFreedom_isAccepted", () => {
  assert.deepEqual(["guided", "creative", "auteur"].map((freedom) => resolveDirection({ freedom }).freedom), ["guided", "creative", "auteur"]);
});

test("resolveDirection_nullToneFreedomAndNotes_countAsUnset", () => {
  const direction = resolveDirection({ tone: null, freedom: null, notes: null });

  assert.deepEqual(["tone" in direction, "freedom" in direction, "notes" in direction], [false, false, false]);
});

test("resolveDirection_unknownTone_throwsNamingTheFieldTheValueAndTheChoices", () => {
  assert.throws(() => resolveDirection({ tone: "loud" }), /brief\.json direction\.tone must be one of playful, light, balanced, serious, critical, got "loud"/);
});

test("resolveDirection_toneInTheWrongCase_isRejected", () => {
  assert.throws(() => resolveDirection({ tone: "Serious" }), /direction\.tone must be one of/);
});

test("resolveDirection_emptyStringTone_isRejectedRatherThanUnset", () => {
  assert.throws(() => resolveDirection({ tone: "" }), /direction\.tone must be one of/);
});

test("resolveDirection_unknownFreedom_throwsNamingTheFieldAndTheChoices", () => {
  assert.throws(() => resolveDirection({ freedom: "wild" }), /direction\.freedom must be one of guided, creative, auteur, got "wild"/);
});

test("resolveDirection_nonStringNotes_throwsNamingTheField", () => {
  for (const notes of [7, true, ["a"], { a: 1 }]) assert.throws(() => resolveDirection({ notes }), /direction\.notes must be a string/, JSON.stringify(notes));
});

test("resolveDirection_emptyStringNotes_isKept", () => {
  assert.equal(resolveDirection({ notes: "" }).notes, "");
});

test("resolveDirection_toneFreedomAndNotes_doNotChangeAnyVisualKnob", () => {
  const plain = resolveDirection({ preset: "story-driven" });

  const creative = resolveDirection({ preset: "story-driven", tone: "critical", freedom: "auteur", notes: "retro" });

  assert.deepEqual({ ...creative, tone: undefined, freedom: undefined, notes: undefined }, { ...plain, tone: undefined, freedom: undefined, notes: undefined });
});

test("describeDirection_toneOnly_appendsJustTheTone", () => {
  assert.match(describeDirection(resolveDirection({ tone: "light" })), /transitions [^,]*, tone light$/);
});

test("describeDirection_freedomOnly_appendsJustTheFreedom", () => {
  assert.match(describeDirection(resolveDirection({ freedom: "guided" })), /, freedom guided$/);
});

test("describeDirection_neitherSet_endsWithTheTransitions", () => {
  assert.doesNotMatch(describeDirection(resolveDirection({})), /tone|freedom/);
});

test("describeDirection_notes_areNotPrinted", () => {
  assert.doesNotMatch(describeDirection(resolveDirection({ notes: "secret" })), /secret/);
});

// delivery ---------------------------------------------------------------------------------------------

test("deliveryFor_unsetAndNullTone_isTheBalancedDelivery", () => {
  assert.deepEqual([deliveryFor(undefined), deliveryFor(null)], [TONE_DELIVERY.balanced, TONE_DELIVERY.balanced]);
});

test("deliveryFor_balanced_isTheDeliveryBeforeTonesExisted", () => {
  assert.deepEqual({ ...deliveryFor("balanced") }, { stability: 0.5, style: 0 });
});

test("deliveryFor_tones_getSteadierFromPlayfulToCritical", () => {
  const stabilities = ["playful", "light", "balanced", "serious", "critical"].map((tone) => deliveryFor(tone).stability);

  assert.deepEqual(stabilities, [0.35, 0.45, 0.5, 0.6, 0.7]);
});

test("TONE_DELIVERY_table_isFrozenAndCoversEveryTone", () => {
  assert.deepEqual([Object.isFrozen(TONE_DELIVERY), Object.keys(TONE_DELIVERY)], [true, [...TONES]]);
});

// narrationStamp ---------------------------------------------------------------------------------------

const hashOf = (parts) => createHash("sha1").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
const stampFor = (direction, { say = "Hello there.", voice = { id: "v1" } } = {}) => narrationStamp({ voice, direction }, { say }, []);
const BEFORE_TONES = hashOf(["v1", 1, "Hello there."]);

test("narrationStamp_noDirectionAtAll_isTheStampFromBeforeTones", () => {
  assert.equal(narrationStamp({ voice: { id: "v1" } }, { say: "Hello there." }, []), BEFORE_TONES);
});

test("narrationStamp_directionWithoutTone_isTheStampFromBeforeTones", () => {
  assert.equal(stampFor({ preset: "calm-technical" }), BEFORE_TONES);
});

test("narrationStamp_balancedTone_isTheStampFromBeforeTones", () => {
  assert.equal(stampFor({ tone: "balanced" }), BEFORE_TONES);
});

test("narrationStamp_nullTone_isTheStampFromBeforeTones", () => {
  assert.equal(stampFor({ tone: null }), BEFORE_TONES);
});

test("narrationStamp_everyNonBalancedTone_getsItsOwnStampDifferentFromBalanced", () => {
  const stamps = ["playful", "light", "serious", "critical"].map((tone) => stampFor({ tone }));

  assert.deepEqual([new Set(stamps).size, stamps.includes(BEFORE_TONES)], [4, false]);
});

test("narrationStamp_sameNonBalancedTone_isStableAcrossCalls", () => {
  assert.equal(stampFor({ tone: "serious" }), stampFor({ tone: "serious" }));
});

test("narrationStamp_nonBalancedTone_isTheOldFormulaPlusTheSettings", () => {
  assert.equal(stampFor({ tone: "serious" }), hashOf(["v1", 1, "Hello there.", { stability: 0.6, style: 0 }]));
});

test("narrationStamp_unknownTone_throwsNamingTheField", () => {
  assert.throws(() => stampFor({ tone: "loud" }), /direction\.tone must be one of/);
});

test("narrationStamp_voiceSpeedTextOrVoiceChange_changeTheStamp", () => {
  const base = stampFor({});

  const changed = [stampFor({}, { say: "Other." }), stampFor({}, { voice: { id: "v2" } }), stampFor({}, { voice: { id: "v1", speed: 1.1 } })];

  assert.deepEqual(changed.map((stamp) => stamp !== base), [true, true, true]);
});

test("narrationStamp_explicitSpeedOfOne_matchesTheDefaultSpeed", () => {
  assert.equal(stampFor({}, { voice: { id: "v1", speed: 1 } }), BEFORE_TONES);
});

test("narrationStamp_isSixteenHexCharacters", () => {
  assert.match(stampFor({ tone: "playful" }), /^[0-9a-f]{16}$/);
});
