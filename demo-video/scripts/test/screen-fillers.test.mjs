// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The empty-screen warning and what fills a scene before its content arrives: the backdrop
// word and the chapter intro. The default look must not change, so every knob is checked against its absence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createScene, wrap } from "../lib/kit.mjs";
import { CHAPTER_INTRO_VALUES, describeDirection, resolveDirection } from "../lib/direction.mjs";
import { backdropParts, planChapterIntro, startsChapter } from "../lib/fillers.mjs";
import { emptyScreenWarnings, emptyStretches } from "../lib/screen-gaps.mjs";
import { loadTheme } from "../lib/theme.mjs";

const THEME = loadTheme(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "themes", "labos", "theme.json"));
const DURATION = 8;

// A scene built through the real kit; `reveal` runs the template's own choreography.
function sceneOf({ direction, scene = { type: "steps" }, reveal = () => {} } = {}) {
  const k = createScene({ id: "s1", theme: THEME, fontsCss: "", brief: {}, scene, duration: DURATION, direction: resolveDirection(direction ?? {}) });
  k.html.push('<div id="s1-a">A</div><div id="s1-h">H</div>');
  reveal(k);
  return k;
}
const warningsOf = (k, scene = { type: "steps" }) => emptyScreenWarnings({ id: "s1", scene, intervals: k.visibleIntervals(), duration: DURATION });

// the empty-screen warning ---------------------------------------------------------------------------------

test("emptyStretches_noContentUntilTheFirstReveal_reportsTheLeadingGap", () => {
  assert.deepEqual(emptyStretches([{ from: 2.6, until: Infinity }], 8), [{ from: 0, to: 2.6, revealAt: 2.6 }]);
});

test("emptyStretches_gapOfExactlyTheThreshold_isNotReported", () => {
  assert.deepEqual(emptyStretches([{ from: 1.0, until: Infinity }], 8), []);
});

test("emptyScreenWarnings_lateFirstReveal_namesLengthAndFirstReveal", () => {
  const k = sceneOf({ reveal: (s) => s.rise("a", 2.6) });

  assert.deepEqual(warningsOf(k), ["s1: empty for 2.6 s at the start (first reveal at 2.6 s)"]);
});

test("emptyScreenWarnings_headlineRisingAt0.2_countsAsContent", () => {
  const k = sceneOf({ reveal: (s) => { s.rise("h", 0.2); s.rise("a", 5); } });

  assert.deepEqual(warningsOf(k), []);
});

test("emptyScreenWarnings_everythingFadesOutThenReturns_reportsTheGapBetween", () => {
  const k = sceneOf({ reveal: (s) => { s.rise("a", 0.4); s.to("a", 3, { opacity: 0 }, 0.4); s.rise("h", 5.2); } });

  assert.deepEqual(warningsOf(k), ["s1: empty for 1.8 s from 3.4 s (next reveal at 5.2 s)"]);
});

test("emptyScreenWarnings_afterTheLastRevealOrTheCloseFadeOut_isNotReported", () => {
  const k = sceneOf({ reveal: (s) => { s.rise("a", 0.4); s.to("cam", 6, { opacity: 0 }, 2); } });

  assert.deepEqual(warningsOf(k), []);
});

test("emptyScreenWarnings_beat_isExempt", () => {
  const k = sceneOf({ scene: { type: "beat" }, reveal: (s) => s.punch("a", 4) });

  assert.deepEqual(warningsOf(k, { type: "beat" }), []);
});

test("emptyScreenWarnings_nothingRevealed_saysSo", () => {
  assert.deepEqual(warningsOf(sceneOf()), ["s1: nothing is revealed (empty for 8.0 s)"]);
});

test("emptyScreenWarnings_backdrop_fillsTheWait", () => {
  const k = sceneOf({ scene: { type: "steps", backdrop: "Before" }, reveal: (s) => s.rise("a", 4) });
  wrap(k, { fontsCss: "" });

  assert.deepEqual(warningsOf(k), []);
});

// backdrop word ----------------------------------------------------------------------------------------------

test("wrap_backdropField_addsADecorativeWordBehindTheContent", () => {
  const html = wrap(sceneOf({ scene: { type: "steps", backdrop: "Before" } }), { fontsCss: "" });

  assert.match(html, /<div id="s1-bg"[^>]*>(?:<div id="s1-grid"[^>]*><\/div>)?<div id="s1-backdrop" class="s1-backdrop" data-layout-ignore aria-hidden="true">Before<\/div><\/div>/);
  assert.match(html, /tl\.fromTo\("#s1-backdrop",\{x:70\},\{x:-70,duration:8,ease:"none"\},0\);/);
});

test("wrap_noBackdropField_addsNothing", () => {
  assert.equal(wrap(sceneOf(), { fontsCss: "" }).includes("backdrop"), false);
});

test("backdropParts_blankOrOverlongWord_throwsNamingTheScene", () => {
  for (const backdrop of ["  ", "x".repeat(17)])
    assert.throws(() => backdropParts({ id: "s9", p: (n) => `s9-${n}`, scene: { backdrop }, theme: THEME, duration: 5, esc: String }), /s9: backdrop must be 1-16 characters/);
});

// chapter intro ----------------------------------------------------------------------------------------------

test("startsChapter_firstSceneOfEachLabel_isTrueButNotSummaryCloseOrRepeat", () => {
  const scenes = [{ type: "title" }, { chapter: "A" }, { chapter: "A" }, { type: "beat" }, { chapter: "B" }, { chapter: "B" }, { type: "recap", chapter: "Recap" }, { type: "close" }];

  assert.deepEqual(scenes.map((_, i) => startsChapter(scenes, i)), [false, true, false, false, true, false, false, false]);
});

test("startsChapter_labelReturningAfterABeat_isNotANewChapter", () => {
  const scenes = [{ chapter: "A" }, { type: "beat" }, { chapter: "A" }];

  assert.equal(startsChapter(scenes, 2), false);
});

test("planChapterIntro_roomBeforeTheFirstCue_runsTheFullIntro", () => {
  const plan = planChapterIntro({ start: 0, firstCue: 3 });

  assert.equal(plan.end, 1.45);
  assert.ok(Math.abs(plan.rise + plan.hold + plan.leave - 1.45) < 1e-9);
});

test("planChapterIntro_cueLeavesLessThanTheMinimum_isSkipped", () => {
  assert.equal(planChapterIntro({ start: 0, firstCue: 1.1 }), null);
  assert.equal(planChapterIntro({ start: 0.6, firstCue: 1.7 }), null);
});

test("planChapterIntro_cueLeavesJustEnough_shortensTheIntro", () => {
  assert.equal(planChapterIntro({ start: 0, firstCue: 1.3 }).end, 1.3);
});

const introOf = (extra = {}) => {
  const k = sceneOf({ scene: { type: "steps", chapter: "Design" }, reveal: (s) => s.rise("h", 0.2), ...extra });
  k.rise("a", 3);
  return k;
};

test("firstContentCue_ignoresTheHeadlineRise", () => {
  assert.equal(introOf().firstContentCue(), 3);
});

test("wrap_chapterIntro_flysToTheTagWhichFadesInAsItLands", () => {
  const plan = planChapterIntro({ start: 0, firstCue: 3 });
  const html = wrap(introOf(), { fontsCss: "", eyebrow: "E", intro: plan });

  assert.match(html, /<span id="s1-intro" class="s1-intro">Design<\/span>/);
  assert.match(html, /tl\.fromTo\(\["#s1-eyebrow"\],\{opacity:0,y:8\},\{opacity:1,y:0,duration:0\.4,ease:"power3\.out"\},0\);/);
  assert.match(html, /tl\.fromTo\(\["#s1-tag"\],\{opacity:0,y:8\},\{opacity:1,y:0,duration:0\.4,ease:"power3\.out"\},1\.34\);/);
  assert.match(html, /tl\.to\("#s1-intro",\{x:\d+,y:-423,scale:0\.2,/);
});

test("wrap_chapterIntroWithoutATag_fadesOutInPlace", () => {
  const plan = planChapterIntro({ start: 0, firstCue: 3 });
  const html = wrap(introOf({ direction: { chrome: "none" } }), { fontsCss: "", intro: plan });

  assert.match(html, /tl\.to\("#s1-intro",\{scale:1\.08,opacity:0,/);
  assert.equal(html.includes('"#s1-tag"'), false);
});

test("wrap_chapterIntro_countsAsFillingTheWait", () => {
  const k = sceneOf({ scene: { type: "steps", chapter: "Design" }, reveal: (s) => s.rise("a", 1.4) });
  wrap(k, { fontsCss: "", intro: planChapterIntro({ start: 0, firstCue: 1.45 }) });

  assert.deepEqual(warningsOf(k), []);
});

test("wrap_noIntro_keepsTheChromeFadeInAsOneTween", () => {
  const html = wrap(introOf(), { fontsCss: "", eyebrow: "E" });

  assert.match(html, /tl\.fromTo\(\["#s1-eyebrow","#s1-tag"\],\{opacity:0,y:8\}/);
  assert.equal(html.includes("intro"), false);
});

// direction knobs --------------------------------------------------------------------------------------------

test("resolveDirection_chapterIntro_isKeptWhenSetAndAbsentOtherwise", () => {
  assert.equal(resolveDirection({ chapter_intro: "on" }).chapter_intro, "on");
  assert.equal("chapter_intro" in resolveDirection({ chapter_intro: null }), false);
});

test("resolveDirection_unknownChapterIntro_throwsNamingTheValues", () => {
  assert.throws(() => resolveDirection({ chapter_intro: "yes" }), { message: `brief.json direction.chapter_intro must be one of ${CHAPTER_INTRO_VALUES.join(", ")}, got "yes"` });
});

test("resolveDirection_revealRemoved_isAnUnknownField", () => {
  assert.throws(() => resolveDirection({ reveal: "blueprint" }), /unknown field "reveal"/);
});

test("describeDirection_chapterIntro_isAppended", () => {
  assert.match(describeDirection(resolveDirection({ chapter_intro: "on" })), /, chapter_intro on$/);
});
