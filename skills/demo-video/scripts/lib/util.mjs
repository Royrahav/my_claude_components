// Shared helpers: paths, processes, JSON, env, audio probes. Output stays compact on purpose:
// every line printed here lands in the calling model's context.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const HF = "hyperframes@0.8.115";
export const CACHE_DIR = join(homedir(), ".cache", "demo-video");
export const CONFIG_PATH = join(homedir(), ".config", "demo-video", "config.json");
export const W = 1920;
export const H = 1080;
export const CAPTION_TOP = 900;
export const LEAD = 0.35;

const isWin = process.platform === "win32";
const quote = (a) => (/[\s"&|<>^()]/.test(a) ? `"${String(a).replace(/"/g, '\\"')}"` : String(a));

// Runs a command; `shell` is needed on Windows for npx/.cmd shims only.
export function run(cmd, args = [], { cwd, shell = false, input } = {}) {
  const useShell = shell && isWin;
  const r = spawnSync(useShell ? [cmd, ...args.map(quote)].join(" ") : cmd, useShell ? [] : args, {
    cwd,
    shell: useShell,
    encoding: "utf8",
    input,
    maxBuffer: 256 * 1024 * 1024,
  });
  return { code: r.status ?? 1, out: r.stdout ?? "", err: r.stderr ?? "", error: r.error };
}

export function hf(args, cwd) {
  return run("npx", ["--yes", HF, ...args], { cwd, shell: true });
}

export function ffmpeg(args) {
  const r = run("ffmpeg", ["-hide_banner", "-nostats", "-y", ...args]);
  if (r.code !== 0) throw new Error(`ffmpeg failed: ${r.err.slice(-600)}`);
  return r.err;
}

export function duration(file) {
  const r = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number(r.out.trim());
}

// Integrated loudness (LUFS) of a media file's audio.
export function lufs(file, start, length) {
  const pre = start != null ? ["-ss", String(start), "-t", String(length)] : [];
  const r = run("ffmpeg", ["-hide_banner", "-nostats", ...pre, "-i", file, "-af", "ebur128=framelog=quiet", "-f", "null", "-"]);
  const m = r.err.match(/I:\s+(-?\d+(?:\.\d+)?) LUFS/);
  return m ? Number(m[1]) : null;
}

export const r3 = (x) => Math.round(x * 1000) / 1000;
export const r2 = (x) => Math.round(x * 100) / 100;

export function readJson(file, fallback) {
  if (!existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing ${file}`);
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

export function writeJson(file, value) {
  ensureDir(dirname(file));
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function config() {
  return readJson(CONFIG_PATH, { projects_dir: join(homedir(), "demo-videos") });
}

// ELEVENLABS_API_KEY from the environment, the project .env, or the machine config folder .env.
export function apiKey(project) {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  for (const file of [project && join(project, ".env"), join(dirname(CONFIG_PATH), ".env")].filter(Boolean)) {
    if (!existsSync(file)) continue;
    const m = readFileSync(file, "utf8").match(/^ELEVENLABS_API_KEY\s*=\s*"?([^"\r\n]+)"?/m);
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

export function projectFiles(project) {
  const p = resolve(project);
  return {
    root: p,
    brief: join(p, "brief.json"),
    scenes: join(p, "scenes.json"),
    facts: join(p, "FACTS.md"),
    pron: join(p, "pronunciations.json"),
    theme: join(p, "theme", "theme.json"),
    timeline: join(p, ".demo", "timeline.json"),
    raw: join(p, "assets", "voice", "raw"),
    voice: join(p, "assets", "voice"),
    sfx: join(p, "assets", "sfx"),
    music: join(p, "assets", "music", "bgm.mp3"),
    comps: join(p, "compositions"),
    index: join(p, "index.html"),
    renders: join(p, "renders"),
    review: join(p, "review"),
  };
}

export function loadProject(project) {
  const f = projectFiles(project);
  const brief = readJson(f.brief);
  const doc = readJson(f.scenes);
  const scenes = (doc.scenes ?? doc).map((s, i) => ({ ...s, id: s.id ?? `s${String(i + 1).padStart(2, "0")}` }));
  return { f, brief, scenes };
}

const DEFAULT_MUSIC_PROMPT = "Calm, modern corporate technology background music for a product explainer. Soft synth pads, light clean electric piano, gentle muted percussion, steady 96 BPM, no vocals, no drops or builds, even low-energy bed under a voiceover, clean resolved ending.";

// A new project's brief.json; the defaults are the skill's recommended interview answers (`voice` replaces the
// stock ElevenLabs one, init passes the machine engine's default).
export function defaultBrief({ name, product, musicPrompt, voice }) {
  return {
    name,
    product,
    eyebrow: String(product).toUpperCase(),
    audience: "mixed: developers, product managers, customer-facing teams",
    length_s: 180,
    lang: "en",
    voice: voice ?? { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", speed: 1.0 },
    captions: true,
    music: true,
    sfx: true,
    quality: "standard",
    music_prompt: musicPrompt ?? DEFAULT_MUSIC_PROMPT,
  };
}

export function onlySet(arg) {
  return arg ? new Set(String(arg).split(",").map((s) => s.trim())) : null;
}

export function flag(argv, name, fallback) {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}

export const clock = (t) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`;

// build's per-scene duration line; with --only, the rebuilt scenes are marked with "*".
export function formatDurations(tl, only) {
  const line = tl.scenes.map((s) => `${s.id} ${s.duration.toFixed(1)}s${only?.has(s.id) ? "*" : ""}`).join(" | ");
  return only ? `${line} (* rebuilt)` : line;
}
