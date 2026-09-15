#!/usr/bin/env node
/**
 * mem - the memory CLI.
 *
 * Two audiences, one interface. A human runs `mem list`/`mem gc` and reads the tables; an
 * agent runs `mem catalog`/`mem search`/`mem get` and reads the same output. Every command
 * therefore prints something terse and complete, and every command accepts `--json` for the
 * cases where a caller wants to parse rather than read.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { paths, ensureStore, loadConfig, DEFAULT_CONFIG } from '../lib/paths.mjs';
import { parse, serialize } from '../lib/frontmatter.mjs';
import * as store from '../lib/store.mjs';
import { search, buildCatalog, renderCatalog, inScope } from '../lib/search.mjs';
import { analyze, archivable, summarize } from '../lib/gc.mjs';
import { resolveScope, GLOBAL_SCOPE } from '../lib/scope.mjs';

const argv = process.argv.slice(2);

/** Minimal flag parsing: `--key value`, `--key=value`, `--flag`, and positional rest. */
function parseArgs(args) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (!a.startsWith('--')) { rest.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq !== -1) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const key = a.slice(2);
    const next = args[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = true;
    else { flags[key] = next; i += 1; }
  }
  return { flags, rest };
}

const { flags, rest } = parseArgs(argv);
const command = rest[0] || 'help';
const cwd = flags.cwd ? resolve(String(flags.cwd)) : process.cwd();
const asJson = Boolean(flags.json);

function out(text) { process.stdout.write(`${text}\n`); }
function json(value) { out(JSON.stringify(value, null, 2)); }
function fail(message, code = 1) { process.stderr.write(`mem: ${message}\n`); process.exit(code); }

function readStdin() {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

function list(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Build a memory record from either a full markdown document (--stdin / --file) or flags.
 * The document form is what agents use: it keeps the whole memory in one reviewable blob.
 */
function recordFromInput() {
  let fromDoc = {};
  let body = '';

  if (flags.stdin || flags.file) {
    const text = flags.file ? readFileSync(resolve(String(flags.file)), 'utf8') : readStdin();
    if (!text.trim()) fail('no input received on stdin');
    const parsed = parse(text);
    fromDoc = parsed.data;
    body = parsed.body;
  }

  const scope = flags.scope || fromDoc.scope
    || (flags.global ? GLOBAL_SCOPE : null)
    || resolveScope(cwd);

  return {
    id: flags.id || fromDoc.id,
    title: flags.title || fromDoc.title,
    hook: flags.hook || fromDoc.hook,
    type: flags.type || fromDoc.type,
    status: flags.status || fromDoc.status,
    confidence: flags.confidence || fromDoc.confidence,
    scope,
    tags: list(flags.tags).length ? list(flags.tags) : list(fromDoc.tags),
    keywords: list(flags.keywords).length ? list(flags.keywords) : list(fromDoc.keywords),
    links: list(flags.links).length ? list(flags.links) : list(fromDoc.links),
    supersedes: list(flags.supersedes).length ? list(flags.supersedes) : list(fromDoc.supersedes),
    expires: flags.expires || fromDoc.expires || null,
    source: flags.source || fromDoc.source || null,
    body: flags.body ? String(flags.body) : body,
  };
}

const commands = {
  help() {
    out(`mem - cross-project memory for Claude Code

RECALL
  mem catalog [--cwd DIR] [--max N]     Scoped one-line catalog (no bodies). Session-start view.
  mem search <query> [--k N] [--all]    Rank memories against a query. --all ignores scope.
  mem get <id> [--raw] [--quiet]        Print one memory in full. Records a hit unless --quiet.
  mem list [--scope S] [--type T] [--status S]

WRITE
  mem write --stdin                     Create/update from a markdown doc on stdin (preferred).
  mem write --id X --title .. --hook .. --type .. --body ..
  mem checkpoint --stdin                Write/refresh an in-progress project memory.
  mem set <id> <field> <value>          Change one field (e.g. status done).
  mem link <id> <other-id>              Add a bidirectional [[link]].
  mem touch <id>                        Record a hit without printing.

MAINTAIN
  mem gc [--apply]                      Report (or archive) expired/finished/unused memories.
  mem doctor                            Validate every file, the index, and all links.
  mem reindex                           Rebuild index.json and INDEX.md from disk.
  mem stats                             Store size, hit distribution, scope breakdown.
  mem scope [--cwd DIR]                 Show the scope a directory resolves to, and why.
  mem migrate [--apply] [--retire-legacy]   Import legacy ~/.claude/projects/*/memory stores.
  mem export <dir> | mem import <dir>   Move a store between machines.

Add --json to any command for machine-readable output.
Store: ${paths.root}`);
  },

  scope() {
    const scope = resolveScope(cwd);
    const entries = store.loadIndex();
    const visible = entries.filter((e) => inScope(e, cwd));
    if (asJson) return json({ cwd, scope, visible: visible.length, total: entries.length });
    out(`cwd    ${cwd}`);
    out(`scope  ${scope}`);
    out(`visible ${visible.length} of ${entries.length} memories (this scope + global + topic.*)`);
  },

  catalog() {
    const entries = store.loadIndex();
    const max = Number(flags.max || loadConfig().budget.catalogMaxEntries);
    const catalog = buildCatalog(entries, cwd, { maxEntries: max });
    if (asJson) return json({ scope: resolveScope(cwd), ...catalog });
    const text = renderCatalog(catalog, resolveScope(cwd));
    if (text) out(text);
  },

  search() {
    const query = rest.slice(1).join(' ');
    if (!query) fail('usage: mem search <query>');
    const results = search(store.loadIndex(), query, {
      cwd,
      k: Number(flags.k || 5),
      minScore: Number(flags.min || 0),
      allScopes: Boolean(flags.all),
    });
    if (asJson) {
      return json(results.map((r) => ({ id: r.entry.id, score: r.score, matched: r.matched, hook: r.entry.hook, scope: r.entry.scope })));
    }
    if (results.length === 0) return out('no matching memories');
    for (const r of results) {
      out(`${r.score.toFixed(1).padStart(5)}  ${r.entry.id}  [${r.entry.scope}]  ${r.entry.hook}`);
    }
    out('\nmem get <id> to load one.');
  },

  get() {
    const ids = rest.slice(1);
    if (ids.length === 0) fail('usage: mem get <id> [<id>...]');
    const all = store.readAll();
    const found = [];
    for (const id of ids) {
      const mem = store.findById(id, all);
      if (!mem) { process.stderr.write(`mem: no memory '${id}'\n`); continue; }
      found.push(mem);
      if (!flags.quiet) store.recordHit(id);
    }
    if (found.length === 0) process.exit(1);
    if (asJson) return json(found.map(({ file, ...m }) => m));
    for (const mem of found) {
      if (flags.raw) { out(serialize({ ...mem, body: undefined, file: undefined }, mem.body)); continue; }
      out(`# ${mem.title}  (${mem.id})`);
      out(`type=${mem.type} scope=${mem.scope} status=${mem.status} updated=${mem.updated || '?'}`
        + (mem.tags?.length ? ` tags=${mem.tags.join(',')}` : ''));
      out('');
      out(mem.body);
      if (mem.links?.length) out(`\nrelated: ${mem.links.map((l) => `mem get ${l}`).join(' | ')}`);
      out('');
    }
  },

  list() {
    let entries = store.loadIndex();
    if (!flags.all) entries = entries.filter((e) => inScope(e, cwd));
    if (flags.scope) entries = entries.filter((e) => e.scope === flags.scope);
    if (flags.type) entries = entries.filter((e) => e.type === flags.type);
    if (flags.status) entries = entries.filter((e) => e.status === flags.status);
    if (asJson) return json(entries);
    if (entries.length === 0) return out('no memories match');
    for (const e of entries) {
      out(`${e.id.padEnd(34)} ${e.type.padEnd(10)} ${String(e.status).padEnd(12)} ${String(e.hits).padStart(3)}h  ${e.hook}`);
    }
  },

  write() {
    const input = recordFromInput();
    const result = store.write(input, { force: Boolean(flags.force) });
    if (asJson) return json(result);
    if (!result.ok) {
      process.stderr.write(`mem: rejected '${result.record.id || '?'}'\n`);
      for (const e of result.errors) process.stderr.write(`  error: ${e}\n`);
      for (const w of result.warnings) process.stderr.write(`  warn:  ${w}\n`);
      process.exit(1);
    }
    for (const w of result.warnings) process.stderr.write(`  warn: ${w}\n`);
    out(`wrote ${result.record.id} -> ${result.file}`);
  },

  checkpoint() {
    const input = recordFromInput();
    input.type = input.type || 'project';
    input.status = input.status || 'in-progress';
    if (!input.id) fail('checkpoint needs --id (stable across sessions, so it updates in place)');
    const result = store.write(input, { force: Boolean(flags.force) });
    if (asJson) return json(result);
    if (!result.ok) {
      for (const e of result.errors) process.stderr.write(`  error: ${e}\n`);
      process.exit(1);
    }
    out(`checkpoint ${result.record.id} (${result.record.status}) -> ${result.file}`);
  },

  set() {
    const [, id, field, ...value] = rest;
    if (!id || !field) fail('usage: mem set <id> <field> <value>');
    const raw = value.join(' ');
    const parsed = ['tags', 'keywords', 'links', 'supersedes'].includes(field) ? list(raw) : raw;
    if (!store.setField(id, field, parsed)) fail(`no memory '${id}'`);
    out(`${id}.${field} = ${Array.isArray(parsed) ? parsed.join(',') : parsed}`);
  },

  link() {
    const [, a, b] = rest;
    if (!a || !b) fail('usage: mem link <id> <other-id>');
    const all = store.readAll();
    const memA = store.findById(a, all);
    const memB = store.findById(b, all);
    if (!memA) fail(`no memory '${a}'`);
    if (!memB) fail(`no memory '${b}'`);
    store.setField(a, 'links', [...new Set([...(memA.links || []), b])]);
    store.setField(b, 'links', [...new Set([...(memB.links || []), a])]);
    out(`linked ${a} <-> ${b}`);
  },

  touch() {
    const id = rest[1];
    if (!id) fail('usage: mem touch <id>');
    if (!store.findById(id)) fail(`no memory '${id}'`);
    store.recordHit(id);
    store.reindex();
  },

  reindex() {
    const entries = store.reindex();
    out(`indexed ${entries.length} memories -> ${paths.index}`);
  },

  gc() {
    const entries = store.loadIndex();
    const findings = analyze(entries);
    const targets = archivable(findings);

    if (asJson) return json({ summary: summarize(findings), findings, willArchive: targets });

    const section = (name, rows, verb) => {
      if (rows.length === 0) return;
      out(`\n${name} (${rows.length})${verb ? ` - ${verb}` : ''}`);
      for (const r of rows) out(`  ${r.id}: ${r.reason}`);
    };
    section('EXPIRED', findings.expired, 'past their expiry date');
    section('FINISHED', findings.finished, 'completed work past its grace period');
    section('NEVER USED', findings.unused, 'written but never retrieved');
    section('STALE', findings.stale, 'still live, just cold - review, do not auto-archive');
    section('MERGE CANDIDATES', findings.duplicates, 'overlapping; combine by hand');
    section('OVERSIZED', findings.oversized, 'too long to be one fact');
    section('BROKEN LINKS', findings.brokenLinks, '');

    if (targets.length === 0) { out('\nnothing to archive.'); return; }
    if (!flags.apply) {
      out(`\n${targets.length} memories would be archived. Re-run with --apply to do it.`);
      return;
    }
    for (const t of targets) store.remove(t.id, { archive: true });
    out(`\narchived ${targets.length} memories to ${join(paths.backups, 'removed')}`);
  },

  doctor() {
    const problems = [];
    const all = store.readAll();
    const byId = new Map(all.map((m) => [m.id, m]));

    for (const mem of all) {
      const { errors, warnings } = store.validate(mem);
      for (const e of errors) problems.push({ level: 'error', id: mem.id, message: e });
      for (const w of warnings) problems.push({ level: 'warn', id: mem.id, message: w });
      for (const l of mem.links || []) {
        if (!byId.has(l)) problems.push({ level: 'warn', id: mem.id, message: `dangling link [[${l}]]` });
      }
      const expectedFile = store.fileFor(mem.scope, mem.id);
      if (resolve(mem.file) !== resolve(expectedFile)) {
        problems.push({ level: 'error', id: mem.id, message: `file is at ${mem.file} but scope says ${expectedFile}` });
      }
    }

    const ids = all.map((m) => m.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    for (const id of new Set(dupes)) problems.push({ level: 'error', id, message: 'duplicate id in two files' });

    const indexed = new Set(store.loadIndex().map((e) => e.id));
    for (const id of ids) if (!indexed.has(id)) problems.push({ level: 'warn', id, message: 'missing from index - run mem reindex' });

    if (asJson) return json({ memories: all.length, problems });
    out(`checked ${all.length} memories`);
    if (problems.length === 0) return out('no problems found.');
    for (const p of problems) out(`  ${p.level.toUpperCase().padEnd(5)} ${p.id}: ${p.message}`);
    if (problems.some((p) => p.level === 'error')) process.exit(1);
  },

  stats() {
    const entries = store.loadIndex();
    const byScope = {};
    const byType = {};
    let bytes = 0;
    let neverUsed = 0;
    for (const e of entries) {
      byScope[e.scope] = (byScope[e.scope] || 0) + 1;
      byType[e.type] = (byType[e.type] || 0) + 1;
      bytes += e.bytes || 0;
      if (!e.hits) neverUsed += 1;
    }
    const payload = { total: entries.length, bytes, neverUsed, byScope, byType, store: paths.root };
    if (asJson) return json(payload);
    out(`${entries.length} memories, ${(bytes / 1024).toFixed(1)} KB of bodies, ${neverUsed} never retrieved`);
    out(`\nby scope:`);
    for (const [k, v] of Object.entries(byScope).sort((a, b) => b[1] - a[1])) out(`  ${String(v).padStart(3)}  ${k}`);
    out(`\nby type:`);
    for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) out(`  ${String(v).padStart(3)}  ${k}`);
    const top = entries.filter((e) => e.hits).sort((a, b) => b.hits - a.hits).slice(0, 5);
    if (top.length) {
      out(`\nmost used:`);
      for (const e of top) out(`  ${String(e.hits).padStart(3)}h  ${e.id}`);
    }
  },

  init() {
    ensureStore();
    if (!existsSync(paths.config)) {
      writeFileSync(paths.config, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8');
    }
    store.reindex();
    out(`store ready at ${paths.root}`);
  },

  export() {
    const dest = rest[1] ? resolve(rest[1]) : null;
    if (!dest) fail('usage: mem export <dir>');
    mkdirSync(dest, { recursive: true });
    cpSync(paths.store, join(dest, 'store'), { recursive: true });
    for (const f of ['index.json', 'stats.json', 'config.json']) {
      const src = join(paths.root, f);
      if (existsSync(src)) cpSync(src, join(dest, f));
    }
    out(`exported store to ${dest}`);
  },

  import() {
    const src = rest[1] ? resolve(rest[1]) : null;
    if (!src || !existsSync(join(src, 'store'))) fail('usage: mem import <dir>  (dir must contain store/)');
    ensureStore();
    let imported = 0;
    for (const scopeDir of readdirSync(join(src, 'store'), { withFileTypes: true })) {
      if (!scopeDir.isDirectory()) continue;
      const from = join(src, 'store', scopeDir.name);
      for (const f of readdirSync(from)) {
        if (!f.endsWith('.md')) continue;
        const { data, body } = parse(readFileSync(join(from, f), 'utf8'));
        const existing = store.findById(data.id);
        // Imported copies never clobber a local memory that is newer; the machine you are on
        // is assumed to hold the more current truth unless told otherwise.
        if (existing && !flags.force && String(existing.updated || '') >= String(data.updated || '')) continue;
        store.write({ ...data, body }, { force: true });
        imported += 1;
      }
    }
    out(`imported ${imported} memories from ${src}`);
  },
};

// `migrate` is large enough to live in its own module; loaded lazily so the common commands
// stay fast and the CLI does not pay for code it rarely runs.
commands.migrate = async () => {
  const { runMigration } = await import('../lib/migrate.mjs');
  const result = runMigration({
    apply: Boolean(flags.apply),
    retireLegacy: Boolean(flags['retire-legacy']),
    force: Boolean(flags.force),
  });
  if (asJson) return json(result);
  for (const line of result.report) out(line);
};

const handler = commands[command];
if (!handler) fail(`unknown command '${command}'. Try: mem help`);

try {
  await handler();
} catch (err) {
  fail(err?.stack || String(err));
}
