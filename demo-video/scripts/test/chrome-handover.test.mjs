// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The chrome at a scene's entrance: after a crossfade it waits for the outgoing scene, so two eyebrows or two
// chapter tags never show in the same corner; every other entrance keeps the chrome entering with its scene.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeIndex } from "../lib/assemble.mjs";
import { resolveDirection } from "../lib/direction.mjs";
import { createScene, wrap } from "../lib/kit.mjs";
import { loadTheme } from "../lib/theme.mjs";

const THEME = loadTheme(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "themes", "labos", "theme.json"));
const SCENE_SECONDS = 5;

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dv-chrome-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

// Scene `id` with a chapter, wrapped the way build wraps it.
function wrappedScene(id, { entrance, direction, templateChrome = true } = {}) {
  const look = direction ? { direction: resolveDirection(direction) } : {};
  const k = createScene({ id, theme: THEME, fontsCss: "", brief: {}, scene: { chapter: "The problem" }, duration: SCENE_SECONDS, ...look });
  return wrap(k, { fontsCss: "", chrome: templateChrome, eyebrow: "PRODUCT", entrance });
}

// index.html for two back-to-back scenes, s0 then s1, with s1 entering by `entrance`.
function indexEnteringSecondSceneBy(entrance) {
  const scenes = ["s0", "s1"].map((id, i) => ({ id, type: "bullets", start: i * SCENE_SECONDS, duration: SCENE_SECONDS, voice: null }));
  writeIndex(root, { total: 2 * SCENE_SECONDS, scenes }, scenes, {}, { canvas: "#FFFFFF", captions: false, sfxOn: false, transitions: [null, entrance] });
  return readFileSync(join(root, "index.html"), "utf8");
}

// When the exit tween on scene `id`'s host has taken it, chrome included, to opacity 0.
function hiddenAt(indexHtml, id) {
  const [, props, start] = indexHtml.match(new RegExp(`tl\\.to\\("#el-${id}",\\{([^}]*)\\},([\\d.]+)\\);`));
  assert.match(props, /opacity:0,/);
  return Number(start) + Number(props.match(/duration:([\d.]+)/)[1]);
}

// The scene-local start of each tween on scene `id`'s eyebrow or chapter tag.
const chromeTweenStarts = (sceneHtml, id) =>
  sceneHtml
    .split("\n")
    .filter((line) => line.includes(`"#${id}-eyebrow"`) || line.includes(`"#${id}-tag"`))
    .map((line) => Number(line.match(/,([\d.]+)\);$/)[1]));

for (const chrome of ["full", "minimal"]) {
  test(`crossfade_${chrome}Chrome_showsTheIncomingChromeOnlyOnceTheOutgoingChromeIsHidden`, () => {
    const outgoingHiddenAt = hiddenAt(indexEnteringSecondSceneBy("fade"), "s0");

    const incomingStarts = chromeTweenStarts(wrappedScene("s1", { entrance: "fade", direction: { chrome } }), "s1");

    assert.deepEqual(incomingStarts.map((start) => SCENE_SECONDS + start), [outgoingHiddenAt]);
  });
}

for (const entrance of [null, "push", "zoom", "cut"]) {
  test(`wrap_${entrance ?? "noEntrance"}_keepsTheChromeEnteringWithTheScene`, () => {
    assert.equal(wrappedScene("s1", { entrance }), wrappedScene("s1"));
  });
}

test("wrap_noChromeEnteringByCrossfade_animatesNoChrome", () => {
  const html = wrappedScene("s1", { entrance: "fade", direction: { chrome: "none" } });

  assert.deepEqual(chromeTweenStarts(html, "s1"), []);
});

test("wrap_templateWithoutChromeEnteringByTheFinalFade_isUnchanged", () => {
  assert.equal(wrappedScene("s1", { entrance: "fade", templateChrome: false }), wrappedScene("s1", { templateChrome: false }));
});
