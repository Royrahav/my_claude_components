// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
import { test } from "node:test";
import assert from "node:assert/strict";
import decision from "../lib/scenes/decision.mjs";
import { ICONS } from "../lib/kit.mjs";
import { buildScene, px, sceneTimeline } from "./helpers.mjs";

const timeline = sceneTimeline({ duration: 20, speechEnd: 15 });
const withDetail = (detail) => ({
  question: "Q?",
  yes: [{ text: "node" }],
  detail: { title: "Contract", sections: [{ rows: [{ code: "a=1" }] }], ...detail },
});

// The arrow label is the only element rendered with an inline `position:static`.
const ARROW_LABEL = /<span class="s1-lbl" style="position:static">([^<]*)<\/span>/;

test("decision_withoutArrowLabel_rendersNoLabelOnTheArrow", () => {
  const { html } = buildScene(decision, withDetail({}), timeline);

  assert.doesNotMatch(html, ARROW_LABEL);
});

test("decision_withoutArrowLabel_neverShowsTheOldDefaultUpload", () => {
  const { html } = buildScene(decision, withDetail({}), timeline);

  assert.doesNotMatch(html, /upload/i);
});

test("decision_withArrowLabel_rendersThatLabelOnTheArrow", () => {
  const { html } = buildScene(decision, withDetail({ arrow_label: "send" }), timeline);

  assert.equal(html.match(ARROW_LABEL)?.[1], "send");
});

test("decision_withEmptyArrowLabel_rendersNoLabel", () => {
  const { html } = buildScene(decision, withDetail({ arrow_label: "" }), timeline);

  assert.doesNotMatch(html, ARROW_LABEL);
});

test("decision_arrowLabelWithMarkup_isEscaped", () => {
  const { html } = buildScene(decision, withDetail({ arrow_label: "<b>x</b>" }), timeline);

  assert.equal(html.match(ARROW_LABEL)?.[1], "&lt;b&gt;x&lt;/b&gt;");
});

test("decision_withoutDetail_rendersNoArrowAtAll", () => {
  const { html } = buildScene(decision, { question: "Q?", yes: [{ text: "node" }] }, timeline);

  assert.doesNotMatch(html, /s1-up/);
});

test("decision_withDetail_alwaysDrawsTheArrowIcon", () => {
  const { html } = buildScene(decision, withDetail({}), timeline);

  assert.match(html, /id="s1-upi"/);
});

// The y of the yes line, of the arrow icon's middle and of the detail card band's middle.
function centersOf({ css, html }) {
  const arrowSize = Number(html.match(/id="s1-upi"[^>]*width:(\d+)px/)[1]);
  return {
    line: px(css, "yl", "top") + px(css, "yl", "height") / 2,
    arrow: 1080 - px(css, "up", "bottom") - arrowSize / 2,
    card: px(css, "detw", "top") + px(css, "detw", "min-height") / 2,
  };
}

test("decision_arrowAndDetailCard_areCenteredOnTheYesLine", () => {
  const centers = centersOf(buildScene(decision, withDetail({}), timeline));

  assert.deepEqual([centers.arrow, centers.card], [centers.line, centers.line]);
});

test("decision_detailCardBand_startsAtTheTopOfTheContentBand", () => {
  const { css } = buildScene(decision, withDetail({}), timeline);

  assert.equal(px(css, "detw", "top"), 150);
});

// The icon at the start of the no box ({ name, color }), or null when it shows none.
function noBoxIcon(tone) {
  const { html } = buildScene(decision, { question: "Q?", yes: [{ text: "node" }], no: { text: "Old path", tone } }, timeline);
  const svg = html.match(/<div id="s1-no" class="s1-no">(<svg[^>]*>.*?<\/svg>)?<span class="s1-not">/)[1];
  if (!svg) return null;
  return { name: Object.keys(ICONS).find((name) => svg.includes(`>${ICONS[name]}</svg>`)), color: svg.match(/stroke:([^;"]+)/)[1] };
}

test("decision_noWithBadTone_showsACrossInTheDangerColor", () => {
  assert.deepEqual(noBoxIcon("bad"), { name: "cross", color: "var(--danger)" });
});

test("decision_noWithGoodTone_showsACheckInTheAccentColor", () => {
  assert.deepEqual(noBoxIcon("good"), { name: "check", color: "var(--accent)" });
});

for (const tone of [undefined, "neutral", "accent"]) {
  test(`decision_noWithTone_${tone}_showsNoIcon`, () => {
    assert.equal(noBoxIcon(tone), null);
  });
}
