// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
import { test } from "node:test";
import assert from "node:assert/strict";
import title from "../lib/scenes/title.mjs";
import { buildScene, sceneTimeline, tweensOf } from "./helpers.mjs";

const KICK_IN = 0.55;
const KICK_CLEAR_LEAD = 0.45;
const KICK_FADE = 0.4;
const KICK_LEAD = 1.3;

const narration = (count = 20) =>
  sceneTimeline({
    duration: 20,
    words: Array.from({ length: count }, (_, i) => ({ text: `w${i}`, start: 0.6 + i * 0.5, end: 1.0 + i * 0.5 })),
  });

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} !~ ${expected}`);
const kickerNames = (n) => Array.from({ length: n }, (_, i) => `k${i}`);
const kickerAt = (at) => ({ text: "word", at });

// The kicker's slide-in and clear-out tweens, and the time the lockup title starts rising.
function timing(k, n) {
  const kickers = kickerNames(n).map((name) => {
    const [slideIn, clearOut] = tweensOf(k, name);
    return { slideIn, clearOut };
  });
  const [reveal] = tweensOf(k, "t1");
  return { kickers, lockupStart: reveal.start };
}

test("title_withoutKickers_emitsOnlyTheLockupAtDefaultTime", () => {
  const { k, html } = buildScene(title, { title: "Hello" });

  assert.doesNotMatch(html, /s1-k0/);
  assert.equal(tweensOf(k, "t1")[0].start, 0.5);
});

test("title_withKickers_everyKickerIsFullyInBeforeItStartsClearing", () => {
  const { k } = buildScene(title, { title: "T", kicker: ["a", "b", "c"] }, narration());

  const { kickers } = timing(k, 3);

  for (const { slideIn, clearOut } of kickers) assert.ok(slideIn.start + KICK_IN <= clearOut.start);
});

test("title_withKickers_everyKickerIsFullyClearedBeforeTheLockupReveals", () => {
  const { k } = buildScene(title, { title: "T", kicker: ["a", "b", "c"] }, narration());

  const { kickers, lockupStart } = timing(k, 3);

  for (const { clearOut } of kickers) assert.ok(clearOut.start + clearOut.duration <= lockupStart);
});

test("title_withKickers_clearOutStartsExactlyBeforeTheLockup", () => {
  const { k } = buildScene(title, { title: "T", kicker: ["a"], lockup_at: 9 }, narration());

  const { kickers } = timing(k, 1);

  assert.equal(kickers[0].clearOut.start, 9 - KICK_CLEAR_LEAD);
  assert.equal(kickers[0].clearOut.duration, KICK_FADE);
});

test("title_kickerCuedTooCloseToLockup_isPulledEarlierToFitFully", () => {
  const { k } = buildScene(title, { title: "T", kicker: [kickerAt(5)], lockup_at: 5.2 }, narration());

  const { kickers, lockupStart } = timing(k, 1);

  assert.equal(lockupStart, 5.2);
  near(kickers[0].slideIn.start, 5.2 - KICK_LEAD);
});

test("title_kickerCuedWellBeforeLockup_keepsItsCue", () => {
  const { k } = buildScene(title, { title: "T", kicker: [kickerAt(1), kickerAt(2)], lockup_at: 8 }, narration());

  const { kickers, lockupStart } = timing(k, 2);

  assert.deepEqual(
    [kickers[0].slideIn.start, kickers[1].slideIn.start, lockupStart],
    [1, 2, 8],
  );
});

test("title_allKickersCuedAtTheSameTime_keepAStaggerOfAtLeastKickStep", () => {
  const { k } = buildScene(
    title,
    { title: "T", kicker: [kickerAt(9), kickerAt(9), kickerAt(9)], lockup_at: 9.2 },
    narration(),
  );

  const { kickers } = timing(k, 3);

  const starts = kickers.map((x) => x.slideIn.start);
  assert.deepEqual(starts, [7.3, 7.6, 7.9]);
});

test("title_lockupCuedTooEarlyForKickers_movesTheLockupLater", () => {
  const { k } = buildScene(
    title,
    { title: "T", kicker: [kickerAt(0.7), kickerAt(0.8)], lockup_at: 0.8 },
    narration(),
  );

  const { kickers, lockupStart } = timing(k, 2);

  near(lockupStart, 0.6 + KICK_LEAD + 0.3);
  assert.ok(kickers[1].clearOut.start + KICK_FADE <= lockupStart);
});

test("title_lockupCuedTooEarly_stillShowsEveryKickerInFullBeforeClearing", () => {
  const { k } = buildScene(
    title,
    { title: "T", kicker: [kickerAt(0.7), kickerAt(0.8)], lockup_at: 0.8 },
    narration(),
  );

  const { kickers } = timing(k, 2);

  for (const { slideIn, clearOut } of kickers) assert.ok(slideIn.start + KICK_IN <= clearOut.start);
});

test("title_pulledKickers_neverStartBeforeTheNarrationBegins", () => {
  const { k, c } = buildScene(
    title,
    { title: "T", kicker: [kickerAt(0.7), kickerAt(0.8), kickerAt(0.9)], lockup_at: 0.8 },
    narration(),
  );

  const { kickers } = timing(k, 3);

  for (const { slideIn } of kickers) assert.ok(slideIn.start >= c.first);
});

test("title_kickerWithWordCue_landsOnThatSpokenWord", () => {
  const { k } = buildScene(title, { title: "T", kicker: [kickerAt("w2")], lockup_at: 9 }, narration());

  const { kickers } = timing(k, 1);

  assert.equal(kickers[0].slideIn.start, 1.6);
});

test("title_stringAndObjectKickers_bothRenderTheirText", () => {
  const { html } = buildScene(title, { title: "T", kicker: ["plain", { text: "obj" }] }, narration());

  assert.match(html, /plain/);
  assert.match(html, /obj/);
});

test("title_lockupSound_followsTheLockupReveal", () => {
  const { k } = buildScene(title, { title: "T", kicker: ["a"], lockup_at: 9 }, narration());

  const chime = k.sfx.find((x) => x.sound === "chime");
  const whoosh = k.sfx.find((x) => x.sound === "whoosh");

  assert.deepEqual([whoosh.t, chime.t], [8.7, 9.3]);
});

test("title_escapesMarkupInTitleAndKickers", () => {
  const { html } = buildScene(title, { title: "<b>x</b>", kicker: ["<i>"] }, narration());

  assert.doesNotMatch(html, /<b>x/);
  assert.doesNotMatch(html, /<i>/);
});
