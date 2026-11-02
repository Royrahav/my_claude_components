// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeIndex } from "../lib/assemble.mjs";

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dv-assemble-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const OPTIONS = { canvas: "#FFFFFF", captions: true, sfxOn: true };

// Scenes are back to back (each 5 s). `voiced` marks which ones have a narration clip.
function project(voiced, types = []) {
  const tl = {
    total: voiced.length * 5,
    scenes: voiced.map((v, i) => ({ id: `s${i}`, type: types[i] ?? "bullets", start: i * 5, duration: 5, voice: v ? `assets/voice/s${i}.wav` : null })),
  };
  const scenes = tl.scenes.map((s) => ({ id: s.id, type: s.type }));
  return { tl, scenes };
}

function write(voiced, { types, options = OPTIONS, sceneSfx = {}, scenes: override } = {}) {
  const { tl, scenes } = project(voiced, types);
  const res = writeIndex(root, tl, override ?? scenes, sceneSfx, options);
  return { res, html: readFileSync(join(root, "index.html"), "utf8") };
}

const tagsOf = (html, tag) => [...html.matchAll(new RegExp(`<${tag} [^>]*>`, "g"))].map((m) => m[0]);
const attr = (tagText, name) => tagText.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const voiceTracks = (html) => tagsOf(html, "audio").filter((a) => /-voice"/.test(a)).map((a) => Number(attr(a, "data-track-index")));
const sfxTags = (html) => tagsOf(html, "audio").filter((a) => /el-sfx-/.test(a));

test("writeIndex_consecutiveVoicedScenes_alternateBetweenTracks10And11", () => {
  const { html } = write([true, true, true, true]);

  assert.deepEqual(voiceTracks(html), [10, 11, 10, 11]);
});

test("writeIndex_sceneWithoutVoice_doesNotConsumeAVoiceTrackSlot", () => {
  const { html } = write([true, false, true, true]);

  assert.deepEqual(voiceTracks(html), [10, 11, 10]);
});

test("writeIndex_voiceClip_startsAndLastsWithItsScene", () => {
  const { html } = write([true, true]);

  const clip = tagsOf(html, "audio").find((a) => /el-s1-voice/.test(a));

  assert.deepEqual([attr(clip, "data-start"), attr(clip, "data-duration"), attr(clip, "src")], ["5", "5", "assets/voice/s1.wav"]);
});

test("writeIndex_sceneHosts_alternateBetweenTracks0And1", () => {
  const { html } = write([true, true, true]);

  const hosts = tagsOf(html, "div").filter((d) => /class="scene"/.test(d));

  assert.deepEqual(hosts.map((h) => Number(attr(h, "data-track-index"))), [0, 1, 0]);
});

test("writeIndex_captionsOn_usesTrack2AndSpansTheWholeVideo", () => {
  const { html } = write([true, true]);

  const caption = tagsOf(html, "div").find((d) => /el-captions/.test(d));

  assert.deepEqual([attr(caption, "data-track-index"), attr(caption, "data-duration"), attr(caption, "data-track-kind")], ["2", "10", "captions"]);
});

test("writeIndex_captionsOff_emitsNoCaptionTrack", () => {
  const { html } = write([true, true], { options: { ...OPTIONS, captions: false } });

  assert.doesNotMatch(html, /el-captions/);
});

test("writeIndex_sfxClips_takeTracksFrom20Upward", () => {
  const { html } = write([true, true, true], { types: ["bullets", "pipeline", "metrics"] });

  const tracks = sfxTags(html).map((a) => Number(attr(a, "data-track-index")));

  assert.deepEqual(tracks, [20, 21]);
});

test("writeIndex_transitionIntoPipeline_addsAWhooshAtTheBoundary", () => {
  const { res, html } = write([true, true], { types: ["bullets", "pipeline"] });

  const whoosh = sfxTags(html)[0];

  assert.deepEqual([res.sfx, attr(whoosh, "src"), attr(whoosh, "data-start")], [1, "assets/sfx/whoosh.mp3", "5"]);
});

test("writeIndex_sfxOff_emitsNoSfxClips", () => {
  const { res, html } = write([true, true], { types: ["bullets", "pipeline"], options: { ...OPTIONS, sfxOn: false } });

  assert.deepEqual([res.sfx, sfxTags(html).length], [0, 0]);
});

test("writeIndex_sceneSfxBeyondSceneDuration_isDropped", () => {
  const { res } = write([true], { sceneSfx: { s0: [{ sound: "pop", t: 5 }, { sound: "pop", t: 4.9 }] } });

  assert.equal(res.sfx, 1);
});

test("writeIndex_sceneSfx_isOffsetByTheSceneStart", () => {
  const { html } = write([true, true], { sceneSfx: { s1: [{ sound: "click", t: 1.25 }] } });

  assert.equal(attr(sfxTags(html)[0], "data-start"), "6.25");
});

test("writeIndex_lastScene_hasNoTransitionAndKeepsItsDuration", () => {
  const { html } = write([true, true]);

  const hosts = tagsOf(html, "div").filter((d) => /class="scene"/.test(d));

  assert.deepEqual(hosts.map((h) => attr(h, "data-duration")), ["5.6", "5"]);
});

test("writeIndex_singleScene_writesValidIndexWithoutTransitions", () => {
  const { html } = write([true]);

  assert.match(html, /<!doctype html>/);
  assert.doesNotMatch(html, /tl\.to\("#el-/);
});

// transitions ---------------------------------------------------------------------------------------

// The tween that moves scene `id` out at a transition, or undefined when it just cuts away.
const exitOf = (html, id) => html.match(new RegExp(`tl\\.to\\("#el-${id}",\\{([^}]*)\\}`))?.[1];
const hostDurations = (html) => tagsOf(html, "div").filter((d) => /class="scene"/.test(d)).map((h) => attr(h, "data-duration"));

test("writeIndex_withoutTransitions_pushesIntoEachSceneAndFadesIntoTheLast", () => {
  const { html } = write([true, true, true]);

  assert.deepEqual([exitOf(html, "s0"), exitOf(html, "s1")], ["x:-1920,duration:0.5,ease:\"power3.inOut\"", "filter:\"blur(10px)\",scale:1.03,opacity:0,duration:0.6,ease:\"power2.inOut\""]);
});

test("writeIndex_givenTransitions_entersEachSceneThatWay", () => {
  const { html } = write([true, true, true, true], { options: { ...OPTIONS, transitions: [null, "zoom", "cut", "fade"] } });

  assert.match(exitOf(html, "s0"), /^scale:2\.2,/);
  assert.equal(exitOf(html, "s1"), undefined);
  assert.match(exitOf(html, "s2"), /^filter:"blur\(10px\)"/);
});

test("writeIndex_givenTransitions_extendOnlyTheScenesThatHandOverGradually", () => {
  const { html } = write([true, true, true, true], { options: { ...OPTIONS, transitions: [null, "zoom", "cut", "fade"] } });

  assert.deepEqual(hostDurations(html), ["5.45", "5", "5.6", "5"]);
});

test("writeIndex_cutIntoAPipeline_addsNoWhoosh", () => {
  const { res } = write([true, true], { types: ["bullets", "pipeline"], options: { ...OPTIONS, transitions: [null, "cut"] } });

  assert.equal(res.sfx, 0);
});
