// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The music library: mood pick, slot listing, adopt, reuse versus generate, and the bed loop. The generator
// is always a stub, so no test spends credits or needs audio.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MOODS, adoptBed, assertSlot, describeSlot, listLibrary, loopFilter, loopPlan, pickMood, planMusic, shortBedWarning, slotFile, useMood } from "../lib/music.mjs";

let dir;
let library;
let project;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dv-music-"));
  library = join(dir, "library");
  project = join(dir, "project");
  mkdirSync(project);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const fillSlot = (slot, text = slot) => {
  mkdirSync(library, { recursive: true });
  writeFileSync(slotFile(slot, library), text);
};

// MOODS ------------------------------------------------------------------------------------------------

test("MOODS_theFiveSlots_haveDistinctInstrumentalLoopFriendlyPrompts", () => {
  const prompts = Object.values(MOODS);

  assert.deepEqual(
    [prompts.length, new Set(prompts).size, prompts.every((p) => /no vocals/.test(p) && /no long intro/.test(p) && /no big ending/.test(p))],
    [5, 5, true],
  );
});

// pickMood ---------------------------------------------------------------------------------------------

test("pickMood_musicMoodSet_winsOverToneAndPreset", () => {
  const brief = { music_mood: "minimal-ambient", direction: { tone: "playful", preset: "energetic-launch" } };

  assert.equal(pickMood(brief, "minimal-ambient"), "minimal-ambient");
});

test("pickMood_unknownMusicMood_throwsNamingTheSlots", () => {
  assert.throws(() => pickMood({ music_mood: "loud" }), /unknown music mood "loud".*calm-tech/);
});

test("pickMood_toneAlone_mapsToItsMood", () => {
  const pick = (tone) => pickMood({ direction: { tone } });

  assert.deepEqual(["playful", "light", "serious", "critical", "balanced"].map(pick), ["launch-bright", "story-warm", "focus-serious", "focus-serious", "calm-tech"]);
});

test("pickMood_presetAlone_mapsToItsMood", () => {
  const pick = (preset) => pickMood({ direction: { preset } });

  assert.deepEqual(["energetic-launch", "story-driven", "minimal-documentary", "calm-technical"].map(pick), ["launch-bright", "story-warm", "focus-serious", "calm-tech"]);
});

test("pickMood_unknownPreset_throwsInsteadOfFallingBackToTheDefaultMood", () => {
  assert.throws(() => pickMood({ direction: { preset: "bogus" } }), /preset/);
});

test("pickMood_noDirection_isCalmTech", () => {
  assert.equal(pickMood({}), "calm-tech");
});

test("pickMood_twoMoodsFit_prefersTheOneTheLastVideoDidNotUse", () => {
  const brief = { direction: { preset: "calm-technical" } };

  assert.deepEqual([pickMood(brief, "calm-tech"), pickMood(brief, "minimal-ambient"), pickMood(brief, null)], ["minimal-ambient", "calm-tech", "calm-tech"]);
});

test("pickMood_toneAndPresetDisagree_bothFitSoTheLastVideoDecides", () => {
  const brief = { direction: { tone: "serious", preset: "energetic-launch" } };

  assert.deepEqual([pickMood(brief, null), pickMood(brief, "focus-serious")], ["focus-serious", "launch-bright"]);
});

test("pickMood_onlyOneMoodFitsAndItWasUsedLast_stillUsesIt", () => {
  assert.equal(pickMood({ direction: { preset: "story-driven" } }, "story-warm"), "story-warm");
});

// library ----------------------------------------------------------------------------------------------

test("listLibrary_someSlotsFilled_reportsEverySlotInOrderWithLengths", () => {
  fillSlot("story-warm");

  const slots = listLibrary(library, () => 360.2);

  assert.deepEqual(
    [slots.map((s) => s.slot), slots.filter((s) => s.present).map(describeSlot), describeSlot(slots[0])],
    [Object.keys(MOODS), ["story-warm: present, 360s"], "calm-tech: missing"],
  );
});

test("listLibrary_noLibraryFolder_allSlotsMissing", () => {
  assert.equal(listLibrary(join(dir, "none"), () => 1).every((s) => !s.present), true);
});

test("adoptBed_emptySlot_copiesTheBedIn", () => {
  const bed = join(project, "bgm.mp3");
  writeFileSync(bed, "bed");

  const track = adoptBed("calm-tech", bed, library);

  assert.equal(readFileSync(track, "utf8"), "bed");
});

test("adoptBed_filledSlot_refusesAndKeepsTheTrack", () => {
  const bed = join(project, "bgm.mp3");
  writeFileSync(bed, "new");
  fillSlot("calm-tech", "original");

  assert.throws(() => adoptBed("calm-tech", bed, library), /already filled/);
  assert.equal(readFileSync(slotFile("calm-tech", library), "utf8"), "original");
});

test("adoptBed_noBedOrUnknownSlot_throws", () => {
  assert.throws(() => adoptBed("calm-tech", join(project, "missing.mp3"), library), /no music bed to adopt/);
  assert.throws(() => adoptBed("loud", join(project, "missing.mp3"), library), /unknown music mood/);
});

test("assertSlot_inheritedObjectKey_isNotASlot", () => {
  assert.throws(() => assertSlot("toString"), /unknown music mood/);
});

test("useMood_filledSlot_copiesItIntoTheProjectWithoutGenerating", async () => {
  fillSlot("focus-serious", "track");
  const calls = [];

  const { bed, generated } = await useMood(project, "focus-serious", { dir: library, generate: async (...args) => calls.push(args) });

  assert.deepEqual([readFileSync(bed, "utf8"), generated, calls.length], ["track", false, 0]);
});

test("useMood_missingSlot_generatesIntoTheLibraryThenCopies", async () => {
  const calls = [];
  const generate = async (root, prompt, seconds, out) => {
    calls.push({ root, prompt, seconds });
    writeFileSync(out, "made");
  };

  const { bed, generated } = await useMood(project, "launch-bright", { dir: library, generate });

  assert.deepEqual(
    [readFileSync(bed, "utf8"), readFileSync(slotFile("launch-bright", library), "utf8"), generated, calls],
    ["made", "made", true, [{ root: project, prompt: MOODS["launch-bright"], seconds: 360 }]],
  );
});

test("useMood_generatorFails_leavesNoSlotAndNoBed", async () => {
  const failing = async () => {
    throw new Error("402");
  };

  await assert.rejects(useMood(project, "calm-tech", { dir: library, generate: failing }), /402/);

  assert.deepEqual([existsSync(slotFile("calm-tech", library)), existsSync(join(project, "assets", "music", "bgm.mp3"))], [false, false]);
});

// loop -------------------------------------------------------------------------------------------------

test("loopPlan_bedCoversTheVideo_isNotLooped", () => {
  assert.deepEqual([loopPlan(360, 200).copies, loopPlan(200, 200).copies, loopPlan(0, 200).copies], [1, 1, 1]);
});

test("loopPlan_bedShorterThanTheVideo_countsCopiesThatCoverItWithCrossfades", () => {
  const { copies, crossfade } = loopPlan(100, 400);

  assert.deepEqual([copies, crossfade, copies * 100 - (copies - 1) * crossfade >= 400, (copies - 1) * 100 - (copies - 2) * crossfade < 400], [5, 3, true, true]);
});

test("loopPlan_videoExactlyFilledByTwoCopies_needsTwoAndOneSecondMoreNeedsThree", () => {
  assert.deepEqual([loopPlan(100, 197).copies, loopPlan(100, 198).copies], [2, 3]);
});

test("loopPlan_veryShortBed_shrinksTheCrossfadeToAThirdOfIt", () => {
  assert.equal(loopPlan(6, 30).crossfade, 2);
});

test("loopFilter_oneCopy_usesTheBedInputAsIs", () => {
  assert.deepEqual(loopFilter({ copies: 1, crossfade: 0 }), { prefix: "", label: "[1:a]" });
});

test("loopFilter_threeCopies_chainsAcrossfadesOverSeparateInputs", () => {
  const { prefix, label } = loopFilter({ copies: 3, crossfade: 3 });

  assert.deepEqual(
    [prefix, label],
    ["[1:a][2:a]acrossfade=d=3:c1=qsin:c2=qsin[j1];[j1][3:a]acrossfade=d=3:c1=qsin:c2=qsin[j2];", "[j2]"],
  );
});

// planMusic: what a `music` command writes to the brief ------------------------------------------------

test("planMusic_moodAsked_isTheNewMoodEvenWhenAnotherWasSet", () => {
  const choice = planMusic({ product: "P", music_mood: "calm-tech" }, { asked: "story-warm" });

  assert.deepEqual([choice.mood, choice.brief.music_mood, choice.keepBed], ["story-warm", "story-warm", false]);
});

test("planMusic_moodAskedForTheFirstTime_isRecordedInTheBrief", () => {
  assert.equal(planMusic({}, { asked: "launch-bright" }).brief.music_mood, "launch-bright");
});

test("planMusic_plainRerunWithAMoodSet_keepsThatMoodAndLeavesTheBriefEqual", () => {
  const brief = { music_mood: "focus-serious", direction: { tone: "playful" } };

  const choice = planMusic(brief, { lastMood: "focus-serious" });

  assert.deepEqual([choice.mood, JSON.stringify(choice.brief) === JSON.stringify(brief)], ["focus-serious", true]);
});

test("planMusic_plainRunWithNoMood_picksAndRecordsOne", () => {
  const choice = planMusic({ direction: { tone: "serious" } }, {});

  assert.deepEqual([choice.mood, choice.brief.music_mood], ["focus-serious", "focus-serious"]);
});

test("planMusic_customBed_clearsTheMoodAndMarksTheBrief", () => {
  const choice = planMusic({ music_mood: "calm-tech" }, { custom: true });

  assert.deepEqual([choice.brief.music_mood, choice.brief.music_custom, choice.mood, choice.keepBed], [undefined, true, null, false]);
});

test("planMusic_plainRerunAfterACustomBed_keepsTheBedAndTheBrief", () => {
  const brief = { music_custom: true };

  const choice = planMusic(brief, { customBedPresent: true });

  assert.deepEqual([choice.keepBed, choice.mood, choice.brief === brief], [true, null, true]);
});

test("planMusic_customMarkButTheBedIsGone_fallsBackToALibraryMood", () => {
  const choice = planMusic({ music_custom: true }, { customBedPresent: false });

  assert.deepEqual([choice.keepBed, choice.mood, choice.brief.music_custom], [false, "calm-tech", undefined]);
});

test("planMusic_moodAskedAfterACustomBed_switchesToTheLibraryAndClearsTheMark", () => {
  const choice = planMusic({ music_custom: true }, { asked: "minimal-ambient", customBedPresent: true });

  assert.deepEqual([choice.mood, choice.brief.music_mood, choice.brief.music_custom, choice.keepBed], ["minimal-ambient", "minimal-ambient", undefined, false]);
});

test("planMusic_unknownMoodAsked_throws", () => {
  assert.throws(() => planMusic({}, { asked: "loud" }), /unknown music mood/);
});

test("planMusic_anyChoice_doesNotChangeTheInputBrief", () => {
  const brief = { music_mood: "calm-tech" };

  planMusic(brief, { asked: "story-warm" });
  planMusic(brief, { custom: true });

  assert.deepEqual(brief, { music_mood: "calm-tech" });
});

// slot repair and adopt ------------------------------------------------------------------------------------

test("shortBedWarning_bedUnderTheSlotLength_warnsWithBothLengths", () => {
  assert.match(shortBedWarning("bed.mp3", () => 120.4), /120s.*360s/);
});

test("shortBedWarning_bedAsLongAsASlot_isNull", () => {
  assert.equal(shortBedWarning("bed.mp3", () => 360), null);
});

test("useMood_generated_leavesNoTemporaryFileBehind", async () => {
  await useMood(project, "calm-tech", { dir: library, generate: async (r, p, s, out) => writeFileSync(out, "made") });

  assert.deepEqual(readdirSync(library), ["calm-tech.mp3"]);
});

test("useMood_generatorWritesThenFails_leavesNoSlotAndNoTemporaryFile", async () => {
  const failing = async (r, p, s, out) => {
    writeFileSync(out, "half");
    throw new Error("connection reset");
  };

  await assert.rejects(useMood(project, "calm-tech", { dir: library, generate: failing }), /connection reset/);

  assert.deepEqual(readdirSync(library), []);
});

test("useMood_deletedSlotFile_isRegenerated", async () => {
  fillSlot("calm-tech", "old");
  rmSync(slotFile("calm-tech", library));

  const { generated } = await useMood(project, "calm-tech", { dir: library, generate: async (r, p, s, out) => writeFileSync(out, "new") });

  assert.deepEqual([generated, readFileSync(slotFile("calm-tech", library), "utf8")], [true, "new"]);
});
