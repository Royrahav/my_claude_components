// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// Render history (history.jsonl, last 20 projects) and the taste notes (taste.md). Every test works in a
// temp folder through the injectable paths, so the real ~/.config/demo-video is never read or written.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describeRecord, historyPaths, historyReport, historyWarnings, otherVideos, readHistory, recordOf, recordRender, safeHistoryWarnings } from "../lib/history.mjs";
import { resolveDirection } from "../lib/direction.mjs";

let dir;
let historyFile;
let tasteFile;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dv-history-"));
  historyFile = join(dir, "history.jsonl");
  tasteFile = join(dir, "taste.md");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const scenesOf = (...types) => types.map((type, i) => ({ id: `s${i + 1}`, ...(typeof type === "string" ? { type } : type) }));
const GENERIC = ["title", "split", "recap", "close"];

// A record as `render` would write it; `root` defaults to a distinct one per name.
function recordFor(name, { scenes = scenesOf(...GENERIC), direction = {}, root = `/p/${name}`, sources, date = "2026-10-11" } = {}) {
  return recordOf({ root, brief: { name, direction }, scenes, sources: sources ?? scenes.map(() => "builtin"), direction: resolveDirection(direction), date });
}

// historyPaths -----------------------------------------------------------------------------------------

test("historyPaths_noEnvironmentOverride_pointsIntoTheConfigFolder", () => {
  const paths = historyPaths({});

  assert.deepEqual([paths.history.endsWith("history.jsonl"), paths.taste.endsWith("taste.md"), paths.history.includes("demo-video")], [true, true, true]);
});

test("historyPaths_environmentOverrides_winOverTheDefaults", () => {
  const paths = historyPaths({ DEMO_VIDEO_HISTORY: "/x/h.jsonl", DEMO_VIDEO_TASTE: "/x/t.md" });

  assert.deepEqual(paths, { history: "/x/h.jsonl", taste: "/x/t.md" });
});

test("historyPaths_onlyOneOverride_leavesTheOtherAtItsDefault", () => {
  const paths = historyPaths({ DEMO_VIDEO_HISTORY: "/x/h.jsonl" });

  assert.deepEqual([paths.history, paths.taste.endsWith("taste.md")], ["/x/h.jsonl", true]);
});

// recordOf ---------------------------------------------------------------------------------------------

test("recordOf_fullVideo_capturesEveryField", () => {
  const scenes = scenesOf("title", { type: "split", variant: "wide" }, "recap", { type: "close", variant: "cta" });
  const direction = { preset: "story-driven", tone: "light", freedom: "creative", motif: "rails" };

  const record = recordFor("demo", { scenes, direction, sources: ["builtin", "project", "builtin", "builtin"] });

  assert.deepEqual(record, {
    date: "2026-10-11",
    root: resolve("/p/demo"),
    name: "demo",
    scenes: ["title", "split/wide", "recap", "close/cta"],
    preset: "story-driven",
    tone: "light",
    freedom: "creative",
    close: "cta",
    summary: "recap",
    signature: ["split"],
    motif: "rails",
  });
});

test("recordOf_noDirection_usesNullsForEveryOptionalField", () => {
  const record = recordFor("plain");

  assert.deepEqual([record.preset, record.tone, record.freedom, record.motif, record.signature], [null, null, null, null, []]);
});

test("recordOf_closeWithoutVariant_recordsTheDefaultVariantName", () => {
  assert.equal(recordFor("a").close, "default");
});

test("recordOf_noCloseScene_recordsNullClose", () => {
  assert.equal(recordFor("a", { scenes: scenesOf("title", "recap") }).close, null);
});

test("recordOf_summaryFlagOnANonRecapScene_isRecordedAsTheSummary", () => {
  const record = recordFor("a", { scenes: scenesOf("title", { type: "statement", summary: true, variant: "bold" }, "close") });

  assert.equal(record.summary, "statement/bold");
});

test("recordOf_secondToLastSceneIsNotASummary_recordsNullSummary", () => {
  assert.equal(recordFor("a", { scenes: scenesOf("title", "split", "close") }).summary, null);
});

test("recordOf_singleScene_recordsNullSummaryWithoutFailing", () => {
  assert.equal(recordFor("a", { scenes: scenesOf("close") }).summary, null);
});

test("recordOf_signatureTemplates_areTheDistinctProjectAndCustomTypes", () => {
  const scenes = scenesOf("title", "flow", "flow", "custom", "split", "close");

  const record = recordFor("a", { scenes, sources: ["builtin", "project", "project", "custom", "builtin", "builtin"] });

  assert.deepEqual(record.signature, ["flow", "custom"]);
});

test("recordOf_relativeRoot_isStoredResolved", () => {
  assert.equal(recordFor("a", { root: "some/where" }).root, resolve("some/where"));
});

// readHistory ------------------------------------------------------------------------------------------

test("readHistory_missingFile_isEmpty", () => {
  assert.deepEqual(readHistory(historyFile), []);
});

test("readHistory_emptyFile_isEmpty", () => {
  writeFileSync(historyFile, "");

  assert.deepEqual(readHistory(historyFile), []);
});

test("readHistory_corruptLineBetweenGoodOnes_isSkipped", () => {
  writeFileSync(historyFile, `{"name":"a","root":"/p/a","scenes":[]}\n{not json\n\n{"name":"b","root":"/p/b","scenes":[]}\n`);

  assert.deepEqual(readHistory(historyFile).map((r) => r.name), ["a", "b"]);
});

test("readHistory_crlfLineEndings_areRead", () => {
  writeFileSync(historyFile, `{"name":"a","root":"/p/a","scenes":[]}\r\n{"name":"b","root":"/p/b","scenes":[]}\r\n`);

  assert.deepEqual(readHistory(historyFile).map((r) => r.name), ["a", "b"]);
});

// recordRender -----------------------------------------------------------------------------------------

test("recordRender_missingFolder_isCreatedAndTheRecordWritten", () => {
  const nested = join(dir, "a", "b", "history.jsonl");

  recordRender(recordFor("a"), nested);

  assert.deepEqual(readHistory(nested).map((r) => r.name), ["a"]);
});

test("recordRender_writesOneJsonObjectPerLineEndingWithANewline", () => {
  recordRender(recordFor("a"), historyFile);
  recordRender(recordFor("b"), historyFile);

  const text = readFileSync(historyFile, "utf8");

  assert.deepEqual([text.endsWith("\n"), text.trim().split("\n").length], [true, 2]);
});

test("recordRender_sameRootAgain_replacesItsRecordAndMakesItTheNewest", () => {
  recordRender(recordFor("first", { root: "/p/a" }), historyFile);
  recordRender(recordFor("other", { root: "/p/b" }), historyFile);
  recordRender(recordFor("second", { root: "/p/a" }), historyFile);

  assert.deepEqual(readHistory(historyFile).map((r) => r.name), ["other", "second"]);
});

test("recordRender_exactlyTwentyProjects_keepsAllOfThem", () => {
  for (let i = 0; i < 20; i++) recordRender(recordFor(`v${i}`), historyFile);

  const names = readHistory(historyFile).map((r) => r.name);

  assert.deepEqual([names.length, names[0]], [20, "v0"]);
});

test("recordRender_twentyOneProjects_dropsTheOldest", () => {
  for (let i = 0; i < 21; i++) recordRender(recordFor(`v${i}`), historyFile);

  const names = readHistory(historyFile).map((r) => r.name);

  assert.deepEqual([names.length, names[0], names[19]], [20, "v1", "v20"]);
});

test("recordRender_rerenderingWhenFull_dropsNobody", () => {
  for (let i = 0; i < 20; i++) recordRender(recordFor(`v${i}`), historyFile);

  recordRender(recordFor("again", { root: "/p/v0" }), historyFile);

  const names = readHistory(historyFile).map((r) => r.name);

  assert.deepEqual([names.length, names[0], names[19]], [20, "v1", "again"]);
});

test("recordRender_corruptLineInTheFile_isDroppedOnRewrite", () => {
  writeFileSync(historyFile, "garbage\n");

  recordRender(recordFor("a"), historyFile);

  assert.deepEqual(readFileSync(historyFile, "utf8").trim().split("\n").length, 1);
});

// otherVideos ------------------------------------------------------------------------------------------

const many = (count) => Array.from({ length: count }, (_, i) => recordFor(`v${i}`));

test("otherVideos_moreThanFive_showsTheFiveNewestFirst", () => {
  assert.deepEqual(otherVideos(many(8), "/p/none").map((r) => r.name), ["v7", "v6", "v5", "v4", "v3"]);
});

test("otherVideos_fewerThanFive_showsAllOfThem", () => {
  assert.deepEqual(otherVideos(many(2), "/p/none").map((r) => r.name), ["v1", "v0"]);
});

test("otherVideos_theProjectsOwnRecord_isExcluded", () => {
  assert.deepEqual(otherVideos(many(3), "/p/v1").map((r) => r.name), ["v2", "v0"]);
});

test("otherVideos_explicitCount_overridesTheDefaultFive", () => {
  assert.equal(otherVideos(many(8), "/p/none", 2).length, 2);
});

test("otherVideos_noRecords_isEmpty", () => {
  assert.deepEqual(otherVideos([], "/p/a"), []);
});

// describeRecord ---------------------------------------------------------------------------------------

test("describeRecord_fullRecord_isOneCompactLine", () => {
  const record = recordFor("demo", {
    scenes: scenesOf("title", "flow", "recap", { type: "close", variant: "cta" }),
    direction: { preset: "story-driven", tone: "serious", freedom: "auteur", motif: "rails" },
    sources: ["builtin", "project", "builtin", "builtin"],
  });

  assert.equal(describeRecord(record), "2026-10-11 demo | preset story-driven, tone serious, freedom auteur, close cta, summary recap, signature flow, motif rails | title>flow>recap>close/cta");
});

test("describeRecord_sparseRecord_showsBalancedToneAndNoCloseAndSkipsTheRest", () => {
  const record = recordFor("bare", { scenes: scenesOf("title", "split") });

  assert.equal(describeRecord(record), "2026-10-11 bare | tone balanced, close none | title>split");
});

test("describeRecord_severalSignatureTemplates_areJoinedWithAPlus", () => {
  const record = recordFor("sig", { scenes: scenesOf("flow", "gauge", "recap", "close"), sources: ["project", "custom", "builtin", "builtin"] });

  assert.match(describeRecord(record), /signature flow\+gauge/);
});

// historyReport ----------------------------------------------------------------------------------------

const paths = () => ({ history: historyFile, taste: tasteFile });

test("historyReport_noHistoryAndNoTaste_saysBoth", () => {
  assert.deepEqual(historyReport("/p/a", paths()), ["no earlier videos", "taste notes: none"]);
});

test("historyReport_onlyTheProjectItselfInHistory_countsAsNoEarlierVideos", () => {
  recordRender(recordFor("a"), historyFile);

  assert.equal(historyReport("/p/a", paths())[0], "no earlier videos");
});

test("historyReport_otherProjects_areListedNewestFirstWithoutTheOwnOne", () => {
  for (const name of ["a", "b", "c"]) recordRender(recordFor(name), historyFile);

  const lines = historyReport("/p/b", paths());

  assert.deepEqual([lines.length, lines[0].includes(" c |"), lines[1].includes(" a |"), lines[2]], [3, true, true, "taste notes: none"]);
});

test("historyReport_sevenOtherProjects_showsFiveLines", () => {
  for (let i = 0; i < 7; i++) recordRender(recordFor(`v${i}`), historyFile);

  const lines = historyReport("/p/own", paths());

  assert.equal(lines.filter((line) => line.includes(" | ")).length, 5);
});

test("historyReport_tasteNotes_followTheVideosUnderAHeader", () => {
  writeFileSync(tasteFile, "likes short beats\n  no stock music  \n");

  assert.deepEqual(historyReport("/p/a", paths()), ["no earlier videos", "taste notes:", "likes short beats", "no stock music"]);
});

test("historyReport_emptyOrBlankTasteFile_saysNone", () => {
  writeFileSync(tasteFile, "\n   \n\r\n");

  assert.equal(historyReport("/p/a", paths()).at(-1), "taste notes: none");
});

test("historyReport_twentyTasteLines_areAllShown", () => {
  writeFileSync(tasteFile, Array.from({ length: 20 }, (_, i) => `note ${i}`).join("\n"));

  const lines = historyReport("/p/a", paths());

  assert.deepEqual([lines.length, lines.at(-1)], [22, "note 19"]);
});

test("historyReport_moreThanTwentyTasteLines_isCappedAtTwenty", () => {
  writeFileSync(tasteFile, Array.from({ length: 25 }, (_, i) => `note ${i}`).join("\n"));

  const lines = historyReport("/p/a", paths());

  assert.deepEqual([lines.length, lines.at(-1)], [22, "note 19"]);
});

test("historyReport_missingFolderForBothFiles_doesNotCreateThem", () => {
  const missing = { history: join(dir, "nope", "h.jsonl"), taste: join(dir, "nope", "t.md") };

  historyReport("/p/a", missing);

  assert.equal(existsSync(join(dir, "nope")), false);
});

// historyWarnings --------------------------------------------------------------------------------------

const LOOK = { preset: "story-driven", tone: "light" };
const sameShape = (name, overrides = {}) => recordFor(name, { scenes: scenesOf("title", "split", "recap", { type: "close", variant: "punchline" }), direction: LOOK, ...overrides });

test("historyWarnings_noEarlierVideos_isQuiet", () => {
  assert.deepEqual(historyWarnings(sameShape("new"), []), []);
});

test("historyWarnings_onlyTheProjectsOwnEarlierRecord_isQuiet", () => {
  assert.deepEqual(historyWarnings(sameShape("new", { root: "/p/x" }), [sameShape("old", { root: "/p/x" })]), []);
});

test("historyWarnings_sameCloseVariantAsTheMostRecent_namesThatVideo", () => {
  const latest = recordFor("latest", { scenes: scenesOf("title", "steps", "recap", { type: "close", variant: "punchline" }) });
  const current = recordFor("new", { scenes: scenesOf("title", "beat", "cards", "recap", { type: "close", variant: "punchline" }) });

  assert.deepEqual(historyWarnings(current, [latest]), ["house style: the close uses the punchline variant, like the most recent video (latest); pick another ending"]);
});

test("historyWarnings_sameCloseVariantAsAnOlderVideoOnly_isQuiet", () => {
  const older = recordFor("older", { scenes: scenesOf("title", "steps", "recap", { type: "close", variant: "cta" }) });
  const latest = recordFor("latest", { scenes: scenesOf("title", "cards", "recap", { type: "close", variant: "callback" }) });
  const current = recordFor("new", { scenes: scenesOf("title", "beat", "metrics", "recap", { type: "close", variant: "cta" }) });

  assert.deepEqual(historyWarnings(current, [older, latest]), []);
});

test("historyWarnings_closeWithoutAnyScene_doesNotMatchAnotherMissingClose", () => {
  const latest = recordFor("latest", { scenes: scenesOf("title", "steps", "recap") });
  const current = recordFor("new", { scenes: scenesOf("title", "cards", "metrics", "recap") });

  assert.deepEqual(historyWarnings(current, [latest]), []);
});

test("historyWarnings_sameSceneTypeSequenceInTheThirdMostRecent_namesThatVideo", () => {
  const twin = sameShape("twin", { root: "/p/twin", direction: { preset: "calm-technical" } });
  const fillers = ["f1", "f2"].map((name, i) => recordFor(name, { scenes: scenesOf("title", "steps", "cards", "recap", { type: "close", variant: `v${i}` }) }));
  const current = recordFor("new", { scenes: scenesOf("title", "split", "recap", { type: "close", variant: "cta" }), direction: { preset: "energetic-launch" } });

  assert.deepEqual(historyWarnings(current, [twin, ...fillers]), ["house style: the scene-type sequence matches twin; change the structure"]);
});

test("historyWarnings_sameSceneTypeSequenceInTheFourthMostRecent_isQuiet", () => {
  const twin = recordFor("twin", { scenes: scenesOf("title", "split", "recap", { type: "close", variant: "sting" }) });
  const fillers = ["f1", "f2", "f3"].map((name) => recordFor(name, { scenes: scenesOf("title", "steps", "cards", "recap", { type: "close", variant: "callback" }) }));
  const current = recordFor("new", { scenes: scenesOf("title", "split", "recap", { type: "close", variant: "cta" }) });

  assert.deepEqual(historyWarnings(current, [twin, ...fillers]), []);
});

test("historyWarnings_sequenceDiffersOnlyByVariants_stillCountsAsTheSameSequence", () => {
  const latest = recordFor("latest", { scenes: scenesOf("title", { type: "split", variant: "wide" }, "recap", { type: "close", variant: "sting" }) });
  const current = recordFor("new", { scenes: scenesOf("title", "split", "recap", { type: "close", variant: "cta" }) });

  assert.equal(historyWarnings(current, [latest]).length, 1);
});

test("historyWarnings_samePresetAndToneAsTheMostRecent_warns", () => {
  const latest = recordFor("latest", { scenes: scenesOf("title", "steps", "cards", "recap", { type: "close", variant: "cta" }), direction: LOOK });
  const current = recordFor("new", { scenes: scenesOf("title", "split", "recap", { type: "close", variant: "callback" }), direction: LOOK });

  assert.deepEqual(historyWarnings(current, [latest]), ["house style: preset story-driven and tone light repeat the most recent video (latest)"]);
});

test("historyWarnings_unsetToneAndBalancedTone_countAsTheSameTone", () => {
  const latest = recordFor("latest", { scenes: scenesOf("title", "steps", "recap", { type: "close", variant: "cta" }), direction: { preset: "calm-technical" } });
  const current = recordFor("new", { scenes: scenesOf("title", "split", "recap", { type: "close", variant: "callback" }), direction: { preset: "calm-technical", tone: "balanced" } });

  assert.match(historyWarnings(current, [latest])[0], /preset calm-technical and tone balanced repeat/);
});

test("historyWarnings_samePresetButDifferentTone_isQuiet", () => {
  const latest = recordFor("latest", { scenes: scenesOf("title", "steps", "recap", { type: "close", variant: "cta" }), direction: LOOK });
  const current = recordFor("new", { scenes: scenesOf("title", "split", "recap", { type: "close", variant: "callback" }), direction: { ...LOOK, tone: "serious" } });

  assert.deepEqual(historyWarnings(current, [latest]), []);
});

test("historyWarnings_noPresetOnEither_isQuiet", () => {
  const latest = recordFor("latest", { scenes: scenesOf("title", "steps", "recap", { type: "close", variant: "cta" }) });
  const current = recordFor("new", { scenes: scenesOf("title", "split", "recap", { type: "close", variant: "callback" }) });

  assert.deepEqual(historyWarnings(current, [latest]), []);
});

test("historyWarnings_identicalVideo_warnsOnEachRule", () => {
  assert.equal(historyWarnings(sameShape("new"), [sameShape("old")]).length, 3);
});

test("historyWarnings_mostRecentOtherVideoIsSkippedWhenItIsTheProjectItself", () => {
  const other = recordFor("other", { scenes: scenesOf("title", "steps", "recap", { type: "close", variant: "punchline" }) });
  const own = recordFor("own", { root: "/p/new", scenes: scenesOf("title", "cards", "recap", { type: "close", variant: "cta" }) });
  const current = recordFor("new", { root: "/p/new", scenes: scenesOf("title", "split", "recap", { type: "close", variant: "punchline" }) });

  assert.match(historyWarnings(current, [other, own])[0], /like the most recent video \(other\)/);
});

// the folder exists but nothing was written yet
test("recordRender_existingEmptyFolder_createsTheFile", () => {
  mkdirSync(join(dir, "cfg"));
  const path = join(dir, "cfg", "history.jsonl");

  recordRender(recordFor("a"), path);

  assert.equal(existsSync(path), true);
});

// wrong-shape lines: valid JSON that is not a record ----------------------------------------------------

const GOOD_LINE = JSON.stringify({ name: "good", root: "/p/good", scenes: ["title", "close"] });
const WRONG_SHAPES = [
  ["null", "null"],
  ["an empty array", "[]"],
  ["an empty object", "{}"],
  ["a number", "7"],
  ["a missing root", JSON.stringify({ name: "x", scenes: ["title"] })],
  ["a missing scenes list", JSON.stringify({ name: "x", root: "/p/x" })],
  ["a non-string root", JSON.stringify({ name: "x", root: 5, scenes: ["title"] })],
  ["a non-array scenes", JSON.stringify({ name: "x", root: "/p/x", scenes: "title" })],
];

for (const [label, line] of WRONG_SHAPES) {
  test(`readHistory_lineWith${label.replace(/\W+/g, "_")}_isSkippedAndGoodLinesKept`, () => {
    writeFileSync(historyFile, `${GOOD_LINE}\n${line}\n${GOOD_LINE.replaceAll("good", "second")}\n`);

    assert.deepEqual(readHistory(historyFile).map((r) => r.name), ["good", "second"]);
  });
}

test("recordRender_wrongShapeLines_areDroppedOnRewrite", () => {
  writeFileSync(historyFile, `${WRONG_SHAPES.map(([, line]) => line).join("\n")}\n${GOOD_LINE}\n`);

  recordRender(recordFor("new"), historyFile);

  assert.deepEqual(readFileSync(historyFile, "utf8").trim().split("\n").map((line) => JSON.parse(line).name), ["good", "new"]);
});

test("recordRender_afterwards_leavesNoTempFileAndEveryLineIsJson", () => {
  recordRender(recordFor("a"), historyFile);
  recordRender(recordFor("b"), historyFile);

  const lines = readFileSync(historyFile, "utf8").trim().split("\n");

  assert.deepEqual([existsSync(`${historyFile}.tmp`), readdirSync(dir).sort(), lines.map((line) => JSON.parse(line).name)], [false, ["history.jsonl"], ["a", "b"]]);
});

test("recordRender_staleTempFileFromACrashedRun_isReplacedNotKept", () => {
  writeFileSync(`${historyFile}.tmp`, "half written");

  recordRender(recordFor("a"), historyFile);

  assert.deepEqual([existsSync(`${historyFile}.tmp`), readHistory(historyFile).map((r) => r.name)], [false, ["a"]]);
});

// safeHistoryWarnings ----------------------------------------------------------------------------------

test("safeHistoryWarnings_goodFile_returnsTheNormalWarnings", () => {
  recordRender(sameShape("old"), historyFile);
  const current = sameShape("new");

  assert.deepEqual(safeHistoryWarnings(current, historyFile), historyWarnings(current, readHistory(historyFile)));
  assert.equal(safeHistoryWarnings(current, historyFile).length, 3);
});

test("safeHistoryWarnings_missingFile_isQuiet", () => {
  assert.deepEqual(safeHistoryWarnings(sameShape("new"), join(dir, "nope.jsonl")), []);
});

test("safeHistoryWarnings_pathIsADirectory_returnsOneSkippedLineInsteadOfThrowing", () => {
  const asDirectory = join(dir, "folder.jsonl");
  mkdirSync(asDirectory);

  const warnings = safeHistoryWarnings(sameShape("new"), asDirectory);

  assert.deepEqual([warnings.length, warnings[0].startsWith("history: skipped (")], [1, true]);
});

test("safeHistoryWarnings_fileWithOnlyWrongShapeLines_isQuiet", () => {
  writeFileSync(historyFile, `${WRONG_SHAPES.map(([, line]) => line).join("\n")}\n`);

  assert.deepEqual(safeHistoryWarnings(sameShape("new"), historyFile), []);
});

test("historyWarningsAndReport_fileWithOnlyWrongShapeLines_doNotThrow", () => {
  writeFileSync(historyFile, `${WRONG_SHAPES.map(([, line]) => line).join("\n")}\n`);
  writeFileSync(tasteFile, "");

  assert.deepEqual([historyWarnings(sameShape("new"), readHistory(historyFile)), historyReport("/p/new", paths())], [[], ["no earlier videos", "taste notes: none"]]);
});
