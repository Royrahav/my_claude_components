// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The Kokoro engine without audio or a model: clause splitting, pauses, the phoneme-weighted alignment fed
// through displayWords, engine dispatch and stamps in narrate, voice choice, and the machine default.
// The Python worker is replaced by kokoroWorker.run, a stub that "measures" every word as one second-share.
import { test, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// An empty home dir first, so the developer's real ~/.config/demo-video/config.json is never read.
const fakeHome = mkdtempSync(join(tmpdir(), "dv-kokoro-home-"));
process.env.HOME = fakeHome;
process.env.USERPROFILE = fakeHome;
after(() => rmSync(fakeHome, { recursive: true, force: true }));

const { PAUSE_SENTENCE_S, PAUSE_SOFT_S, clauseAlignment, kokoroWorker, spokenSeconds, splitClauses } = await import("../lib/kokoro.mjs");
const { chooseVoice, defaultVoice, displayWords, engineOf, impliedEngine, machineEngine, narrate, narrationStamp, respell, samples, voiceById } = await import("../lib/voice.mjs");
const { defaultBrief, CONFIG_PATH, writeJson } = await import("../lib/util.mjs");

const words = (text) => text.split(/\s+/);

// weights: one per word unless given; seconds: one per clause unless given.
const measureAll = (clauses, { seconds = 1, weightOf = () => 1 } = {}) => clauses.map((c) => ({ seconds, weights: words(c.text).map(weightOf) }));

// splitClauses ------------------------------------------------------------------------------------------

test("splitClauses_commaAndSentenceEnd_splitAfterThePunctuationWithItsPause", () => {
  assert.deepEqual(splitClauses("First, then second. Third"), [
    { text: "First,", pauseAfter: PAUSE_SOFT_S },
    { text: "then second.", pauseAfter: PAUSE_SENTENCE_S },
    { text: "Third", pauseAfter: 0 },
  ]);
});

test("splitClauses_colonAndSemicolon_areSoftBreaks", () => {
  assert.deepEqual(splitClauses("Two things: one; two").map((c) => c.pauseAfter), [PAUSE_SOFT_S, PAUSE_SOFT_S, 0]);
});

test("splitClauses_questionAndExclamation_areSentenceEnds", () => {
  assert.deepEqual(splitClauses("Why? Because! Done.").map((c) => c.pauseAfter), [PAUSE_SENTENCE_S, PAUSE_SENTENCE_S, 0]);
});

test("splitClauses_lastClause_hasNoPauseSoTheSceneEndsWithoutSilence", () => {
  assert.equal(splitClauses("One. Two.").at(-1).pauseAfter, 0);
});

test("splitClauses_punctuationInsideAToken_doesNotSplit", () => {
  assert.deepEqual(splitClauses("Version 3.5 is out").map((c) => c.text), ["Version 3.5 is out"]);
});

test("splitClauses_doubleColonCodeToken_isNotSplitButItsTrailingCommaIs", () => {
  assert.deepEqual(splitClauses("Call RequestScope::Register, then wait").map((c) => c.text), ["Call RequestScope::Register,", "then wait"]);
});

test("splitClauses_closingQuoteAfterThePunctuation_staysWithItsClause", () => {
  assert.deepEqual(splitClauses('He said "stop." Then left').map((c) => c.text), ['He said "stop."', "Then left"]);
});

test("splitClauses_extraWhitespace_isTrimmedAndCollapsedAtTheBreaks", () => {
  assert.deepEqual(splitClauses("  One.\n\n  Two  ").map((c) => c.text), ["One.", "Two"]);
});

test("splitClauses_eMinusGAndIeAndVs_doNotSplitOrPause", () => {
  assert.deepEqual(splitClauses("Use a flag, e.g. the site one, i.e. per site, vs. global").map((c) => c.text), ["Use a flag,", "e.g. the site one,", "i.e. per site,", "vs. global"]);
});

test("splitClauses_etcMidSentence_doesNotSplitButEtcEndingASentenceDoes", () => {
  assert.deepEqual(splitClauses("Locks, rows etc. are cleared. Next etc. Then more").map((c) => c.text), ["Locks,", "rows etc. are cleared.", "Next etc.", "Then more"]);
});

// clauseAlignment ---------------------------------------------------------------------------------------

test("clauseAlignment_shape_isTheElevenLabsCharacterAlignment", () => {
  const clauses = splitClauses("Hi there. Bye");
  const a = clauseAlignment(clauses, measureAll(clauses));

  assert.deepEqual(Object.keys(a), ["characters", "character_start_times_seconds", "character_end_times_seconds"]);
  assert.equal(a.characters.join(""), "Hi there. Bye");
  assert.equal(a.character_start_times_seconds.length, a.characters.length);
  assert.equal(a.character_end_times_seconds.length, a.characters.length);
});

test("clauseAlignment_clauseEdges_areExactAcrossThePauses", () => {
  const clauses = splitClauses("One two. Three");
  const m = [{ seconds: 1.5, weights: [1, 1] }, { seconds: 0.8, weights: [1] }];
  const out = displayWords(clauseAlignment(clauses, m), { text: "One two. Three", swaps: [] });

  assert.equal(out[0].start, 0);
  assert.equal(out[1].end, 1.5);
  assert.equal(out[2].start, 1.5 + PAUSE_SENTENCE_S);
  assert.equal(out[2].end, 1.5 + PAUSE_SENTENCE_S + 0.8);
});

test("clauseAlignment_wordsInAClause_shareItsTimeInProportionToTheirWeights", () => {
  const clauses = splitClauses("a bbb");
  const out = displayWords(clauseAlignment(clauses, [{ seconds: 2, weights: [1, 3] }]), { text: "a bbb", swaps: [] });

  assert.deepEqual(out, [{ text: "a", start: 0, end: 0.5 }, { text: "bbb", start: 0.5, end: 2 }]);
});

test("clauseAlignment_wordTimes_neverOverlapAndStayInOrder", () => {
  const text = "Locks stay, then the sweep clears them. Done";
  const clauses = splitClauses(text);
  const out = displayWords(clauseAlignment(clauses, measureAll(clauses, { seconds: 1.7, weightOf: (w) => 1 + w.length })), { text, swaps: [] });

  out.forEach((w, i) => assert.ok(w.end >= w.start && (i === 0 || w.start >= out[i - 1].end), `${w.text} out of order`));
});

test("clauseAlignment_wholeTake_charactersStayInOrderAndEndExactlyAtTheSpokenSeconds", () => {
  const clauses = splitClauses("Locks stay, then clear. Done");
  const measured = measureAll(clauses, { seconds: 1.3, weightOf: (w) => 1 + w.length });
  const a = clauseAlignment(clauses, measured);

  a.character_start_times_seconds.forEach((start, i) => assert.ok(a.character_end_times_seconds[i] >= start && (i === 0 || start >= a.character_start_times_seconds[i - 1]), `char ${i} out of order`));
  assert.ok(Math.abs(a.character_end_times_seconds.at(-1) - spokenSeconds(clauses, measured)) < 1e-9);
});

test("clauseAlignment_throughDisplayWords_putsAPronunciationSwapBackToItsDisplayForm", () => {
  const spoken = respell("Set lp options now", [{ display: "lp", spoken: "ell pee" }]);
  const clauses = splitClauses(spoken.text);
  const out = displayWords(clauseAlignment(clauses, measureAll(clauses, { seconds: 4 })), spoken);

  assert.deepEqual(out.map((w) => w.text), ["Set", "lp", "options", "now"]);
  assert.equal(out[1].start, 0.8);
  assert.equal(out[1].end, 2.4);
});

test("clauseAlignment_measuredClauseCountMismatch_throwsNamingTheCounts", () => {
  assert.throws(() => clauseAlignment(splitClauses("One. Two"), [{ seconds: 1, weights: [1] }]), /measured 1 clauses, expected 2/);
});

test("clauseAlignment_weightCountMismatch_throwsNamingTheClause", () => {
  assert.throws(() => clauseAlignment(splitClauses("One two"), [{ seconds: 1, weights: [1] }]), /weighed 1 words in "One two", expected 2/);
});

test("spokenSeconds_clausesPlusPausesBetweenThem_noTrailingPause", () => {
  const clauses = splitClauses("One, two. Three");

  assert.equal(spokenSeconds(clauses, measureAll(clauses, { seconds: 1 })), 3 + PAUSE_SOFT_S + PAUSE_SENTENCE_S);
});

// voice choice and defaults ---------------------------------------------------------------------------------

test("engineOf_voiceWithoutAnEngine_isElevenLabsSoOlderBriefsKeepWorking", () => {
  assert.equal(engineOf({ id: "XrExE9yKIg1WjnnlVkGX" }), "elevenlabs");
});

test("engineOf_unknownEngine_throwsNamingTheChoices", () => {
  assert.throws(() => engineOf({ engine: "piper" }), /voice\.engine must be one of kokoro, elevenlabs, got "piper"/);
});

test("machineEngine_noConfigTts_isKokoro", () => {
  assert.equal(machineEngine(), "kokoro");
});

test("machineEngine_configTtsElevenlabs_isElevenLabs", () => {
  writeJson(CONFIG_PATH, { tts: "elevenlabs" });
  try {
    assert.equal(machineEngine(), "elevenlabs");
  } finally {
    rmSync(CONFIG_PATH, { force: true });
  }
});

test("defaultVoice_kokoro_isHeart", () => {
  assert.deepEqual(defaultVoice("kokoro"), { engine: "kokoro", id: "af_heart", name: "Heart", speed: 1 });
});

test("defaultBrief_withAVoice_usesItInsteadOfTheStockElevenLabsVoice", () => {
  assert.equal(defaultBrief({ name: "n", product: "p", voice: defaultVoice("kokoro") }).voice.id, "af_heart");
});

test("voiceById_sameNameInTwoEngines_isFoundInTheRequestedOne", () => {
  assert.equal(voiceById("George", "kokoro").id, "bm_george");
  assert.equal(voiceById("George", "elevenlabs").id, "JBFqnCBsd6RMkjVDRZzb");
});

test("chooseVoice_switchToKokoro_startsFromHeartKeepsSpeedAndDropsTheMeasuredRate", () => {
  const next = chooseVoice({ id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", speed: 0.95, measured_wps: 2.68 }, { engine: "kokoro" });

  assert.deepEqual(next, { engine: "kokoro", id: "af_heart", name: "Heart", speed: 0.95 });
});

test("chooseVoice_switchBackToElevenlabs_startsFromMatilda", () => {
  assert.equal(chooseVoice(defaultVoice("kokoro"), { engine: "elevenlabs" }).id, "XrExE9yKIg1WjnnlVkGX");
});

test("chooseVoice_kokoroVoiceByName_setsItsIdAndDropsTheMeasuredRate", () => {
  const next = chooseVoice({ engine: "kokoro", id: "af_heart", name: "Heart", speed: 1, measured_wps: 2.3 }, { voice: "bella" });

  assert.deepEqual(next, { engine: "kokoro", id: "af_bella", name: "Bella", speed: 1 });
});

test("chooseVoice_unknownKokoroVoice_throwsListingTheVoices", () => {
  assert.throws(() => chooseVoice(defaultVoice("kokoro"), { voice: "nobody" }), /unknown Kokoro voice "nobody"; available: Heart, Bella/);
});

test("chooseVoice_customElevenlabsId_isKept", () => {
  assert.equal(chooseVoice({ id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda" }, { voice: "customId123" }).id, "customId123");
});

test("chooseVoice_nothingAsked_changesNothing", () => {
  const voice = { engine: "kokoro", id: "af_heart", name: "Heart", speed: 1.1, measured_wps: 2.3 };

  assert.deepEqual(chooseVoice(voice, {}), voice);
});

test("chooseVoice_speedOnly_setsTheSpeedAndKeepsTheMeasuredRate", () => {
  const next = chooseVoice({ engine: "kokoro", id: "af_heart", name: "Heart", speed: 1, measured_wps: 2.3 }, { speed: "1.1" });

  assert.deepEqual([next.speed, next.measured_wps], [1.1, 2.3]);
});

// stamps ---------------------------------------------------------------------------------------------------

const stampOf = (voice) => narrationStamp({ voice }, { say: "Hello there." }, []);

test("narrationStamp_sameIdUnderAnotherEngine_isAnotherStamp", () => {
  assert.notEqual(stampOf({ engine: "kokoro", id: "x" }), stampOf({ engine: "elevenlabs", id: "x" }));
});

test("narrationStamp_kokoroVoiceChange_changesTheStamp", () => {
  assert.notEqual(stampOf({ engine: "kokoro", id: "af_heart" }), stampOf({ engine: "kokoro", id: "af_bella" }));
});

test("narrationStamp_kokoroIgnoresTheTone_soATonedBriefKeepsItsTakes", () => {
  const voice = { engine: "kokoro", id: "af_heart" };

  assert.equal(narrationStamp({ voice, direction: { tone: "playful" } }, { say: "Hi." }, []), narrationStamp({ voice }, { say: "Hi." }, []));
});

// narrate dispatch (worker stubbed) ----------------------------------------------------------------------------

let project;
let calls;
let realRun;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "dv-kokoro-"));
  calls = [];
  realRun = kokoroWorker.run;
  kokoroWorker.run = (jobs) => {
    calls.push(jobs);
    for (const j of jobs) writeFileSync(j.out, "x"); // the real worker writes each take's mp3
    return Object.fromEntries(jobs.map((j) => [j.id, measureAll(j.clauses)]));
  };
});

afterEach(() => {
  kokoroWorker.run = realRun;
  rmSync(project, { recursive: true, force: true });
});

const KOKORO_BRIEF = { voice: { engine: "kokoro", id: "af_heart", name: "Heart", speed: 1 } };
const SCENES = [{ id: "s01", say: "Locks stay, then clear." }, { id: "s02", say: "Second scene here." }];
const rawFile = (id, ext) => join(project, "assets", "voice", "raw", `${id}.${ext}`);

test("narrate_kokoroBrief_sendsOneWorkerRunWithEveryScene", async () => {
  await narrate(project, SCENES, KOKORO_BRIEF, null);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].map((j) => [j.id, j.voice, j.speed]), [["s01", "af_heart", 1], ["s02", "af_heart", 1]]);
  assert.deepEqual(calls[0][0].clauses, splitClauses("Locks stay, then clear."));
});

test("narrate_kokoroBrief_writesElevenLabsShapedWordsAndAStampPerScene", async () => {
  const results = await narrate(project, SCENES, KOKORO_BRIEF, null);

  const wordsFile = JSON.parse(readFileSync(rawFile("s01", "words.json"), "utf8"));
  assert.deepEqual(wordsFile.map((w) => w.text), ["Locks", "stay,", "then", "clear."]);
  assert.equal(readFileSync(rawFile("s01", "key"), "utf8"), narrationStamp(KOKORO_BRIEF, SCENES[0], []));
  assert.equal(results.length, 2);
});

test("narrate_pronunciations_areAppliedBeforeTheWorkerAndUndoneInTheWords", async () => {
  writeFileSync(join(project, "pronunciations.json"), JSON.stringify([{ display: "lp", spoken: "ell pee" }]));
  await narrate(project, [{ id: "s01", say: "Use lp now." }], KOKORO_BRIEF, null);

  assert.equal(calls[0][0].clauses[0].text, "Use ell pee now.");
  assert.deepEqual(JSON.parse(readFileSync(rawFile("s01", "words.json"), "utf8")).map((w) => w.text), ["Use", "lp", "now."]);
});

test("narrate_secondRunWithNothingChanged_voicesNothing", async () => {
  await narrate(project, SCENES, KOKORO_BRIEF, null);
  mkdirSync(join(project, "assets", "voice", "raw"), { recursive: true });
  for (const s of SCENES) writeFileSync(rawFile(s.id, "mp3"), "x"); // the stub writes no audio; takes need an mp3 to count
  const results = await narrate(project, SCENES, KOKORO_BRIEF, null);

  assert.deepEqual(results, ["all takes up to date"]);
  assert.equal(calls.length, 1);
});

test("narrate_oneSceneChanged_voicesOnlyThatScene", async () => {
  await narrate(project, SCENES, KOKORO_BRIEF, null);
  for (const s of SCENES) writeFileSync(rawFile(s.id, "mp3"), "x");
  await narrate(project, [SCENES[0], { id: "s02", say: "Changed text." }], KOKORO_BRIEF, null);

  assert.deepEqual(calls[1].map((j) => j.id), ["s02"]);
});

test("narrate_switchOfVoiceOrEngine_voicesEverySceneAgain", async () => {
  await narrate(project, SCENES, KOKORO_BRIEF, null);
  for (const s of SCENES) writeFileSync(rawFile(s.id, "mp3"), "x");
  await narrate(project, SCENES, { voice: { ...KOKORO_BRIEF.voice, id: "af_bella", name: "Bella" } }, null);

  assert.deepEqual(calls[1].map((j) => j.id), ["s01", "s02"]);
});

test("narrate_kokoroSpeedOutsideTheRange_throwsBeforeVoicing", async () => {
  await assert.rejects(narrate(project, SCENES, { voice: { ...KOKORO_BRIEF.voice, speed: 1.5 } }, null), /Kokoro speed 1.5 is outside 0.8-1.25/);
  assert.equal(calls.length, 0);
});

test("narrate_workerFails_surfacesItsErrorAndWritesNoTake", async () => {
  kokoroWorker.run = () => {
    throw new Error("Kokoro worker failed: model file missing");
  };

  await assert.rejects(narrate(project, SCENES, KOKORO_BRIEF, null), /Kokoro worker failed: model file missing/);
  assert.equal(existsSync(rawFile("s01", "key")) || existsSync(rawFile("s01", "words.json")), false);
});

test("narrate_workerReturnsNothingForAScene_failsAndLeavesNoKeyThatWouldHideTheMissingTake", async () => {
  kokoroWorker.run = (jobs) => ({ [jobs[0].id]: measureAll(jobs[0].clauses) });

  await assert.rejects(narrate(project, SCENES, KOKORO_BRIEF, null));
  assert.equal(existsSync(rawFile("s02", "key")) || existsSync(rawFile("s02", "words.json")), false);
});

test("narrate_onlyOneScene_sendsOnlyThatSceneToTheWorker", async () => {
  await narrate(project, SCENES, KOKORO_BRIEF, new Set(["s02"]));

  assert.deepEqual(calls[0].map((j) => j.id), ["s02"]);
});

test("narrate_noSayAtAll_doesNotStartTheWorker", async () => {
  await narrate(project, [{ id: "s01" }], KOKORO_BRIEF, null);

  assert.equal(calls.length, 0);
});

// samples (worker stubbed) ---------------------------------------------------------------------------------

test("samples_kokoro_voicesEachNamedVoiceInOneWorkerRun", async () => {
  const lines = await samples(project, "Hello there, friend.", ["Heart", "emma"], "kokoro");

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].map((j) => j.voice), ["af_heart", "bf_emma"]);
  assert.match(lines[0], /^Heart \(female, warm, American \(default\)\): .*voice-heart\.mp3 \d+\.\ds$/);
  assert.equal(existsSync(join(project, "samples")), true);
});

test("samples_kokoroWithNoKnownName_returnsNothingAndDoesNotStartTheWorker", async () => {
  assert.deepEqual(await samples(project, "Hi.", ["Matilda"], "kokoro"), []);
  assert.equal(calls.length, 0);
});

test("narrate_workerResultMissingAScene_failsNamingTheSceneAndSavesTheEarlierOnes", async () => {
  kokoroWorker.run = (jobs) => {
    for (const j of jobs) writeFileSync(j.out, "x");
    return { [jobs[0].id]: measureAll(jobs[0].clauses) };
  };

  await assert.rejects(narrate(project, SCENES, KOKORO_BRIEF, null), /Kokoro worker returned nothing for scene s02/);
  assert.equal(existsSync(rawFile("s01", "key")), true);
  assert.equal(existsSync(rawFile("s02", "key")), false);
});

test("narrate_workerWroteNoMp3_failsThatSceneWithoutKeyOrWords", async () => {
  kokoroWorker.run = (jobs) => Object.fromEntries(jobs.map((j) => [j.id, measureAll(j.clauses)]));

  await assert.rejects(narrate(project, SCENES, KOKORO_BRIEF, null), /Kokoro worker wrote no audio for scene s01/);
  assert.deepEqual([existsSync(rawFile("s01", "key")), existsSync(rawFile("s01", "words.json"))], [false, false]);
});

test("narrate_sceneBeingRevoicedWhenTheWorkerFails_leavesNoOldKeyWordsOrAudio", async () => {
  await narrate(project, SCENES, KOKORO_BRIEF, null);
  kokoroWorker.run = () => {
    throw new Error("Kokoro worker failed: boom");
  };

  await assert.rejects(narrate(project, SCENES, { voice: { ...KOKORO_BRIEF.voice, id: "af_bella", name: "Bella" } }, null), /boom/);
  for (const id of ["s01", "s02"]) assert.deepEqual(["key", "mp3", "words.json"].map((ext) => existsSync(rawFile(id, ext))), [false, false, false]);
});

test("narrate_whitespaceOnlySay_isTreatedAsSilent", async () => {
  await narrate(project, [{ id: "s01", say: "   " }], KOKORO_BRIEF, null);

  assert.equal(calls.length, 0);
});

test("impliedEngine_briefVoiceWithoutAnEngine_isTheMachineDefault", () => {
  assert.equal(impliedEngine({ id: "XrExE9yKIg1WjnnlVkGX" }), "kokoro");
});

test("impliedEngine_briefVoiceWithAnEngine_isNothingSoItIsKept", () => {
  assert.equal(impliedEngine({ engine: "elevenlabs", id: "x" }), undefined);
});

test("chooseVoice_legacyBriefWithTheImpliedKokoroEngine_becomesHeartWithTheEngineWritten", () => {
  const legacy = { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", speed: 0.95, measured_wps: 2.68 };

  assert.deepEqual(chooseVoice(legacy, { engine: impliedEngine(legacy) }), { engine: "kokoro", id: "af_heart", name: "Heart", speed: 0.95 });
});

test("chooseVoice_legacyBriefWithTheImpliedElevenlabsEngine_keepsItsVoiceAndWritesTheEngine", () => {
  const legacy = { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", speed: 1 };

  assert.deepEqual(chooseVoice(legacy, { engine: "elevenlabs" }), { ...legacy, engine: "elevenlabs" });
});

test("chooseVoice_voiceOfTheOtherEngine_throwsNamingTheEngineToAdd", () => {
  assert.throws(() => chooseVoice({ engine: "elevenlabs", id: "x", name: "x" }, { voice: "Heart" }), /Heart is a kokoro voice; add --engine kokoro/);
});
