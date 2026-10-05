// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// Caption timing: when each group leaves the screen, in the group data and in the script the captions
// composition runs (played here against recording stand-ins for the DOM and GSAP).
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { captionGroups, captionsHtml } from "../lib/captions.mjs";
import { FADE_OUT } from "../lib/scenes/close.mjs";
import { loadTheme } from "../lib/theme.mjs";

const HOLD = 0.7;
const THEME = loadTheme(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "themes", "labos", "theme.json"));

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
