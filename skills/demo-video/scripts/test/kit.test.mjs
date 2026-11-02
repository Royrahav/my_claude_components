// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createScene } from "../lib/kit.mjs";
import { THEME } from "./helpers.mjs";

const newKit = () => createScene({ id: "s1", theme: THEME, fontsCss: "", brief: {}, scene: {}, duration: 10 });

test("centeredTop_blockInDefaultBand_centersBetween150And860", () => {
  assert.equal(newKit().centeredTop(100), 455);
});

test("centeredTop_withHeadline_centersBetween240And860", () => {
  assert.equal(newKit().centeredTop(100, { title: true }), 500);
});

test("centeredTop_customBottom_centersAboveThatBottom", () => {
  assert.equal(newKit().centeredTop(100, { bottom: 600 }), 325);
});

test("centeredTop_blockFillsTheBand_startsAtTheBandTop", () => {
  assert.equal(newKit().centeredTop(710), 150);
});

test("centeredTop_blockTallerThanBand_clampsToTheBandTopInsteadOfGoingNegative", () => {
  assert.equal(newKit().centeredTop(2000), 150);
});

test("centeredTop_oddRemainder_roundsToWholePixel", () => {
  assert.equal(Number.isInteger(newKit().centeredTop(101)), true);
});

// Runs the emitted count() script against a stub timeline and element, returning what it registered.
function runCount(args) {
  const k = newKit();
  k.count(...args);
  const calls = [];
  const el = { textContent: "0" };
  const tl = { fromTo: (target, from, to, at) => calls.push({ target, from, to, at }) };
  new Function("tl", "document", k.js[0])(tl, { getElementById: (id) => (id === "s1-n" ? el : null) });
  return { call: calls[0], el };
}

test("count_tween_doesNotRenderImmediately", () => {
  const { call } = runCount(["n", 50, 1.5]);

  assert.equal(call.to.immediateRender, false);
});

test("count_tween_runsFromZeroToTargetAtGivenTime", () => {
  const { call } = runCount(["n", 50, 1.5, 2]);

  assert.deepEqual([call.from.v, call.to.v, call.to.duration, call.at], [0, 50, 2, 1.5]);
});

test("count_update_writesTheRoundedValueIntoTheElement", () => {
  const { call, el } = runCount(["n", 50, 0]);

  call.target.v = 12.6;
  call.to.onUpdate();

  assert.equal(el.textContent, "13");
});

test("count_updateWithDecimalsAndCommas_formatsThousandsAndFraction", () => {
  const { call, el } = runCount(["n", 5000, 0, 1, 1, true]);

  call.target.v = 1234567.84;
  call.to.onUpdate();

  assert.equal(el.textContent, "1,234,567.8");
});
