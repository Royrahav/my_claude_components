// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { ffColor, sheetGeometry, summarizeCheck, summarizeLint } from "../lib/check.mjs";

// summarizeLint -------------------------------------------------------------------------------------

test("summarizeLint_errorsAndWarningsWithParenthesizedPlurals_parsesBothCounts", () => {
  const r = summarizeLint("lint finished: 3 error(s), 2 warning(s)\n");

  assert.deepEqual([r.summary, r.errors, r.warnings], ["3 error(s), 2 warning(s)", 3, 2]);
});

test("summarizeLint_cleanRunWithPlainPlurals_parsesZeroZero", () => {
  const r = summarizeLint("0 errors, 0 warnings\n");

  assert.deepEqual([r.summary, r.errors, r.warnings], ["0 errors, 0 warnings", 0, 0]);
});

test("summarizeLint_singularWords_areAccepted", () => {
  const r = summarizeLint("1 error, 1 warning");

  assert.deepEqual([r.errors, r.warnings], [1, 1]);
});

test("summarizeLint_noSummaryLine_reportsQuestionMarkAndZeroCounts", () => {
  const r = summarizeLint("something unexpected\n");

  assert.deepEqual([r.summary, r.errors, r.warnings], ["?", 0, 0]);
});

test("summarizeLint_emptyOutput_hasNoLines", () => {
  const r = summarizeLint("");

  assert.deepEqual([r.summary, r.errorLines, r.warningLines], ["?", [], []]);
});

test("summarizeLint_markedLines_areSplitIntoErrorsAndWarningsAndTrimmed", () => {
  const r = summarizeLint("  ✗ bad thing  \n  ⚠ odd thing  \nplain line\n1 error(s), 1 warning(s)");

  assert.deepEqual([r.errorLines, r.warningLines], [["✗ bad thing"], ["⚠ odd thing"]]);
});

test("summarizeLint_manyErrors_keepsAtMostFifteen", () => {
  const out = Array.from({ length: 20 }, (_, i) => `✗ e${i}`).join("\n");

  assert.equal(summarizeLint(out).errorLines.length, 15);
});

test("summarizeLint_exactlyFifteenErrors_keepsAll", () => {
  const out = Array.from({ length: 15 }, (_, i) => `✗ e${i}`).join("\n");

  assert.equal(summarizeLint(out).errorLines.length, 15);
});

test("summarizeLint_manyWarnings_keepsTheFirstTenInOrder", () => {
  const out = Array.from({ length: 12 }, (_, i) => `⚠ w${i}`).join("\n");

  const r = summarizeLint(out);

  assert.deepEqual([r.warningLines.length, r.warningLines[0], r.warningLines[9]], [10, "⚠ w0", "⚠ w9"]);
});

test("summarizeLint_longWarning_isCutTo200Characters", () => {
  const r = summarizeLint(`⚠ ${"w".repeat(500)}`);

  assert.equal(r.warningLines[0].length, 200);
});

test("summarizeLint_warningOf200Characters_isNotCut", () => {
  const line = `⚠ ${"w".repeat(198)}`;

  assert.equal(summarizeLint(line).warningLines[0], line);
});

test("summarizeLint_longError_isNotTruncated", () => {
  const line = `✗ ${"e".repeat(300)}`;

  assert.equal(summarizeLint(line).errorLines[0], line);
});

// summarizeCheck ------------------------------------------------------------------------------------

const lines = (...parts) => parts.join("\n") + "\n";
const PASS = "◇  Check passed";
const FULL_CONTRAST = lines("Contrast", "  ◇ 52/52 text checks pass WCAG AA");
// What HyperFrames printed for a midnight project: contrast misses as ✗ warnings, and still "Check passed".
const CONTRAST_MISSES = lines(
  "Contrast",
  "  ✗ #cap-w0-3 1.58:1 (need 3:1, t=1.682s)",
  "    Try rgb(101,103,107); source compositions/captions.html",
  "  ✗ #cap-w5-4 1.58:1 (need 3:1, t=18.498s)",
  "    Try rgb(101,103,107); source compositions/captions.html",
  "  0 error(s), 2 warning(s), 0 info(s)",
);

test("summarizeCheck_cleanRun_passesAndShowsFullContrast", () => {
  const r = summarizeCheck(lines(FULL_CONTRAST, PASS));

  assert.deepEqual([r.passed, r.summary, r.failureLines], [true, "check: passed, contrast 52/52 AA", []]);
});

test("summarizeCheck_contrastMissesListedAsCrossLines_failEvenThoughHyperFramesSaysCheckPassed", () => {
  const r = summarizeCheck(lines(CONTRAST_MISSES, PASS));

  assert.deepEqual([r.passed, r.summary], [false, "check: FAILED"]);
});

test("summarizeCheck_windowsCrlfOutput_readsVerdictCountAndTrimsCarriageReturns", () => {
  const crlf = (text) => text.replace(/\n/g, "\r\n");

  const clean = summarizeCheck(crlf(lines(FULL_CONTRAST, PASS)));
  const missed = summarizeCheck(crlf(lines(CONTRAST_MISSES, PASS)));

  assert.deepEqual([clean.passed, clean.summary], [true, "check: passed, contrast 52/52 AA"]);
  assert.deepEqual([missed.passed, missed.failureLines[0]], [false, "✗ #cap-w0-3 1.58:1 (need 3:1, t=1.682s)"]);
});

test("summarizeCheck_contrastMisses_keepTheirCrossLinesAndDropTheHintLines", () => {
  const r = summarizeCheck(lines(CONTRAST_MISSES, PASS));

  assert.deepEqual(r.failureLines, ["✗ #cap-w0-3 1.58:1 (need 3:1, t=1.682s)", "✗ #cap-w5-4 1.58:1 (need 3:1, t=18.498s)"]);
});

test("summarizeCheck_countBelowOneHundredPercent_failsAndShowsTheCount", () => {
  const r = summarizeCheck(lines("Contrast", "  ◇ 48/52 text checks pass WCAG AA", PASS));

  assert.deepEqual([r.passed, r.summary, r.failureLines], [false, "check: FAILED, contrast 48/52 AA", []]);
});

test("summarizeCheck_fullCountButACrossLineElsewhere_stillFailsAndKeepsTheCount", () => {
  const r = summarizeCheck(lines("Layout", "  ✗ t=1s canvas_overflow #a", FULL_CONTRAST, PASS));

  assert.deepEqual([r.passed, r.summary], [false, "check: FAILED, contrast 52/52 AA"]);
});

test("summarizeCheck_failedVerdictWithErrors_fails", () => {
  const r = summarizeCheck(lines("Layout", "  ✗ t=1s canvas_overflow #a", "◇  Check failed"));

  assert.deepEqual([r.passed, r.summary, r.failureLines.length], [false, "check: FAILED", 1]);
});

test("summarizeCheck_failedVerdictAloneWithoutCrossLines_fails", () => {
  const r = summarizeCheck(lines("Contrast", "  ◇ 52/52 text checks pass WCAG AA", "◇  Check failed"));

  assert.deepEqual([r.passed, r.summary, r.failureLines], [false, "check: FAILED, contrast 52/52 AA", []]);
});

test("summarizeCheck_noVerdictAtAll_fails", () => {
  const r = summarizeCheck("");

  assert.deepEqual([r.passed, r.summary, r.failureLines], [false, "check: FAILED", []]);
});

test("summarizeCheck_outputWithoutAContrastLine_passesOnTheVerdictAlone", () => {
  const r = summarizeCheck(lines(PASS));

  assert.deepEqual([r.passed, r.summary], [true, "check: passed"]);
});

test("summarizeCheck_zeroOfZeroTextChecks_countsAsFullContrast", () => {
  const r = summarizeCheck(lines("Contrast", "  ◇ 0/0 text checks pass WCAG AA", PASS));

  assert.deepEqual([r.passed, r.summary], [true, "check: passed, contrast 0/0 AA"]);
});

test("summarizeCheck_crossLines_areTrimmed", () => {
  const r = summarizeCheck("    ✗ #x 1.5:1 (need 3:1, t=1s)   \n");

  assert.deepEqual(r.failureLines, ["✗ #x 1.5:1 (need 3:1, t=1s)"]);
});

test("summarizeCheck_manyCrossLines_keepsAtMostTwentyFive", () => {
  const out = Array.from({ length: 30 }, (_, i) => `  ✗ #e${i}`).join("\n");

  assert.equal(summarizeCheck(out).failureLines.length, 25);
});

test("summarizeCheck_longCrossLine_isCutTo220Characters", () => {
  const r = summarizeCheck(`  ✗ ${"w".repeat(500)}`);

  assert.equal(r.failureLines[0].length, 220);
});

// sheetGeometry -------------------------------------------------------------------------------------

for (const [scenes, cols] of [[1, 2], [4, 2], [5, 3], [9, 3], [10, 4], [16, 4]]) {
  test(`sheetGeometry_${scenes}Scenes_uses${cols}Columns`, () => {
    assert.equal(sheetGeometry(scenes).cols, cols);
  });
}

test("sheetGeometry_tiles_spanTheFull1920WidthAtSixteenByNine", () => {
  const { cols, tileW, tileH } = sheetGeometry(6);

  assert.deepEqual([cols * tileW, tileH], [1920, 360]);
});

test("sheetGeometry_fourColumns_giveTileSize480x270", () => {
  const { tileW, tileH } = sheetGeometry(12);

  assert.deepEqual([tileW, tileH], [480, 270]);
});

// ffColor -------------------------------------------------------------------------------------------

test("ffColor_sixDigitHex_becomes0xRRGGBB", () => {
  assert.equal(ffColor("#F6F7F9"), "0xF6F7F9");
});

test("ffColor_threeDigitHex_isExpandedByDoublingEachDigit", () => {
  assert.equal(ffColor("#abc"), "0xaabbcc");
});

test("ffColor_mixedCaseThreeDigitHex_keepsCase", () => {
  assert.equal(ffColor("#A0f"), "0xAA00ff");
});
