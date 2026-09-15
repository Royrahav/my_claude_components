/**
 * _common.mjs - shared plumbing for the memory hooks.
 *
 * FAIL-SAFE BY CONSTRUCTION. Hooks run on the user's critical path: a UserPromptSubmit hook
 * that exits non-zero blocks the prompt, and a Stop hook that throws can wedge the end of a
 * session. Every hook therefore wraps its whole body in `runHook`, which swallows errors and
 * exits 0. Emitting nothing is always an acceptable outcome; breaking the session never is.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export function readPayload() {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function cwdOf(payload) {
  const candidate = payload.cwd || payload.workspace_dir || process.cwd();
  try {
    return existsSync(candidate) ? candidate : process.cwd();
  } catch {
    return process.cwd();
  }
}

const STATE_DIR = join(tmpdir(), 'claude-memory-hooks');

function stateFile(name, sessionId) {
  const key = String(sessionId || 'nosession').replace(/[^A-Za-z0-9_-]/g, '_');
  return join(STATE_DIR, `${key}.${name}`);
}

function ensureStateDir() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  // Opportunistic cleanup so the directory cannot grow without bound across sessions.
  try {
    const cutoff = Date.now() - 3 * 86400000;
    for (const f of readdirSync(STATE_DIR)) {
      const p = join(STATE_DIR, f);
      if (statSync(p).mtimeMs < cutoff) rmSync(p, { force: true });
    }
  } catch {
    // Cleanup is best-effort; never let it affect the hook's real job.
  }
}

/** True the first time it is called for this session/name, false afterwards. */
export function claimOnce(name, sessionId) {
  try {
    ensureStateDir();
    const f = stateFile(name, sessionId);
    if (existsSync(f)) return false;
    writeFileSync(f, new Date().toISOString(), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/** True if `cooldownMinutes` have passed since this marker was last set (and resets it). */
export function claimCooldown(name, sessionId, cooldownMinutes) {
  try {
    ensureStateDir();
    const f = stateFile(name, sessionId);
    if (existsSync(f)) {
      const age = (Date.now() - statSync(f).mtimeMs) / 60000;
      if (age < cooldownMinutes) return false;
    }
    writeFileSync(f, new Date().toISOString(), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/** Remember a small piece of per-session state (used to avoid repeating the same suggestions). */
export function recallSet(name, sessionId) {
  try {
    const f = stateFile(name, sessionId);
    if (!existsSync(f)) return new Set();
    return new Set(readFileSync(f, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function recallAdd(name, sessionId, values) {
  try {
    ensureStateDir();
    const f = stateFile(name, sessionId);
    const merged = new Set([...recallSet(name, sessionId), ...values]);
    writeFileSync(f, [...merged].join('\n'), 'utf8');
  } catch {
    // Losing this state only costs a repeated suggestion.
  }
}

/** Rough size signal for "did this session actually do anything worth capturing?". */
export function transcriptWeight(payload) {
  try {
    const p = payload.transcript_path;
    if (!p || !existsSync(p)) return 0;
    return statSync(p).size;
  } catch {
    return 0;
  }
}

export function emit(text) {
  if (text && String(text).trim()) process.stdout.write(`${String(text).trim()}\n`);
}

export function emitJson(value) {
  process.stdout.write(JSON.stringify(value));
}

/** Run a hook body, guaranteeing a clean exit whatever happens inside it. */
export async function runHook(fn) {
  try {
    await fn();
  } catch {
    // Deliberately silent: hook stderr surfaces to the user as noise, and there is nothing
    // they could usefully do about a memory-catalog failure mid-prompt.
  }
  process.exit(0);
}
