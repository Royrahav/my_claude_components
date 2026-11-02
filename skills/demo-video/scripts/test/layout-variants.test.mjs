// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The layout variants: each stays inside the free band (96 px side margins, below the chrome or the
// headline, above the captions at y=900), reveals with the kit's seek-safe fromTo tweens, styles with
// theme variables only, follows the direction through the kit, and lands on its cues like its default.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as title from "../lib/scenes/title.mjs";
import * as split from "../lib/scenes/split.mjs";
import * as bullets from "../lib/scenes/bullets.mjs";
import * as statement from "../lib/scenes/statement.mjs";
import * as recap from "../lib/scenes/recap.mjs";
import * as pipeline from "../lib/scenes/pipeline.mjs";
import { templateFor } from "../lib/variants.mjs";
import { buildScene, px, sceneTimeline, tweensOf } from "./helpers.mjs";

const SIDE = 96;
const RIGHT = 1920 - SIDE;
const CHROME_BOTTOM = 110;
const BAND_TOP = 150;
const BAND_TOP_WITH_TITLE = 240;
const BAND_BOTTOM = 860;
const CAPTION_TOP = 880;
const FOOT_TOP = 760;

const narration = (count = 30) =>
  sceneTimeline({ duration: 20, words: Array.from({ length: count }, (_, i) => ({ text: `w${i}`, start: 0.6 + i * 0.5, end: 1.0 + i * 0.5 })) });
const build = (module, variant, data, timeline = narration(), options) =>
  buildScene(templateFor(module, { id: "s1", type: "test", variant }), data, timeline, options);

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} !~ ${expected}`);
const startOf = (k, name, nth = 0) => tweensOf(k, name)[nth].start;
const endOf = ({ start, duration }) => start + duration;
const listOf = (count, make) => Array.from({ length: count }, (_, i) => make(i));
const cssRule = (css, rule) => css.match(new RegExp(`\\.s1-${rule}\\{([^}]*)\\}`))?.[1] ?? "";

// Every variant with data that fills it.
const FULL = {
  kinetic: [title, { title: "Print Gateway", subtitle: "Printing for the container era", kicker: ["Reports", "Forms", "Distribution"] }],
  split: [title, { title: "Print Gateway", subtitle: "Printing for the container era", kicker: ["Reports", { text: "Forms" }] }],
  stacked: [split, {
    title: "Before and after",
    left: { label: "Before", items: [{ text: "Windows spooler", icon: "server" }, { text: "SumatraPDF", icon: "doc" }, { text: "One per server" }] },
    right: { label: "After", items: [{ text: "One central service", tone: "good" }, { text: "No spooler", tone: "bad" }, { text: "Traceable jobs", tone: "navy" }] },
    footer: [{ text: "Accepts PDF", icon: "printer" }],
  }],
  list: [bullets, { title: "What you get", items: listOf(6, (i) => ({ title: `Point ${i + 1}`, text: `Detail ${i + 1}`, ...(i === 2 ? { icon: "gate" } : {}) })) }],
  "full-bleed": [statement, { eyebrow: "Ships in", big: "labOS 5.44", sub: "Containerized deployments", icon: "container", chips: [{ text: "Other sites: unchanged" }, { text: "Labels: not included", tone: "neutral" }] }],
  cards: [recap, { items: listOf(4, (i) => ({ title: `Takeaway ${i + 1}`, example: `Example ${i + 1}`, who: "Support" })), footer: { text: "Shipped in 5.44" } }],
  vertical: [pipeline, {
    title: "The whole picture",
    stations: [{ title: "labOS", icon: "cloud", chips: ["Screens"] }, { title: "Print Gateway", icon: "gate", hero: true, code: "POST /print" }, { title: "CUPS server", icon: "queue" }, { title: "Printers", icon: "printer" }],
    links: [{ label: "HTTP" }, { label: "lp", mono: true }, { label: "IPP" }],
    helpers: [{ text: "ippfix (setup aid)", link: 1 }, { text: "Kibana", under: 3 }],
  }],
};

// every variant ---------------------------------------------------------------------------------------

const LAYOUT_PROPERTY = /[{,]"?(left|top|right|bottom|width|height|margin\w*|padding\w*|letterSpacing|fontSize)"?:/;

// Lines that break the motion rules: a reveal that is not a fromTo, a later move (tl.to) of an element no
// fromTo revealed first, or a tween of a layout property.
function motionProblems(js) {
  const revealed = new Set();
  return js.filter((line) => {
    const [, verb, target] = line.match(/^tl\.(\w+)\("([^"]+)"/) ?? [];
    if (verb === "fromTo") revealed.add(target);
    const seekSafe = verb === "fromTo" || (verb === "to" && revealed.has(target));
    return !seekSafe || LAYOUT_PROPERTY.test(line);
  });
}

const firstDuration = (k) => Number(k.js[0].match(/duration:([\d.]+)/)[1]);

for (const [variant, [module, data]] of Object.entries(FULL)) {
  test(`${variant}_motion_revealsWithFromToAndMovesOnlyWhatItRevealed`, () => {
    const { k } = build(module, variant, data);

    assert.deepEqual(motionProblems(k.js), []);
  });

  test(`${variant}_styling_usesThemeVariablesOnly`, () => {
    const { css, html } = build(module, variant, data);

    assert.doesNotMatch(css + html, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  test(`${variant}_livelyMotion_quickensTheRevealsThroughTheKit`, () => {
    const calm = build(module, variant, data).k;

    const lively = build(module, variant, data, narration(), { direction: { motion: "lively" } }).k;

    near(firstDuration(lively), Math.round(firstDuration(calm) * 0.75 * 1000) / 1000);
  });

  test(`${variant}_cueWarnings_noneWhenEveryCueIsSpoken`, () => {
    const { warnings } = build(module, variant, data);

    assert.deepEqual(warnings, []);
  });
}

const MARKUP = "<b>x</b>";
const ESCAPE_DATA = {
  kinetic: [title, { title: MARKUP, subtitle: MARKUP, kicker: [MARKUP] }],
  split: [title, { title: MARKUP, subtitle: MARKUP, kicker: [MARKUP] }],
  stacked: [split, { title: MARKUP, left: { label: MARKUP, items: [{ text: MARKUP }] }, right: { label: MARKUP, items: [{ text: MARKUP }] }, footer: [{ text: MARKUP }] }],
  list: [bullets, { title: MARKUP, items: [{ title: MARKUP, text: MARKUP }, { title: MARKUP }] }],
  "full-bleed": [statement, { eyebrow: MARKUP, big: MARKUP, sub: MARKUP, chips: [{ text: MARKUP }] }],
  cards: [recap, { title: MARKUP, items: [{ title: MARKUP, example: MARKUP, who: MARKUP }, { title: MARKUP, example: MARKUP }], footer: { text: MARKUP } }],
  vertical: [pipeline, { title: MARKUP, stations: [{ title: MARKUP, chips: [MARKUP], code: MARKUP }, { title: MARKUP }], links: [{ label: MARKUP }], helpers: [{ text: MARKUP, link: 0 }] }],
};

for (const [variant, [module, data]] of Object.entries(ESCAPE_DATA)) {
  test(`${variant}_markupInTextFields_isEscaped`, () => {
    const { html } = build(module, variant, data);

    assert.doesNotMatch(html, /<b>/);
  });
}

// title: kinetic --------------------------------------------------------------------------------------

const kineticOf = (kicker, extra = {}, timeline = narration()) => build(title, "kinetic", { title: "Print Gateway", kicker, ...extra }, timeline);
const wordBoxes = (html) => [...html.matchAll(/id="s1-w(\d+)" class="s1-word" style="top:(\d+)px;font-size:(\d+)px"/g)].map((m) => ({ top: Number(m[2]), size: Number(m[3]) }));

test("kinetic_wordBox_spansTheContentWidthBetweenTheMargins", () => {
  const { css } = kineticOf(["Reports"]);

  assert.deepEqual([px(css, "word", "left"), px(css, "word", "left") + px(css, "word", "width")], [SIDE, RIGHT]);
});

test("kinetic_everyWord_staysInsideTheBandAboveTheCaptions", () => {
  const { html } = kineticOf(["Reports", "Forms", "Distribution", "A very long kicker phrase that wraps"]);

  for (const { top, size } of wordBoxes(html)) {
    assert.ok(top >= BAND_TOP);
    assert.ok(top + size * 1.05 <= BAND_BOTTOM);
  }
});

test("kinetic_words_fillTheScreenSizedToTheirLength", () => {
  const sizes = wordBoxes(kineticOf(["Forms", "Distribution", "A very long kicker phrase that wraps"]).html).map((box) => box.size);

  assert.deepEqual(sizes, [260, 200, 110]);
});

test("kinetic_words_appearOneAtATime", () => {
  const { k } = kineticOf(["Reports", "Forms", "Distribution"]);

  const roundingSlack = 0.001; // the kit writes times to the millisecond
  for (const i of [0, 1]) {
    const [, exit] = tweensOf(k, `w${i}`);
    assert.ok(endOf(exit) <= startOf(k, `w${i + 1}`) + roundingSlack);
  }
});

test("kinetic_everyWord_isFullyInBeforeItLeaves", () => {
  const { k } = kineticOf([{ text: "a", at: "w2" }, { text: "b", at: "w3" }, { text: "c", at: "w4" }]);

  for (const i of [0, 1, 2]) {
    const [entrance, exit] = tweensOf(k, `w${i}`);
    assert.ok(endOf(entrance) <= exit.start);
  }
});

test("kinetic_lastWord_collapsesIntoTheLockupAsItAppears", () => {
  const { k } = kineticOf([{ text: "Reports", at: "w2" }, { text: "Forms", at: "w4" }], { lockup_at: "w12" });

  const [, collapse] = tweensOf(k, "w1");

  near(endOf(collapse), startOf(k, "t1"));
  assert.equal(startOf(k, "t1"), 6.6);
});

test("kinetic_kickerWithWordCue_landsOnThatSpokenWord", () => {
  const { k } = kineticOf([{ text: "Reports", at: "w6" }]);

  assert.equal(startOf(k, "w0"), 3.6);
});

test("kinetic_wordsCuedTooClose_areSpacedSoEachCanBeRead", () => {
  const { k } = kineticOf([{ text: "a", at: "w2" }, { text: "b", at: "w3" }, { text: "c", at: "w4" }]);

  assert.deepEqual([0, 1, 2].map((i) => startOf(k, `w${i}`)), [1.6, 2.4, 3.2]);
});

test("kinetic_lockupCuedBeforeTheWordsHavePlayed_waitsForThem", () => {
  const { k } = kineticOf([{ text: "a", at: "w2" }], { lockup_at: "w1" });

  near(startOf(k, "t1"), 1.6 + 0.95);
});

test("kinetic_withoutKickers_showsOnlyTheLockup", () => {
  const { k, html } = kineticOf([]);

  assert.doesNotMatch(html, /s1-w0/);
  assert.equal(startOf(k, "t1"), 0.5);
});

// title: split ----------------------------------------------------------------------------------------

const titleSplitOf = (extra, timeline = narration()) => build(title, "split", { title: "Print Gateway", ...extra }, timeline);

test("titleSplit_lockupAndPanel_sitSideBySideBetweenTheMargins", () => {
  const { css } = titleSplitOf({ kicker: ["Reports"], subtitle: "Sub" });

  const lockupRight = px(css, "side", "left") + px(css, "side", "width");
  const panelLeft = px(css, "pn", "left");

  assert.equal(px(css, "side", "left"), SIDE);
  assert.ok(lockupRight < panelLeft);
  assert.equal(panelLeft + px(css, "pn", "width"), RIGHT);
});

test("titleSplit_panel_isCenteredInTheBandAboveTheCaptions", () => {
  const { css } = titleSplitOf({ subtitle: "Sub" });

  const top = px(css, "pn", "top");
  const bottom = top + px(css, "pn", "height");

  assert.ok(top >= BAND_TOP && bottom <= BAND_BOTTOM);
  assert.ok(Math.abs(top - BAND_TOP - (BAND_BOTTOM - bottom)) <= 1);
});

test("titleSplit_panel_growsInBeforeItsFirstKicker", () => {
  const { k } = titleSplitOf({ kicker: [{ text: "Reports", at: "w4" }] });

  assert.ok(startOf(k, "pn") <= startOf(k, "k0") - 0.4);
});

test("titleSplit_kickerCuedRightAway_stillFindsThePanelIn", () => {
  const { k } = titleSplitOf({ kicker: [{ text: "Reports", at: "w0" }] }, narration());

  assert.ok(startOf(k, "pn") < startOf(k, "k0"));
});

test("titleSplit_kickersAndLockup_landOnTheirSpokenWords", () => {
  const { k } = titleSplitOf({ kicker: [{ text: "Reports", at: "w5" }], lockup_at: "w8" });

  assert.deepEqual([startOf(k, "k0"), startOf(k, "t1")], [3.1, 4.6]);
});

test("titleSplit_subtitleAlone_fillsThePanelInLargerType", () => {
  const { css, html } = titleSplitOf({ subtitle: "Printing for the container era" });

  assert.match(cssRule(css, "sub"), /font:400 44px/);
  assert.doesNotMatch(html, /s1-k0/);
});

test("titleSplit_subtitleBelowKickers_isSmaller", () => {
  const { css } = titleSplitOf({ kicker: ["Reports"], subtitle: "Sub" });

  assert.match(cssRule(css, "sub"), /font:400 32px/);
});

test("titleSplit_neitherKickerNorSubtitle_drawsNoPanel", () => {
  const { k, html } = titleSplitOf({});

  assert.doesNotMatch(html, /s1-pn/);
  assert.equal(tweensOf(k, "pn").length, 0);
});

test("titleSplit_template_optsOutOfTheChrome", () => {
  assert.equal(titleSplitOf({ subtitle: "Sub" }).result.chrome, false);
});

// split: stacked --------------------------------------------------------------------------------------

const sideOf = (count, extra = {}) => ({ label: "Side", items: listOf(count, (i) => ({ text: `item ${i}` })), ...extra });
const stackedOf = (extra = {}) => build(split, "stacked", { left: sideOf(3), right: sideOf(3), ...extra });

// Top and bottom of the stacked block, and where the divider sits, as the markup places them.
function stackedBlock({ css, html }) {
  const [top, bottomLabel] = [...html.matchAll(/class="s1-wl" style="top:(\d+)px/g)].map((m) => Number(m[1]));
  const rowTops = [...html.matchAll(/class="s1-wing" style="top:(\d+)px/g)].map((m) => Number(m[1]));
  const itemH = px(css, "item", "height");
  return { top, bottomLabel, topRowBottom: rowTops[0] + itemH, bottom: rowTops[1] + itemH, divider: px(css, "div", "top") };
}

test("stacked_block_isCenteredInTheBand", () => {
  const block = stackedBlock(stackedOf());

  assert.ok(block.top >= BAND_TOP && block.bottom <= BAND_BOTTOM);
  assert.ok(Math.abs(block.top - BAND_TOP - (BAND_BOTTOM - block.bottom)) <= 1);
});

test("stacked_withHeadlineAndFooter_fitsBetweenThemAboveTheFooterRow", () => {
  const block = stackedBlock(stackedOf({ title: "Head", footer: [{ text: "foot" }] }));

  assert.ok(block.top >= BAND_TOP_WITH_TITLE);
  assert.ok(block.bottom <= FOOT_TOP - 40);
});

test("stacked_divider_isAHorizontalRuleMidwayBetweenTheTwoRows", () => {
  const scene = stackedOf();
  const block = stackedBlock(scene);

  assert.deepEqual([px(scene.css, "div", "left"), px(scene.css, "div", "width"), px(scene.css, "div", "height")], [SIDE, 1728, 2]);
  assert.ok(Math.abs(block.divider + 1 - block.topRowBottom - (block.bottomLabel - block.divider - 1)) <= 1);
});

test("stacked_rows_spanTheContentWidthBetweenTheMargins", () => {
  const { css } = stackedOf();

  assert.deepEqual([px(css, "wing", "left"), px(css, "wing", "width")], [SIDE, 1728]);
});

test("stacked_divider_drawsAcrossInsteadOfDown", () => {
  const { k } = stackedOf();

  assert.match(k.js.find((line) => line.includes('"#s1-div"')), /\{scaleX:0\}/);
});

test("stacked_topRow_dropsInFromAboveAndTheBottomRowRisesFromBelow", () => {
  const { k } = stackedOf();

  const entranceOf = (name) => k.js.find((line) => line.includes(`"#s1-${name}"`));

  assert.match(entranceOf("l0"), /\{opacity:0,y:-24\}/);
  assert.match(entranceOf("r0"), /\{opacity:0,y:24\}/);
});

test("stacked_itemCues_landInReadingOrder", () => {
  const { k } = build(split, "stacked", { left: { label: "Before", items: [{ text: "a", at: "w3" }] }, right: { label: "After", items: [{ text: "b", at: "w7" }] } });

  assert.deepEqual([startOf(k, "l0"), startOf(k, "r0")], [2.1, 4.1]);
});

test("stacked_badItems_clickOnceOnTheFirst", () => {
  const right = { label: "After", items: [{ text: "a", tone: "bad", at: "w3" }, { text: "b", tone: "bad", at: "w5" }] };

  const { k } = build(split, "stacked", { left: sideOf(1), right });

  assert.deepEqual(k.sfx.map((x) => [x.sound, x.t]), [["click", 2.1]]);
});

// bullets: list ---------------------------------------------------------------------------------------

const listOfItems = (count, extra = {}) => build(bullets, "list", { items: listOf(count, (i) => ({ title: `t${i}`, text: `x${i}` })), ...extra });

function listBlock(css, count) {
  const top = px(css, "list", "top");
  return { top, bottom: top + count * px(css, "lr", "height") + (count - 1) * px(css, "list", "gap") };
}

for (const count of [2, 3, 4, 5, 6]) {
  test(`list_${count}Items_withHeadline_isCenteredBelowItAboveTheCaptions`, () => {
    const { top, bottom } = listBlock(listOfItems(count, { title: "Head" }).css, count);

    assert.ok(top >= BAND_TOP_WITH_TITLE && bottom <= BAND_BOTTOM);
    assert.ok(Math.abs(top - BAND_TOP_WITH_TITLE - (BAND_BOTTOM - bottom)) <= 1);
  });
}

test("list_rows_spanTheContentWidthBetweenTheMargins", () => {
  const { css } = listOfItems(3);

  assert.deepEqual([px(css, "list", "left"), px(css, "list", "width")], [SIDE, 1728]);
});

test("list_fewerItems_getLargerRowsAndNumerals", () => {
  const sizes = [2, 6].map((count) => px(listOfItems(count).css, "lr", "height"));

  assert.ok(sizes[0] > sizes[1]);
});

test("list_itemsWithoutIcons_showTwoDigitNumeralsInOrder", () => {
  const { html } = listOfItems(3);

  assert.deepEqual([...html.matchAll(/id="s1-m\d" class="s1-mk">(\d+)</g)].map((m) => m[1]), ["01", "02", "03"]);
});

test("list_itemWithIcon_showsTheIconInsteadOfItsNumeral", () => {
  const { html } = build(bullets, "list", { items: [{ title: "a" }, { title: "b", icon: "gate" }] });

  assert.match(html, /id="s1-m1" class="s1-mk"><svg/);
});

test("list_rowWithWordCue_slidesInOnThatWordAndItsNumeralPopsJustAfter", () => {
  const { k } = build(bullets, "list", { items: [{ title: "a", at: "w4" }, { title: "b" }] });

  assert.equal(startOf(k, "r0"), 2.6);
  near(startOf(k, "m0"), 2.75);
});

test("list_noItems_buildsWithoutRows", () => {
  const { html, result } = listOfItems(0);

  assert.doesNotMatch(html, /s1-r0/);
  assert.equal(result.chrome, true);
});

// statement: full-bleed -------------------------------------------------------------------------------

const fullBleedOf = (extra = {}) => build(statement, "full-bleed", { big: "labOS 5.44", ...extra });

test("fullBleed_band_spansTheFrameWidthBetweenTheChromeAndTheCaptions", () => {
  const { css } = fullBleedOf();

  const top = px(css, "band", "top");

  assert.match(cssRule(css, "band"), /(?:^|;)left:0;/);
  assert.equal(px(css, "band", "width"), 1920);
  assert.ok(top >= CHROME_BOTTOM && top + px(css, "band", "height") < CAPTION_TOP);
});

test("fullBleed_text_staysInsideTheMarginsOverTheBand", () => {
  const { css } = fullBleedOf();

  assert.deepEqual([px(css, "fb", "left"), px(css, "fb", "width"), px(css, "fb", "top"), px(css, "fb", "height")], [SIDE, 1728, px(css, "band", "top"), px(css, "band", "height")]);
});

test("fullBleed_textOnTheBand_usesTheOnAccentColorOnTheAccentTextFill", () => {
  const { css } = fullBleedOf({ eyebrow: "E", sub: "S" });

  assert.match(cssRule(css, "band"), /background:var\(--accent-text\)/);
  for (const rule of ["fe", "bt", "bs"]) assert.match(cssRule(css, rule), /color:var\(--on-accent\)/);
});

test("fullBleed_chips_sitOnSurfacePillsSoTheirColorsStayReadable", () => {
  const { css, html } = fullBleedOf({ chips: [{ text: "Unchanged" }] });

  assert.match(cssRule(css, "cb"), /background:var\(--surface\)/);
  assert.match(html, /<span id="s1-c0" class="s1-cb"><span class="s1-chip /);
});

test("fullBleed_chipCuedBeforeTheBandIsIn_waitsForIt", () => {
  const { k } = fullBleedOf({ at: "w4", chips: [{ text: "Unchanged", at: "w1" }] });

  near(startOf(k, "c0"), 2.6 + 0.7);
});

test("fullBleed_bandAndStatement_landOnTheCue", () => {
  const { k } = fullBleedOf({ at: "w4" });

  assert.deepEqual([startOf(k, "band"), startOf(k, "bt")], [2.6, 2.95]);
});

test("fullBleed_bigText_shrinksAsItGetsLonger", () => {
  const sizes = ["OK", "labOS 5.44", "Twenty characters!!", "A statement thirty chars long"].map((big) => Number(cssRule(fullBleedOf({ big }).css, "bt").match(/font:900 (\d+)px/)[1]));

  assert.deepEqual(sizes, [220, 170, 128, 100]);
});

// recap: cards ----------------------------------------------------------------------------------------

const cardsOf = (count, extra = {}) => build(recap, "cards", { items: listOf(count, (i) => ({ title: `T${i}`, example: `E${i}` })), ...extra });

function cardRow({ css, html }) {
  const lefts = [...html.matchAll(/id="s1-r\d" class="s1-cd" style="left:(\d+)px"/g)].map((m) => Number(m[1]));
  const top = px(css, "cd", "top");
  const footTop = px(css, "ft", "top");
  return { lefts, width: px(css, "cd", "width"), top, bottom: html.includes('id="s1-ft"') ? footTop + 62 : top + px(css, "cd", "height") };
}

for (const count of [2, 3, 4]) {
  test(`cards_${count}ItemsWithFooter_fillTheContentWidthBelowTheHeadline`, () => {
    const row = cardRow(cardsOf(count, { footer: { text: "Foot" } }));

    assert.equal(row.lefts[0], SIDE);
    assert.ok(row.lefts[count - 1] + row.width <= RIGHT && row.lefts[count - 1] + row.width > RIGHT - count);
    assert.ok(row.top >= BAND_TOP_WITH_TITLE && row.bottom <= BAND_BOTTOM);
    assert.ok(Math.abs(row.top - BAND_TOP_WITH_TITLE - (BAND_BOTTOM - row.bottom)) <= 1);
  });
}

test("cards_eachCard_holdsItsOwnExample", () => {
  const { html } = cardsOf(3);

  const cards = html.split('<div id="s1-r').slice(1);

  cards.forEach((card, i) => assert.ok(card.includes(`id="s1-x${i}"`) && !card.includes(`id="s1-x${i + 1}"`)));
});

test("cards_whoChip_sitsAtTheFootOfItsCard", () => {
  const { html } = build(recap, "cards", { items: [{ title: "T", example: "E", who: "Support" }, { title: "U", example: "F" }] });

  assert.match(html, /<span class="s1-chip s1-t-navy" style="margin-top:auto">/);
});

test("cards_cardAndExample_landOnTheirSpokenWords", () => {
  const { k } = build(recap, "cards", { items: [{ title: "T", example: "E", at: "w4", example_at: "w6" }, { title: "U", example: "F" }] });

  assert.deepEqual([startOf(k, "r0"), startOf(k, "x0")], [2.6, 3.6]);
  near(startOf(k, "b0"), 2.75);
});

test("cards_withoutTitle_useTheDefaultHeadline", () => {
  assert.match(cardsOf(2).html, /id="s1-h" class="s1-h2">What to remember</);
});

// pipeline: vertical ----------------------------------------------------------------------------------

const verticalOf = (count, extra = {}) =>
  build(pipeline, "vertical", { title: "Head", stations: listOf(count, (i) => ({ title: `S${i}` })), links: listOf(count - 1, (i) => ({ label: `L${i}` })), ...extra });

function stationColumn({ css, html }) {
  const tops = [...html.matchAll(/id="s1-s\d" class="s1-vs[^"]*" style="top:(\d+)px"/g)].map((m) => Number(m[1]));
  const height = px(css, "vs", "height");
  return { tops, height, left: px(css, "vs", "left"), right: px(css, "vs", "left") + px(css, "vs", "width") };
}

for (const count of [2, 3, 4, 5]) {
  test(`vertical_${count}Stations_areCenteredBelowTheHeadlineAboveTheCaptions`, () => {
    const { tops, height } = stationColumn(verticalOf(count));

    const bottom = tops[count - 1] + height;

    assert.ok(tops[0] >= BAND_TOP_WITH_TITLE && bottom <= BAND_BOTTOM);
    assert.ok(Math.abs(tops[0] - BAND_TOP_WITH_TITLE - (BAND_BOTTOM - bottom)) <= 1);
  });

  test(`vertical_${count}Stations_eachLinkRunsFromOneStationToTheNext`, () => {
    const scene = verticalOf(count);
    const { tops, height } = stationColumn(scene);

    const links = [...scene.html.matchAll(/id="s1-l(\d)" class="s1-vln" style="top:(\d+)px"/g)].map((m) => [Number(m[1]), Number(m[2])]);

    assert.equal(links.length, count - 1);
    for (const [i, top] of links) assert.deepEqual([top, top + px(scene.css, "vln", "height")], [tops[i - 1] + height, tops[i]]);
  });
}

test("vertical_stationsAndHelpers_stayInsideTheMargins", () => {
  const scene = verticalOf(3, { helpers: [{ text: "Side", link: 0 }] });

  const helperLeft = px(scene.css, "vhp", "left");

  assert.ok(stationColumn(scene).left >= SIDE && stationColumn(scene).right < helperLeft);
  assert.equal(helperLeft + px(scene.css, "vhp", "width"), RIGHT);
});

test("vertical_linkLabels_sitLeftOfTheLaneInsideTheMargin", () => {
  const { css } = verticalOf(3);

  const labelsRight = 1920 - px(css, "vlk", "right");
  const lane = px(css, "vln", "left") + 2;

  assert.ok(labelsRight < lane && labelsRight - SIDE >= 300);
});

test("vertical_packet_travelsDownTheLaneOneStationAtATime", () => {
  const scene = verticalOf(4);
  const { tops } = stationColumn(scene);

  const legs = scene.k.js.filter((line) => line.startsWith('tl.to("#s1-pk"')).map((line) => Number(line.match(/"y":(\d+)/)[1]));
  const packetLeft = Number(scene.html.match(/id="s1-pk" class="s1-pk" style="left:(\d+)px/)[1]);

  assert.deepEqual(legs, tops.slice(1).map((top) => top - tops[0]));
  assert.equal(packetLeft + 13, px(scene.css, "vln", "left") + 2);
});

test("vertical_linkHelper_isJoinedByADashedLineFromTheLaneToTheHelperColumn", () => {
  const scene = verticalOf(3, { helpers: [{ text: "Side", link: 1 }] });

  const lineRight = px(scene.css, "vhl", "left") + px(scene.css, "vhl", "width");

  assert.equal(lineRight, px(scene.css, "vhp", "left"));
  assert.match(cssRule(scene.css, "vhl"), /border-top:3px dashed var\(--light\)/);
});

test("vertical_withoutHelpers_centersTheStationsFurtherRight", () => {
  const alone = stationColumn(verticalOf(3)).left;

  const withHelpers = stationColumn(verticalOf(3, { helpers: [{ text: "Side", under: 0 }] })).left;

  assert.ok(alone > withHelpers);
});

test("vertical_stationWithWordCue_growsOnThatWordAfterItsLinkDraws", () => {
  const { k } = verticalOf(2, { stations: [{ title: "A" }, { title: "B", at: "w4" }] });

  assert.equal(startOf(k, "s1"), 2.6);
  near(startOf(k, "l1"), 2.15);
});

test("vertical_packetFalse_drawsNoPacket", () => {
  const { html } = verticalOf(3, { packet: false });

  assert.doesNotMatch(html, /s1-pk/);
});
