// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { houseStyleWarnings } from "../lib/house-style.mjs";

const ENDING_WARNING = "house style: end with a summary scene (a recap, or any scene with summary: true), then close";
const RECAP_WARNING = "house style: recap needs 2-4 items, each with a title and an example";
const SIGNATURE_WARNING = "house style: no signature scene (a project template designed for this demo)";
const backToBack = (first, second, type, variant = "default") =>
  `house style: ${first} and ${second} both use ${type} (${variant} variant) back to back; vary the template or variant`;
const overused = (type, count, counted) =>
  `house style: ${type} is used in ${count} of ${counted} scenes (over 40%, close and summary aside); vary the templates`;
const sameEntrance = (transition) =>
  `house style: every scene enters with ${transition} (the final fade aside); vary direction.transitions or a scene's transition`;

const item = (n = 1) => ({ title: `Takeaway ${n}`, example: `Example ${n}` });
const itemsOf = (count) => Array.from({ length: count }, (_, i) => item(i + 1));
const recapScene = (items = itemsOf(3)) => ({ type: "recap", data: { items } });
const withIds = (scenes) => scenes.map((scene, i) => ({ id: `s${String(i + 1).padStart(2, "0")}`, ...scene }));
// A "recap" in the list becomes a complete recap; any other entry is a type name or a whole scene.
const scenesOf = (...entries) => withIds(entries.map((entry) => (entry === "recap" ? recapScene() : typeof entry === "string" ? { type: entry } : entry)));
const closingWith = (recap) => withIds([{ type: "title" }, recap, { type: "close" }]);

// The video as built, shaped so only the rule under test can fire: the first scene is a project template
// (the signature) and the entrances alternate. `built` replaces either part.
const variedBuild = (scenes) => ({
  sources: scenes.map((_, i) => (i === 0 ? "project" : "builtin")),
  transitions: scenes.map((_, i) => (i === 0 ? null : i % 2 ? "push" : "fade")),
});
const warningsFor = (scenes, built = {}) => houseStyleWarnings(scenes, { ...variedBuild(scenes), ...built });
const entrances = (...names) => [null, ...names];

// the ending ----------------------------------------------------------------------------------------

test("houseStyleWarnings_endsWithRecapThenClose_hasNoWarning", () => {
  assert.deepEqual(warningsFor(scenesOf("title", "split", "recap", "close")), []);
});

test("houseStyleWarnings_onlyRecapThenClose_hasNoWarning", () => {
  assert.deepEqual(warningsFor(scenesOf("recap", "close")), []);
});

for (const type of ["split", "bullets", "cards", "statement", "callback"]) {
  test(`houseStyleWarnings_${type}MarkedAsTheSummaryThenClose_hasNoWarning`, () => {
    assert.deepEqual(warningsFor(scenesOf("title", "code", { type, summary: true }, "close")), []);
  });
}

test("houseStyleWarnings_summaryFlagSetToFalse_doesNotCountAsTheSummary", () => {
  assert.deepEqual(warningsFor(scenesOf("title", "code", { type: "split", summary: false }, "close")), [ENDING_WARNING]);
});

test("houseStyleWarnings_summaryFlagAsAString_doesNotCountAsTheSummary", () => {
  assert.deepEqual(warningsFor(scenesOf("title", "code", { type: "split", summary: "true" }, "close")), [ENDING_WARNING]);
});

test("houseStyleWarnings_coldOpenBeforeTheTitle_needsNoTitleFirst", () => {
  assert.deepEqual(warningsFor(scenesOf("split", "title", "steps", "recap", "close")), []);
});

test("houseStyleWarnings_noTitleSceneAtAll_hasNoWarning", () => {
  assert.deepEqual(warningsFor(scenesOf("statement", "pipeline", "recap", "close")), []);
});

test("houseStyleWarnings_closeWithoutSummary_warns", () => {
  assert.deepEqual(warningsFor(scenesOf("title", "split", "close")), [ENDING_WARNING]);
});

test("houseStyleWarnings_summaryNotRightBeforeClose_warns", () => {
  assert.deepEqual(warningsFor(scenesOf("title", "recap", "statement", "close")), [ENDING_WARNING]);
});

test("houseStyleWarnings_flaggedSummaryNotRightBeforeClose_warns", () => {
  assert.deepEqual(warningsFor(scenesOf("title", { type: "split", summary: true }, "statement", "close")), [ENDING_WARNING]);
});

test("houseStyleWarnings_recapAfterClose_warns", () => {
  assert.deepEqual(warningsFor(scenesOf("title", "close", "recap")), [ENDING_WARNING]);
});

test("houseStyleWarnings_recapAsTheLastScene_warns", () => {
  assert.deepEqual(warningsFor(scenesOf("title", "recap")), [ENDING_WARNING]);
});

test("houseStyleWarnings_closeOnly_warns", () => {
  assert.deepEqual(warningsFor(scenesOf("close")), [ENDING_WARNING]);
});

test("houseStyleWarnings_noScenes_warnsAboutTheEndingAndTheMissingSignature", () => {
  assert.deepEqual(warningsFor([]), [ENDING_WARNING, SIGNATURE_WARNING]);
});

test("houseStyleWarnings_anEarlierRecap_doesNotCountWhenTheEndingIsWrong", () => {
  assert.deepEqual(warningsFor(scenesOf("recap", "split", "close")), [ENDING_WARNING]);
});

// the recap's content -------------------------------------------------------------------------------

for (const count of [2, 3, 4]) {
  test(`houseStyleWarnings_recapWith${count}CompleteItems_hasNoWarning`, () => {
    assert.deepEqual(warningsFor(closingWith(recapScene(itemsOf(count)))), []);
  });
}

for (const count of [0, 1, 5, 6]) {
  test(`houseStyleWarnings_recapWith${count}Items_warns`, () => {
    assert.deepEqual(warningsFor(closingWith(recapScene(itemsOf(count)))), [RECAP_WARNING]);
  });
}

test("houseStyleWarnings_recapWithoutData_warns", () => {
  assert.deepEqual(warningsFor(closingWith({ type: "recap" })), [RECAP_WARNING]);
});

test("houseStyleWarnings_recapDataWithoutItems_warns", () => {
  assert.deepEqual(warningsFor(closingWith({ type: "recap", data: { title: "T" } })), [RECAP_WARNING]);
});

test("houseStyleWarnings_recapWhoseItemsIsNotAList_warns", () => {
  assert.deepEqual(warningsFor(closingWith({ type: "recap", data: { items: "nope" } })), [RECAP_WARNING]);
});

for (const [label, broken] of [
  ["MissingTitle", { example: "E" }],
  ["EmptyTitle", { title: "", example: "E" }],
  ["BlankTitle", { title: "   ", example: "E" }],
  ["NullTitle", { title: null, example: "E" }],
  ["MissingExample", { title: "T" }],
  ["EmptyExample", { title: "T", example: "" }],
  ["BlankExample", { title: "T", example: " \n " }],
  ["NullExample", { title: "T", example: null }],
]) {
  test(`houseStyleWarnings_recapItemWith${label}_warns`, () => {
    assert.deepEqual(warningsFor(closingWith(recapScene([item(1), broken, item(3)]))), [RECAP_WARNING]);
  });
}

test("houseStyleWarnings_recapItemThatIsNull_warns", () => {
  assert.deepEqual(warningsFor(closingWith(recapScene([item(1), null, item(3)]))), [RECAP_WARNING]);
});

test("houseStyleWarnings_optionalItemFields_doNotMatter", () => {
  const rich = { title: "T", example: "E", icon: "gear", who: "Support", at: "one", example_at: "two" };

  assert.deepEqual(warningsFor(closingWith(recapScene([rich, rich]))), []);
});

test("houseStyleWarnings_incompleteRecapInTheWrongPlace_warnsAboutBoth", () => {
  const scenes = withIds([{ type: "title" }, recapScene([item(1)]), { type: "statement" }, { type: "close" }]);

  assert.deepEqual(warningsFor(scenes), [ENDING_WARNING, RECAP_WARNING]);
});

test("houseStyleWarnings_noRecapAtAll_doesNotAlsoWarnAboutItsContent", () => {
  assert.deepEqual(warningsFor(scenesOf("title", "close")), [ENDING_WARNING]);
});

test("houseStyleWarnings_twoRecapsWhereOneIsIncomplete_warnsOnlyOnce", () => {
  const scenes = withIds([recapScene(), { type: "split" }, recapScene([item(1)]), { type: "close" }]);

  assert.deepEqual(warningsFor(scenes), [RECAP_WARNING]);
});

test("houseStyleWarnings_summaryInAnotherTemplate_isNotHeldToTheRecapItemRule", () => {
  const checklist = { type: "bullets", summary: true, data: { items: [{ title: "Only a title" }] } };

  assert.deepEqual(warningsFor(scenesOf("title", "code", checklist, "close")), []);
});

// the signature scene ------------------------------------------------------------------------------

test("houseStyleWarnings_onlyBuiltInTemplates_warnsThatThereIsNoSignatureScene", () => {
  const scenes = scenesOf("title", "split", "recap", "close");

  assert.deepEqual(warningsFor(scenes, { sources: scenes.map(() => "builtin") }), [SIGNATURE_WARNING]);
});

for (const [label, source] of [["ANewProjectTemplate", "project"], ["AHandWrittenCustomScene", "custom"]]) {
  test(`houseStyleWarnings_${label}AnywhereInTheVideo_countsAsTheSignature`, () => {
    const scenes = scenesOf("title", "split", "code", "recap", "close");

    const sources = ["builtin", "builtin", source, "builtin", "builtin"];

    assert.deepEqual(warningsFor(scenes, { sources }), []);
  });
}

test("houseStyleWarnings_onlyAProjectCopyOfABuiltIn_stillWarnsThatThereIsNoSignatureScene", () => {
  const scenes = scenesOf("title", "split", "code", "recap", "close");

  const sources = ["builtin", "override", "builtin", "builtin", "builtin"];

  assert.deepEqual(warningsFor(scenes, { sources }), [SIGNATURE_WARNING]);
});

test("houseStyleWarnings_aNewProjectTemplateBesideAnOverride_countsAsTheSignature", () => {
  const scenes = scenesOf("title", "split", "code", "recap", "close");

  const sources = ["builtin", "override", "project", "builtin", "builtin"];

  assert.deepEqual(warningsFor(scenes, { sources }), []);
});

// back-to-back repeats ------------------------------------------------------------------------------

// A title, the given scenes from s02 on, then enough other templates that nothing counts as overused.
const longVideo = (...middle) => scenesOf("title", ...middle, "cards", "bullets", "statement", "recap", "close");

test("houseStyleWarnings_sameTemplateTwiceInARow_warnsNamingBothScenes", () => {
  assert.deepEqual(warningsFor(longVideo("split", "split")), [backToBack("s02", "s03", "split")]);
});

test("houseStyleWarnings_missingVariant_countsAsTheDefaultVariant", () => {
  const scenes = longVideo("split", { type: "split", variant: "default" });

  assert.deepEqual(warningsFor(scenes), [backToBack("s02", "s03", "split")]);
});

test("houseStyleWarnings_sameTemplateAndNamedVariantInARow_warnsWithTheVariant", () => {
  const stacked = { type: "split", variant: "stacked" };

  assert.deepEqual(warningsFor(longVideo(stacked, stacked)), [backToBack("s02", "s03", "split", "stacked")]);
});

test("houseStyleWarnings_sameTemplateInAnotherVariant_hasNoWarning", () => {
  assert.deepEqual(warningsFor(longVideo("split", { type: "split", variant: "stacked" })), []);
});

test("houseStyleWarnings_sameTemplateWithAnotherSceneBetween_hasNoWarning", () => {
  assert.deepEqual(warningsFor(longVideo("split", "code", "split")), []);
});

test("houseStyleWarnings_twoHandWrittenCustomScenesInARow_hasNoWarning", () => {
  assert.deepEqual(warningsFor(scenesOf("title", "custom", "custom", "recap", "close")), []);
});

test("houseStyleWarnings_aRunOfThree_warnsForEachAdjacentPair", () => {
  const scenes = scenesOf("title", "cards", "code", "split", "split", "split", "bullets", "statement", "metrics", "recap", "close");

  assert.deepEqual(warningsFor(scenes), [backToBack("s04", "s05", "split"), backToBack("s05", "s06", "split")]);
});

// one template everywhere ---------------------------------------------------------------------------

test("houseStyleWarnings_templateInMoreThan40PercentOfScenes_warns", () => {
  const scenes = scenesOf("title", "bullets", "split", "bullets", "code", "bullets", "recap", "close");

  assert.deepEqual(warningsFor(scenes), [overused("bullets", 3, 6)]);
});

test("houseStyleWarnings_templateInExactly40PercentOfScenes_hasNoWarning", () => {
  assert.deepEqual(warningsFor(scenesOf("title", "bullets", "split", "bullets", "code", "recap", "close")), []);
});

test("houseStyleWarnings_videoUnderFiveScenes_isNotCheckedForOveruse", () => {
  assert.deepEqual(warningsFor(scenesOf("bullets", "title", "bullets", "close")), [ENDING_WARNING]);
});

test("houseStyleWarnings_summaryInAnOverusedTemplate_isLeftOutOfTheCount", () => {
  const scenes = scenesOf("title", "bullets", "split", "bullets", "code", { type: "bullets", summary: true }, "close");

  assert.deepEqual(warningsFor(scenes), []);
});

test("houseStyleWarnings_templateUsedOnce_isNeverOverusedEvenInAFewCountedScenes", () => {
  const scenes = scenesOf("title", "recap", "split", "recap", "close");

  assert.deepEqual(warningsFor(scenes), []);
});

test("houseStyleWarnings_manyHandWrittenCustomScenes_areNotOneOverusedTemplate", () => {
  assert.deepEqual(warningsFor(scenesOf("title", "custom", "split", "custom", "custom", "recap", "close")), []);
});

// one transition everywhere -------------------------------------------------------------------------

test("houseStyleWarnings_sixScenesEnteringTheSameWayBeforeTheFinalFade_warns", () => {
  const scenes = scenesOf("title", "split", "cards", "code", "recap", "close");

  const transitions = entrances("push", "push", "push", "push", "fade");

  assert.deepEqual(warningsFor(scenes, { transitions }), [sameEntrance("push")]);
});

test("houseStyleWarnings_finalSceneEnteringTheSameWayToo_stillWarnsOnce", () => {
  const scenes = scenesOf("title", "split", "cards", "code", "recap", "close");

  const transitions = entrances("fade", "fade", "fade", "fade", "fade");

  assert.deepEqual(warningsFor(scenes, { transitions }), [sameEntrance("fade")]);
});

test("houseStyleWarnings_fiveScenesEnteringTheSameWay_isNotChecked", () => {
  const scenes = scenesOf("title", "split", "code", "recap", "close");

  assert.deepEqual(warningsFor(scenes, { transitions: entrances("push", "push", "push", "fade") }), []);
});

test("houseStyleWarnings_oneDifferentEntranceBeforeTheEnd_hasNoWarning", () => {
  const scenes = scenesOf("title", "split", "cards", "code", "recap", "close");

  const transitions = entrances("push", "push", "zoom", "push", "fade");

  assert.deepEqual(warningsFor(scenes, { transitions }), []);
});

// all rules together --------------------------------------------------------------------------------

test("houseStyleWarnings_aVideoBreakingEveryRule_listsTheWarningsInRuleOrder", () => {
  const scenes = scenesOf("title", "bullets", "bullets", "split", "bullets", recapScene([item(1)]), "statement");

  const built = { sources: scenes.map(() => "builtin"), transitions: entrances("cut", "cut", "cut", "cut", "cut", "fade") };

  assert.deepEqual(warningsFor(scenes, built), [ENDING_WARNING, RECAP_WARNING, SIGNATURE_WARNING, backToBack("s02", "s03", "bullets"), overused("bullets", 3, 6), sameEntrance("cut")]);
});
