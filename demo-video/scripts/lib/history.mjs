// Render history: one record per project in history.jsonl (the last 20), so a new video can differ from
// the recent ones, plus the creator's lasting preferences in taste.md. Both live in the config folder
// (~/.config/demo-video); DEMO_VIDEO_HISTORY and DEMO_VIDEO_TASTE or the `paths` argument point elsewhere.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { CONFIG_PATH, ensureDir } from "./util.mjs";
import { variantOf } from "./variants.mjs";
import { isClose, isSummary } from "./house-style.mjs";

const MAX_RECORDS = 20;
const MAX_SHOWN = 5;
const MAX_TASTE_LINES = 20;
const COMPARED_FOR_SEQUENCE = 3;
const DEFAULT_VARIANT_NAME = "default";
const DEFAULT_TONE = "balanced";

export function historyPaths(env = process.env) {
  const dir = dirname(CONFIG_PATH);
  return { history: env.DEMO_VIDEO_HISTORY ?? join(dir, "history.jsonl"), taste: env.DEMO_VIDEO_TASTE ?? join(dir, "taste.md") };
}

// scenes carry id/type/variant; `sources[i]` is where scene i's template came from (templateSource).
export function recordOf({ root, brief, scenes, sources, direction, date = new Date().toISOString().slice(0, 10) }) {
  const close = scenes.findLast(isClose);
  const summary = scenes.length >= 2 && isSummary(scenes[scenes.length - 2]) ? scenes[scenes.length - 2] : null;
  return {
    date,
    root: resolve(root),
    name: brief.name,
    scenes: scenes.map(describeScene),
    preset: brief.direction?.preset ?? null,
    tone: direction.tone ?? null,
    freedom: direction.freedom ?? null,
    close: close ? variantOf(close) : null,
    summary: summary ? describeScene(summary) : null,
    signature: [...new Set(scenes.filter((_, i) => ["project", "custom"].includes(sources[i])).map((scene) => scene.type))],
    motif: brief.direction?.motif ?? null,
  };
}

const describeScene = (scene) => (variantOf(scene) === DEFAULT_VARIANT_NAME ? scene.type : `${scene.type}/${variantOf(scene)}`);
const sameRoot = (a, b) => (process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b);

// Records, oldest first. A line that is not valid JSON, or not a record (a root and a scene list), is
// skipped rather than blocking a build or render; the next rewrite drops it.
export function readHistory(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).flatMap(parseLine);
}

function parseLine(line) {
  try {
    const entry = JSON.parse(line);
    return typeof entry?.root === "string" && Array.isArray(entry.scenes) ? [entry] : [];
  } catch {
    return [];
  }
}

// One record per project root: it replaces the root's earlier record and becomes the most recent.
// Written through a temp file and a rename; two renders finishing at once may still lose one update.
export function recordRender(record, path) {
  const others = readHistory(path).filter((entry) => !sameRoot(entry.root, record.root));
  const kept = [...others, record].slice(-MAX_RECORDS);
  ensureDir(dirname(path));
  writeFileSync(`${path}.tmp`, `${kept.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
  renameSync(`${path}.tmp`, path);
}

// The most recent videos other than this project's, newest first.
export const otherVideos = (records, root, count = MAX_SHOWN) => records.filter((entry) => !sameRoot(entry.root, resolve(root))).slice(-count).reverse();

const field = (label, value) => (value ? [`${label} ${value}`] : []);

export function describeRecord(r) {
  const parts = [
    ...field("preset", r.preset),
    `tone ${r.tone ?? DEFAULT_TONE}`,
    ...field("freedom", r.freedom),
    `close ${r.close ?? "none"}`,
    ...field("summary", r.summary),
    ...field("signature", r.signature?.join("+")),
    ...field("motif", r.motif),
  ];
  return `${r.date} ${r.name} | ${parts.join(", ")} | ${r.scenes.join(">")}`;
}

// The compact report of `D history`: the other recent videos, then the creator's taste notes.
export function historyReport(root, paths = historyPaths()) {
  const videos = otherVideos(readHistory(paths.history), root).map(describeRecord);
  return [...(videos.length ? videos : ["no earlier videos"]), ...tasteLines(paths.taste)];
}

function tasteLines(path) {
  const notes = existsSync(path) ? readFileSync(path, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
  return notes.length ? ["taste notes:", ...notes.slice(0, MAX_TASTE_LINES)] : ["taste notes: none"];
}

// historyWarnings for the build: an unreadable history file yields one compact line, never a failed build.
export function safeHistoryWarnings(record, path) {
  try {
    return historyWarnings(record, readHistory(path));
  } catch (e) {
    return [`history: skipped (${e.message})`];
  }
}

// Advisory house-style warnings: this video against the ones before it (its own earlier record excluded).
export function historyWarnings(record, records) {
  const others = otherVideos(records, record.root, MAX_RECORDS);
  const latest = others[0];
  if (!latest) return [];
  return [
    sameCloseWarning(record, latest),
    sameSequenceWarning(record, others.slice(0, COMPARED_FOR_SEQUENCE)),
    sameLookWarning(record, latest),
  ].filter(Boolean);
}

const types = (names) => names.map((name) => name.split("/")[0]);

function sameCloseWarning(record, latest) {
  return record.close && record.close === latest.close
    ? `house style: the close uses the ${record.close} variant, like the most recent video (${latest.name}); pick another ending`
    : null;
}

function sameSequenceWarning(record, recent) {
  const sequence = types(record.scenes).join(">");
  const twin = recent.find((entry) => types(entry.scenes).join(">") === sequence);
  return twin ? `house style: the scene-type sequence matches ${twin.name}; change the structure` : null;
}

function sameLookWarning(record, latest) {
  const tone = (entry) => entry.tone ?? DEFAULT_TONE;
  return record.preset && record.preset === latest.preset && tone(record) === tone(latest)
    ? `house style: preset ${record.preset} and tone ${tone(record)} repeat the most recent video (${latest.name})`
    : null;
}
