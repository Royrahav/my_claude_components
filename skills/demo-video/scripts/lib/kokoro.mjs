// Kokoro: the free local voice engine. This module splits the spoken text into clauses, runs the Python worker
// (scripts/kokoro_tts.py) that voices them, and turns what the worker measured into the same character
// alignment ElevenLabs returns, so displayWords, captions and cues work unchanged.
//
// Kokoro gives no timestamps, so timing is built, not read: every clause is voiced on its own and joined with a
// fixed pause. A clause's start and end in the take are therefore exact. Inside a clause each word gets a share
// of the clause audio proportional to its phoneme count, so word times are estimates (typically within about
// 0.1 s), good for cues and captions.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { SKILL_DIR, run } from "./util.mjs";

export const KOKORO_MODEL_DIR = join(homedir(), ".cache", "kokoro");
export const KOKORO_MODEL_FILES = ["kokoro-v1.0.int8.onnx", "voices-v1.0.bin"];
const WORKER = join(SKILL_DIR, "scripts", "kokoro_tts.py");
const PYTHON = process.platform === "win32" ? "python" : "python3";

// Silence between clauses: a sentence end breathes longer than a comma, colon or semicolon.
export const PAUSE_SENTENCE_S = 0.3;
export const PAUSE_SOFT_S = 0.12;

// Kokoro accepts 0.5-2.0; narration stays in the range that still sounds natural.
export const SPEED_RANGE = Object.freeze({ min: 0.8, max: 1.25 });

// wps = words per second at speed 1.0, measured on six scenes of dense narration with the clause pauses included
// (used by `plan`; narrate then stores the real rate in the brief).
export const KOKORO_VOICES = [
  { name: "Heart", id: "af_heart", desc: "female, warm, American (default)", wps: 2.93 },
  { name: "Bella", id: "af_bella", desc: "female, expressive, American", wps: 3.0 },
  { name: "Nicole", id: "af_nicole", desc: "female, soft and calm, American", wps: 2.18 },
  { name: "Michael", id: "am_michael", desc: "male, steady, American", wps: 2.54 },
  { name: "Fenrir", id: "am_fenrir", desc: "male, deep, American", wps: 3.11 },
  { name: "Emma", id: "bf_emma", desc: "female, clear, British", wps: 2.85 },
  { name: "George", id: "bm_george", desc: "male, warm, British", wps: 2.4 },
];

// A break is whitespace after . ! ? , ; : (closing quotes allowed), except after an abbreviation that does not end
// a sentence: "e.g.", "i.e.", "vs." never, "etc." only when a lowercase word follows.
const CLAUSE_BREAK = /(?<=[.!?,;:]["')\]]*)(?<!\b(?:[eE]\.g|[iI]\.e|vs)\.)(?:(?<!\betc\.)\s+|(?<=\betc\.)\s+(?=[A-Z]))/;
const SENTENCE_END = /[.!?]["')\]]*$/;

// [{ text, pauseAfter }] in reading order; the last clause has no pause (no silence at the end of a scene).
export function splitClauses(spoken) {
  const texts = spoken.trim().split(CLAUSE_BREAK).filter(Boolean);
  return texts.map((text, i) => ({ text, pauseAfter: i === texts.length - 1 ? 0 : SENTENCE_END.test(text) ? PAUSE_SENTENCE_S : PAUSE_SOFT_S }));
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// Length of the take: every clause plus the pauses between them.
export const spokenSeconds = (clauses, measured) => sum(measured.map((m) => m.seconds)) + sum(clauses.slice(0, -1).map((c) => c.pauseAfter));

// measured[i] = { seconds, weights } for clauses[i] (one weight per word). Returns the ElevenLabs alignment shape:
// characters with start and end times; clause edges are exact, words are weighted shares of their clause.
export function clauseAlignment(clauses, measured) {
  if (measured.length !== clauses.length) throw new Error(`Kokoro worker measured ${measured.length} clauses, expected ${clauses.length}`);
  const out = { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] };
  const put = (ch, start, end) => {
    out.characters.push(ch);
    out.character_start_times_seconds.push(start);
    out.character_end_times_seconds.push(end);
  };
  let clock = 0;
  for (const [i, clause] of clauses.entries()) {
    const words = clause.text.split(/\s+/);
    const { seconds, weights } = measured[i];
    if (weights.length !== words.length) throw new Error(`Kokoro worker weighed ${weights.length} words in "${clause.text}", expected ${words.length}`);
    const total = sum(weights);
    let cursor = clock;
    for (const [w, word] of words.entries()) {
      if (w > 0) put(" ", cursor, cursor);
      const end = cursor + (seconds * weights[w]) / total;
      const step = (end - cursor) / word.length;
      [...word].forEach((ch, c) => put(ch, cursor + c * step, cursor + (c + 1) * step));
      cursor = end;
    }
    clock += seconds;
    if (i < clauses.length - 1) {
      put(" ", clock, clock + clause.pauseAfter);
      clock += clause.pauseAfter;
    }
  }
  return out;
}

// Runs the worker over jobs [{ id, voice, speed, out, clauses: [{ text, pauseAfter }] }] and returns
// { id: [{ seconds, weights }] }. The job and result files live in a temp folder removed on every path.
function runWorker(jobs) {
  const dir = mkdtempSync(join(tmpdir(), "dv-kokoro-"));
  try {
    const jobsFile = join(dir, "jobs.json");
    const resultFile = join(dir, "result.json");
    const wire = jobs.map((j) => ({ ...j, clauses: j.clauses.map((c) => ({ text: c.text, pause_after: c.pauseAfter })) }));
    writeFileSync(jobsFile, JSON.stringify(wire));
    const r = run(PYTHON, [WORKER, "--jobs-file", jobsFile, "--result", resultFile, "--model-dir", KOKORO_MODEL_DIR]);
    if (r.error?.code === "ENOENT") throw new Error(`Kokoro worker failed: ${PYTHON} not found on PATH (run \`D setup\` for the install steps)`);
    if (r.code !== 0) throw new Error(`Kokoro worker failed: ${(r.err || r.out || String(r.error)).trim().split("\n").slice(-4).join(" | ")}`);
    const result = JSON.parse(readFileSync(resultFile, "utf8"));
    return Object.fromEntries(Object.entries(result).map(([id, v]) => [id, v.clauses]));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Tests replace kokoroWorker.run so no model or Python is needed.
export const kokoroWorker = { run: runWorker };

export function checkedSpeed(speed) {
  if (!(speed >= SPEED_RANGE.min && speed <= SPEED_RANGE.max)) throw new Error(`Kokoro speed ${speed} is outside ${SPEED_RANGE.min}-${SPEED_RANGE.max} (set with narrate --speed)`);
  return speed;
}

// Lines for `setup`: ready, or exactly what to install.
export function kokoroSetupLines() {
  const pkg = run(PYTHON, ["-c", "import kokoro_onnx, onnxruntime"]).code === 0;
  const missing = KOKORO_MODEL_FILES.filter((f) => !existsSync(join(KOKORO_MODEL_DIR, f)));
  if (pkg && !missing.length) return ["Kokoro voice: ok (local, free)"];
  return [
    `Kokoro voice: NOT READY${pkg ? "" : ` (python package missing: \`${PYTHON} -m pip install --user kokoro-onnx\`)`}${missing.length ? ` (model files missing in ${KOKORO_MODEL_DIR}: ${missing.join(", ")})` : ""}`,
    ...(missing.length ? [`  download ${missing.join(" and ")} from the kokoro-onnx GitHub release "model-files-v1.0" into ${KOKORO_MODEL_DIR}`] : []),
  ];
}
