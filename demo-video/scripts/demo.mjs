#!/usr/bin/env node
// demo-video CLI. Every command prints a few compact lines (they are read by the agent).
//   node demo.mjs <command> [project-dir] [options]
// Commands: setup | init | theme | theme-from-site | voices | samples | plan | narrate | sfx | music |
//           build | check | render | script | status

import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CONFIG_PATH, HF, LEAD, SKILL_DIR, apiKey, clock, config, defaultBrief, ensureDir, flag, formatDurations, hf, loadProject, onlySet, projectFiles, r2, readJson, run, writeJson } from "./lib/util.mjs";
import { brandFromSite, fontCss, installFonts, loadTheme } from "./lib/theme.mjs";
import { STOCK_VOICES, ensureSfx, measuredWps, music, narrate, rateFor, samples, voiceById } from "./lib/voice.mjs";
import { buildTimeline, holdFor, makeCue } from "./lib/timeline.mjs";
import { createScene, wrap } from "./lib/kit.mjs";
import { writeCaptions } from "./lib/captions.mjs";
import { writeIndex } from "./lib/assemble.mjs";
import { contactSheet, lintAndCheck } from "./lib/check.mjs";
import { render } from "./lib/render.mjs";
import { USER_AGENTS_DIR, installAgents } from "./lib/agents.mjs";
import { houseStyleWarnings } from "./lib/house-style.mjs";
import { describeDirection, enteringTransitions, resolveDirection } from "./lib/direction.mjs";
import { templateFor } from "./lib/variants.mjs";
import { templatePath, templateSource } from "./lib/template-source.mjs";

const argv = process.argv.slice(2);
const cmd = argv[0];
const positional = argv[1] && !argv[1].startsWith("--") ? argv[1] : null;
const project = () => resolve(positional ?? ".");
const say = (...l) => console.log(l.join("\n"));

async function setup() {
  const node = Number(process.versions.node.split(".")[0]);
  say(`node ${process.versions.node} ${node >= 22 ? "ok" : "TOO OLD (need 22+)"}`);
  const ff = run("ffmpeg", ["-version"]);
  say(ff.code === 0 ? "ffmpeg ok" : "ffmpeg MISSING: Windows `winget install Gyan.FFmpeg` | macOS `brew install ffmpeg` | Linux `sudo apt install ffmpeg`");
  const b = hf(["browser", "ensure"]);
  say(`hyperframes ${HF}: ${b.code === 0 ? "ok, render browser ready" : `browser setup FAILED: ${(b.out + b.err).trim().split("\n").slice(-2).join(" ")}`}`);
  const cfg = config();
  const dir = flag(argv, "projects-dir");
  if (dir || !existsSync(CONFIG_PATH)) writeJson(CONFIG_PATH, { ...cfg, projects_dir: dir ? resolve(dir) : cfg.projects_dir });
  say(`projects dir: ${config().projects_dir}`);
  const key = apiKey();
  say(key ? "ElevenLabs key: found" : `ElevenLabs key: MISSING (ask the user for it, then write ELEVENLABS_API_KEY=... to ${join(CONFIG_PATH, "..", ".env")})`);
  const agents = installAgents(join(SKILL_DIR, "agents"), USER_AGENTS_DIR);
  const stale = agents.removed.length ? `; removed stale: ${agents.removed.join(", ")}` : "";
  say(`agents: ${agents.installed.length} installed (${agents.installed.join(", ")})${stale}`);
  if (agents.created) say("restart Claude Code once: the agents folder was just created");
}

// Copies a built-in theme (labos | neutral | midnight) or a theme folder / theme.json into <project>/theme.
function useTheme(dir, themeArg) {
  const src = existsSync(themeArg) ? resolve(themeArg, themeArg.endsWith(".json") ? ".." : ".") : join(SKILL_DIR, "assets", "themes", themeArg);
  if (!existsSync(join(src, "theme.json"))) throw new Error(`unknown theme ${themeArg}; available: ${readdirSync(join(SKILL_DIR, "assets", "themes")).join(", ")}`);
  if (resolve(src) !== resolve(dir, "theme")) cpSync(src, join(dir, "theme"), { recursive: true });
}

// Switches theme (--use) or re-applies an edited theme/theme.json: fonts are re-downloaded, colors re-derived.
async function themeCmd() {
  const root = project();
  const use = flag(argv, "use");
  if (use) useTheme(root, use);
  const th = loadTheme(projectFiles(root).theme);
  const fonts = await installFonts(root, th);
  say(`theme ${th.name} (${th.mode}), ${fonts} font files, accent text ${th.derived.accentText}; next: build`);
}

async function init() {
  const dir = resolve(positional ?? join(config().projects_dir, flag(argv, "name", "demo")));
  const f = projectFiles(dir);
  ensureDir(dir);
  useTheme(dir, flag(argv, "theme", "labos"));
  const th = loadTheme(f.theme);
  const fonts = await installFonts(dir, th);
  const name = basename(dir);
  const product = flag(argv, "product", name);
  if (!existsSync(f.brief)) writeJson(f.brief, defaultBrief({ name, product, musicPrompt: th.music_prompt }));
  if (!existsSync(f.scenes)) cpSync(join(SKILL_DIR, "assets", "scenes.example.json"), f.scenes);
  if (!existsSync(f.pron)) cpSync(join(SKILL_DIR, "assets", "pronunciations.default.json"), f.pron);
  if (!existsSync(join(dir, ".env"))) writeFileSync(join(dir, ".env"), "# ELEVENLABS_API_KEY=  (optional here; the machine-level key in ~/.config/demo-video/.env is used otherwise)\n");
  writeJson(join(dir, "hyperframes.json"), { $schema: "https://hyperframes.heygen.com/schema/hyperframes.json", paths: { blocks: "compositions", components: "compositions/components", assets: "assets" }, media: { autoProxy: true } });
  writeJson(join(dir, "meta.json"), { id: name, name, createdAt: new Date().toISOString() });
  ensureDir(f.comps);
  say(`project ${dir}`, `theme ${th.name} (${th.mode}), ${fonts} font files, accent text ${th.derived.accentText}`, "next: write FACTS.md, brief.json, scenes.json; then `plan`");
}

function status() {
  const f = projectFiles(project());
  const has = (p) => existsSync(p);
  const takes = has(f.raw) ? readdirSync(f.raw).filter((x) => x.endsWith(".mp3")).length : 0;
  const comps = has(f.comps) ? readdirSync(f.comps).filter((x) => x.endsWith(".html")).length : 0;
  const renders = has(f.renders) ? readdirSync(f.renders).filter((x) => x.endsWith(".mp4") && !x.startsWith(".")) : [];
  const scenes = has(f.scenes) ? (readJson(f.scenes).scenes ?? []).length : 0;
  say(`FACTS.md ${has(f.facts) ? "yes" : "no"} | scenes ${scenes} | takes ${takes} | music ${has(f.music) ? "yes" : "no"} | compositions ${comps} | renders ${renders.join(", ") || "none"}`);
  const next = !has(f.facts) ? "research -> FACTS.md" : !scenes ? "write scenes.json" : takes < scenes ? "samples/narrate" : !comps ? "build" : renders.length ? "deliver or apply changes" : "check, then render";
  say(`next: ${next}`);
}

function plan() {
  const { brief, scenes } = loadProject(project());
  const rate = rateFor(brief);
  const { pacing } = resolveDirection(brief.direction);
  let total = 0;
  let words = 0;
  const rows = scenes.map((s) => {
    const w = (s.say ?? "").split(/\s+/).filter(Boolean).length;
    const sec = (s.duration ?? (s.say ? LEAD + w / rate + holdFor(s, pacing) : 6));
    total += sec;
    words += w;
    return `${s.id} ${s.type} ${w}w ~${sec.toFixed(1)}s`;
  });
  const target = Number(flag(argv, "target", brief.length_s));
  const overhead = total - words / rate;
  const speed = Number(brief.voice.speed ?? 1);
  const needSpeed = Math.min(1.15, Math.max(0.95, (speed * (words / rate)) / Math.max(1, target - overhead)));
  say(
    rows.join(" | "),
    `total ~${clock(total)} (${words} words at ${rate.toFixed(2)} w/s), target ${clock(target)}, word budget at the current speed ~${Math.round((target - overhead) * rate)}`,
    `speed to hit target: ${needSpeed.toFixed(2)} (now ${speed.toFixed(2)}; set with narrate --speed)`,
  );
}

async function build() {
  const root = project();
  const { f, brief, scenes } = loadProject(root);
  const only = onlySet(flag(argv, "only"));
  const theme = loadTheme(f.theme);
  const direction = resolveDirection(brief.direction);
  const transitions = enteringTransitions(scenes, direction.transitions);
  const fontsCss = fontCss(root);
  const { tl, warnings } = buildTimeline(f, scenes, { pacing: direction.pacing });
  const sources = scenes.map((s) => templateSource(root, s.type));
  const sfxMapPath = join(root, ".demo", "sfx.json");
  const sceneSfx = only && existsSync(sfxMapPath) ? readJson(sfxMapPath) : {};
  ensureDir(f.comps);
  for (const [i, s] of scenes.entries()) {
    if (only && !only.has(s.id)) continue;
    const stl = tl.scenes[i];
    if (sources[i] === "custom") {
      const file = join(f.comps, `${s.id}.html`);
      if (!existsSync(file)) warnings.push(`${s.id}: custom scene file compositions/${s.id}.html missing`);
      else writeFileSync(file, readFileSync(file, "utf8").replace(/(data-composition-id="[^"]+" data-start="0" data-duration=")[\d.]+/, `$1${stl.duration}`).replace(/(class="clip[^"]*" data-start="0" data-duration=")[\d.]+/, `$1${stl.duration}`));
      continue;
    }
    const tplPath = templatePath(root, s.type);
    if (!existsSync(tplPath)) throw new Error(`${s.id}: unknown scene type "${s.type}" (not in the skill or <project>/scenes/)`);
    const tpl = templateFor(await import(pathToFileURL(tplPath).href), s);
    const k = createScene({ id: s.id, theme, fontsCss, brief, scene: s, duration: stl.duration, direction });
    const res = tpl(k, s.data ?? {}, makeCue(stl, warnings)) ?? {};
    writeFileSync(join(f.comps, `${s.id}.html`), wrap(k, { fontsCss, chrome: res.chrome !== false, eyebrow: brief.eyebrow ?? brief.product, entrance: transitions[i] }));
    sceneSfx[s.id] = k.sfx;
  }
  writeJson(sfxMapPath, sceneSfx);
  const caps = brief.captions !== false ? writeCaptions(root, tl, theme, fontsCss, direction.captions) : 0;
  const sfxOn = brief.sfx !== false && existsSync(join(f.sfx, "pop.mp3"));
  if (brief.sfx !== false && !sfxOn) warnings.push("SFX files missing: run `sfx` (or set brief.sfx false)");
  const { sfx } = writeIndex(root, tl, scenes, sceneSfx, { canvas: theme.colors.canvas, captions: brief.captions !== false, sfxOn, transitions });
  const dashes = JSON.stringify(scenes).match(/[\u2013\u2014]/g);
  if (dashes) warnings.push(`${dashes.length} em/en dash characters in scenes.json (house style: plain hyphens)`);
  warnings.push(...houseStyleWarnings(scenes, { sources, transitions }));
  const directionLine = brief.direction ? [`direction: ${describeDirection(direction)}`] : [];
  say(formatDurations(tl, only), `total ${clock(tl.total)} (${tl.total}s), captions ${caps} groups, sfx ${sfx}`, ...directionLine, ...warnings.slice(0, 20).map((w) => `warn: ${w}`));
}

function script() {
  const root = project();
  const { brief, scenes } = loadProject(root);
  const words = scenes.reduce((n, s) => n + (s.say ?? "").split(/\s+/).filter(Boolean).length, 0);
  const md = [`# ${brief.product} - narration`, "", `${scenes.length} scenes, ${words} words, about ${clock(words / rateFor(brief))} of speech.`, "", ...scenes.flatMap((s, i) => [`## ${i + 1}. ${s.chapter ?? s.type} (${s.id}, ${s.type})`, "", s.say ?? "(silent)", ""])].join("\n");
  writeFileSync(join(root, "SCRIPT.md"), md);
  say(`SCRIPT.md written: ${scenes.length} scenes, ${words} words`);
}

async function main() {
  switch (cmd) {
    case "setup":
      return setup();
    case "init":
      return init();
    case "theme":
      return themeCmd();
    case "theme-from-site":
      return say(JSON.stringify(await brandFromSite(positional), null, 1));
    case "voices":
      return say(STOCK_VOICES.map((v) => `${v.name} ${v.id} - ${v.desc}`).join("\n"));
    case "samples": {
      const root = project();
      const { scenes } = loadProject(root);
      const text = flag(argv, "text", scenes.find((s) => s.say)?.say);
      const names = String(flag(argv, "voices", "Matilda,River,Brian,Daniel")).split(",");
      return say(...(await samples(root, text, names)));
    }
    case "plan":
      return plan();
    case "narrate": {
      const root = project();
      const { brief, scenes } = loadProject(root);
      const sp = flag(argv, "speed");
      if (sp) brief.voice.speed = Number(sp);
      const v = flag(argv, "voice");
      if (v) {
        const sv = voiceById(v);
        brief.voice = { ...brief.voice, id: sv?.id ?? v, name: sv?.name ?? v };
      }
      if (sp || v) writeJson(projectFiles(root).brief, brief);
      const res = await narrate(root, scenes, brief, onlySet(flag(argv, "only")), argv.includes("--force"));
      const wps = measuredWps(root, scenes);
      if (wps) {
        brief.voice.measured_wps = r2(wps / (brief.voice.speed ?? 1));
        writeJson(projectFiles(root).brief, brief);
      }
      return say(res.join(" | "), `measured ${wps ? wps.toFixed(2) : "?"} words/s; next: build`);
    }
    case "sfx": {
      const made = await ensureSfx(project());
      return say(`sfx ready${made.length ? ` (generated ${made.join(", ")})` : " (cached)"}`);
    }
    case "music": {
      const root = project();
      const { brief } = loadProject(root);
      const file = flag(argv, "file");
      const f = projectFiles(root);
      if (file) {
        ensureDir(join(root, "assets", "music"));
        cpSync(resolve(file), f.music);
        return say(`music bed: ${f.music} (user file)`);
      }
      const tlTotal = existsSync(f.timeline) ? readJson(f.timeline).total : brief.length_s;
      const out = await music(root, flag(argv, "prompt", brief.music_prompt), tlTotal + 8);
      return say(`music bed: ${out}`);
    }
    case "build":
      return build();
    case "check": {
      const root = project();
      const f = projectFiles(root);
      const r = lintAndCheck(root);
      const sheet = contactSheet(root, readJson(f.timeline), flag(argv, "mid") ? "mid" : "end");
      return say(r.text, `contact sheet: ${sheet.out}`);
    }
    case "render": {
      const root = project();
      const { f, brief } = loadProject(root);
      const tl = readJson(f.timeline);
      return say(render(root, brief, tl, { quality: flag(argv, "quality", brief.quality ?? "standard"), workers: Number(flag(argv, "workers", 5)), out: flag(argv, "out"), mixOnly: argv.includes("--mix-only") }));
    }
    case "script":
      return script();
    case "status":
      return status();
    default:
      say("usage: node demo.mjs <setup|init|theme|theme-from-site|voices|samples|plan|narrate|sfx|music|build|check|render|script|status> [project] [--options]");
  }
}

main().catch((e) => {
  console.error(`demo: ${e.message}`);
  process.exitCode = 1;
});
