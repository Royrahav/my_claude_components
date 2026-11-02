// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The ending rule (a summary scene second to last, a close last) and the visible "Summary" label every
// summary scene carries whatever the direction's chrome level says.
import { test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { endingProblem } from "../lib/check.mjs";
import { createScene, wrap } from "../lib/kit.mjs";
import { resolveDirection } from "../lib/direction.mjs";
import { loadTheme } from "../lib/theme.mjs";

const THEME = loadTheme(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "themes", "labos", "theme.json"));

// endingProblem ----------------------------------------------------------------------------------------

const scenesOf = (...entries) => entries.map((entry, i) => ({ id: `s${i + 1}`, ...(typeof entry === "string" ? { type: entry } : entry) }));
const SUMMARY_RULE = /^ending rule: the second-to-last scene \(.*\) must be a summary \(a recap, or summary: true\)$/;

test("endingProblem_recapThenClose_isNull", () => {
  assert.equal(endingProblem(scenesOf("title", "split", "recap", "close")), null);
});

test("endingProblem_summaryFlagThenCloseVariant_isNull", () => {
  assert.equal(endingProblem(scenesOf("title", { type: "statement", summary: true }, { type: "close", variant: "sting" })), null);
});

test("endingProblem_exactlyTwoScenes_isNullWhenTheyAreSummaryThenClose", () => {
  assert.equal(endingProblem(scenesOf("recap", "close")), null);
});

test("endingProblem_noSummaryBeforeTheClose_namesTheRuleAndTheScene", () => {
  assert.equal(endingProblem(scenesOf("title", "split", "close")), "ending rule: the second-to-last scene (s2 split) must be a summary (a recap, or summary: true)");
});

test("endingProblem_summaryFlagFalse_isNotASummary", () => {
  assert.match(endingProblem(scenesOf("title", { type: "statement", summary: false }, "close")), SUMMARY_RULE);
});

test("endingProblem_summaryNotLast_butAScenePrecedesTheClose_isStillAProblem", () => {
  assert.match(endingProblem(scenesOf("recap", "split", "close")), SUMMARY_RULE);
});

test("endingProblem_lastSceneIsNotAClose_namesTheRuleAndTheScene", () => {
  assert.equal(endingProblem(scenesOf("title", "recap", "split")), "ending rule: the last scene (s3 split) must be a close");
});

test("endingProblem_summaryLastWithNoClose_namesTheCloseRule", () => {
  assert.match(endingProblem(scenesOf("title", "recap", "recap")), /^ending rule: the last scene \(s3 recap\) must be a close$/);
});

test("endingProblem_bothPartsWrong_reportsTheSummaryRuleFirst", () => {
  assert.match(endingProblem(scenesOf("title", "split", "cards")), SUMMARY_RULE);
});

test("endingProblem_singleScene_namesTheMissingSummaryAsNone", () => {
  assert.equal(endingProblem(scenesOf("close")), "ending rule: the second-to-last scene (none) must be a summary (a recap, or summary: true)");
});

test("endingProblem_noScenes_namesTheMissingSummaryAsNone", () => {
  assert.match(endingProblem([]), /second-to-last scene \(none\)/);
});

// summary label ----------------------------------------------------------------------------------------

function wrapped(scene, { chrome = true, level = "none" } = {}) {
  const k = createScene({ id: "s1", theme: THEME, fontsCss: "", brief: {}, scene, duration: 10, direction: resolveDirection({ chrome: level }) });
  return wrap(k, { fontsCss: "", chrome, eyebrow: "PRODUCT" });
}

const tagText = (html) => html.match(/<div id="s1-tag" class="s1-tag[^"]*">([^<]*)<\/div>/)?.[1];

test("wrap_recapUnderEveryChromeLevel_showsTheSummaryLabel", () => {
  const labels = ["full", "minimal", "none"].map((level) => tagText(wrapped({ type: "recap" }, { level })));

  assert.deepEqual(labels, ["Summary", "Summary", "Summary"]);
});

test("wrap_summaryFlagOnATemplateWithoutChrome_stillShowsTheLabel", () => {
  assert.equal(tagText(wrapped({ type: "statement", summary: true }, { chrome: false })), "Summary");
});

test("wrap_summaryLabelOverride_replacesTheTextAndIsTrimmed", () => {
  assert.equal(tagText(wrapped({ type: "recap", summary_label: "  In short  " })), "In short");
});

test("wrap_blankOrMissingSummaryLabel_fallsBackToSummary", () => {
  assert.deepEqual([tagText(wrapped({ type: "recap", summary_label: "" })), tagText(wrapped({ type: "recap", summary_label: "\t" })), tagText(wrapped({ type: "recap", summary_label: null }))], ["Summary", "Summary", "Summary"]);
});

test("wrap_summaryLabelMarkup_isEscaped", () => {
  const html = wrapped({ type: "recap", summary_label: "<b>x</b>" });

  assert.equal(html.includes("<b>x</b>"), false);
});

test("wrap_summaryReplacesTheChapterTag_insteadOfSittingBesideIt", () => {
  const html = wrapped({ type: "recap", chapter: "Recap" }, { level: "full" });

  assert.deepEqual([html.match(/id="s1-tag"/g).length, tagText(html), html.includes(">Recap<")], [1, "Summary", false]);
});

test("wrap_summaryUnderFullChromeWithChromeTemplate_keepsTheEyebrow", () => {
  assert.ok(wrapped({ type: "recap" }, { level: "full" }).includes('id="s1-eyebrow"'));
});

test("wrap_summaryUnderFullChromeButTemplateOptsOut_dropsTheEyebrowKeepsTheLabel", () => {
  const html = wrapped({ type: "statement", summary: true }, { chrome: false, level: "full" });

  assert.deepEqual([html.includes('id="s1-eyebrow"'), tagText(html)], [false, "Summary"]);
});

test("wrap_summaryUnderMinimalOrNoneChrome_hasNoEyebrow", () => {
  assert.deepEqual(["minimal", "none"].map((level) => wrapped({ type: "recap" }, { level }).includes('id="s1-eyebrow"')), [false, false]);
});

test("wrap_summaryScene_getsThePillStyling", () => {
  const html = wrapped({ type: "recap" });

  assert.match(html, /\.s1-summary\{top:46px;font-size:27px;padding:14px 32px;color:var\(--on-accent\);background:var\(--accent-text\)\}/);
  assert.match(html, /class="s1-tag s1-summary"/);
});

test("wrap_nonSummaryScene_hasNeitherTheLabelNorThePillStyling", () => {
  const html = wrapped({ type: "split", chapter: "Problem" }, { level: "minimal" });

  assert.deepEqual([tagText(html), html.includes("s1-summary"), html.includes("Summary")], ["Problem", false, false]);
});

test("wrap_nonSummarySceneWithChromeNone_hasNoChromeAtAll", () => {
  const html = wrapped({ type: "split", chapter: "Problem" }, { level: "none" });

  assert.deepEqual([html.includes('id="s1-tag"'), html.includes('id="s1-eyebrow"')], [false, false]);
});

test("wrap_summaryLabelFieldOnANonSummaryScene_isIgnored", () => {
  assert.equal(wrapped({ type: "split", summary_label: "In short" }, { level: "full" }).includes("In short"), false);
});

// checkOutcome (fix round 2) ---------------------------------------------------------------------------

test("checkOutcome_lintFailure_failsWithTheLintTextOnly", async () => {
  const { checkOutcome } = await import("../lib/check.mjs");

  const outcome = checkOutcome({ ok: false, text: "lint: 1 error" }, [{ id: "s1", type: "recap" }, { id: "s2", type: "close" }]);

  assert.deepEqual(outcome, { lines: ["lint: 1 error"], failed: true });
});

test("checkOutcome_endingRuleFailure_failsWithTheRuleLine", async () => {
  const { checkOutcome } = await import("../lib/check.mjs");

  const outcome = checkOutcome({ ok: true, text: "check: passed" }, [{ id: "s1", type: "split" }, { id: "s2", type: "close" }]);

  assert.deepEqual(outcome, { lines: ["check: passed", "check: FAILED - ending rule: the second-to-last scene (s1 split) must be a summary (a recap, or summary: true)"], failed: true });
});

test("checkOutcome_bothFine_passes", async () => {
  const { checkOutcome } = await import("../lib/check.mjs");

  const outcome = checkOutcome({ ok: true, text: "check: passed" }, [{ id: "s1", type: "recap" }, { id: "s2", type: "close" }]);

  assert.deepEqual(outcome, { lines: ["check: passed"], failed: false });
});
