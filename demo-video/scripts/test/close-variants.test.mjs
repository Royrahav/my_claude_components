// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The closing scene: the default (1-3 taglines, optional underline sweep) and the punchline, cta,
// callback and sting variants. Each is checked through the HTML and tweens it emits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createScene } from "../lib/kit.mjs";
import { resolveDirection } from "../lib/direction.mjs";
import { makeCue } from "../lib/timeline.mjs";
import close, { FADE_OUT, variants } from "../lib/scenes/close.mjs";
import { THEME, sceneTimeline, tweensOf } from "./helpers.mjs";

const LOGO_THEME = { ...THEME, logo: "logo.svg" };
const wordsOf = (say) => say.split(/\s+/).map((text, i) => ({ text, start: 0.6 + i * 0.4, end: 0.9 + i * 0.4 }));
const EPSILON = 1e-9;

// buildScene from helpers fixes the theme and brief; closes need both to vary.
function build(template, data, { theme = THEME, brief = {}, duration = 12, say } = {}) {
  const timeline = sceneTimeline({ duration, words: say ? wordsOf(say) : [] });
  const warnings = [];
  const k = createScene({ id: "s1", theme, fontsCss: "", brief, scene: {}, duration });
  const result = template(k, data, makeCue(timeline, warnings));
  return { k, result, warnings, html: k.html.join("\n"), css: k.css.join("\n") };
}

// default close ----------------------------------------------------------------------------------------

test("close_defaultWithOneTagline_putsTheSweepUnderIt", () => {
  const { html } = build(close, { title: "Done", tagline: ["Ship it."] });

  assert.match(html, /<span id="s1-ph0" class="s1-last">Ship it\.<i id="s1-ul"/);
});

test("close_defaultWithThreeTaglines_marksOnlyTheLastAsAccent", () => {
  const { html } = build(close, { title: "Done", tagline: ["One.", "Two.", "Three."] });

  assert.deepEqual([html.includes('id="s1-ph2" class="s1-last"'), html.includes('id="s1-ph0" class="s1-last"'), html.includes('id="s1-ph1" class="s1-last"')], [true, false, false]);
});

test("close_defaultWithoutTaglines_rendersTheTitleAloneWithoutASweep", () => {
  const { html, k } = build(close, { title: "Done" });

  assert.deepEqual([html.includes("Done"), html.includes("s1-ph0"), html.includes('id="s1-ul"'), k.js.some((line) => line.includes("#s1-ul"))], [true, false, false, false]);
});

test("close_underlineFalse_keepsTheLastTaglineButDropsTheSweep", () => {
  const { html } = build(close, { title: "Done", tagline: ["A.", "B."], underline: false });

  assert.deepEqual([html.includes('id="s1-ph1" class="s1-last"'), html.includes('id="s1-ul"')], [true, false]);
});

test("close_taglineEntryWithAtTime_isRevealedAtThatTime", () => {
  const { k } = build(close, { title: "Done", tagline: [{ text: "Late.", at: 5 }] });

  assert.equal(tweensOf(k, "ph0")[0].start, 5);
});

test("close_defaultLogoFalse_omitsTheLockupLogo", () => {
  const withLogo = build(close, { title: "T" }, { theme: LOGO_THEME });
  const without = build(close, { title: "T", logo: false }, { theme: LOGO_THEME });

  assert.deepEqual([withLogo.html.includes("theme/logo.svg"), without.html.includes("theme/logo.svg")], [true, false]);
});

test("close_default_fadesToTheCanvasAtTheEndAndReturnsNoChrome", () => {
  const { k, result } = build(close, { title: "T" }, { duration: 10 });

  assert.deepEqual([result, tweensOf(k, "cam").at(-1).start], [{ chrome: false }, 10 - FADE_OUT]);
});

// shared by every variant -------------------------------------------------------------------------------

const MINIMAL = {
  punchline: { line: "Ship it today" },
  cta: { action: "Turn it on" },
  callback: { hook: "Why?", answer: "Because." },
  sting: { title: "Product" },
};

for (const [name, data] of Object.entries(MINIMAL)) {
  test(`close_${name}_fadesToTheCanvasAtTheEndAndReturnsNoChrome`, () => {
    const { k, result } = build(variants[name], data, { duration: 10 });

    assert.deepEqual([result, tweensOf(k, "cam").at(-1).start], [{ chrome: false }, 10 - FADE_OUT]);
  });

  test(`close_${name}_refLine_isShownOnlyWhenGiven`, () => {
    const without = build(variants[name], data);
    const withRef = build(variants[name], { ...data, ref: "v2.4" });

    assert.deepEqual([without.html.includes('id="s1-ref"'), withRef.html.includes('id="s1-ref"')], [false, true]);
  });

  test(`close_${name}_refLine_isEscaped`, () => {
    const { html } = build(variants[name], { ...data, ref: "<b>x</b>" });

    assert.equal(html.includes("<b>x</b>"), false);
  });

  test(`close_${name}_logoFalse_dropsTheSmallLogo`, () => {
    const shown = build(variants[name], data, { theme: LOGO_THEME });
    const hidden = build(variants[name], { ...data, logo: false }, { theme: LOGO_THEME, brief: { product: "P" } });

    assert.deepEqual([shown.html.includes("theme/logo.svg"), hidden.html.includes("theme/logo.svg")], [true, false]);
  });
}

// punchline --------------------------------------------------------------------------------------------

test("closePunchline_line_isRevealedOneSpanPerWord", () => {
  const { html } = build(variants.punchline, { line: "Ship it today" });

  assert.deepEqual([html.match(/class="s1-pw"/g).length, html.includes('id="s1-w2"'), html.includes('id="s1-w3"')], [3, true, false]);
});

test("closePunchline_missingLine_throwsNamingTheField", () => {
  assert.throws(() => build(variants.punchline, {}), /s1: close punchline needs data\.line/);
});

test("closePunchline_blankLine_throwsNamingTheField", () => {
  assert.throws(() => build(variants.punchline, { line: "   " }), /close punchline needs data\.line/);
});

test("closePunchline_longLine_usesASmallerFontThanAShortOne", () => {
  const sizeOf = ({ css }) => Number(css.match(/\.s1-pl\{[^}]*font:900 (\d+)px/)[1]);

  const sizes = [sizeOf(build(variants.punchline, { line: "Done." })), sizeOf(build(variants.punchline, { line: "x".repeat(80) }))];

  assert.deepEqual(sizes, [150, 80]);
});

test("closePunchline_sub_appearsAfterTheLastWord", () => {
  const { k } = build(variants.punchline, { line: "One two three", sub: "More" });

  assert.ok(tweensOf(k, "psub")[0].start > tweensOf(k, "w2")[0].start);
});

test("closePunchline_noSub_hasNoSubElement", () => {
  const { html } = build(variants.punchline, { line: "One two" });

  assert.equal(html.includes('id="s1-psub"'), false);
});

test("closePunchline_shortScene_pullsTheLastRevealBeforeTheFade", () => {
  const { k } = build(variants.punchline, { line: "a b c d e f g h i j k l", at: 3 }, { duration: 5 });

  assert.ok(tweensOf(k, "w11")[0].start <= 5 - FADE_OUT - 1.2 + EPSILON);
});

test("closePunchline_atTime_startsTheFirstWordThere", () => {
  const { k } = build(variants.punchline, { line: "One two", at: 2.5 });

  assert.equal(tweensOf(k, "w0")[0].start, 2.5);
});

// cta --------------------------------------------------------------------------------------------------

const stepRows = (html) => (html.match(/id="s1-st\d"/g) ?? []).length;

test("closeCta_actionOnly_rendersNoStepRows", () => {
  const { html } = build(variants.cta, { action: "Turn it on" });

  assert.deepEqual([html.includes("Turn it on"), stepRows(html), html.includes('class="s1-stp"')], [true, 0, false]);
});

test("closeCta_threeSteps_areNumberedInOrder", () => {
  const { html } = build(variants.cta, { action: "Go", steps: ["First", { text: "Second" }, "Third"] });

  assert.deepEqual([stepRows(html), [...html.matchAll(/s1-num">(\d)</g)].map((m) => m[1])], [3, ["1", "2", "3"]]);
});

test("closeCta_fourSteps_throwsNamingTheField", () => {
  assert.throws(() => build(variants.cta, { action: "Go", steps: ["a", "b", "c", "d"] }), /s1: close cta needs data\.steps to be a list of at most 3/);
});

test("closeCta_stepWithBlankText_throwsNamingTheField", () => {
  assert.throws(() => build(variants.cta, { action: "Go", steps: ["a", { text: "  " }] }), /data\.steps/);
});

test("closeCta_missingAction_throwsNamingTheField", () => {
  assert.throws(() => build(variants.cta, { steps: ["a"] }), /close cta needs data\.action/);
});

test("closeCta_stepWithAtTime_slidesInAtThatTime", () => {
  const { k } = build(variants.cta, { action: "Go", steps: [{ text: "Late", at: 4 }] });

  assert.equal(tweensOf(k, "st0")[0].start, 4);
});

test("closeCta_codeAndWhere_areShownOnlyWhenGiven", () => {
  const bare = build(variants.cta, { action: "Go" });
  const full = build(variants.cta, { action: "Go", code: "npm run x", where: "v2.4" });

  assert.deepEqual([bare.html.includes('id="s1-cd"'), bare.html.includes('id="s1-where"'), full.html.includes("npm run x"), full.html.includes("v2.4")], [false, false, true, true]);
});

test("closeCta_actionOverEighteenCharacters_usesTheSmallerFont", () => {
  const sizeOf = ({ css }) => Number(css.match(/\.s1-act\{font:900 (\d+)px/)[1]);

  const sizes = [sizeOf(build(variants.cta, { action: "x".repeat(18) })), sizeOf(build(variants.cta, { action: "x".repeat(19) }))];

  assert.deepEqual(sizes, [130, 96]);
});

// callback ---------------------------------------------------------------------------------------------

test("closeCallback_hookAndAnswer_areBothRenderedWithAStrikeOnTheHook", () => {
  const { html } = build(variants.callback, { hook: "Why?", answer: "Because." });

  assert.match(html, /id="s1-hk"[^>]*>Why\?<i id="s1-hs"/);
  assert.ok(html.includes(">Because.<"));
});

test("closeCallback_missingHook_throwsNamingTheField", () => {
  assert.throws(() => build(variants.callback, { answer: "A" }), /close callback needs data\.hook/);
});

test("closeCallback_missingAnswer_throwsNamingTheField", () => {
  assert.throws(() => build(variants.callback, { hook: "H" }), /close callback needs data\.answer/);
});

test("closeCallback_answerAtJustAfterTheHook_isPushedAtLeastTheGapLater", () => {
  const { k } = build(variants.callback, { hook: "H", answer: "A", hook_at: 2, answer_at: 2.2 });

  assert.equal(tweensOf(k, "hs")[0].start, 3.4);
});

test("closeCallback_answerAtWellAfterTheHook_isKeptAsWritten", () => {
  const { k } = build(variants.callback, { hook: "H", answer: "A", hook_at: 1, answer_at: 6 });

  assert.equal(tweensOf(k, "hs")[0].start, 6);
});

test("closeCallback_shortScene_pullsTheAnswerBeforeTheFade", () => {
  const { k } = build(variants.callback, { hook: "H", answer: "A", answer_at: 9 }, { duration: 5 });

  assert.ok(tweensOf(k, "hs")[0].start <= 5 - FADE_OUT - 1.2 + EPSILON);
});

// sting ------------------------------------------------------------------------------------------------

test("closeSting_withThemeLogo_showsTheLogoImage", () => {
  const { html } = build(variants.sting, {}, { theme: LOGO_THEME });

  assert.match(html, /<img id="s1-big"[^>]*theme\/logo\.svg/);
});

test("closeSting_withoutLogo_showsTheBriefProductName", () => {
  const { html } = build(variants.sting, {}, { brief: { product: "Acme" } });

  assert.match(html, /<div id="s1-big" class="s1-nm">Acme</);
});

test("closeSting_withoutLogoOrProduct_fallsBackToTheTitle", () => {
  const { html } = build(variants.sting, { title: "Fallback" });

  assert.match(html, /class="s1-nm">Fallback</);
});

test("closeSting_nothingToShow_throwsNamingTheNeeds", () => {
  assert.throws(() => build(variants.sting, {}), /s1: close sting needs a theme logo, brief\.product or data\.title/);
});

test("closeSting_logoFalseAndNoName_throws", () => {
  assert.throws(() => build(variants.sting, { logo: false }, { theme: LOGO_THEME }), /close sting needs/);
});

test("closeSting_threeSecondScene_revealsTheTitleBeforeTheFade", () => {
  const { k } = build(variants.sting, { title: "Tagline" }, { theme: LOGO_THEME, duration: 3 });

  assert.ok(tweensOf(k, "tt")[0].start <= 3 - FADE_OUT - 0.5 + EPSILON);
});

test("closeSting_withoutTitle_hasNoTitleLine", () => {
  const { html } = build(variants.sting, {}, { theme: LOGO_THEME });

  assert.equal(html.includes('id="s1-tt"'), false);
});

// validation (fix round 2) ----------------------------------------------------------------------------

test("closeCta_stepsNotAList_throwsTheNamedError", () => {
  for (const steps of ["one", { text: "a" }, 3])
    assert.throws(() => build(variants.cta, { action: "Go", steps }), /s1: close cta needs data.steps to be a list of at most 3/);
});

test("closeDefault_fourTaglines_throwsTheNamedErrorAndThreeAreAccepted", () => {
  assert.throws(() => build(close, { title: "T", tagline: ["a", "b", "c", "d"] }), /s1: close needs data.tagline to be a list of at most 3 phrases/);
  assert.doesNotThrow(() => build(close, { title: "T", tagline: ["a", "b", "c"] }));
});

test("closeDefault_taglineNotAList_throwsTheNamedError", () => {
  assert.throws(() => build(close, { title: "T", tagline: "one" }), /data.tagline/);
});

// the ref over the persistent world ----------------------------------------------------------------------

function worldBuild(template, data) {
  const k = createScene({ id: "s1", theme: THEME, fontsCss: "", brief: {}, scene: {}, duration: 12, direction: resolveDirection({ background: "world" }) });
  template(k, data, makeCue(sceneTimeline({ duration: 12 }), []));
  return { html: k.html.join("\n"), css: k.css.join("\n") };
}
const pxIn = (css, selector, prop) => Number(css.match(new RegExp(String.raw`${selector}\{[^}]*?${prop}:(-?[\d.]+)px`))[1]);

for (const [name, template] of [["default", close], ["punchline", variants.punchline]]) {
  const data = { title: "T", line: "L", tagline: ["One."], ref: "Ref: LAB-1" };

  test(`close_${name}_refOverTheWorld_hasAnOpaqueCanvasPatchBehindTheWholeRefBox`, () => {
    const { html, css } = worldBuild(template, data);
    const patch = { left: pxIn(css, "\.s1-refbg", "left"), top: pxIn(css, "\.s1-refbg", "top"), width: pxIn(css, "\.s1-refbg", "width"), height: pxIn(css, "\.s1-refbg", "height") };
    const box = { left: pxIn(css, "#s1-ref", "left"), width: pxIn(css, "#s1-ref", "width"), top: pxIn(css, "\.s1-ref", "top"), height: 28 };
    const opaqueShare = Number(css.match(/radial-gradient\(closest-side,var\(--canvas\) (\d+)%/)[1]) / 100;
    const reach = (x, y) => Math.hypot((x - (patch.left + patch.width / 2)) / (patch.width / 2), (y - (patch.top + patch.height / 2)) / (patch.height / 2));
    const farthestCorner = Math.max(...[box.left, box.left + box.width].flatMap((x) => [box.top, box.top + box.height].map((y) => reach(x, y))));

    assert.ok(html.indexOf("s1-refbg") < html.indexOf('id="s1-ref"'));
    assert.ok(farthestCorner <= opaqueShare);
    assert.ok(patch.width < 960);
  });

  test(`close_${name}_refWithoutTheWorld_hasNoPatch`, () => {
    const { html, css } = build(template, data);

    assert.deepEqual([html.includes("refbg"), css.includes("refbg")], [false, false]);
  });
}

// reveal blueprint ---------------------------------------------------------------------------------------

function blueprintClose(template, data) {
  const k = createScene({ id: "s1", theme: THEME, fontsCss: "", brief: {}, scene: {}, duration: 12, direction: resolveDirection({ reveal: "blueprint" }) });
  template(k, data, makeCue(sceneTimeline({ duration: 12 }), []));
  return k.js;
}
const startsHidden = (js, id) => js.some((line) => line.startsWith(`tl.fromTo("#s1-${id}",{opacity:0`) && !line.includes("{opacity:0."));

test("close_spokenLinesUnderBlueprint_stayHiddenUntilTheirCue", () => {
  const tagline = blueprintClose(close, { title: "T", tagline: ["One.", "Two."] });
  const punchline = blueprintClose(variants.punchline, { line: "Say it plain", sub: "Then stop" });
  const callback = blueprintClose(variants.callback, { hook: "Why?", answer: "Because." });

  assert.deepEqual([startsHidden(tagline, "ph0"), startsHidden(tagline, "ph1"), startsHidden(punchline, "w0"), startsHidden(punchline, "w2"), startsHidden(punchline, "psub"), startsHidden(callback, "an")], Array(6).fill(true));
  assert.equal(startsHidden(tagline, "t1"), false); // the title is not a spoken-in-pieces line: it still ghosts
});
