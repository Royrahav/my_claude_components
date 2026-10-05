// ElevenLabs: narration with character timestamps (exact caption/cue timing, no Whisper pass),
// stock voices (restricted keys often lack voices_read), music bed, and the small SFX set.

import { existsSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { CACHE_DIR, apiKey, duration, ensureDir, ffmpeg, r3, readJson, writeJson, run } from "./util.mjs";

const API = "https://api.elevenlabs.io";
const MODEL = "eleven_multilingual_v2";

// wps = measured words per second at speed 1.0 on dense narration (used by `plan`).
export const STOCK_VOICES = [
  { name: "Matilda", id: "XrExE9yKIg1WjnnlVkGX", desc: "female, professional, American", wps: 2.25 },
  { name: "River", id: "SAz9YHcvj6GT2YYXdXww", desc: "neutral, relaxed, informative", wps: 2.5 },
  { name: "Brian", id: "nPczCjzI2devNBz1zQrb", desc: "male, deep, American", wps: 2.55 },
  { name: "Daniel", id: "onwK4e9ZLuTAKqWW03F9", desc: "male, authoritative, British", wps: 2.3 },
  { name: "Sarah", id: "EXAVITQu4vr4xnSDxMaL", desc: "female, confident, American", wps: 2.4 },
  { name: "George", id: "JBFqnCBsd6RMkjVDRZzb", desc: "male, warm, British", wps: 2.3 },
  { name: "Alice", id: "Xb7hH8MSUJpSbSDYk0k2", desc: "female, clear, British", wps: 2.4 },
  { name: "Eric", id: "cjVigY5qzO86Huf0OWal", desc: "male, friendly, American", wps: 2.45 },
];

export const voiceById = (idOrName) =>
  STOCK_VOICES.find((v) => v.id === idOrName || v.name.toLowerCase() === String(idOrName).toLowerCase());

// Busy (429) and server (5xx) errors are retried after these waits; any other status throws at once.
const RETRY_WAITS_S = [5, 15, 30];
const MAX_WAIT_S = 60;
// The pause between retries; tests replace retryTimer.sleep so they don't really wait.
export const retryTimer = { sleep };

async function call(project, path, body, binary) {
  const key = apiKey(project);
  if (!key) throw new Error("ELEVENLABS_API_KEY missing: put it in <project>/.env (ELEVENLABS_API_KEY=...)");
  const route = path.split("?")[0];
  const req = {
    method: body ? "POST" : "GET",
    headers: { "xi-api-key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  };
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, req);
    if (res.ok) return binary ? Buffer.from(await res.arrayBuffer()) : res.json();
    const msg = apiMessage(await res.text());
    const transient = res.status === 429 || res.status >= 500;
    if (!transient || attempt === RETRY_WAITS_S.length) throw new Error(`${route} -> HTTP ${res.status}: ${msg}`);
    const wait = retryWait(res.headers.get("retry-after"), RETRY_WAITS_S[attempt]);
    console.log(`ElevenLabs ${route}: HTTP ${res.status}, retry ${attempt + 1}/${RETRY_WAITS_S.length} in ${wait}s (${msg.slice(0, 80)})`);
    await retryTimer.sleep(wait * 1000);
  }
}

// ElevenLabs errors look like {"detail": {"status": "system_busy", "message": "..."}}; others show raw.
function apiMessage(text) {
  let detail;
  try {
    detail = JSON.parse(text)?.detail;
  } catch {
    return text.slice(0, 300); // not JSON
  }
  if (!detail?.message) return text.slice(0, 300);
  return detail.status ? `${detail.status}: ${detail.message}` : detail.message;
}

// Retry-After (seconds or an HTTP date) when the API sends one, else the default; kept within 1-60 s.
function retryWait(retryAfter, fallback) {
  const h = retryAfter?.trim() ?? "";
  const asked = /^\d+(\.\d+)?$/.test(h) ? Number(h) : (Date.parse(h) - Date.now()) / 1000;
  return Math.round(Math.min(MAX_WAIT_S, Math.max(1, Number.isFinite(asked) ? asked : fallback)));
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function loadPron(project) {
  const f = join(project, "pronunciations.json");
  return existsSync(f) ? readJson(f) : [];
}

// The text the voice reads, respelled in one pass (a spoken form is never respelled again), and the
// swaps: where each respelling landed in it ({ from, to, display }), to map the voice's words back.
export function respell(text, pron) {
  const spokenOf = new Map();
  for (const { display, spoken } of pron) if (!spokenOf.has(display)) spokenOf.set(display, spoken);
  if (!spokenOf.size) return { text, swaps: [] };
  const longestFirst = [...spokenOf.keys()].sort((a, b) => b.length - a.length).map(escapeRe);
  const pattern = new RegExp(`(?<![\\w-])(?:${longestFirst.join("|")})(?![\\w-])`, "g");
  const swaps = [];
  let out = "";
  let copied = 0;
  for (const m of text.matchAll(pattern)) {
    out += text.slice(copied, m.index);
    const spoken = spokenOf.get(m[0]);
    swaps.push({ from: out.length, to: out.length + spoken.length, display: m[0] });
    out += spoken;
    copied = m.index + m[0].length;
  }
  return { text: out + text.slice(copied), swaps };
}

export const toSpoken = (text, pron) => respell(text, pron).text;

// The voice's character alignment -> display words with times. Spoken words merge back into a display
// form only where respell() put one, so a plain "lp options" or "paper size" stays as written.
export function displayWords(alignment, { text, swaps }) {
  const words = alignedWords(alignment);
  const tokens = [...text.matchAll(/\S+/g)].map((m) => ({ from: m.index, to: m.index + m[0].length }));
  if (tokens.length !== words.length) return words.map(rounded); // alignment is not of this text: keep it as spoken
  const out = [];
  let next = 0;
  for (const { first, last } of respelledRuns(tokens, swaps)) {
    out.push(...words.slice(next, first));
    out.push({ text: displayText(text, swaps, tokens[first].from, tokens[last].to), start: words[first].start, end: words[last].end });
    next = last + 1;
  }
  out.push(...words.slice(next));
  return out.map(rounded);
}

// Alignment characters -> whitespace-separated words with start and end times.
function alignedWords({ characters: ch, character_start_times_seconds: st, character_end_times_seconds: en }) {
  const words = [];
  let cur = null;
  for (let i = 0; i < ch.length; i++) {
    if (/\s/.test(ch[i])) {
      if (cur) words.push(cur);
      cur = null;
      continue;
    }
    if (!cur) cur = { text: "", start: st[i], end: en[i] };
    cur.text += ch[i];
    cur.end = en[i];
  }
  if (cur) words.push(cur);
  return words;
}

// Token index runs [first, last] covered by respellings; respellings that share a token join one run.
function respelledRuns(tokens, swaps) {
  const runs = [];
  for (const swap of swaps) {
    const first = tokens.findIndex((t) => t.to > swap.from);
    const last = tokens.findLastIndex((t) => t.from < swap.to);
    if (first < 0 || last < first) continue;
    const prev = runs[runs.length - 1];
    if (prev && first <= prev.last) prev.last = Math.max(prev.last, last);
    else runs.push({ first, last });
  }
  return runs;
}

// Spoken text [from, to) with each respelling inside it put back to its display form.
function displayText(spoken, swaps, from, to) {
  let out = "";
  let copied = from;
  for (const swap of swaps.filter((s) => s.from >= from && s.to <= to)) {
    out += spoken.slice(copied, swap.from) + swap.display;
    copied = swap.to;
  }
  return out + spoken.slice(copied, to);
}

const rounded = (w) => ({ text: w.text, start: r3(w.start), end: r3(w.end) });

export async function synth(project, { voice, text, previous, next, speed = 1, out }) {
  const pron = loadPron(project);
  const spoken = respell(text, pron);
  const body = {
    text: spoken.text,
    model_id: MODEL,
    voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed },
  };
  if (previous) body.previous_text = toSpoken(previous, pron);
  if (next) body.next_text = toSpoken(next, pron);
  const res = await call(project, `/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, body);
  writeFileSync(out, Buffer.from(res.audio_base64, "base64"));
  return { words: displayWords(res.alignment, spoken), seconds: duration(out) };
}

// Raw takes for every scene (or `only`), 3 requests at a time.
// Re-voices only scenes whose spoken text, voice or speed changed (stamp in raw/<id>.key). A take whose
// stamp now belongs to another id (scenes inserted or reordered) is moved there instead of re-synthesized.
export async function narrate(project, scenes, brief, only, force = false) {
  const dir = ensureDir(join(project, "assets", "voice", "raw"));
  const pron = loadPron(project);
  const stamp = (s) => createHash("sha1").update(JSON.stringify([brief.voice.id, brief.voice.speed ?? 1, toSpoken(s.say, pron)])).digest("hex").slice(0, 16);
  const file = (id, ext) => join(dir, `${id}.${ext}`);
  const takes = new Map();
  for (const id of readdirSync(dir).filter((x) => x.endsWith(".key")).map((x) => x.slice(0, -4)))
    if (existsSync(file(id, "mp3")) && existsSync(file(id, "words.json")))
      takes.set(readFileSync(file(id, "key"), "utf8"), { id, mp3: readFileSync(file(id, "mp3")), words: readFileSync(file(id, "words.json")) });
  const results = [];
  const todo = [];
  for (const [i, s] of scenes.entries()) {
    if (!s.say || (only && !only.has(s.id))) continue;
    const take = !force && !only && takes.get(stamp(s));
    if (!take) todo.push({ s, i });
    else if (take.id !== s.id) {
      writeFileSync(file(s.id, "mp3"), take.mp3);
      writeFileSync(file(s.id, "words.json"), take.words);
      writeFileSync(file(s.id, "key"), stamp(s));
      results.push(`${s.id} reused`);
    }
  }
  if (!todo.length && !results.length) results.push("all takes up to date");
  for (let k = 0; k < todo.length; k += 3) {
    const batch = todo.slice(k, k + 3).map(async ({ s, i }) => {
      const r = await synth(project, {
        voice: brief.voice.id,
        text: s.say,
        previous: scenes[i - 1]?.say,
        next: scenes[i + 1]?.say,
        speed: brief.voice.speed ?? 1,
        out: join(dir, `${s.id}.mp3`),
      });
      writeJson(join(dir, `${s.id}.words.json`), r.words);
      writeFileSync(file(s.id, "key"), stamp(s));
      return `${s.id} ${r.seconds.toFixed(1)}s`;
    });
    results.push(...(await Promise.all(batch)));
  }
  return results;
}

export async function samples(project, text, names) {
  const dir = ensureDir(join(project, "samples"));
  const picks = names.map((n) => voiceById(n)).filter(Boolean);
  return Promise.all(
    picks.map(async (v) => {
      const out = join(dir, `voice-${v.name.toLowerCase()}.mp3`);
      const r = await synth(project, { voice: v.id, text, out });
      return `${v.name} (${v.desc}): ${out} ${r.seconds.toFixed(1)}s`;
    }),
  );
}

export async function music(project, prompt, seconds) {
  const out = join(ensureDir(join(project, "assets", "music")), "bgm.mp3");
  const audio = await call(project, "/v1/music?output_format=mp3_44100_128", { prompt, music_length_ms: Math.min(600000, Math.round(seconds * 1000)), force_instrumental: true }, true);
  writeFileSync(out, audio);
  return out;
}

// Light SFX set, generated once per machine and normalized (200 Hz high-pass, peak -24 dBFS)
// so they sit well under the voice.
export const SFX_PROMPTS = {
  whoosh: ["soft short whoosh transition sound, clean, subtle", 0.8],
  click: ["single soft UI click, clean", 0.5],
  pop: ["soft bubble pop user interface sound, subtle", 0.6],
  chime: ["gentle positive notification chime, warm, short", 1.6],
  typing: ["short burst of quiet keyboard typing", 1.5],
};

export async function ensureSfx(project) {
  const cache = ensureDir(join(CACHE_DIR, "sfx"));
  const dest = ensureDir(join(project, "assets", "sfx"));
  const made = [];
  for (const [name, [prompt, secs]] of Object.entries(SFX_PROMPTS)) {
    const final = join(cache, `${name}.mp3`);
    if (!existsSync(final)) {
      const raw = join(cache, `${name}.raw.mp3`);
      writeFileSync(raw, await call(project, "/v1/sound-generation?output_format=mp3_44100_128", { text: prompt, duration_seconds: secs, prompt_influence: 0.6 }, true));
      const peak = Number((run("ffmpeg", ["-hide_banner", "-i", raw, "-af", "highpass=f=200,volumedetect", "-f", "null", "-"]).err.match(/max_volume: (-?[\d.]+)/) ?? [])[1] ?? -3);
      ffmpeg(["-i", raw, "-af", `highpass=f=200,volume=${(-24 - peak).toFixed(1)}dB`, "-c:a", "libmp3lame", "-q:a", "2", final]);
      made.push(name);
    }
    copyFileSync(final, join(dest, `${name}.mp3`));
  }
  return made;
}

export function rateFor(brief) {
  const v = voiceById(brief.voice.id) ?? { wps: 2.35 };
  return (brief.voice.measured_wps ?? v.wps) * (brief.voice.speed ?? 1);
}

export function measuredWps(project, scenes) {
  let words = 0;
  let secs = 0;
  for (const s of scenes) {
    const f = join(project, "assets", "voice", "raw", `${s.id}.words.json`);
    if (!s.say || !existsSync(f)) continue;
    const w = JSON.parse(readFileSync(f, "utf8"));
    if (!w.length) continue;
    words += w.length;
    secs += w[w.length - 1].end;
  }
  return secs > 0 ? words / secs : null;
}
