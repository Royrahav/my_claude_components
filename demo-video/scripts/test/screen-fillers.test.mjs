// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The empty-screen warning and what fills a scene before its content arrives: blueprint reveals, the backdrop
// word and the chapter intro. The default look must not change, so every knob is checked against its absence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createScene, wrap } from "../lib/kit.mjs";
import { CHAPTER_INTRO_VALUES, REVEAL_VALUES, describeDirection, resolveDirection } from "../lib/direction.mjs";
import { backdropParts, planChapterIntro, startsChapter } from "../lib/fillers.mjs";
import { emptyScreenWarnings, emptyStretches } from "../lib/screen-gaps.mjs";
import { loadTheme } from "../lib/theme.mjs";
import { makeCue } from "../lib/timeline.mjs";
import title, { variants } from "../lib/scenes/title.mjs";
import { sceneTimeline } from "./helpers.mjs";

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

test("emptyScreenWarnings_blueprintGhosts_fillTheWait", () => {
  const k = sceneOf({ direction: { reveal: "blueprint" }, reveal: (s) => s.rise("a", 4) });

  assert.deepEqual(warningsOf(k), []);
});

test("emptyScreenWarnings_backdrop_fillsTheWait", () => {
  const k = sceneOf({ scene: { type: "steps", backdrop: "Before" }, reveal: (s) => s.rise("a", 4) });
  wrap(k, { fontsCss: "" });

  assert.deepEqual(warningsOf(k), []);
});

// blueprint reveal -------------------------------------------------------------------------------------------

const riseOf = (direction) => sceneOf({ direction, reveal: (s) => { s.rise("a", 2); s.draw("h", 3); } });

test("blueprint_unset_leavesTheRevealTweenAsItWas", () => {
  const { js, css } = riseOf();

  assert.equal(js[0], 'tl.fromTo("#s1-a",{opacity:0,y:22},{opacity:1,y:0,duration:0.55,ease:"power3.out"},2);');
  assert.deepEqual(css, []);
});

test("blueprint_on_startsTheRevealAsAnOpacityOnlyGhostThatFillsInOnTheCue", () => {
  const { js, css } = riseOf({ reveal: "blueprint" });

  assert.equal(js[0], 'tl.fromTo("#s1-a",{opacity:0.18,y:22},{opacity:1,y:0,duration:0.55,ease:"power3.out"},2);');
  assert.deepEqual(css, []);
});

test("blueprint_on_leavesLineDrawsAndTypingAlone", () => {
  const { js } = riseOf({ reveal: "blueprint" });

  assert.equal(js[1], 'tl.fromTo("#s1-h",{scaleX:0},{scaleX:1,duration:0.6,ease:"power2.inOut"},3);');
});

test("blueprint_onABeat_leavesTheBeatAlone", () => {
  const k = sceneOf({ direction: { reveal: "blueprint" }, scene: { type: "beat" }, reveal: (s) => s.punch("a", 0.15) });

  assert.match(k.js[0], /\{opacity:0,scale:1\.45\}/);
});

test("blueprint_on_keepsTheChromeFadeInUnchanged", () => {
  const plain = wrap(sceneOf({ scene: { type: "steps", chapter: "Design" } }), { fontsCss: "", eyebrow: "E" });
  const blueprint = wrap(sceneOf({ direction: { reveal: "blueprint" }, scene: { type: "steps", chapter: "Design" } }), { fontsCss: "", eyebrow: "E" });

  assert.equal(blueprint, plain);
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

test("resolveDirection_chapterIntroAndReveal_areKeptWhenSetAndAbsentOtherwise", () => {
  assert.deepEqual([resolveDirection({ chapter_intro: "on" }).chapter_intro, resolveDirection({ reveal: "blueprint" }).reveal], ["on", "blueprint"]);
  assert.equal("chapter_intro" in resolveDirection({ chapter_intro: null }), false);
  assert.equal("reveal" in resolveDirection({}), false);
});

test("resolveDirection_unknownChapterIntroOrReveal_throwsNamingTheValues", () => {
  assert.throws(() => resolveDirection({ chapter_intro: "yes" }), { message: `brief.json direction.chapter_intro must be one of ${CHAPTER_INTRO_VALUES.join(", ")}, got "yes"` });
  assert.throws(() => resolveDirection({ reveal: "ghost" }), { message: `brief.json direction.reveal must be one of ${REVEAL_VALUES.join(", ")}, got "ghost"` });
});

test("describeDirection_chapterIntroAndReveal_areAppended", () => {
  assert.match(describeDirection(resolveDirection({ chapter_intro: "on", reveal: "blueprint" })), /, chapter_intro on, reveal blueprint$/);
});

// blueprint on title scenes: elements that take each other's place must not ghost together -------------------

const titleIn = (template, data) => {
  const timeline = sceneTimeline({ duration: 12, words: [] });
  const k = createScene({ id: "s1", theme: THEME, fontsCss: "", brief: {}, scene: {}, duration: 12, direction: resolveDirection({ reveal: "blueprint" }) });
  template(k, data, makeCue(timeline, []));
  return k.js.join("\n");
};
const startOf = (js, id) => js.split(`tl.fromTo("#s1-${id}",{opacity:`)[1].split(/[,}]/)[0];
const COPY = { title: "Print Gateway", subtitle: "Printing", kicker: ["Reports", "Forms"] };

test("title_blueprintDefaultVariantWithKickers_kickersAndLockupStartHidden", () => {
  const js = titleIn(title, COPY);

  assert.deepEqual(["k0", "k1", "t1", "sub"].map((id) => startOf(js, id)), ["0", "0", "0", "0"]);
});

test("title_blueprintKineticWithKickers_wordsAndLockupStartHidden", () => {
  const js = titleIn(variants.kinetic, COPY);

  assert.deepEqual(["w0", "w1", "t1", "sub"].map((id) => startOf(js, id)), ["0", "0", "0", "0"]);
});

test("title_blueprintWithoutKickers_lockupStillGhosts", () => {
  const js = titleIn(title, { title: "Print Gateway", subtitle: "Printing" });

  assert.deepEqual(["t1", "sub"].map((id) => startOf(js, id)), ["0.18", "0.18"]);
});
