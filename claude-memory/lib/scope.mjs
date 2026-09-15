/**
 * scope.mjs - which memories belong to where you are standing.
 *
 * The central problem this solves: a *workspace path* is not an *identity*. The same
 * codebase checked out at four paths (release branches, Perforce streams, a second clone)
 * produced four disconnected memory silos under the old per-project layout. Scope is
 * therefore derived from the strongest identity signal available, in order:
 *
 *   1. an explicit .claude-scope marker file (any ancestor directory)  - always wins
 *   2. a configured path rule                                          - collapses known checkouts
 *   3. the git `origin` remote, normalised                             - same repo, any clone
 *   4. a slug of the directory name                                    - last resort
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, basename, resolve } from 'node:path';
import { loadConfig } from './paths.mjs';

export const GLOBAL_SCOPE = 'global';

export function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Walk up from `dir` looking for a `.claude-scope` file naming the scope explicitly. */
function markerScope(dir) {
  let cur = resolve(dir);
  for (;;) {
    const marker = join(cur, '.claude-scope');
    if (existsSync(marker)) {
      const name = readFileSync(marker, 'utf8').trim().split(/\r?\n/)[0].trim();
      if (name) return name.startsWith('repo.') || name.startsWith('topic.') ? name : `repo.${slug(name)}`;
    }
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

function ruleScope(dir) {
  for (const rule of loadConfig().scopeRules) {
    try {
      if (new RegExp(rule.match, 'i').test(dir)) return rule.scope;
    } catch {
      // A malformed user-supplied regex skips that rule rather than breaking resolution.
    }
  }
  return null;
}

/** `https://github.com/LabOS-co/printer-service.git` and the ssh form both -> `labos-co-printer-service`. */
export function normalizeRemote(url) {
  if (!url) return null;
  let s = url.trim().replace(/\.git$/i, '');
  s = s.replace(/^[a-z+]+:\/\//i, '').replace(/^[^@/]+@/, '');
  s = s.replace(/:/g, '/');
  const parts = s.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return slug(parts.slice(-2).join('-'));
}

function gitScope(dir) {
  try {
    const url = execFileSync('git', ['-C', dir, 'remote', 'get-url', 'origin'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000,
    }).trim();
    const key = normalizeRemote(url);
    return key ? `repo.${key}` : null;
  } catch {
    return null;
  }
}

// Resolution walks the filesystem and can spawn git, while callers ask about the same
// directory once per memory in the store. Uncached, a 40-entry catalog spawned 40 git
// processes on every session start - most of the hook's entire latency budget.
const scopeCache = new Map();

/** Resolve the repo scope for a working directory. Never throws. */
export function resolveScope(cwd = process.cwd()) {
  const dir = resolve(cwd);
  const cached = scopeCache.get(dir);
  if (cached) return cached;
  const scope = markerScope(dir) || ruleScope(dir) || gitScope(dir) || `repo.${slug(basename(dir)) || 'unscoped'}`;
  scopeCache.set(dir, scope);
  return scope;
}

/** Tests and long-lived processes need to observe a changed config or marker file. */
export function resetScopeCache() {
  scopeCache.clear();
}

/**
 * The scopes a session may read from: the current repo, everything global, and every
 * topic scope. Topic scopes are cross-project on purpose - how to authenticate against
 * labOS is true whichever checkout you are sitting in.
 */
export function readableScopes(cwd, allScopes) {
  const here = resolveScope(cwd);
  return allScopes.filter((s) => s === here || s === GLOBAL_SCOPE || s.startsWith('topic.'));
}

export function scopeToDir(scope) {
  return slug(scope.replace(/\./g, '-')) || 'global';
}
