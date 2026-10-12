// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// Smoke tests for the endings, beat, summary label, ending check, history and Cursor helpers: each new
// piece works once end to end. The Unit Test Agent's suite covers the edge cases.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createScene, wrap } from "../lib/kit.mjs";
import { resolveDirection } from "../lib/direction.mjs";
import { endingProblem } from "../lib/check.mjs";
import { cursorAgentText, hostsFor } from "../lib/agents.mjs";
import { historyWarnings, otherVideos, readHistory, recordOf, recordRender } from "../lib/history.mjs";
import { houseStyleWarnings } from "../lib/house-style.mjs";
import { deliveryFor } from "../lib/voice.mjs";
import beat, { variants as beatVariants } from "../lib/scenes/beat.mjs";
import close, { variants as closeVariants } from "../lib/scenes/close.mjs";
import { loadTheme } from "../lib/theme.mjs";
import { buildScene, sceneTimeline } from "./helpers.mjs";

const SCENES_DOC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "references", "scenes.md");
const REAL_THEME = loadTheme(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "themes", "labos", "theme.json"));
const wordsOf = (say) => say.split(/\s+/).map((text, i) => ({ text, start: 0.6 + i * 0.4, end: 0.9 + i * 0.4 }));

// The one-line JSON scenes documented under a `### <type>:` heading of scenes.md.
function documentedScenes(type) {
  const section = readFileSync(SCENES_DOC, "utf8").split(`### ${type}:`)[1].split(/\r?\n### /)[0];
  return [...section.matchAll(/^\{ "type": .*\}$/gm)].map((m) => JSON.parse(m[0]));
}

const templateOf = (module, scene) => (scene.variant ? module.variants[scene.variant] : module.default);
const timelineOf = (scene) => sceneTimeline({ duration: scene.duration ?? 12, words: scene.say ? wordsOf(scene.say) : [] });

for (const [type, module] of [["close", { default: close, variants: closeVariants }], ["beat", { default: beat, variants: beatVariants }]]) {
  test(`${type}_everyDocumentedExample_buildsWithEveryCueResolved`, () => {
    const scenes = documentedScenes(type);

    assert.ok(scenes.length >= 1);
    for (const scene of scenes) {
      const { warnings, result } = buildScene(templateOf(module, scene), scene.data, timelineOf(scene));
      assert.deepEqual(warnings, [], `${scene.type}/${scene.variant}`);
      assert.equal(result.chrome, false);
    }
  });
}

test("closeVariants_missingRequiredField_throwsNamingIt", () => {
  for (const [variant, field] of [["punchline", "line"], ["cta", "action"], ["callback", "hook"]])
    assert.throws(() => buildScene(closeVariants[variant], {}, timelineOf({})), new RegExp(`close ${variant} needs data.${field}`));
});

test("closeCta_fourSteps_throws", () => {
  assert.throws(() => buildScene(closeVariants.cta, { action: "Go", steps: ["a", "b", "c", "d"] }), /data.steps/);
});

test("closeDefault_underlineFalse_dropsTheSweep", () => {
  const { html, k } = buildScene(close, { title: "T", tagline: ["One."], underline: false });

  assert.equal(html.includes(`id="s1-ul"`), false);
  assert.equal(k.js.some((line) => line.includes("#s1-ul")), false);
});

test("beat_moreThanFourWords_throwsNamingTheField", () => {
  assert.throws(() => buildScene(beat, { text: "one two three four five" }), /beat data.text must be at most 4 words/);
});

test("beatInvert_fillsTheFrameWithTheAccent", () => {
  const { html } = buildScene(beatVariants.invert, { text: "Done" });

  assert.ok(html.includes(`id="s1-fill"`));
});

// summary label --------------------------------------------------------------------------------------------

function wrapped(scene, { chrome = true, direction = "none" } = {}) {
  const dir = resolveDirection({ chrome: direction });
  const k = createScene({ id: "s1", theme: REAL_THEME, fontsCss: "", brief: {}, scene, duration: 10, direction: dir });
  return wrap(k, { fontsCss: "", chrome, eyebrow: "PRODUCT" });
}

test("wrap_summarySceneUnderChromeNone_stillShowsTheSummaryLabel", () => {
  assert.match(wrapped({ type: "recap", chapter: "Recap" }), />Summary</);
});

test("wrap_summaryFlagOnAChromeFalseTemplate_showsTheLabelAndHonorsSummaryLabel", () => {
  assert.match(wrapped({ type: "statement", summary: true, summary_label: "In short" }, { chrome: false }), />In short</);
});

test("wrap_nonSummaryScene_hasNoSummaryLabel", () => {
  assert.doesNotMatch(wrapped({ type: "split", chapter: "Problem" }, { direction: "full" }), /Summary/);
});

// ending check ---------------------------------------------------------------------------------------------

const scenesOf = (...types) => types.map((type, i) => ({ id: `s${i + 1}`, ...(typeof type === "string" ? { type } : type) }));

test("endingProblem_summaryThenClose_isNull", () => {
  assert.equal(endingProblem(scenesOf("title", "recap", "close")), null);
});

test("endingProblem_noSummary_namesTheRule", () => {
  assert.match(endingProblem(scenesOf("title", "split", "close")), /^ending rule: the second-to-last scene \(s2 split\) must be a summary/);
});

test("endingProblem_lastIsNotAClose_namesTheRule", () => {
  assert.match(endingProblem(scenesOf("title", "recap", "split")), /the last scene \(s3 split\) must be a close/);
});

// house style ----------------------------------------------------------------------------------------------

const quietSources = (scenes) => scenes.map(() => "builtin");

test("houseStyleWarnings_beatsAreNotCountedAsTemplateUses", () => {
  const scenes = scenesOf("title", "beat", "split", "beat", "steps", "beat", "recap", "close");

  const warnings = houseStyleWarnings(scenes, { sources: quietSources(scenes), transitions: scenes.map(() => null) });

  assert.equal(warnings.some((w) => w.includes("beat is used")), false);
});

test("houseStyleWarnings_evenDurations_warnsOfMonotoneRhythm", () => {
  const scenes = scenesOf("title", "split", "steps", "cards", "metrics", "recap", "close");

  const warnings = houseStyleWarnings(scenes, { sources: quietSources(scenes), transitions: scenes.map(() => null), durations: [8, 14, 15, 14, 15, 14, 6] });

  assert.ok(warnings.includes("house style: monotone rhythm (every scene 14-15 s); mix in a short beat or a longer showcase"));
});

test("houseStyleWarnings_mixedDurations_noRhythmWarning", () => {
  const scenes = scenesOf("title", "split", "beat", "cards", "metrics", "recap", "close");

  const warnings = houseStyleWarnings(scenes, { sources: quietSources(scenes), transitions: scenes.map(() => null), durations: [8, 14, 1.6, 20, 15, 14, 6] });

  assert.equal(warnings.some((w) => w.includes("monotone")), false);
});

// voice delivery -------------------------------------------------------------------------------------------

test("deliveryFor_eachTone_followsTheTable", () => {
  assert.deepEqual([undefined, "playful", "light", "balanced", "serious", "critical"].map((tone) => Object.values(deliveryFor(tone))), [[0.5, 0], [0.35, 0.45], [0.45, 0.25], [0.5, 0], [0.6, 0], [0.7, 0]]);
});

test("deliveryFor_unknownTone_throwsNamingTheField", () => {
  assert.throws(() => deliveryFor("loud"), /direction.tone must be one of/);
});

// history --------------------------------------------------------------------------------------------------

const briefOf = (name, direction = {}) => ({ name, direction });
const recordFor = (root, name, scenes, direction = {}, date = "2026-10-11") =>
  recordOf({ root, brief: briefOf(name, direction), scenes, sources: scenes.map(() => "builtin"), direction: resolveDirection(direction), date });

test("recordRender_sameRootTwice_keepsOneRecordAsTheMostRecent", () => {
  const dir = mkdtempSync(join(tmpdir(), "dv-history-"));
  const path = join(dir, "history.jsonl");
  try {
    recordRender(recordFor("/p/a", "a", scenesOf("title", "close")), path);
    recordRender(recordFor("/p/b", "b", scenesOf("title", "close")), path);
    recordRender(recordFor("/p/a", "a2", scenesOf("title", "close")), path);

    assert.deepEqual(readHistory(path).map((r) => r.name), ["b", "a2"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("recordRender_overTwentyProjects_keepsTheLastTwenty", () => {
  const dir = mkdtempSync(join(tmpdir(), "dv-history-"));
  const path = join(dir, "history.jsonl");
  try {
    for (let i = 0; i < 23; i++) recordRender(recordFor(`/p/${i}`, `v${i}`, scenesOf("title", "close")), path);

    assert.deepEqual([readHistory(path).length, readHistory(path)[0].name], [20, "v3"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("historyWarnings_sameCloseSequenceAndLook_warnsOnEach", () => {
  const scenes = scenesOf("title", "split", { type: "recap" }, { type: "close", variant: "punchline" });
  const direction = { preset: "story-driven", tone: "light" };
  const earlier = recordFor("/p/old", "old", scenes, direction);

  const warnings = historyWarnings(recordFor("/p/new", "new", scenes, direction), [earlier]);

  assert.equal(warnings.length, 3);
});

test("historyWarnings_differentFromTheRecentVideos_isQuiet", () => {
  const earlier = recordFor("/p/old", "old", scenesOf("title", "split", "recap", "close"), { preset: "story-driven" });

  const warnings = historyWarnings(recordFor("/p/new", "new", scenesOf("title", "beat", "steps", "recap", { type: "close", variant: "cta" }), { preset: "calm-technical" }), [earlier]);

  assert.deepEqual(warnings, []);
});

test("otherVideos_excludesTheProjectItselfAndShowsAtMostFiveNewestFirst", () => {
  const records = Array.from({ length: 8 }, (_, i) => recordFor(`/p/${i}`, `v${i}`, scenesOf("title", "close")));

  assert.deepEqual(otherVideos(records, "/p/7").map((r) => r.name), ["v6", "v5", "v4", "v3", "v2"]);
});

// Cursor helpers -------------------------------------------------------------------------------------------

const CHECKER = `---\nname: demo-checker\ndescription: "A checker."\nmodel: sonnet\neffort: high\n---\n\nBody line.\n`;

test("cursorAgentText_checker_dropsEffortSetsModelAndReadonly", () => {
  assert.equal(cursorAgentText(CHECKER, { name: "demo-checker" }), `---\nname: demo-checker\ndescription: "A checker."\nmodel: inherit\nreadonly: true\n---\n\nBody line.\n`);
});

test("cursorAgentText_researcherWithModelFlag_isBackgroundWithThatModel", () => {
  const text = cursorAgentText(CHECKER.replace("demo-checker", "demo-researcher"), { name: "demo-researcher", model: "claude-4-sonnet" });

  assert.match(text, /model: claude-4-sonnet\nis_background: true\n---/);
});

test("hostsFor_detectionAndOverride", () => {
  assert.deepEqual(
    [hostsFor(undefined, { cursorExists: false }), hostsFor(undefined, { cursorExists: true }), hostsFor("cursor", { cursorExists: false }), hostsFor("claude", { cursorExists: true })],
    [{ claude: true, cursor: false }, { claude: true, cursor: true }, { claude: false, cursor: true }, { claude: true, cursor: false }],
  );
});

test("hostsFor_unknownHost_throws", () => {
  assert.throws(() => hostsFor("vim", { cursorExists: false }), /--host must be one of claude, cursor, both/);
});

// direction tone, freedom, notes ---------------------------------------------------------------------------

test("resolveDirection_toneFreedomNotes_areKeptAndDescribed", async () => {
  const { describeDirection } = await import("../lib/direction.mjs");

  const direction = resolveDirection({ tone: "serious", freedom: "auteur", notes: "retro terminal" });

  assert.deepEqual([direction.tone, direction.freedom, direction.notes], ["serious", "auteur", "retro terminal"]);
  assert.match(describeDirection(direction), /, tone serious, freedom auteur$/);
});

test("resolveDirection_badToneFreedomOrNotes_throwsNamingTheField", () => {
  assert.throws(() => resolveDirection({ tone: "loud" }), /direction.tone must be one of playful, light, balanced, serious, critical/);
  assert.throws(() => resolveDirection({ freedom: "wild" }), /direction.freedom must be one of guided, creative, auteur/);
  assert.throws(() => resolveDirection({ notes: 7 }), /direction.notes must be a string/);
});

// fix round 1 ----------------------------------------------------------------------------------------------

test("narrationStamp_unsetAndBalancedTone_matchTheFormulaBeforeTonesExisted", async () => {
  const { narrationStamp } = await import("../lib/voice.mjs");
  const { createHash } = await import("node:crypto");
  const scene = { say: "Hello there." };
  const before = createHash("sha1").update(JSON.stringify(["v1", 1, "Hello there."])).digest("hex").slice(0, 16);

  const stamps = [undefined, "balanced", "serious"].map((tone) => narrationStamp({ voice: { id: "v1" }, direction: tone && { tone } }, scene, []));

  assert.deepEqual([stamps[0], stamps[1], stamps[2] !== before], [before, before, true]);
});

test("silentSeconds_stingWithoutDuration_isTwoAndAHalfSeconds", async () => {
  const { silentSeconds } = await import("../lib/timeline.mjs");

  assert.deepEqual([silentSeconds({ type: "close", variant: "sting" }), silentSeconds({ type: "close" })], [2.5, 6]);
});

test("wrap_blankSummaryLabel_fallsBackToSummary", () => {
  assert.match(wrapped({ type: "recap", summary_label: "   " }), />Summary</);
});
