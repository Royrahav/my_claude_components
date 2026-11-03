// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// .demo/scene3d.json: which scenes built a 3D stage, kept across --only builds and read by the render's history record.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { previousThreeD, readThreeD, threeDFlags, threeDPath } from "../lib/scene3d.mjs";

const withProject = (flags, run) => {
  const root = mkdtempSync(join(tmpdir(), "dv-scene3d-"));
  try {
    if (flags) {
      mkdirSync(join(root, ".demo"));
      writeFileSync(threeDPath(root), JSON.stringify(flags));
    }
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test("readThreeD_noFileYet_isEmpty", () => {
  withProject(null, (root) => assert.deepEqual(readThreeD(root), {}));
});

test("previousThreeD_fullBuild_startsCleanSoRemovedScenesDropOut", () => {
  withProject({ s01: true, gone: true }, (root) => assert.deepEqual(previousThreeD(root, null), {}));
});

test("previousThreeD_onlyBuild_keepsTheFlagsOfTheScenesItDoesNotRebuild", () => {
  withProject({ s01: true, s02: false }, (root) => assert.deepEqual(previousThreeD(root, new Set(["s02"])), { s01: true, s02: false }));
});

test("threeDFlags_followsTheSceneOrder_andLeavesUnknownScenesUndefinedForTheNameFallback", () => {
  const scenes = [{ id: "s01" }, { id: "s02" }, { id: "s03" }];

  assert.deepEqual(threeDFlags(scenes, { s03: true, s01: false }), [false, undefined, true]);
});
