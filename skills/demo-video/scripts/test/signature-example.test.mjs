// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The worked signature-scene example (assets/examples/signature-sheet.mjs): it stays inside the free band,
// reshapes the sheet by transforms on its cues, and styles with theme variables only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import signatureSheet from "../../assets/examples/signature-sheet.mjs";
import { buildScene, sceneTimeline, tweensOf } from "./helpers.mjs";

const SIDE = 96;
const BAND_TOP_WITH_TITLE = 240;
const BAND_BOTTOM = 860;

const SAY = "Today every label prints on A4. Now each printer can switch to Letter instead, set per queue.";
const narration = () => {
  const words = SAY.split(/\s+/).map((text, i) => ({ text, start: 0.6 + i * 0.4, end: 0.9 + i * 0.4 }));
  return sceneTimeline({ duration: 12, words });
};
const spokenAt = (word) => 0.6 + SAY.split(/\s+/).findIndex((w) => w.replace(/\W/g, "") === word) * 0.4;

const A4 = { name: "A4", width: 210, height: 297, at: "A4" };
const LETTER = { name: "Letter", width: 216, height: 279, at: "Letter" };
const DATA = { title: "One setting per printer", unit: "mm", sizes: [A4, LETTER], note: { text: "Set per queue", at: "queue" } };
const sheetOf = (data = DATA) => buildScene(signatureSheet, data, narration());

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} !~ ${expected}`);
const inlineBox = (html, id) => {
  const style = html.match(new RegExp(`id="s1-${id}"[^>]*style="([^"]*)"`))[1];
  const value = (prop) => Number(style.match(new RegExp(`(?:^|;)${prop}:(-?[\\d.]+)px`))?.[1]);
  return { left: value("left"), top: value("top"), width: value("width"), height: value("height") };
};
const toLine = (k, name) => k.js.find((line) => line.startsWith(`tl.to("#s1-${name}"`));

test("signatureSheet_documentedData_buildsWithEveryCueResolved", () => {
  const { warnings, html } = sheetOf();

  assert.deepEqual(warnings, []);
  assert.ok(html.includes(">A4<") && html.includes(">Letter<"));
});

test("signatureSheet_sheetLabelsAndNote_stayInsideTheBandBetweenTheMargins", () => {
  const { html } = sheetOf();

  const sheet = inlineBox(html, "sheet");
  const heightLabel = inlineBox(html, "hl1");
  const note = inlineBox(html, "note");

  assert.ok(sheet.left >= SIDE && sheet.top >= BAND_TOP_WITH_TITLE);
  assert.ok(heightLabel.left + 260 <= 1920 - SIDE);
  assert.ok(note.top + 48 <= BAND_BOTTOM);
});

// A percentage padding resolves against the 1920px canvas and would widen the sheet past its size.
test("signatureSheet_sheetPadding_isSizedFromTheSheetInPixels", () => {
  const { css, html } = sheetOf();

  const style = html.match(/id="s1-sheet"[^>]*style="([^"]*)"/)[1];

  assert.match(style, /;padding:[\d.]+px [\d.]+px$/);
  assert.doesNotMatch(css, /padding:[^;}]*%/);
});

test("signatureSheet_reshape_landsOnTheNextSizesSpokenWord", () => {
  const { k } = sheetOf();

  const [, reshape] = tweensOf(k, "sheet");

  near(reshape.start, spokenAt("Letter"));
});

test("signatureSheet_reshape_scalesTheSheetByTheSizeRatioWithTransformsOnly", () => {
  const { k } = sheetOf();

  assert.match(toLine(k, "sheet"), /\{"scaleX":1\.0286,"scaleY":0\.9394\}/);
});

test("signatureSheet_dimensionLines_followTheReshapedEdges", () => {
  const { k, html } = sheetOf();

  const sheet = inlineBox(html, "sheet");
  const shift = ((279 - 297) * (sheet.height / 297)) / 2;

  const widthLineY = Number(toLine(k, "dw").match(/"y":(-?[\d.]+)/)[1]);
  assert.ok(Math.abs(widthLineY - shift) <= 0.1);
});

test("signatureSheet_firstSize_countsItsDimensionsUpFromZero", () => {
  const { k, html } = sheetOf();

  const counts = k.js.filter((line) => line.startsWith("(function(){")).map((line) => Number(line.match(/\{v:(\d+),duration/)[1]));

  assert.deepEqual(counts, [210, 297]);
  assert.match(html, /<span id="s1-wv0">0<\/span>/);
});

test("signatureSheet_motion_revealsWithFromToAndNeverTweensLayout", () => {
  const { k } = sheetOf();

  const tweens = k.js.filter((line) => line.startsWith("tl."));

  assert.ok(tweens.every((line) => /^tl\.(fromTo|to)\(/.test(line)));
  assert.ok(tweens.every((line) => !/[{,]"?(left|top|width|height)"?:/.test(line)));
});

test("signatureSheet_styling_usesThemeVariablesOnly", () => {
  const { css, html } = sheetOf();

  assert.doesNotMatch(css + html, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

test("signatureSheet_note_risesOnItsCueAfterTheReshape", () => {
  const { k } = sheetOf();

  near(tweensOf(k, "note")[0].start, spokenAt("queue"));
});

// The scene documented in references/custom-scene.md, with synthetic word timing over its narration.
test("signatureSheet_documentedExample_buildsWithEveryCueResolved", () => {
  const doc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "references", "custom-scene.md"), "utf8");
  const scene = JSON.parse(doc.split("### Worked example")[1].match(/```json\r?\n([\s\S]*?)\r?\n```/)[1]);
  const words = scene.say.split(/\s+/).map((text, i) => ({ text, start: 0.6 + i * 0.4, end: 0.9 + i * 0.4 }));

  const { warnings, html } = buildScene(signatureSheet, scene.data, sceneTimeline({ duration: 12, words }));

  assert.deepEqual(warnings, []);
  for (const size of scene.data.sizes) assert.ok(html.includes(`>${size.name}<`));
});

test("signatureSheet_noSizes_buildsOnlyTheHeadline", () => {
  const { html, result } = sheetOf({ title: "Head", sizes: [] });

  assert.doesNotMatch(html, /s1-sheet/);
  assert.equal(result.chrome, true);
});
