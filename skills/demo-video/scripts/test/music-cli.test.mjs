// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// `music` end to end, with HOME pointed at a temp dir and filled slots, so no test calls the API or needs audio.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MOODS, slotFile } from "../lib/music.mjs";

const DEMO = join(dirname(fileURLToPath(import.meta.url)), "..", "demo.mjs");

let home;
let project;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "dv-music-cli-"));
  project = join(home, "project");
  mkdirSync(project);
  writeFileSync(join(project, "scenes.json"), JSON.stringify({ scenes: [{ type: "title" }] }));
  const library = join(home, ".cache", "demo-video", "music");
  mkdirSync(library, { recursive: true });
  for (const slot of Object.keys(MOODS)) writeFileSync(slotFile(slot, library), slot);
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

const briefPath = () => join(project, "brief.json");
const writeBrief = (brief) => writeFileSync(briefPath(), JSON.stringify(brief));
const readBrief = () => JSON.parse(readFileSync(briefPath(), "utf8"));
const bedText = () => readFileSync(join(project, "assets", "music", "bgm.mp3"), "utf8");
const music = (...args) => spawnSync(process.execPath, [DEMO, "music", project, ...args], { env: { ...process.env, HOME: home, USERPROFILE: home, ELEVENLABS_API_KEY: "" }, encoding: "utf8" });

test("music_moodFlag_isWrittenToTheBriefAndTheBedIsThatMood", () => {
  writeBrief({ music_mood: "calm-tech" });

  music("--mood", "story-warm");

  assert.deepEqual([readBrief().music_mood, bedText()], ["story-warm", "story-warm"]);
});

test("music_plainRerunAfterMood_keepsTheChosenMood", () => {
  writeBrief({});
  music("--mood", "launch-bright");

  music();

  assert.deepEqual([readBrief().music_mood, bedText()], ["launch-bright", "launch-bright"]);
});

test("music_fileFlag_clearsTheMoodAndAPlainRerunKeepsTheCustomBed", () => {
  writeBrief({ music_mood: "calm-tech" });
  const mine = join(home, "mine.mp3");
  writeFileSync(mine, "custom");
  music("--file", mine);

  const rerun = music();

  assert.deepEqual([readBrief().music_mood, readBrief().music_custom, bedText(), rerun.stdout.includes("kept")], [undefined, true, "custom", true]);
});

test("music_moodFlagAfterACustomBed_switchesBackToTheLibrary", () => {
  writeBrief({ music_custom: true });
  mkdirSync(join(project, "assets", "music"), { recursive: true });
  writeFileSync(join(project, "assets", "music", "bgm.mp3"), "custom");

  music("--mood", "focus-serious");

  assert.deepEqual([readBrief().music_mood, readBrief().music_custom, bedText()], ["focus-serious", undefined, "focus-serious"]);
});

test("music_adopt_doesNotChangeTheBrief", () => {
  writeBrief({ music_mood: "calm-tech" });
  mkdirSync(join(project, "assets", "music"), { recursive: true });
  writeFileSync(join(project, "assets", "music", "bgm.mp3"), "bed");

  const run = music("--adopt", "calm-tech");

  assert.deepEqual([readBrief(), run.status === 0 || /already filled/.test(run.stderr)], [{ music_mood: "calm-tech" }, true]);
});
