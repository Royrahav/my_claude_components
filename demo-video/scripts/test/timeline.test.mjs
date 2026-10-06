// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// Holds after the speech: each template's default, scaled by the direction's pacing; a scene's own hold wins.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_HOLD, buildTimeline, holdFor } from "../lib/timeline.mjs";
import { LEAD, projectFiles } from "../lib/util.mjs";

const OTHER_HOLD = 1.4;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !~ ${expected}`);

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dv-timeline-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

// holdFor -------------------------------------------------------------------------------------------

test("defaultHold_perTemplate_isUnchanged", () => {
  assert.deepEqual(DEFAULT_HOLD, { title: 3.0, close: 4.0, metrics: 2.2, statement: 2.0, recap: 2.0, options: 1.8, states: 1.8, decision: 1.6 });
});

// Every built-in default, plus a template without one (a project template, say).
const DEFAULTS = [...Object.entries(DEFAULT_HOLD), ["bullets", OTHER_HOLD], ["my-signature", OTHER_HOLD]];

test("holdFor_withoutPacing_isEachTemplatesDefaultHold", () => {
  for (const [type, hold] of DEFAULTS) assert.equal(holdFor({ type }), hold, type);
});

test("holdFor_measuredPacing_isExactlyEachTemplatesDefaultHold", () => {
  for (const [type, hold] of DEFAULTS) assert.equal(holdFor({ type }, "measured"), hold, type);
});

for (const [pacing, scale] of [["brisk", 0.8], ["relaxed", 1.2]]) {
  test(`holdFor_${pacing}Pacing_scalesEachDefaultHoldBy${scale}`, () => {
    for (const [type, hold] of DEFAULTS) near(holdFor({ type }, pacing), hold * scale);
  });
}

for (const pacing of ["measured", "brisk", "relaxed"]) {
  test(`holdFor_sceneWithItsOwnHoldAt${pacing}Pacing_keepsItAsWritten`, () => {
    assert.equal(holdFor({ type: "title", hold: 0.9 }, pacing), 0.9);
  });

  test(`holdFor_sceneWithAZeroHoldAt${pacing}Pacing_keepsZero`, () => {
    assert.equal(holdFor({ type: "close", hold: 0 }, pacing), 0);
  });
}

// buildTimeline: the pacing reaches every voiced scene ------------------------------------------------

// A voiced scene without a take yet lasts the lead plus its hold, so its length shows the hold directly.
function durations(scenes, options) {
  const { tl } = buildTimeline(projectFiles(root), scenes, { level: false, ...options });
  return tl.scenes.map((s) => s.duration);
}

const VOICED = [{ id: "s01", type: "title", say: "Hello." }, { id: "s02", type: "bullets", say: "Points." }];

test("buildTimeline_withoutPacing_holdsEachVoicedSceneForItsDefault", () => {
  const actual = durations(VOICED);

  actual.forEach((duration, i) => near(duration, LEAD + holdFor(VOICED[i])));
});

for (const [pacing, scale] of [["brisk", 0.8], ["relaxed", 1.2]]) {
  test(`buildTimeline_${pacing}Pacing_scalesTheHoldOfEveryVoicedScene`, () => {
    const actual = durations(VOICED, { pacing });

    near(actual[0], Math.round((LEAD + DEFAULT_HOLD.title * scale) * 1000) / 1000);
    near(actual[1], Math.round((LEAD + OTHER_HOLD * scale) * 1000) / 1000);
  });
}

test("buildTimeline_anyPacing_leavesSilentScenesAtTheirSetDuration", () => {
  const silent = [{ id: "s01", type: "title", duration: 5 }, { id: "s02", type: "bullets" }];

  assert.deepEqual(durations(silent, { pacing: "relaxed" }), [5, 6]);
});
