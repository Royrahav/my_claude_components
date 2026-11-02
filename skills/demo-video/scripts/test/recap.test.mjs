// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// Recap scene: the stack stays inside the free band (96 px side margins, below the headline, above the
// captions at y=900), rows and examples land on their cues, and motion sticks to the kit's fromTo helpers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import recap from "../lib/scenes/recap.mjs";
import { DEFAULT_HOLD } from "../lib/timeline.mjs";
import { buildScene, px, sceneTimeline, tweensOf } from "./helpers.mjs";

const SIDE = 96;
const BAND_TOP = 150;
const BAND_TOP_WITH_TITLE = 240;
const BAND_BOTTOM = 860;
const CAPTION_TOP = 880;

const timeline = sceneTimeline({ duration: 20, speechEnd: 15 });
const silentTimeline = sceneTimeline({ duration: 9 });
const narration = (count = 20) =>
  sceneTimeline({
    duration: 20,
    words: Array.from({ length: count }, (_, i) => ({ text: `w${i}`, start: 0.6 + i * 0.5, end: 1.0 + i * 0.5 })),
  });

const items = (count, extra = {}) =>
  Array.from({ length: count }, (_, i) => ({ title: `Takeaway ${i + 1}`, example: `Example ${i + 1}`, ...extra }));
const recapOf = (count, extra = {}, tl = timeline) => buildScene(recap, { items: items(count), ...extra }, tl);

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} !~ ${expected}`);
const startsOf = (k, prefix, count) => Array.from({ length: count }, (_, i) => tweensOf(k, `${prefix}${i}`)[0].start);
const fontPx = (css, rule) => Number(css.match(new RegExp(`\\.s1-${rule}\\{font:\\d+ (\\d+)px`))[1]);

// Top and bottom of the stack as the CSS lays it out: rows at min-height plus the gaps, plus the footer block.
function stackBlock({ css, html }, count) {
  const top = px(css, "stack", "top");
  const gap = px(css, "stack", "gap");
  const rows = count * px(css, "rw", "min-height") + (count - 1) * gap;
  const chipHeight = html.match(/id="s1-ft"[^>]*><span[^>]*height:(\d+)px/)?.[1];
  const footer = chipHeight ? gap + px(css, "ft", "margin-top") + Number(chipHeight) : 0;
  return { top, bottom: top + rows + footer };
}

for (const count of [2, 3, 4]) {
  for (const withFooter of [false, true]) {
    const label = `${count}Items${withFooter ? "WithFooter" : ""}`;
    const scene = () => recapOf(count, withFooter ? { footer: { text: "Foot" } } : {});

    test(`recap_${label}_stackStaysInsideTheBandAboveTheCaptions`, () => {
      const { top, bottom } = stackBlock(scene(), count);

      assert.ok(top >= BAND_TOP_WITH_TITLE);
      assert.ok(bottom <= BAND_BOTTOM);
      assert.ok(bottom < CAPTION_TOP);
    });

    test(`recap_${label}_stackIsVerticallyCenteredInTheBand`, () => {
      const { top, bottom } = stackBlock(scene(), count);

      assert.ok(Math.abs(top - BAND_TOP_WITH_TITLE - (BAND_BOTTOM - bottom)) <= 1);
    });
  }
}

test("recap_stack_spansTheContentWidthBetweenThe96pxSideMargins", () => {
  const { css } = recapOf(3);

  assert.equal(px(css, "stack", "left"), SIDE);
  assert.equal(px(css, "stack", "left") + px(css, "stack", "width"), 1920 - SIDE);
});

test("recap_fewerItems_scaleUpModerately", () => {
  const rowHeights = [2, 3, 4].map((count) => px(recapOf(count).css, "rw", "min-height"));

  assert.deepEqual(rowHeights, [168, 140, 118]);
});

for (const count of [2, 3, 4]) {
  test(`recap_${count}Items_titleAndExampleFontsStayWithinTheirReadableRanges`, () => {
    const { css } = recapOf(count);

    assert.ok(fontPx(css, "rt") >= 34 && fontPx(css, "rt") <= 38);
    assert.ok(fontPx(css, "ex") >= 24 && fontPx(css, "ex") <= 26);
  });
}

test("recap_withoutTitle_usesTheDefaultHeadline", () => {
  const { html } = recapOf(3);

  assert.match(html, /id="s1-h" class="s1-h2">What to remember</);
});

test("recap_withTitle_usesItInsteadOfTheDefault", () => {
  const { html } = recapOf(3, { title: "Remember this" });

  assert.match(html, />Remember this</);
  assert.doesNotMatch(html, /What to remember/);
});

test("recap_emptyTitle_dropsTheHeadlineAndFreesTheTopOfTheBand", () => {
  const scene = recapOf(4, { title: "", footer: { text: "Foot" } });

  const { top } = stackBlock(scene, 4);

  assert.doesNotMatch(scene.html, /id="s1-h"/);
  assert.ok(top >= BAND_TOP && top < BAND_TOP_WITH_TITLE);
});

test("recap_itemWithoutIcon_badgeShowsItsPosition", () => {
  const { html } = recapOf(3);

  const badges = [...html.matchAll(/id="s1-b\d" class="s1-bd">(\d)</g)].map((m) => m[1]);
  assert.deepEqual(badges, ["1", "2", "3"]);
});

test("recap_itemWithIcon_badgeShowsTheIconInsteadOfTheNumber", () => {
  const { html } = buildScene(recap, { items: [{ title: "T", example: "E", icon: "shield" }, { title: "U", example: "F" }] }, timeline);

  assert.match(html, /id="s1-b0" class="s1-bd s1-ib"><svg/);
  assert.match(html, /id="s1-b1" class="s1-bd">2</);
});

test("recap_mixedIconAndNumberedItems_numberCountsPositionNotIconCount", () => {
  const data = { items: [{ title: "A", example: "a" }, { title: "B", example: "b", icon: "shield" }, { title: "C", example: "c" }, { title: "D", example: "d", icon: "gear" }], footer: { text: "Foot" } };

  const { html, css } = buildScene(recap, data, timeline);

  assert.match(html, /id="s1-b0" class="s1-bd">1</);
  assert.match(html, /id="s1-b1" class="s1-bd s1-ib"><svg/);
  assert.match(html, /id="s1-b2" class="s1-bd">3</);
  assert.match(html, /id="s1-b3" class="s1-bd s1-ib"><svg/);
  assert.ok(stackBlock({ css, html }, 4).bottom <= BAND_BOTTOM);
});

test("recap_example_isMarkedWithAnEgLabel", () => {
  const { html } = recapOf(2);

  assert.match(html, /<div id="s1-x0" class="s1-ex"><span class="s1-eg">e\.g\.<\/span>Example 1<\/div>/);
});

test("recap_itemWithoutExample_rendersNeitherLabelNorExampleTween", () => {
  const { k, html } = buildScene(recap, { items: [{ title: "T" }, { title: "U" }] }, timeline);

  assert.doesNotMatch(html, /e\.g\./);
  assert.deepEqual([tweensOf(k, "x0").length, tweensOf(k, "x1").length], [0, 0]);
});

test("recap_whoOnAnItem_rendersANavyChipOnThatRowOnly", () => {
  const { html } = buildScene(recap, { items: [{ title: "T", example: "E", who: "Support" }, { title: "U", example: "F" }] }, timeline);

  assert.equal(html.match(/s1-t-navy/g).length, 1);
  assert.match(html, /<span class="s1-ct">Support</);
});

test("recap_markupInTextFields_isEscaped", () => {
  const { html } = buildScene(recap, { title: "<b>h</b>", items: [{ title: "<i>t</i>", example: "<u>e</u>", who: "<s>w</s>" }], footer: { text: "<em>f</em>" } }, timeline);

  assert.doesNotMatch(html, /<(b|i|u|s|em)>/);
});

test("recap_rowWithWordCue_risesOnThatSpokenWord", () => {
  const { k } = buildScene(recap, { items: [{ title: "T", example: "E", at: "w4" }, { title: "U", example: "F", at: "w9" }] }, narration());

  assert.deepEqual(startsOf(k, "r", 2), [2.6, 5.1]);
});

test("recap_exampleWithoutCue_fadesInHalfASecondOrSoAfterItsRow", () => {
  const { k } = buildScene(recap, { items: [{ title: "T", example: "E", at: "w4" }] }, narration());

  near(startsOf(k, "x", 1)[0], 2.6 + 0.6);
});

test("recap_exampleAt_landsOnThatSpokenWord", () => {
  const { k } = buildScene(recap, { items: [{ title: "T", example: "E", at: "w2", example_at: "w5" }] }, narration());

  assert.deepEqual([startsOf(k, "r", 1)[0], startsOf(k, "x", 1)[0]], [1.6, 3.1]);
});

test("recap_cuesOfSeveralRows_resolveInReadingOrder", () => {
  const data = { items: [{ title: "T", example: "E", at: "w2", example_at: "w3" }, { title: "U", example: "F", at: "w6", example_at: "w7" }] };

  const { k, warnings } = buildScene(recap, data, narration());

  assert.deepEqual([startsOf(k, "r", 2), startsOf(k, "x", 2), warnings], [[1.6, 3.6], [2.1, 4.1], []]);
});

test("recap_badge_popsJustAfterItsRowStarts", () => {
  const { k } = buildScene(recap, { items: [{ title: "T", example: "E", at: "w4" }] }, narration());

  near(startsOf(k, "b", 1)[0], 2.6 + 0.15);
});

test("recap_rowsWithoutCues_appearInOrderAndTheLastExampleLandsBeforeTheSpeechEnds", () => {
  const { k } = recapOf(3);

  const rows = startsOf(k, "r", 3);
  const lastExample = startsOf(k, "x", 3)[2];
  assert.ok(rows[0] < rows[1] && rows[1] < rows[2]);
  assert.ok(rows[0] >= 0.6);
  assert.ok(lastExample < 15);
});

test("recap_silentScene_everyRowAndExampleFinishesInsideTheScene", () => {
  const { k } = recapOf(3, {}, silentTimeline);

  const exampleEnds = [0, 1, 2].map((i) => {
    const [fade] = tweensOf(k, `x${i}`);
    return fade.start + fade.duration;
  });
  assert.ok(Math.max(...exampleEnds) <= 9);
  assert.ok(startsOf(k, "r", 3)[0] > 0);
});

test("recap_motion_usesOnlyFromToTweensOnTransformsAndOpacity", () => {
  const { k } = recapOf(3, { footer: { text: "Foot" } });

  assert.ok(k.js.every((line) => line.startsWith("tl.fromTo(")));
  assert.ok(k.js.every((line) => !/\b(left|top|width|height|letterSpacing):/.test(line)));
});

test("recap_sound_isOneSubtlePopPerRowRightAfterItsRowStarts", () => {
  const { k } = buildScene(recap, { items: [{ title: "T", example: "E", at: "w2" }, { title: "U", example: "F", at: "w6" }] }, narration());

  assert.deepEqual(k.sfx.map((x) => [x.sound, x.t]), [["pop", 1.75], ["pop", 3.75]]);
  assert.ok(k.sfx.every((x) => x.volume <= 0.5));
});

test("recap_footer_rendersAChipThatRisesOnItsCue", () => {
  const { k, html } = buildScene(recap, { items: items(3), footer: { text: "Shipped in 5.44", at: "w8" } }, narration());

  assert.match(html, /id="s1-ft"[^>]*><span[^>]*>.*Shipped in 5\.44/);
  assert.equal(tweensOf(k, "ft")[0].start, 4.6);
});

test("recap_footerGivenAsPlainString_isAccepted", () => {
  const { html } = recapOf(2, { footer: "Plain footer" });

  assert.match(html, /Plain footer/);
});

test("recap_withoutFooter_rendersNoFooterElement", () => {
  const { k, html } = recapOf(3);

  assert.doesNotMatch(html, /s1-ft/);
  assert.equal(tweensOf(k, "ft").length, 0);
});

test("recap_noItems_buildsOnlyTheHeadline", () => {
  const { html, result } = buildScene(recap, {}, timeline);

  assert.match(html, /s1-h/);
  assert.doesNotMatch(html, /s1-r0/);
  assert.equal(result.chrome, true);
});

test("recap_badgeDigit_usesTheOnAccentColorOnTheAccentTextFill", () => {
  const { css } = recapOf(3);

  assert.match(css, /\.s1-bd\{[^}]*background:var\(--accent-text\);color:var\(--on-accent\)/);
});

test("recap_styling_usesThemeVariablesOnly", () => {
  const { css, html } = recapOf(3, { footer: { text: "Foot" } });

  assert.doesNotMatch(css + html, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

test("recap_defaultHold_isTwoSeconds", () => {
  assert.equal(DEFAULT_HOLD.recap, 2.0);
});

// The example documented in references/scenes.md, with synthetic word timing over its narration.
const SCENES_DOC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "references", "scenes.md");

function documentedExample() {
  const section = readFileSync(SCENES_DOC, "utf8").split("### recap")[1];
  const scene = JSON.parse(section.match(/```json\r?\n([\s\S]*?)\r?\n```/)[1]);
  const words = scene.say.split(/\s+/).map((text, i) => ({ text, start: 0.6 + i * 0.4, end: 0.9 + i * 0.4 }));
  return { scene, words };
}

test("recap_documentedExample_buildsWithEveryCueResolved", () => {
  const { scene, words } = documentedExample();

  const { warnings, html } = buildScene(recap, scene.data, sceneTimeline({ duration: 30, words }));

  assert.deepEqual(warnings, []);
  for (const item of scene.data.items) assert.ok(html.includes(item.title));
});

test("recap_documentedExample_narrationFollowsTheTwentyFiveToFortyFiveWordRule", () => {
  const { words } = documentedExample();

  assert.ok(words.length >= 25 && words.length <= 45, `${words.length} words`);
});
