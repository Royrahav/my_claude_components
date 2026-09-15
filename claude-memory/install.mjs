#!/usr/bin/env node
/**
 * install.mjs - wire this repo into a Claude Code installation.
 *
 * Idempotent and additive. It merges into an existing settings.json rather than replacing it,
 * identifies its own hook entries by path so re-running updates instead of duplicating, and
 * backs the file up before every write. Someone who already has hooks configured must be able
 * to run this without losing them.
 *
 *   node install.mjs [--dry-run] [--link] [--no-hooks] [--no-skill] [--path]
 *
 *   --dry-run   print what would change, write nothing
 *   --link      symlink the skill instead of copying it (for developing this repo)
 *   --path      add the shim directory to the user PATH (Windows only, asks nothing)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync, symlinkSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { claudeHome, paths, ensureStore, DEFAULT_CONFIG } from './lib/paths.mjs';

const REPO = dirname(fileURLToPath(import.meta.url));
const flags = new Set(process.argv.slice(2));
const dryRun = flags.has('--dry-run');
const isWindows = process.platform === 'win32';

const changes = [];
function note(action, detail) {
  changes.push(`${action.padEnd(9)} ${detail}`);
}

function writeFile(path, content) {
  if (dryRun) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

// --- 1. Node version -------------------------------------------------------------------
const major = Number(process.versions.node.split('.')[0]);
if (major < 18) {
  console.error(`mem requires Node 18 or newer (found ${process.versions.node}).`);
  process.exit(1);
}

// --- 2. The store ----------------------------------------------------------------------
if (!dryRun) {
  ensureStore();
  if (!existsSync(paths.config)) {
    writeFileSync(paths.config, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8');
  }
}
note(existsSync(paths.store) ? 'exists' : 'create', `store  ${paths.root}`);

// --- 3. The `mem` launcher -------------------------------------------------------------
// Shims rather than a global npm install: no npm dependency, no permissions prompt, and the
// shim keeps working when the repo is moved because it resolves the entry point at run time.
const binDir = join(claudeHome(), 'bin');
const entry = join(REPO, 'bin', 'mem.mjs');

if (!flags.has('--no-bin')) {
  if (isWindows) {
    writeFile(join(binDir, 'mem.cmd'), `@echo off\r\nnode "${entry}" %*\r\n`);
    // Git Bash and WSL see the extensionless file, cmd.exe sees the .cmd.
    writeFile(join(binDir, 'mem'), `#!/bin/sh\nexec node "${entry.replace(/\\/g, '/')}" "$@"\n`);
    note('write', `shims  ${binDir}\\mem.cmd, ${binDir}\\mem`);
  } else {
    const shim = join(binDir, 'mem');
    writeFile(shim, `#!/bin/sh\nexec node "${entry}" "$@"\n`);
    if (!dryRun) execFileSync('chmod', ['+x', shim]);
    note('write', `shim   ${shim}`);
  }
}

// --- 4. The skill ----------------------------------------------------------------------
// Skill discovery is one level deep, so the skill has to sit directly at skills/memory.
if (!flags.has('--no-skill')) {
  const target = join(claudeHome(), 'skills', 'memory');
  const source = join(REPO, 'skill');
  if (!dryRun) {
    rmSync(target, { recursive: true, force: true });
    mkdirSync(dirname(target), { recursive: true });
    if (flags.has('--link')) symlinkSync(source, target, 'junction');
    else cpSync(source, target, { recursive: true });
  }
  note(flags.has('--link') ? 'link' : 'copy', `skill  ${target}`);
}

// --- 5. Hooks in settings.json ---------------------------------------------------------
const HOOK_EVENTS = [
  { event: 'SessionStart', script: 'session-start.mjs', timeout: 15 },
  { event: 'UserPromptSubmit', script: 'user-prompt.mjs', timeout: 10 },
  { event: 'Stop', script: 'stop.mjs', timeout: 10 },
  { event: 'PreCompact', script: 'pre-compact.mjs', timeout: 10 },
];

if (!flags.has('--no-hooks')) {
  const settingsPath = join(claudeHome(), 'settings.json');
  let settings = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    } catch (err) {
      console.error(`Refusing to touch ${settingsPath}: it is not valid JSON (${err.message}).`);
      console.error('Fix or move it, then re-run.');
      process.exit(1);
    }
    if (!dryRun) {
      const backup = `${settingsPath}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      copyFileSync(settingsPath, backup);
      note('backup', backup);
    }
  }

  settings.hooks ??= {};
  const hooksDir = join(REPO, 'hooks');

  for (const { event, script, timeout } of HOOK_EVENTS) {
    const command = `node "${join(hooksDir, script)}"`;
    settings.hooks[event] ??= [];

    // Identify our own entries by the hooks directory, so re-running after moving the repo
    // replaces the stale entry instead of leaving a broken one behind next to a new one.
    const isOurs = (group) => (group.hooks || []).some((h) => String(h.command || '').includes('claude-memory'));
    settings.hooks[event] = settings.hooks[event].filter((group) => !isOurs(group));
    settings.hooks[event].push({ hooks: [{ type: 'command', command, timeout }] });
    note('hook', `${event.padEnd(17)} -> ${script}`);
  }

  writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

// --- 6. PATH ---------------------------------------------------------------------------
const pathHasBin = (process.env.PATH || '').split(isWindows ? ';' : ':').some((p) => resolve(p || '.') === resolve(binDir));

if (flags.has('--path') && isWindows && !pathHasBin && !dryRun) {
  try {
    execFileSync('powershell', ['-NoProfile', '-Command',
      `$u=[Environment]::GetEnvironmentVariable('Path','User'); if ($u -notlike '*${binDir}*') { [Environment]::SetEnvironmentVariable('Path', $u + ';${binDir}', 'User') }`,
    ], { stdio: 'ignore' });
    note('path', `added ${binDir} to the user PATH (new shells only)`);
  } catch {
    note('path', `could not update PATH automatically - add ${binDir} yourself`);
  }
}

// --- Report ----------------------------------------------------------------------------
console.log(dryRun ? 'DRY RUN - nothing was written\n' : 'Installed\n');
for (const c of changes) console.log(`  ${c}`);

console.log('\nNext:');
if (!pathHasBin && !flags.has('--path')) {
  console.log(`  1. Put ${binDir} on your PATH (or re-run with --path on Windows).`);
}
console.log('  2. `mem migrate` to preview importing any legacy ~/.claude/projects/*/memory stores,');
console.log('     then `mem migrate --apply`.');
console.log('  3. Start a new Claude Code session - the catalog is injected at session start.');
console.log('\n  `mem doctor` checks the store, `mem stats` shows what is in it.');
