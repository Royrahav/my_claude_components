// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// Split and bullets layout: what the templates emit must stay inside the free band (96 px side margins,
// below the chrome / headline, above the captions at y=900).
import { test } from "node:test";
import assert from "node:assert/strict";
import split from "../lib/scenes/split.mjs";
import bullets from "../lib/scenes/bullets.mjs";
import { buildScene, px, sceneTimeline } from "./helpers.mjs";

const timeline = sceneTimeline({ duration: 20, speechEnd: 15 });
const SIDE = 96;
const CAPTION_TOP = 880;
const BAND_TOP = 150;
const BAND_TOP_WITH_TITLE = 240;
const FOOT_TOP = 760;

const items = (n) => Array.from({ length: n }, (_, i) => ({ text: `item ${i}` }));
const splitOf = (rows, extra = {}) => buildScene(split, { left: { label: "Old", items: items(rows) }, right: { label: "New", items: items(rows) }, ...extra }, timeline);

function splitBlock(css, rows) {
  const top = px(css, "wl", "top");
  const wingTop = px(css, "wing", "top");
  const gap = px(css, "wing", "gap");
  const itemH = px(css, "item", "min-height");
  return { top, wingTop, gap, itemH, bottom: wingTop + rows * itemH + (rows - 1) * gap, dividerH: px(css, "div", "height"), dividerTop: px(css, "div", "top") };
}

for (const rows of [1, 2, 3, 4, 5]) {
  test(`split_${rows}RowsPerSide_blockStaysInsideTheBandAboveTheCaptions`, () => {
    const { css } = splitOf(rows);

    const b = splitBlock(css, rows);

    assert.ok(b.top >= BAND_TOP);
    assert.ok(b.bottom <= 860);
    assert.ok(b.bottom < CAPTION_TOP);
  });

  test(`split_${rows}RowsPerSide_blockIsVerticallyCenteredInTheBand`, () => {
    const { css } = splitOf(rows);

    const b = splitBlock(css, rows);

    assert.ok(Math.abs(b.top - BAND_TOP - (860 - b.bottom)) <= 1);
  });

  test(`split_${rows}RowsPerSide_dividerSpansExactlyTheBlock`, () => {
    const { css } = splitOf(rows);

    const b = splitBlock(css, rows);

    assert.deepEqual([b.dividerTop, b.dividerH], [b.top, b.bottom - b.top]);
  });
}

test("split_sparseWings_scaleUpWhileDenseWingsStayAtBaseSize", () => {
  const heights = [1, 2, 3, 4].map((rows) => px(splitOf(rows).css, "item", "min-height"));

  assert.deepEqual(heights, [96, 96, 85, 74]);
});

test("split_wingsStayInsideThe96pxSideMargins", () => {
  const { css } = splitOf(2);

  const width = px(css, "wing", "width");

  assert.equal(SIDE + width <= 1920 / 2, true);
  assert.equal(1024 + width, 1920 - SIDE);
});

test("split_withHeadline_blockStartsBelowTheHeadline", () => {
  const { css } = splitOf(2, { title: "Headline" });

  assert.ok(splitBlock(css, 2).top >= BAND_TOP_WITH_TITLE);
});

test("split_withFooter_blockEndsAboveTheFooterRow", () => {
  const { css } = splitOf(3, { footer: [{ text: "foot" }] });

  assert.ok(splitBlock(css, 3).bottom <= FOOT_TOP - 40);
});

test("split_withFooter_footerRowKeepsItsFixedPosition", () => {
  const { css } = splitOf(1, { footer: [{ text: "foot" }] });

  assert.equal(px(css, "frow", "top"), FOOT_TOP);
});

test("split_unevenWings_blockIsSizedByTheLongerSide", () => {
  const { css } = buildScene(split, { left: { items: items(1) }, right: { items: items(3) } }, timeline);

  assert.equal(px(css, "item", "min-height"), 85);
});

test("split_noItemsAtAll_stillBuildsASingleRowBlock", () => {
  const { css, result } = buildScene(split, {}, timeline);

  assert.deepEqual([px(css, "item", "min-height"), result.chrome], [96, true]);
});

// bullets -------------------------------------------------------------------------------------------

const bulletsOf = (n, extra = {}) =>
  buildScene(bullets, { items: Array.from({ length: n }, (_, i) => ({ title: `t${i}`, text: `x${i}` })), ...extra }, timeline);

function cardBoxes({ css, html }) {
  const w = px(css, "bc", "width");
  const h = px(css, "bc", "height");
  const boxes = [...html.matchAll(/id="s1-b\d+"[^>]*style="left:(\d+)px;top:(\d+)px"/g)].map((m) => ({ left: Number(m[1]), top: Number(m[2]), w, h }));
  return { boxes, w, h };
}

for (const n of [1, 2, 3, 4, 5, 6]) {
  test(`bullets_${n}Cards_allInsideThe96pxSideMargins`, () => {
    const { boxes } = cardBoxes(bulletsOf(n));

    assert.equal(Math.min(...boxes.map((b) => b.left)), SIDE);
    assert.ok(Math.max(...boxes.map((b) => b.left + b.w)) <= 1920 - SIDE);
  });

  test(`bullets_${n}Cards_gridIsVerticallyCenteredInTheBand`, () => {
    const { boxes } = cardBoxes(bulletsOf(n));

    const top = Math.min(...boxes.map((b) => b.top));
    const bottom = Math.max(...boxes.map((b) => b.top + b.h));
    assert.ok(Math.abs(top - BAND_TOP - (860 - bottom)) <= 1);
    assert.ok(bottom <= 860);
  });

  test(`bullets_${n}Cards_withHeadline_gridStartsBelowTheHeadline`, () => {
    const { boxes } = cardBoxes(bulletsOf(n, { title: "Head" }));

    assert.ok(Math.min(...boxes.map((b) => b.top)) >= BAND_TOP_WITH_TITLE);
  });
}

test("bullets_singleRow_cardsAreScaledUp", () => {
  const heights = [2, 3].map((n) => cardBoxes(bulletsOf(n)).h);

  assert.deepEqual(heights, [375, 375]);
});

test("bullets_twoRows_cardsKeepBaseHeight", () => {
  const heights = [4, 5, 6].map((n) => cardBoxes(bulletsOf(n)).h);

  assert.deepEqual(heights, [260, 260, 260]);
});

test("bullets_cards_centerTheirContentWithEqualHeights", () => {
  const { css, html } = bulletsOf(5);

  assert.match(css, /\.s1-bc\{[^}]*justify-content:center/);
  assert.equal(new Set(cardBoxes({ css, html }).boxes.map((b) => b.h)).size, 1);
});

test("bullets_fiveCards_fillRowsOfThreeThenTwo", () => {
  const { boxes } = cardBoxes(bulletsOf(5));

  assert.deepEqual([...new Set(boxes.map((b) => b.top))].length, 2);
  assert.equal(boxes.filter((b) => b.top === boxes[0].top).length, 3);
});

test("bullets_noItems_buildsWithoutCards", () => {
  const { html, result } = bulletsOf(0);

  assert.doesNotMatch(html, /s1-b0/);
  assert.equal(result.chrome, true);
});
