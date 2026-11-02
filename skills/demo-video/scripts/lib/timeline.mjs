// Timeline: real voice duration decides every scene length (lead + speech + hold), takes are
// leveled to -18 LUFS and padded, and word cues ("decision", "token#2", "ships+0.3") resolve to
// seconds so reveals land exactly on the spoken word.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { LEAD, ensureDir, ffmpeg, lufs, r3, readJson, writeJson, duration as probe } from "./util.mjs";

const VOICE_LUFS = -18;
export const DEFAULT_HOLD = { title: 3.0, close: 4.0, metrics: 2.2, statement: 2.0, recap: 2.0, options: 1.8, states: 1.8, decision: 1.6, beat: 0.8, "iso-journey": 3.0, "iso-map": 2.0 };
// A layout variant can hold differently from its template ("template/variant"): the sting is a short sign-off.
const VARIANT_HOLD = { "close/sting": 1.5 };
const OTHER_HOLD = 1.4;
const SILENT_SECONDS = 6;
const SILENT_BEAT_SECONDS = 1.6;
const SILENT_STING_SECONDS = 2.5;
// direction.pacing scales the default holds; a scene's own `hold` is kept as written.
const PACING_HOLD_SCALE = { measured: 1, brisk: 0.8, relaxed: 1.2 };

const norm = (w) => String(w).toLowerCase().replace(/^[^\w%/.$]+|[^\w%]+$/g, "");

// Seconds a voiced scene holds after its speech.
export function holdFor(scene, pacing = "measured") {
  return scene.hold ?? defaultHold(scene) * PACING_HOLD_SCALE[pacing];
}

const defaultHold = (scene) => VARIANT_HOLD[`${scene.type}/${scene.variant}`] ?? DEFAULT_HOLD[scene.type] ?? OTHER_HOLD;

// A scene's length without its own `duration`: lead + speech + hold when voiced, else a fixed length.
export function silentSeconds(scene) {
  if (scene.type === "beat") return SILENT_BEAT_SECONDS;
  return scene.type === "close" && scene.variant === "sting" ? SILENT_STING_SECONDS : SILENT_SECONDS;
}

export function buildTimeline(f, scenes, { level = true, pacing } = {}) {
  ensureDir(f.voice);
  let t = 0;
  const out = [];
  const warnings = [];
  for (const s of scenes) {
    const rawMp3 = join(f.raw, `${s.id}.mp3`);
    const rawWords = join(f.raw, `${s.id}.words.json`);
    let words = [];
    let speech = 0;
    let voice = null;
    if (s.say) {
      if (!existsSync(rawMp3) || !existsSync(rawWords)) {
        warnings.push(`${s.id}: no narration take yet (run narrate)`);
      } else {
        speech = probe(rawMp3);
        words = readJson(rawWords).map((w) => ({ ...w, start: r3(w.start + LEAD), end: r3(w.end + LEAD) }));
        voice = `assets/voice/${s.id}.wav`;
        if (level) {
          const gain = VOICE_LUFS - (lufs(rawMp3) ?? VOICE_LUFS);
          ffmpeg(["-i", rawMp3, "-af", `volume=${gain.toFixed(2)}dB,adelay=${Math.round(LEAD * 1000)}:all=1,aresample=44100`, "-ac", "1", "-c:a", "pcm_s16le", join(f.root, voice)]);
        }
      }
    }
    const dur = r3(s.duration ?? (s.say ? LEAD + speech + holdFor(s, pacing) : silentSeconds(s)));
    out.push({ id: s.id, type: s.type, start: r3(t), duration: dur, speechEnd: r3(LEAD + speech), words, voice });
    t += dur;
  }
  const tl = { total: r3(t), scenes: out };
  writeJson(f.timeline, tl);
  return { tl, warnings };
}

// One resolver per scene. Cues are resolved in the order the template asks for them, so plain
// words search forward from the previous cue; "word#2" picks an occurrence; "+0.3"/"-0.2" offsets.
export function makeCue(sceneTl, warnings) {
  const words = sceneTl.words;
  let cursor = 0;
  const first = words[0]?.start ?? 0.6;
  const last = sceneTl.speechEnd > 1 ? sceneTl.speechEnd : sceneTl.duration * 0.8;
  const cue = (at, fallback) => {
    if (at === undefined || at === null || at === "") return fallback;
    if (typeof at === "number") return at;
    const m = String(at).match(/^(.+?)(?:#(\d+))?([+-]\d+(?:\.\d+)?)?$/);
    const target = norm(m[1]);
    const nth = m[2] ? Number(m[2]) : 0;
    const offset = m[3] ? Number(m[3]) : 0;
    let idx = -1;
    if (nth) {
      let seen = 0;
      idx = words.findIndex((w) => norm(w.text) === target && ++seen === nth);
    } else {
      idx = words.findIndex((w, k) => k >= cursor && norm(w.text) === target);
      if (idx < 0) idx = words.findIndex((w) => norm(w.text) === target);
    }
    if (idx < 0) {
      warnings.push(`${sceneTl.id}: cue "${at}" not in narration; used fallback`);
      return fallback;
    }
    cursor = idx + 1;
    return r3(Math.max(0.05, words[idx].start + offset));
  };
  // n evenly spaced fallback times across the narration window
  const spread = (n, from = first, to = last) =>
    Array.from({ length: n }, (_, i) => r3(n === 1 ? from : from + ((to - from) * i) / (n - 1)));
  // A template's note about its own timing (a cue it had to move): the build prints it.
  const warn = (message) => warnings.push(`${sceneTl.id}: ${message}`);
  return { cue, spread, warn, first, last, duration: sceneTl.duration };
}
