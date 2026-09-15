/**
 * paths.mjs - where everything lives.
 *
 * The *code* (this repo) and the *store* (the user's memories) are deliberately separate.
 * The store lives under ~/.claude/memory so it survives reinstalling or moving the repo,
 * and so it is never accidentally committed to the repo that ships the tooling.
 */
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';

/** Root of the user's Claude configuration. Overridable for tests and for unusual installs. */
export function claudeHome() {
  return process.env.CLAUDE_HOME
    ? resolve(process.env.CLAUDE_HOME)
    : join(homedir(), '.claude');
}

/** Root of the memory store: config, index, stats and the memory files themselves. */
export function storeRoot() {
  return process.env.CLAUDE_MEMORY_HOME
    ? resolve(process.env.CLAUDE_MEMORY_HOME)
    : join(claudeHome(), 'memory');
}

export const paths = {
  get root() { return storeRoot(); },
  get store() { return join(storeRoot(), 'store'); },
  get index() { return join(storeRoot(), 'index.json'); },
  get stats() { return join(storeRoot(), 'stats.json'); },
  get config() { return join(storeRoot(), 'config.json'); },
  get humanIndex() { return join(storeRoot(), 'INDEX.md'); },
  get backups() { return join(storeRoot(), 'backups'); },
  get legacyProjects() { return join(claudeHome(), 'projects'); },
};

/**
 * Defaults are the whole configuration: config.json only ever holds overrides, so a
 * teammate who deletes it gets a working system rather than a broken one.
 */
export const DEFAULT_CONFIG = {
  // Path patterns that collapse several checkouts of one codebase into a single scope.
  // First match wins. `match` is a JS regex source tested case-insensitively against the cwd.
  scopeRules: [],
  budget: {
    catalogMaxEntries: 40,   // hard ceiling on session-start catalog lines
    promptTopK: 3,           // candidate ids named per user prompt
    promptMinScore: 2.5,     // below this a candidate is noise, not a hit
  },
  gc: {
    staleDays: 120,          // untouched this long => GC candidate
    doneGraceDays: 30,       // finished project memories linger this long, then archive
    duplicateThreshold: 0.72,// keyword Jaccard overlap that flags a near-duplicate
  },
  capture: {
    stopHookEnabled: true,
    stopHookCooldownMinutes: 45,
  },
};

let cachedConfig = null;

export function loadConfig() {
  if (cachedConfig) return cachedConfig;
  let overrides = {};
  if (existsSync(paths.config)) {
    try {
      overrides = JSON.parse(readFileSync(paths.config, 'utf8'));
    } catch {
      // A corrupt config must not take the whole system down; defaults are always valid.
      overrides = {};
    }
  }
  cachedConfig = {
    ...DEFAULT_CONFIG,
    ...overrides,
    budget: { ...DEFAULT_CONFIG.budget, ...(overrides.budget || {}) },
    gc: { ...DEFAULT_CONFIG.gc, ...(overrides.gc || {}) },
    capture: { ...DEFAULT_CONFIG.capture, ...(overrides.capture || {}) },
  };
  return cachedConfig;
}

export function resetConfigCache() { cachedConfig = null; }

export function ensureStore() {
  for (const dir of [paths.root, paths.store, join(paths.store, 'global')]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}
