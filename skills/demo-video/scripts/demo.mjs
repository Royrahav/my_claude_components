#!/usr/bin/env node
// demo-video CLI. Every command prints a few compact lines (they are read by the agent).
//   node demo.mjs <command> [project-dir] [options]
// Commands: setup | init | theme | theme-from-site | voices | samples | plan | narrate | sfx | music | music-library |
//           build | check | render | script | status | history

import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CONFIG_PATH, HF, LEAD, SKILL_DIR, apiKey, clock, config, defaultBrief, ensureDir, flag, formatDurations, hf, loadProject, onlySet, projectFiles, r2, readJson, run, writeJson } from "./lib/util.mjs";
import { brandFromSite, fontCss, installFonts, loadTheme } from "./lib/theme.mjs";
import { chooseVoice, defaultVoice, engineOf, ensureSfx, impliedEngine, machineEngine, measuredWps, music, narrate, rateFor, sampleVoiceNames, samples, voicesOf } from "./lib/voice.mjs";
import { kokoroSetupLines } from "./lib/kokoro.mjs";
import { buildTimeline, holdFor, makeCue, silentSeconds } from "./lib/timeline.mjs";
import { chromeStart, createScene, wrap } from "./lib/kit.mjs";
import { planChapterIntro, startsChapter } from "./lib/fillers.mjs";
import { emptyScreenWarnings } from "./lib/screen-gaps.mjs";
import { writeCaptions } from "./lib/captions.mjs";
import { writeIndex } from "./lib/assemble.mjs";
import { mainLayers, writeLayerFiles } from "./lib/layers.mjs";
import { checkOutcome, contactSheet, lintAndCheck } from "./lib/check.mjs";
import { render } from "./lib/render.mjs";
import { USER_AGENTS_DIR, cursorHome, cursorSkillDiscovery, hostsFor, installAgents, installCursorAgents } from "./lib/agents.mjs";
import { adoptBed, describeSlot, listLibrary, planMusic, shortBedWarning, useMood } from "./lib/music.mjs";
import { historyPaths, historyReport, lastMusicMood, readHistory, recordOf, recordRender, safeHistoryWarnings } from "./lib/history.mjs";
import { houseStyleWarnings, missingQuestionWarnings } from "./lib/house-style.mjs";
import { describeDirection, enteringTransitions, resolveDirection } from "./lib/direction.mjs";
import { templateFor } from "./lib/variants.mjs";
import { previousThreeD, readThreeD, threeDFlags, threeDPath } from "./lib/scene3d.mjs";
import { templateFacts, templatePath, templateSource } from "./lib/template-source.mjs";

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
  const tts = flag(argv, "tts");
  if (tts) engineOf({ engine: tts }); // refuse an unknown engine before it is saved
  if (dir || tts || !existsSync(CONFIG_PATH)) writeJson(CONFIG_PATH, { ...cfg, projects_dir: dir ? resolve(dir) : cfg.projects_dir, ...(tts && { tts }) });
  say(`projects dir: ${config().projects_dir}`, `voice engine for new projects: ${machineEngine()} (change with setup --tts elevenlabs|kokoro)`);
  say(...kokoroSetupLines());
  const key = apiKey();
  say(key ? "ElevenLabs key: found (music, sound effects, ElevenLabs voices)" : `ElevenLabs key: not set (optional: only for generating music or sound effects, or voicing with ElevenLabs; then write ELEVENLABS_API_KEY=... to ${join(CONFIG_PATH, "..", ".env")})`);
  const cursorDir = cursorHome();
  const hosts = hostsFor(flag(argv, "host"), { cursorExists: existsSync(cursorDir) });
  if (hosts.claude) setupClaudeAgents();
  if (hosts.cursor) setupCursorAgents(cursorDir);
}

function setupClaudeAgents() {
  const agents = installAgents(join(SKILL_DIR, "agents"), USER_AGENTS_DIR);
  const stale = agents.removed.length ? `; removed stale: ${agents.removed.join(", ")}` : "";
  say(`agents: ${agents.installed.length} installed (${agents.installed.join(", ")})${stale}`);
  if (agents.created) say("restart Claude Code once: the agents folder was just created");
}

// Cursor copies go to <cursor home>/agents; --cursor-model <id> replaces the default (inherit the parent model).
function setupCursorAgents(cursorDir) {
  const model = flag(argv, "cursor-model", "inherit");
  if (typeof model !== "string" || model.trim() === "") throw new Error("--cursor-model needs a Cursor model id (as listed in Cursor's model picker)");
  const agents = installCursorAgents(join(SKILL_DIR, "agents"), join(cursorDir, "agents"), { model });
  say(`cursor agents: ${agents.installed.length} installed in ${join(cursorDir, "agents")} (model ${model})`, cursorSkillDiscovery({ cursorDir }));
}

// Copies a built-in theme (labos | labos-dark | neutral | midnight) or a theme folder / theme.json into <project>/theme.
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
  if (!existsSync(f.brief)) writeJson(f.brief, defaultBrief({ name, product, musicPrompt: th.music_prompt, voice: defaultVoice(machineEngine()) }));
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
    const sec = (s.duration ?? (s.say ? LEAD + w / rate + holdFor(s, pacing) : silentSeconds(s)));
    total += sec;
    words += w;
    return `${s.id} ${s.type} ${w}w ~${sec.toFixed(1)}s${s.question ? ` Q "${s.question}"` : ""}`;
  });
  const target = Number(flag(argv, "target", brief.length_s));
  const overhead = total - words / rate;
  const speed = Number(brief.voice.speed ?? 1);
  const needSpeed = Math.min(1.15, Math.max(0.95, (speed * (words / rate)) / Math.max(1, target - overhead)));
  say(
    rows.join(" | "),
    `total ~${clock(total)} (${words} words at ${rate.toFixed(2)} w/s), target ${clock(target)}, word budget at the current speed ~${Math.round((target - overhead) * rate)}`,
    `speed to hit target: ${needSpeed.toFixed(2)} (now ${speed.toFixed(2)}; set with narrate --speed)`,
    ...missingQuestionWarnings(scenes).map((w) => `warn: ${w}`),
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
  const templates = templateFacts(root, scenes, sources);
  const sfxMapPath = join(root, ".demo", "sfx.json");
  const sceneSfx = only && existsSync(sfxMapPath) ? readJson(sfxMapPath) : {};
  const threeD = previousThreeD(root, only); // scene id -> built a 3D stage; kept across --only builds
  ensureDir(f.comps);
  const screenWarnings = [];
  for (const [i, s] of scenes.entries()) {
    if (only && !only.has(s.id)) continue;
    const stl = tl.scenes[i];
    if (sources[i] === "custom") {
      delete threeD[s.id];
      const file = join(f.comps, `${s.id}.html`);
      if (!existsSync(file)) warnings.push(`${s.id}: custom scene file compositions/${s.id}.html missing`);
      else writeFileSync(file, readFileSync(file, "utf8").replace(/(data-composition-id="[^"]+" data-start="0" data-duration=")[\d.]+/, `$1${stl.duration}`).replace(/(class="clip[^"]*" data-start="0" data-duration=")[\d.]+/, `$1${stl.duration}`));
      continue;
    }
    const tplPath = templatePath(root, s.type);
    if (!existsSync(tplPath)) throw new Error(`${s.id}: unknown scene type "${s.type}" (not in the skill or <project>/scenes/)`);
    const tpl = templateFor(await import(pathToFileURL(tplPath).href), s);
    const k = createScene({ id: s.id, theme, fontsCss, brief, scene: s, duration: stl.duration, direction, index: i });
    const res = tpl(k, s.data ?? {}, makeCue(stl, warnings)) ?? {};
    const intro = chapterIntroPlan({ direction, scenes, i, k, entrance: transitions[i], warnings });
    writeFileSync(join(f.comps, `${s.id}.html`), wrap(k, { fontsCss, chrome: res.chrome !== false, eyebrow: brief.eyebrow ?? brief.product, entrance: transitions[i], intro }));
    screenWarnings.push(...emptyScreenWarnings({ id: s.id, scene: s, intervals: k.visibleIntervals(), duration: stl.duration }));
    sceneSfx[s.id] = k.sfx;
    threeD[s.id] = k.is3d;
    warnings.push(...k.warnings.map((message) => `${s.id}: ${message}`));
  }
  writeJson(sfxMapPath, sceneSfx);
  writeJson(threeDPath(root), threeD);
  const caps = brief.captions !== false ? writeCaptions(root, tl, theme, fontsCss, direction.captions) : 0;
  const sfxOn = brief.sfx !== false && existsSync(join(f.sfx, "pop.mp3"));
  if (brief.sfx !== false && !sfxOn) warnings.push("SFX files missing: run `sfx` (or set brief.sfx false)");
  const layers = mainLayers({ direction, theme, tl, scenes, transitions, fontsCss });
  warnings.push(...layers.warnings);
  writeLayerFiles(f.comps, layers);
  const { sfx } = writeIndex(root, tl, scenes, sceneSfx, { canvas: theme.colors.canvas, captions: brief.captions !== false, sfxOn, transitions, layers });
  const dashes = JSON.stringify(scenes).match(/[\u2013\u2014]/g);
  if (dashes) warnings.push(`${dashes.length} em/en dash characters in scenes.json (house style: plain hyphens)`);
  warnings.push(...houseStyleWarnings(scenes, { sources, transitions, durations: tl.scenes.map((s) => s.duration), allowTerms: brief.allow_terms, threeD: threeDFlags(scenes, threeD), templates }));
  warnings.push(...safeHistoryWarnings(recordOf({ root, brief, scenes, sources, direction, threeD: threeDFlags(scenes, threeD), templates }), historyPaths().history));
  warnings.push(...screenWarnings); // last: only the first 20 warnings print, and the house-style ones matter more
  const directionLine = brief.direction ? [`direction: ${describeDirection(direction)}`] : [];
  say(formatDurations(tl, only), `total ${clock(tl.total)} (${tl.total}s), captions ${caps} groups, sfx ${sfx}`, ...directionLine, ...warnings.slice(0, 20).map((w) => `warn: ${w}`));
}

// The chapter intro's timing for scene i (direction.chapter_intro "on", the scene opens a chapter), or null; a
// scene whose first content cue leaves no room for it is skipped with a warning.
function chapterIntroPlan({ direction, scenes, i, k, entrance, warnings }) {
  if (direction.chapter_intro !== "on" || !startsChapter(scenes, i)) return null;
  const firstCue = k.firstContentCue();
  const plan = planChapterIntro({ start: chromeStart(entrance), firstCue });
  if (!plan) warnings.push(`${scenes[i].id}: chapter intro skipped (the first content cue at ${r2(firstCue)} s leaves no room)`);
  return plan;
}

// After a successful render: this video joins the history. A history file that cannot be written is reported, not fatal.
function recordInHistory(root) {
  try {
    const { brief, scenes } = loadProject(root);
    const sources = scenes.map((s) => templateSource(root, s.type));
    recordRender(recordOf({ root, brief, scenes, sources, direction: resolveDirection(brief.direction), threeD: threeDFlags(scenes, readThreeD(root)), templates: templateFacts(root, scenes, sources) }), historyPaths().history);
    return "history: recorded";
  } catch (e) {
    return `history: not recorded (${e.message})`;
  }
}

// The project's music bed: the mood's library track (generated into the library only when its slot is
// empty), or a one-off --prompt / --file that stays in this project and survives a plain rerun (music_custom).
// --adopt seeds an empty slot from the bed and leaves the brief alone.
async function musicBed() {
  const root = project();
  const { f, brief } = loadProject(root);
  const adopt = flag(argv, "adopt");
  if (adopt) return say(`library: ${adopt} seeded (${adoptBed(adopt, f.music)})`, shortBedWarning(f.music));
  const file = flag(argv, "file");
  const prompt = flag(argv, "prompt");
  const choice = planMusic(brief, {
    asked: flag(argv, "mood"),
    custom: Boolean(file || prompt),
    customBedPresent: existsSync(f.music),
    lastMood: lastMusicMood(readHistory(historyPaths().history), root),
  });
  saveBrief(f, brief, choice.brief);
  if (choice.keepBed) return say(`music bed: ${f.music} (kept: a custom bed; use --mood <slot> to switch to the library)`);
  if (file || prompt) return say(file ? copyBed(f, file) : await customBed(root, f, brief, prompt));
  const { bed, generated } = await useMood(root, choice.mood);
  return say(`music bed: ${bed} (mood ${choice.mood}, ${generated ? "generated into the library" : "from the library"})`);
}

function copyBed(f, file) {
  ensureDir(dirname(f.music));
  cpSync(resolve(file), f.music);
  return `music bed: ${f.music} (user file)`;
}

async function customBed(root, f, brief, prompt) {
  const total = existsSync(f.timeline) ? readJson(f.timeline).total : brief.length_s;
  const out = await music(root, prompt === true ? brief.music_prompt : prompt, total + 8);
  return `music bed: ${out} (custom prompt, this project only)`;
}

// brief.music_mood is the mood the history records; a custom bed has none and sets music_custom instead.
function saveBrief(f, before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) writeJson(f.brief, after);
}

function script() {
  const root = project();
  const { brief, scenes } = loadProject(root);
  const words = scenes.reduce((n, s) => n + (s.say ?? "").split(/\s+/).filter(Boolean).length, 0);
  const md = [`# ${brief.product} - narration`, "", `${scenes.length} scenes, ${words} words, about ${clock(words / rateFor(brief))} of speech.`, "", ...scenes.flatMap((s, i) => [`## ${i + 1}. ${s.chapter ?? s.type} (${s.id}, ${s.type})`, "", ...(s.question ? [`Question: ${s.question}`, ""] : []), s.say ?? "(silent)", ""])].join("\n");
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
    case "voices": {
      const engine = engineOf({ engine: flag(argv, "engine", machineEngine()) });
      return say(`engine ${engine}`, voicesOf(engine).map((v) => `${v.name} ${v.id} - ${v.desc}`).join("\n"));
    }
    case "samples": {
      const root = project();
      const { brief, scenes } = loadProject(root);
      const engine = engineOf({ engine: flag(argv, "engine", engineOf(brief.voice)) });
      const text = flag(argv, "text", scenes.find((s) => s.say)?.say);
      const names = String(flag(argv, "voices", sampleVoiceNames(engine))).split(",");
      return say(...(await samples(root, text, names, engine)));
    }
    case "plan":
      return plan();
    case "narrate": {
      const root = project();
      const { brief, scenes } = loadProject(root);
      const asked = flag(argv, "engine");
      const implied = asked ? undefined : impliedEngine(brief.voice);
      const voice = chooseVoice(brief.voice, { engine: asked ?? implied, voice: flag(argv, "voice"), speed: flag(argv, "speed") });
      if (JSON.stringify(voice) !== JSON.stringify(brief.voice)) {
        brief.voice = voice;
        writeJson(projectFiles(root).brief, brief);
      }
      const res = await narrate(root, scenes, brief, onlySet(flag(argv, "only")), argv.includes("--force"));
      const wps = measuredWps(root, scenes);
      if (wps) {
        brief.voice.measured_wps = r2(wps / (brief.voice.speed ?? 1));
        writeJson(projectFiles(root).brief, brief);
      }
      const notice = implied ? [`note: the brief had no voice.engine, so the machine default applies: ${implied} (voice ${brief.voice.name}); \`--engine elevenlabs\` keeps ElevenLabs`] : [];
      return say(...notice, res.join(" | "), `measured ${wps ? wps.toFixed(2) : "?"} words/s; next: build`);
    }
    case "sfx": {
      const made = await ensureSfx(project());
      return say(`sfx ready${made.length ? ` (generated ${made.join(", ")})` : " (cached)"}`);
    }
    case "music":
      return musicBed();
    case "music-library":
      return say(...listLibrary().map(describeSlot));
    case "build":
      return build();
    case "check": {
      const root = project();
      const f = projectFiles(root);
      const r = lintAndCheck(root);
      const outcome = checkOutcome(r, loadProject(root).scenes);
      const sheet = contactSheet(root, readJson(f.timeline), flag(argv, "mid") ? "mid" : "end");
      if (outcome.failed) process.exitCode = 1;
      return say(...outcome.lines, `contact sheet: ${sheet.out}`);
    }
    case "render": {
      const root = project();
      const { f, brief } = loadProject(root);
      const tl = readJson(f.timeline);
      const result = render(root, brief, tl, { quality: flag(argv, "quality", brief.quality ?? "standard"), workers: Number(flag(argv, "workers", 5)), out: flag(argv, "out"), mixOnly: argv.includes("--mix-only") });
      return say(result, recordInHistory(root));
    }
    case "history":
      return say(...historyReport(project()));
    case "script":
      return script();
    case "status":
      return status();
    default:
      say("usage: node demo.mjs <setup|init|theme|theme-from-site|voices|samples|plan|narrate|sfx|music|music-library|build|check|render|script|status|history> [project] [--options]");
  }
}

main().catch((e) => {
  console.error(`demo: ${e.message}`);
  process.exitCode = 1;
});
