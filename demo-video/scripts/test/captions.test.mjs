// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// Caption timing: when each group leaves the screen, in the group data and in the script the captions
// composition runs (played here against recording stand-ins for the DOM and GSAP).
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { captionGroups, captionsHtml } from "../lib/captions.mjs";
import { FADE_OUT } from "../lib/scenes/close.mjs";
import { contrast, loadTheme, mix } from "../lib/theme.mjs";

const HOLD = 0.7;
const THEMES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "themes");
const builtInTheme = (name) => loadTheme(join(THEMES_DIR, name, "theme.json"));
const THEME = builtInTheme("labos");
const STYLES = ["pill", "lower", "minimal"];

// words: [text, start, end] in scene time.
const scene = (type, start, duration, words) => ({ id: `${type}-${start}`, type, start, duration, words: words.map(([text, s, e]) => ({ text, start: s, end: e })) });
const timeline = (...scenes) => ({ total: Math.max(...scenes.map((s) => s.start + s.duration)), scenes });
const ends = (tl) => captionGroups(tl).map((g) => g.end);
const assertNear = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} is not ${expected}`);

// The time the captions script hides each group, by group index.
function hideTimes(html) {
  const script = html.match(/<script>\n([\s\S]*?)<\/script>/)[1];
  const hidden = [];
  const node = (id) => ({ id, appendChild() {} });
  const document = { getElementById: node, createElement: () => node() };
  const gsapTimeline = {
    set(target, props, at) {
      if (props.opacity === 0) hidden[Number(target.id.slice("cap-g".length))] = at;
    },
    to() {},
  };
  new Function("document", "gsap", "window", script)(document, { timeline: () => gsapTimeline }, { __timelines: {} });
  return hidden;
}

// A statement, then a close whose last words end long before its fade-out (default hold).
const endingWithClose = timeline(scene("statement", 0, 5, [["It", 1.0, 1.2], ["ships.", 1.3, 1.8]]), scene("close", 5, 7, [["Every", 0.5, 0.8], ["job.", 0.9, 1.3]]));

test("captionGroups_nextGroupStartsWithinTheHold_groupEndsWhenTheNextStarts", () => {
  const tl = timeline(scene("statement", 0, 10, [["First.", 1.0, 1.4], ["Second.", 1.6, 2.0]]));

  assert.equal(ends(tl)[0], 1.6);
});

test("captionGroups_pauseAfterAGroup_groupEndsAHoldAfterItsLastWord", () => {
  const tl = timeline(scene("statement", 0, 10, [["First.", 1.0, 1.4], ["Second.", 4.0, 4.4]]));

  assertNear(ends(tl)[0], 1.4 + HOLD);
});

test("captionGroups_lastGroup_endsAHoldAfterItsLastWordInsteadOfAtTheVideoEnd", () => {
  assertNear(ends(endingWithClose).at(-1), 6.3 + HOLD);
});

test("captionGroups_closeWithAShortHold_lastGroupEndsWhenTheFadeOutStarts", () => {
  const tl = timeline(scene("statement", 0, 5, [["Hi.", 1.0, 1.3]]), scene("close", 5, 3, [["Done.", 1.6, 2.0]]));

  assertNear(ends(tl).at(-1), tl.total - FADE_OUT);
});

test("captionGroups_wordsSpokenDuringTheFadeOut_getNoGroup", () => {
  const tl = timeline(scene("close", 0, 3, [["One.", 1.0, 1.3], ["Two.", 2.5, 2.8]]));

  const texts = captionGroups(tl).map((g) => g.words.map((w) => w.text).join(" "));

  assert.deepEqual(texts, ["One."]);
});

test("captionGroups_videoNotEndingWithClose_lastGroupEndsAtTheVideoEndAtLatest", () => {
  const tl = timeline(scene("statement", 0, 2, [["Bye.", 1.6, 1.9]]));

  assert.equal(ends(tl).at(-1), tl.total);
});

test("captionsScript_eachGroup_isHiddenAtItsEnd", () => {
  const hidden = hideTimes(captionsHtml(endingWithClose, THEME, ""));

  assert.deepEqual(hidden, ends(endingWithClose));
});

test("captionsScript_lastGroup_isHiddenBeforeTheCloseFadesOut", () => {
  const hidden = hideTimes(captionsHtml(endingWithClose, THEME, ""));

  assert.ok(hidden.at(-1) < endingWithClose.total - FADE_OUT, `last group hidden at ${hidden.at(-1)}s`);
});

// caption styles (direction.captions) -----------------------------------------------------------------

const ORIGINAL_BOX_AND_LINE = `.cap-pill{max-width:78%;padding:16px 40px 20px;background:color-mix(in srgb,var(--accent) 4%,var(--canvas));border:1.5px solid color-mix(in srgb,var(--accent) 20%,transparent);border-radius:14px}
.cap-line{display:flex;flex-wrap:wrap;justify-content:center;gap:.08em .14em;font:700 44px/1.1 var(--font-body);letter-spacing:-.005em}
.cap-word{`;
const LARGE_TEXT_AA = 3; // WCAG AA for large text: the caption words are 44px bold

const cssOf = (style, theme = THEME) => captionsHtml(endingWithClose, theme, "", style).match(/<style>\n([\s\S]*?)<\/style>/)[1];
// Every declaration block for `selector`, in source order, joined: later declarations win.
const declarationsOf = (css, selector) =>
  [...css.matchAll(/(?:^|\n)([^{\n]+)\{([^}]*)\}/g)].filter(([, s]) => s === selector).map(([, , body]) => body).join(";");
const valueOf = (declarations, property) => [...declarations.matchAll(new RegExp(`(?:^|;)${property}:([^;]+)`, "g"))].at(-1)?.[1];
const pxOf = (declarations, property) => Number(valueOf(declarations, property)?.replace("px", ""));

// A theme color the captions CSS names: var(--x), or color-mix(in srgb,var(--a) N%,var(--b)).
function themeColor(value, theme) {
  const named = { accent: theme.colors.accent, canvas: theme.colors.canvas, ink: theme.colors.ink, "on-accent": theme.derived.onAccentFill, "accent-text": theme.derived.accentText };
  const mixed = value.match(/^color-mix\(in srgb,var\(--([\w-]+)\) (\d+)%,var\(--([\w-]+)\)\)$/);
  if (mixed) return mix(named[mixed[3]], named[mixed[1]], Number(mixed[2]) / 100);
  return named[value.match(/^var\(--([\w-]+)\)$/)[1]];
}

// The color behind the words: the box's own fill, or the canvas when the style has no box fill.
function backdropOf(style, theme) {
  const fill = valueOf(declarationsOf(cssOf(style, theme), ".cap-pill"), "background");
  return fill ? themeColor(fill, theme) : theme.colors.canvas;
}

test("captionsHtml_withoutAStyle_isThePill", () => {
  assert.equal(captionsHtml(endingWithClose, THEME, ""), captionsHtml(endingWithClose, THEME, "", "pill"));
});

test("captionsHtml_pill_keepsTheOriginalBoxAndLineRules", () => {
  assert.ok(cssOf("pill").includes(ORIGINAL_BOX_AND_LINE));
});

for (const style of STYLES) {
  test(`captionsHtml_${style}_keepsTheStageInTheCaptionBandBelowY900`, () => {
    const stage = declarationsOf(cssOf(style), ".cap-stage");

    assert.deepEqual([pxOf(stage, "top"), pxOf(stage, "top") + pxOf(stage, "height")], [900, 1080]);
  });

  test(`captionsHtml_${style}_setsTheWordsAsLargeText`, () => {
    assert.equal(valueOf(declarationsOf(cssOf(style), ".cap-line"), "font"), "700 44px/1.1 var(--font-body)");
  });

  test(`captionsScript_${style}_showsAndHidesTheGroupsAtTheSameTimes`, () => {
    assert.deepEqual(hideTimes(captionsHtml(endingWithClose, THEME, "", style)), ends(endingWithClose));
  });

  for (const themeName of ["labos", "neutral", "midnight"]) {
    test(`captionsHtml_${style}On${themeName}_everyWordStateReachesAAForLargeText`, () => {
      const theme = builtInTheme(themeName);
      const css = cssOf(style, theme);
      const backdrop = backdropOf(style, theme);
      const upcoming = themeColor(valueOf(declarationsOf(css, ".cap-word"), "color"), theme);
      const active = declarationsOf(css, ".cap-word.is-active");

      assert.ok(contrast(upcoming, backdrop) >= LARGE_TEXT_AA, `upcoming ${contrast(upcoming, backdrop).toFixed(2)}`);
      assert.ok(contrast(theme.colors.ink, backdrop) >= LARGE_TEXT_AA, "spoken");
      assert.ok(contrast(themeColor(valueOf(active, "color"), theme), themeColor(valueOf(active, "background"), theme)) >= LARGE_TEXT_AA, "active");
    });
  }
}

test("captionsHtml_lower_isAFullWidthBandAtTheBottomOfTheCaptionBand", () => {
  const box = declarationsOf(cssOf("lower"), ".cap-pill");

  assert.deepEqual([valueOf(box, "left"), valueOf(box, "right"), valueOf(box, "bottom")], ["0", "0", "0"]);
  assert.ok(pxOf(box, "height") <= 180, "taller than the caption band");
  assert.equal(valueOf(box, "border-top"), "3px solid var(--accent)");
});

test("captionsHtml_lower_startsTheWordsAtThe96pxMargin", () => {
  const css = cssOf("lower");

  assert.equal(valueOf(declarationsOf(css, ".cap-pill"), "padding"), "0 96px");
  assert.equal(valueOf(declarationsOf(css, ".cap-line"), "justify-content"), "flex-start");
});

test("captionsHtml_minimal_hasNoBoxFillOrBorder", () => {
  const box = declarationsOf(cssOf("minimal"), ".cap-pill");

  assert.deepEqual([valueOf(box, "background"), valueOf(box, "border")], [undefined, undefined]);
});

test("captionsHtml_minimal_haloesTheWordsInTheCanvasColorExceptTheActiveOne", () => {
  const css = cssOf("minimal");

  assert.match(valueOf(declarationsOf(css, ".cap-line"), "text-shadow"), /^0 0 \d+px var\(--canvas\),0 0 \d+px var\(--canvas\)$/);
  assert.equal(valueOf(declarationsOf(css, ".cap-line .is-active"), "text-shadow"), "none");
});

test("captionsHtml_styles_lookDifferent", () => {
  const boxes = STYLES.map((style) => declarationsOf(cssOf(style), ".cap-pill"));

  assert.equal(new Set(boxes).size, STYLES.length);
});
