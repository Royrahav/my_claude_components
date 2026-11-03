// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { PROCESS_TERMS, PROCESS_TERMS_UPPERCASE, houseStyleWarnings, isThreeD, missingQuestionWarnings } from "../lib/house-style.mjs";

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

// 3D scenes ----------------------------------------------------------------------------------------------

const too3d = (count, counted) => `house style: ${count} of ${counted} scenes are 3D (over a third, close and summary aside); keep 3D for spatial or flow content`;

// A video whose 3D scenes include one designed for the topic (a project template), so only the share rule can fire.
const withDesigned3d = (scenes) => ({ sources: scenes.map((scene, i) => (i === 0 || scene.type === "iso-stack" ? "project" : "builtin")) });
const quietBuild = (scenes) => ({ ...variedBuild(scenes), ...withDesigned3d(scenes) });
const quietWarnings = (scenes, built = {}) => houseStyleWarnings(scenes, { ...quietBuild(scenes), ...built });

test("houseStyleWarnings_3dScenesOverAThirdOfTheCountedScenes_warns", () => {
  const scenes = scenesOf("title", "iso-stack", "split", "iso-map", "code", "recap", "close");

  assert.deepEqual(quietWarnings(scenes), [too3d(2, 5)]);
});

test("houseStyleWarnings_3dScenesAtAThird_hasNoWarning", () => {
  const scenes = scenesOf("title", "iso-stack", "split", "iso-map", "code", "bullets", "recap", "close");

  assert.deepEqual(quietWarnings(scenes), []);
});

test("houseStyleWarnings_anIsoMapAsTheSummary_isNotCountedAs3d", () => {
  const scenes = scenesOf("title", "iso-stack", "split", "code", { type: "iso-map", summary: true }, "close");

  assert.deepEqual(quietWarnings(scenes), []);
});

// The kit marks a scene 3D when it builds a stage, whatever the template is called.
test("houseStyleWarnings_aTemplateThatBuiltAStage_countsAs3dWhateverItsType", () => {
  const scenes = scenesOf("title", "orbit-hub", "split", "scope-stack", "code", "recap", "close");
  const sources = scenes.map((_, i) => (i <= 1 ? "project" : "builtin"));

  assert.deepEqual(quietWarnings(scenes, { sources, threeD: [false, true, false, true, false, false, false] }), [too3d(2, 5)]);
});

test("houseStyleWarnings_anIsoNamedSceneThatBuiltNoStage_isNotCountedAs3d", () => {
  const scenes = scenesOf("title", "iso-lookalike", "split", "code", "bullets", "recap", "close");

  assert.deepEqual(quietWarnings(scenes, { threeD: scenes.map(() => false) }), []);
});

test("isThreeD_recordedFlag_winsOverTheTypeName_andTheNameIsTheFallback", () => {
  assert.deepEqual([isThreeD({ type: "iso-map" }, 0, [false]), isThreeD({ type: "orbit-hub" }, 0, [true]), isThreeD({ type: "iso-map" }, 0), isThreeD({ type: "split" }, 0, [])], [false, true, true, false]);
});

const designFor = "design one for this topic (a 3D signature scene)";
const everyBuiltIn = (types) => `house style: every 3D scene is a built-in iso template or an unchanged worked example (${types}); ${designFor}`;
const builtInTwice = (type, count) => `house style: the built-in 3D template ${type} is used ${count} times; use each at most once and give other 3D scenes their own form or camera language`;

test("houseStyleWarnings_everyThreeDSceneIsABuiltIn_warnsToDesignOne", () => {
  const scenes = scenesOf("title", "iso-journey", "split", "code", { type: "iso-map", summary: true }, "close");

  assert.deepEqual(warningsFor(scenes), [everyBuiltIn("iso-journey, iso-map")]);
});

test("houseStyleWarnings_aProjectTemplateAmongTheThreeDScenes_hasNoDesignWarning", () => {
  const scenes = scenesOf("title", "iso-journey", "split", "code", "bullets", "recap", "close");

  assert.deepEqual(houseStyleWarnings(scenes, { ...variedBuild(scenes), sources: scenes.map((_, i) => (i === 0 || i === 1 ? "project" : "builtin")) }), []);
});

test("houseStyleWarnings_anOverrideOfABuiltInThreeDTemplate_isStillABuiltIn", () => {
  const scenes = scenesOf("title", "iso-journey", "split", "code", "bullets", "recap", "close");

  assert.deepEqual(houseStyleWarnings(scenes, { ...variedBuild(scenes), sources: scenes.map((_, i) => (i === 0 ? "project" : i === 1 ? "override" : "builtin")) }), [everyBuiltIn("iso-journey")]);
});

test("houseStyleWarnings_noThreeDScenes_hasNoDesignWarning", () => {
  assert.deepEqual(warningsFor(scenesOf("title", "split", "code", "bullets", "recap", "close")), []);
});

test("houseStyleWarnings_theSameBuiltInThreeDTemplateTwice_warnsWithTheCount", () => {
  const scenes = scenesOf("title", "iso-journey", "split", "code", "bullets", "iso-journey", "recap", "close");
  const warnings = quietWarnings(scenes);

  assert.ok(warnings.includes(builtInTwice("iso-journey", 2)), warnings.join("|"));
});

test("houseStyleWarnings_aBuiltInAndAProjectTemplateOfDifferentTypes_areNotRepeats", () => {
  const scenes = scenesOf("title", "iso-journey", "split", "code", "iso-stack", "bullets", "recap", "close");

  assert.ok(!quietWarnings(scenes).some((warning) => warning.includes("used 2 times")));
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

// chapters stay in one run ------------------------------------------------------------------------

const chapterWarning = (label, id) => `house style: chapter "${label}" reappears at ${id} after another chapter; keep each chapter in one run`;
const chapterWarnings = (scenes) => warningsFor(scenes).filter((warning) => warning.includes("reappears"));

test("houseStyleWarnings_chapterReappearsAfterAnotherOne_warnsAtTheReturn", () => {
  const scenes = scenesOf({ type: "title" }, { type: "split", chapter: "Problem" }, { type: "steps", chapter: "Design" }, { type: "cards", chapter: "Problem" }, "recap", "close");

  assert.deepEqual(chapterWarnings(scenes), [chapterWarning("Problem", "s04")]);
});

test("houseStyleWarnings_sceneRunSharingAChapter_hasNoChapterWarning", () => {
  const scenes = scenesOf({ type: "title" }, { type: "split", chapter: "Problem" }, { type: "steps", chapter: "Problem" }, { type: "cards", chapter: "Design" }, "recap", "close");

  assert.deepEqual(chapterWarnings(scenes), []);
});

test("houseStyleWarnings_unlabelledSceneInsideAChapter_doesNotSplitIt", () => {
  const scenes = scenesOf({ type: "title" }, { type: "split", chapter: "Problem" }, { type: "beat" }, { type: "steps", chapter: "Problem" }, "recap", "close");

  assert.deepEqual(chapterWarnings(scenes), []);
});

test("houseStyleWarnings_noChapterLabels_hasNoChapterWarning", () => {
  assert.deepEqual(chapterWarnings(scenesOf("title", "split", "steps", "recap", "close")), []);
});

// development-process terms --------------------------------------------------------------------------

const processWarning = (id, term) => `house style: ${id} mentions "${term}" (development process); a demo shows the feature, not how it was built`;
const processWarnings = (scenes, allowTerms) => warningsFor(scenes, { allowTerms }).filter((warning) => warning.includes("development process"));
const sceneSaying = (say, data) => withIds([{ type: "title" }, { type: "split", say, data }, "recap", "close"].map((s) => (s === "recap" ? recapScene() : typeof s === "string" ? { type: s } : s)));

test("houseStyleWarnings_narrationMentionsUnitTests_warnsWithTheSceneAndTerm", () => {
  assert.deepEqual(processWarnings(sceneSaying("It passed all 40 unit tests before release.")), [processWarning("s02", "unit tests")]);
});

test("houseStyleWarnings_processTermInNestedOnScreenData_warns", () => {
  const data = { cards: [{ title: "Safe", lines: ["Reviewed in a Code Review"] }] };

  assert.deepEqual(processWarnings(sceneSaying("Printing is safe.", data)), [processWarning("s02", "code review")]);
});

test("houseStyleWarnings_sameTermRepeatedInAScene_warnsOnce", () => {
  assert.equal(processWarnings(sceneSaying("QA signed off. Then QA signed off again.")).length, 1);
});

test("houseStyleWarnings_termInsideALongerWord_isNotAHit", () => {
  assert.deepEqual(processWarnings(sceneSaying("QATAR and a Cisco CIty and a quality-assured step.")), []);
});

test("houseStyleWarnings_clAndPrNumbers_warn", () => {
  assert.deepEqual(processWarnings(sceneSaying("Shipped in CL 1021434, see PR #52.")), [processWarning("s02", "cl 1021434"), processWarning("s02", "pr #52")]);
});

test("houseStyleWarnings_productWordsPipelineCommitMergeAndRequestScope_areNotHits", () => {
  const say = "The pipeline transaction can commit, the registrar can merge two patients, and the request scope ends.";

  assert.deepEqual(processWarnings(sceneSaying(say)), []);
});

test("houseStyleWarnings_ciPipelineAndCommitToTheRepo_warn", () => {
  assert.deepEqual(processWarnings(sceneSaying("The CI pipeline ran, then we commit to the repo.")), [processWarning("s02", "ci pipeline"), processWarning("s02", "commit to the repo")]);
});

test("houseStyleWarnings_allowedTerm_liftsEveryHitContainingIt", () => {
  const scenes = sceneSaying("Add a CI run and a CI pipeline, but not a Jira board.");

  assert.deepEqual(processWarnings(scenes, ["CI"]), [processWarning("s02", "jira")]);
});

test("houseStyleWarnings_allowedMultiWordTerm_liftsOnlyThatPhrase", () => {
  const scenes = sceneSaying("A CI pipeline ran, then a CI run.");

  assert.deepEqual(processWarnings(scenes, ["CI Pipeline"]), [processWarning("s02", "ci run")]);
});

test("houseStyleWarnings_allowTermsNotAnArray_isTreatedAsAListNotACrash", () => {
  const scenes = sceneSaying("A CI run and a Jira board.");

  assert.deepEqual([processWarnings(scenes, "CI"), processWarnings(scenes, null), processWarnings(scenes, 7).length], [[processWarning("s02", "jira")], processWarnings(scenes), 2]);
});

test("houseStyleWarnings_questionField_isNotScanned", () => {
  const scene = { type: "split", say: "Printing works.", question: "Was this unit tested?" };

  assert.deepEqual(processWarnings(withIds([{ type: "title" }, scene, recapScene(), { type: "close" }])), []);
});

test("houseStyleWarnings_chapterTag_isScanned", () => {
  const scene = { type: "split", say: "Printing works.", chapter: "QA and tests" };

  assert.deepEqual(processWarnings(withIds([{ type: "title" }, scene, recapScene(), { type: "close" }])), [processWarning("s02", "qa")]);
});

test("houseStyleWarnings_ticketKeysAndIma_warn", () => {
  const warned = processWarnings(sceneSaying("See LAB-16894 and IMA#12345.", { ref: "Ref: WH-77" }));

  assert.deepEqual(warned, [processWarning("s02", "lab-16894"), processWarning("s02", "ima#12345"), processWarning("s02", "wh-77")]);
});

test("houseStyleWarnings_inflectedProcessWords_warn", () => {
  const say = "It was code reviewed, then code-review again, unit tested, with test coverage and a regression suite on Cypress.";

  assert.deepEqual(
    processWarnings(sceneSaying(say)).map((warning) => warning.match(/mentions "([^"]+)"/)[1]),
    ["code reviewed", "code-review", "unit tested", "test coverage", "regression suite", "cypress"],
  );
});

test("houseStyleWarnings_labosProductWords_areNotHits", () => {
  const say = "Specimens sit on shelves and are shelved by rack. Cl 102 is chloride and PR 80 is progesterone receptor. " +
    "The 95% CI is shown. The test count on an order is four. A support ticket opens in CRM. The qa flag is lowercase.";

  assert.deepEqual(processWarnings(sceneSaying(say)), []);
});

test("houseStyleWarnings_standardCodesWithDigits_areNotTicketKeys", () => {
  assert.deepEqual(processWarnings(sceneSaying("COVID-19 tests, HL7, ISO-15189, SHA-256 and UTF-16.")), []);
});

test("houseStyleWarnings_shelvedChangelist_warns", () => {
  assert.deepEqual(processWarnings(sceneSaying("We shelved the CL last week.")), [processWarning("s02", "shelved the cl")]);
});

test("processTerms_everyEntry_isAValidRegexSource", () => {
  for (const term of [...PROCESS_TERMS, ...PROCESS_TERMS_UPPERCASE]) assert.doesNotThrow(() => new RegExp(term), term);
});

// the question ladder ----------------------------------------------------------------------------------

test("missingQuestionWarnings_sceneWithoutQuestion_isReported", () => {
  const scenes = withIds([{ type: "title" }, { type: "split", question: "Why does printing fail?" }, { type: "steps" }, { type: "beat" }, { type: "close" }]);

  assert.deepEqual(missingQuestionWarnings(scenes), ["plan: s03 has no question (the viewer question this scene answers)"]);
});

test("missingQuestionWarnings_blankQuestion_isReported", () => {
  assert.equal(missingQuestionWarnings(withIds([{ type: "split", question: "  " }])).length, 1);
});

test("missingQuestionWarnings_titleBeatAndClose_areExempt", () => {
  assert.deepEqual(missingQuestionWarnings(withIds([{ type: "title" }, { type: "beat" }, { type: "close" }])), []);
});

// worked examples copied unchanged -------------------------------------------------------------------------

const copyOf = (example) => ({ fingerprint: "abc12345", example });
const exampleCopyWarning = (id, type, example) => `house style: ${id} uses ${type}, the worked example ${example} unchanged; design your own form, objects and camera for this topic`;

test("houseStyleWarnings_projectTemplateEqualToAWorkedExample_namesTheScene", () => {
  const scenes = scenesOf("title", "hub-orbit", "split", "code", "bullets", "recap", "close");
  const sources = scenes.map((_, i) => (i === 1 ? "project" : "builtin"));
  const templates = scenes.map((_, i) => (i === 1 ? copyOf("signature-iso-orbit.mjs") : null));

  const warnings = houseStyleWarnings(scenes, { ...variedBuild(scenes), sources, templates, threeD: scenes.map((_, i) => i === 1) });

  assert.ok(warnings.includes(exampleCopyWarning("s02", "hub-orbit", "signature-iso-orbit.mjs")), warnings.join("|"));
});

test("houseStyleWarnings_anUnchangedExampleIsNotASceneDesignedForTheTopic", () => {
  const scenes = scenesOf("title", "hub-orbit", "split", "code", "bullets", "recap", "close");
  const sources = scenes.map((_, i) => (i === 1 ? "project" : "builtin"));
  const templates = scenes.map((_, i) => (i === 1 ? copyOf("signature-iso-orbit.mjs") : null));

  const warnings = houseStyleWarnings(scenes, { ...variedBuild(scenes), sources, templates, threeD: scenes.map((_, i) => i === 1) });

  assert.ok(warnings.includes(everyBuiltIn("hub-orbit")), warnings.join("|"));
});

test("houseStyleWarnings_projectTemplateThatDiffersFromEveryExample_isQuiet", () => {
  const scenes = scenesOf("title", "hub-orbit", "split", "code", "bullets", "recap", "close");
  const sources = scenes.map((_, i) => (i === 1 ? "project" : "builtin"));
  const templates = scenes.map((_, i) => (i === 1 ? copyOf(null) : null));

  assert.deepEqual(houseStyleWarnings(scenes, { ...variedBuild(scenes), sources, templates, threeD: scenes.map((_, i) => i === 1) }), []);
});

test("houseStyleWarnings_sameUnchangedExampleOnTwoScenes_isReportedOnce", () => {
  const scenes = scenesOf("title", "hub-orbit", "split", "hub-orbit", "code", "bullets", "recap", "close");
  const sources = scenes.map((scene) => (scene.type === "hub-orbit" ? "project" : "builtin"));
  const templates = scenes.map((scene) => (scene.type === "hub-orbit" ? copyOf("signature-iso-orbit.mjs") : null));

  const warnings = houseStyleWarnings(scenes, { ...variedBuild(scenes), sources, templates });

  assert.equal(warnings.filter((warning) => warning.includes("worked example")).length, 1);
});
