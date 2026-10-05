// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// voice.mjs call() is private; it is exercised through music(), which sends a binary request through it.
// The retry sleep goes through retryTimer.sleep, replaced here by a recorder, so no test really waits.
import { test, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the home dir at an empty temp dir first, so a developer's real ~/.config/demo-video/.env key is never read.
const fakeHome = mkdtempSync(join(tmpdir(), "dv-home-"));
process.env.HOME = fakeHome;
process.env.USERPROFILE = fakeHome;
after(() => rmSync(fakeHome, { recursive: true, force: true }));

const sleeps = [];
// Dynamic import, after the home dir is redirected: util.mjs resolves the config path at load time.
const { displayWords, music, respell, retryTimer, toSpoken } = await import("../lib/voice.mjs");
retryTimer.sleep = async (ms) => void sleeps.push(ms);

const FAKE_KEY = "test-key-NEVER-PRINT-ME";
const BUSY = JSON.stringify({ detail: { status: "system_busy", message: "heavy traffic" } });
const AUDIO = new Uint8Array([1, 2, 3]);

let project;
let logs;
let requests;
let responses;
let savedKey;
let savedFetch;
let savedLog;

function reply(status, { body = "", headers = {} } = {}) {
  return () => new Response(body, { status, headers });
}

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "dv-voice-"));
  savedKey = process.env.ELEVENLABS_API_KEY;
  process.env.ELEVENLABS_API_KEY = FAKE_KEY;
  logs = [];
  requests = [];
  responses = [];
  savedLog = console.log;
  console.log = (...a) => logs.push(a.join(" "));
  savedFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    const next = responses[Math.min(requests.length - 1, responses.length - 1)];
    return next();
  };
  sleeps.length = 0;
});

afterEach(() => {
  console.log = savedLog;
  globalThis.fetch = savedFetch;
  if (savedKey === undefined) delete process.env.ELEVENLABS_API_KEY;
  else process.env.ELEVENLABS_API_KEY = savedKey;
  rmSync(project, { recursive: true, force: true });
});

// Runs fn and reports its outcome plus the virtual seconds the code asked to sleep.
async function withClock(fn) {
  let outcome;
  try {
    outcome = { value: await fn() };
  } catch (error) {
    outcome = { error };
  }
  return { ...outcome, waited: sleeps.reduce((a, b) => a + b, 0) / 1000 };
}

const retryLogs = () => logs.filter((l) => l.startsWith("ElevenLabs"));
const logged = (l) => Number(l.match(/in (\d+)s/)[1]);

test("call_successFirstTry_returnsAudioWithoutRetrying", async () => {
  responses = [reply(200, { body: AUDIO })];

  const { value } = await withClock(() => music(project, "calm", 10));

  assert.deepEqual([requests.length, retryLogs().length, [...readFileSync(value)]], [1, 0, [1, 2, 3]]);
});

test("call_request_sendsApiKeyHeaderToTheMusicRoute", async () => {
  responses = [reply(200, { body: AUDIO })];

  await withClock(() => music(project, "calm", 10));

  assert.equal(requests[0].init.headers["xi-api-key"], FAKE_KEY);
  assert.match(requests[0].url, /^https:\/\/api\.elevenlabs\.io\/v1\/music\?/);
});

test("call_busy429ThenSuccess_retriesOnceAfterFiveSeconds", async () => {
  responses = [reply(429, { body: BUSY }), reply(200, { body: AUDIO })];

  const { value, waited } = await withClock(() => music(project, "calm", 10));

  assert.deepEqual([requests.length, retryLogs().map(logged), waited, Boolean(value)], [2, [5], 5, true]);
});

test("call_serverError5xx_isRetried", async () => {
  responses = [reply(503, { body: "down" }), reply(200, { body: AUDIO })];

  const { value } = await withClock(() => music(project, "calm", 10));

  assert.deepEqual([requests.length, Boolean(value)], [2, true]);
});

test("call_persistentBusy_waits5Then15Then30ThenFailsWithApiMessage", async () => {
  responses = [reply(429, { body: BUSY })];

  const { error, waited } = await withClock(() => music(project, "calm", 10));

  assert.deepEqual([requests.length, retryLogs().map(logged), waited], [4, [5, 15, 30], 50]);
  assert.equal(error.message, "/v1/music -> HTTP 429: system_busy: heavy traffic");
});

test("call_retryAfterSeconds_isHonored", async () => {
  responses = [reply(429, { body: BUSY, headers: { "retry-after": "7" } }), reply(200, { body: AUDIO })];

  const { waited } = await withClock(() => music(project, "calm", 10));

  assert.deepEqual([retryLogs().map(logged), waited], [[7], 7]);
});

test("call_retryAfterHttpDate_isHonored", async () => {
  const date = new Date(Date.now() + 12000).toUTCString();
  responses = [reply(429, { body: BUSY, headers: { "retry-after": date } }), reply(200, { body: AUDIO })];

  await withClock(() => music(project, "calm", 10));

  const wait = logged(retryLogs()[0]);
  assert.ok(wait >= 10 && wait <= 12, `wait was ${wait}`);
});

test("call_retryAfterAboveSixty_isClampedToSixtySeconds", async () => {
  responses = [reply(429, { body: BUSY, headers: { "retry-after": "3600" } }), reply(200, { body: AUDIO })];

  await withClock(() => music(project, "calm", 10));

  assert.deepEqual(retryLogs().map(logged), [60]);
});

test("call_retryAfterZero_isClampedToOneSecond", async () => {
  responses = [reply(429, { body: BUSY, headers: { "retry-after": "0" } }), reply(200, { body: AUDIO })];

  await withClock(() => music(project, "calm", 10));

  assert.deepEqual(retryLogs().map(logged), [1]);
});

test("call_unparseableRetryAfter_fallsBackToTheScheduledWait", async () => {
  responses = [reply(429, { body: BUSY, headers: { "retry-after": "soon" } }), reply(200, { body: AUDIO })];

  await withClock(() => music(project, "calm", 10));

  assert.deepEqual(retryLogs().map(logged), [5]);
});

test("call_clientError401_failsAtOnceWithoutRetry", async () => {
  responses = [reply(401, { body: JSON.stringify({ detail: { status: "invalid_api_key", message: "bad key" } }) })];

  const { error, waited } = await withClock(() => music(project, "calm", 10));

  assert.deepEqual([requests.length, retryLogs().length, waited], [1, 0, 0]);
  assert.equal(error.message, "/v1/music -> HTTP 401: invalid_api_key: bad key");
});

test("call_errorWithoutStatusField_showsJustTheMessage", async () => {
  responses = [reply(400, { body: JSON.stringify({ detail: { message: "bad prompt" } }) })];

  const { error } = await withClock(() => music(project, "calm", 10));

  assert.equal(error.message, "/v1/music -> HTTP 400: bad prompt");
});

test("call_nonJsonErrorBody_showsTheRawTextCappedAt300Chars", async () => {
  responses = [reply(400, { body: "x".repeat(500) })];

  const { error } = await withClock(() => music(project, "calm", 10));

  assert.equal(error.message, `/v1/music -> HTTP 400: ${"x".repeat(300)}`);
});

test("call_retryLogLine_showsRouteWithoutQueryAndStatus", async () => {
  responses = [reply(429, { body: BUSY }), reply(200, { body: AUDIO })];

  await withClock(() => music(project, "calm", 10));

  assert.equal(retryLogs()[0], "ElevenLabs /v1/music: HTTP 429, retry 1/3 in 5s (system_busy: heavy traffic)");
});

test("call_retryLogLine_truncatesALongMessageTo80Chars", async () => {
  const long = JSON.stringify({ detail: { message: "m".repeat(200) } });
  responses = [reply(500, { body: long }), reply(200, { body: AUDIO })];

  await withClock(() => music(project, "calm", 10));

  assert.ok(retryLogs()[0].endsWith(`(${"m".repeat(80)})`));
});

test("call_apiKey_neverAppearsInLogsOrErrors", async () => {
  responses = [reply(429, { body: BUSY })];

  const { error } = await withClock(() => music(project, "calm", 10));

  assert.equal([...logs, error.message].some((text) => text.includes(FAKE_KEY)), false);
});

test("call_missingApiKey_failsBeforeAnyRequest", async () => {
  delete process.env.ELEVENLABS_API_KEY;
  responses = [reply(200, { body: AUDIO })];

  const { error } = await withClock(() => music(project, "calm", 10));

  assert.deepEqual([requests.length, /ELEVENLABS_API_KEY missing/.test(error.message)], [0, true]);
});

test("music_lengthAbove10Minutes_isCappedAtSixHundredThousandMs", async () => {
  responses = [reply(200, { body: AUDIO })];

  await withClock(() => music(project, "calm", 9999));

  assert.equal(JSON.parse(requests[0].init.body).music_length_ms, 600000);
});

test("music_request_isInstrumentalWithTheGivenPrompt", async () => {
  responses = [reply(200, { body: AUDIO })];

  await withClock(() => music(project, "calm piano", 30));

  const body = JSON.parse(requests[0].init.body);
  assert.deepEqual([body.prompt, body.force_instrumental, body.music_length_ms], ["calm piano", true, 30000]);
});

// pronunciations: respell() -> the voice's alignment -> displayWords() -------------------------------

// A synthetic ElevenLabs alignment of `spoken`: one character every 50 ms.
const alignmentOf = (spoken) => ({
  characters: [...spoken],
  character_start_times_seconds: [...spoken].map((_, i) => i * 0.05),
  character_end_times_seconds: [...spoken].map((_, i) => (i + 1) * 0.05),
});

// The caption words of `text` after a round trip through the voice.
function captionWords(text, pron) {
  const spoken = respell(text, pron);
  return displayWords(alignmentOf(spoken.text), spoken).map((w) => w.text);
}

const LP = [
  { display: "lp", spoken: "L P" },
  { display: "lpoptions", spoken: "L P options" },
];
const LAB_OS = { display: "labOS", spoken: "lab O S" };

test("respell_prefixCollision_spokenTextHasEachRespelling", () => {
  assert.equal(toSpoken("Run lp options, then lpoptions.", LP), "Run L P options, then L P options.");
});

test("displayWords_spokenFormThatStartsALongerOne_mergesOnlyWhereEachDisplayFormWas", () => {
  assert.deepEqual(captionWords("Run lp options, then lpoptions.", LP), ["Run", "lp", "options,", "then", "lpoptions."]);
});

test("displayWords_prefixCollision_doesNotDependOnThePronunciationOrder", () => {
  assert.deepEqual(captionWords("Run lp options, then lpoptions.", [...LP].reverse()), ["Run", "lp", "options,", "then", "lpoptions."]);
});

test("displayWords_respellingMadeOfOrdinaryWords_leavesThoseWordsAloneElsewhere", () => {
  const pron = [{ display: "paperSize", spoken: "paper size" }];

  assert.deepEqual(captionWords("Set paperSize to change the paper size.", pron), ["Set", "paperSize", "to", "change", "the", "paper", "size."]);
});

test("displayWords_mergedWord_spansFromItsFirstToItsLastSpokenCharacter", () => {
  const spoken = respell("Hi labOS", [LAB_OS]); // "Hi lab O S": "l" is character 3, the last "S" character 9

  const merged = displayWords(alignmentOf(spoken.text), spoken)[1];

  assert.deepEqual(merged, { text: "labOS", start: 0.15, end: 0.5 });
});

test("displayWords_respellingInsidePunctuation_keepsThePunctuation", () => {
  assert.deepEqual(captionWords("(labOS), done", [LAB_OS]), ["(labOS),", "done"]);
});

test("displayWords_twoRespellingsSharingAWord_mergeIntoOneWord", () => {
  const pron = [LAB_OS, { display: "macOS", spoken: "mac O S" }];

  assert.deepEqual(captionWords("on labOS/macOS too", pron), ["on", "labOS/macOS", "too"]);
});

test("displayWords_noPronunciations_keepsTheSpokenWords", () => {
  assert.deepEqual(captionWords("Plain words only.", []), ["Plain", "words", "only."]);
});

test("displayWords_alignmentOfAnotherText_keepsTheWordsAsSpoken", () => {
  const spoken = respell("Hi labOS", [LAB_OS]);

  const words = displayWords(alignmentOf("Hi lab O S again"), spoken).map((w) => w.text);

  assert.deepEqual(words, ["Hi", "lab", "O", "S", "again"]);
});

test("respell_wholeWordsOnly_leavesLongerWordsAndHyphenatedNamesAlone", () => {
  assert.equal(toSpoken("lp, lpstat and lp-x", [{ display: "lp", spoken: "L P" }]), "L P, lpstat and lp-x");
});

test("respell_spokenFormContainingAnotherDisplayForm_isNotRespelledAgain", () => {
  const pron = [
    { display: "IPP", spoken: "I P P" },
    { display: "P", spoken: "pee" },
  ];

  assert.equal(toSpoken("IPP and P", pron), "I P P and pee");
});
