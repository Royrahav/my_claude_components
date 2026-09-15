/**
 * store.mjs - reading, validating and writing memory files, and the derived catalog.
 *
 * Two files sit beside the store and are NOT the source of truth:
 *   index.json - a derived catalog, rebuildable from store/ at any time (`mem reindex`)
 *   stats.json - usage telemetry (hits, last hit). Durable, because it cannot be re-derived;
 *                kept out of the .md files so that reading a memory never dirties git.
 */
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, renameSync,
} from 'node:fs';
import { join, basename } from 'node:path';
import { paths, ensureStore } from './paths.mjs';
import { parse, serialize } from './frontmatter.mjs';
import { slug, scopeToDir, GLOBAL_SCOPE } from './scope.mjs';

export const TYPES = ['user', 'feedback', 'project', 'reference', 'decision'];
export const STATUSES = ['active', 'in-progress', 'done', 'superseded', 'archived'];

export const LIMITS = {
  title: 70,
  hook: 110,
  bodyWarn: 1800,
  bodyMax: 4000,
};

// Words too common to discriminate between memories. Kept deliberately small: an over-eager
// stop list silently makes real domain terms unsearchable, which is worse than a little noise.
const STOP_WORDS = [
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this', 'these', 'those',
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'as', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'it', 'its', 'do', 'does', 'did', 'done', 'have', 'has', 'had', 'not',
  'no', 'so', 'such', 'own', 'same', 'too', 'very', 'can', 'will', 'just', 'should', 'now',
  'use', 'used', 'using', 'make', 'makes', 'made', 'get', 'gets', 'got', 'how', 'what', 'when',
  'where', 'which', 'who', 'why', 'you', 'your', 'we', 'our', 'me', 'my', 'they', 'them',
  'their', 'his', 'her', 'one', 'two', 'also', 'into', 'out', 'up', 'down', 'over', 'under',
  'again', 'more', 'most', 'other', 'some', 'any', 'all', 'each', 'both', 'because',
  // Two-letter words are kept as tokens (see below), so the common ones must be listed here.
  'am', 'us', 'he', 'im', 'ok',
];
const STOP = new Set(STOP_WORDS);

// Two-character tokens are indexed rather than dropped. In this domain the shortest words are
// often the most specific ones - p4, cl, db, ui, go, vc, ut - and discarding them left generic
// filler ("check", "add") as the only thing matching a memory whose real subject was `go`.
//
// `go` is kept despite also being a common English verb, because the costs are asymmetric:
// surfacing a Go memory on "go ahead" wastes one line, while missing it on "write a go helper"
// means duplicating code the user already asked to have reused.
const MIN_TOKEN_LENGTH = 2;

export function tokenize(text) {
  const out = new Set();
  const raw = String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9_+#.-]+/)
    .map((t) => t.replace(/^[.\-_]+|[.\-_]+$/g, ''));

  for (const token of raw) {
    // A compound is indexed whole *and* by its parts, so "go-packages" is reachable from
    // "packages" and "read-only" from "readonly"'s neighbours. Without this, a hyphen in
    // either the query or the memory silently blocks an otherwise exact match.
    for (const candidate of token.includes('-') ? [token, ...token.split('-')] : [token]) {
      if (candidate.length >= MIN_TOKEN_LENGTH && !STOP.has(candidate) && !/^\d+$/.test(candidate)) {
        out.add(candidate);
      }
    }
  }
  return [...out];
}

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function loadStats() {
  return readJson(paths.stats, { memories: {} });
}

export function saveStats(stats) {
  ensureStore();
  writeJson(paths.stats, stats);
}

/** Every memory file on disk, parsed. The store is small enough that a full scan is honest and fast. */
export function readAll() {
  ensureStore();
  const out = [];
  for (const scopeDir of readdirSync(paths.store, { withFileTypes: true })) {
    if (!scopeDir.isDirectory()) continue;
    const dir = join(paths.store, scopeDir.name);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const file = join(dir, entry.name);
      const { data, body } = parse(readFileSync(file, 'utf8'));
      out.push({
        ...data,
        id: data.id || basename(entry.name, '.md'),
        scope: data.scope || GLOBAL_SCOPE,
        tags: data.tags || [],
        keywords: data.keywords || [],
        links: data.links || [],
        supersedes: data.supersedes || [],
        type: data.type || 'reference',
        status: data.status || 'active',
        body,
        file,
      });
    }
  }
  return out;
}

export function findById(id, all = readAll()) {
  return all.find((m) => m.id === id) || null;
}

export function fileFor(scope, id) {
  return join(paths.store, scopeToDir(scope), `${id}.md`);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Validate against the schema *and* against the concision rules, because a memory another
 * agent cannot act on in a single read is not a memory, it is a document. Problems come back
 * as `{ errors, warnings }` rather than as a throw, so a caller can report all of them at once.
 */
export function validate(mem) {
  const errors = [];
  const warnings = [];

  if (!mem.id || !/^[a-z0-9][a-z0-9-]*$/.test(mem.id)) errors.push('id must be kebab-case');
  if (!mem.title) errors.push('title is required');
  if (!mem.hook) errors.push('hook is required (the one line that decides relevance)');
  if (!TYPES.includes(mem.type)) errors.push(`type must be one of ${TYPES.join('|')}`);
  if (!STATUSES.includes(mem.status)) errors.push(`status must be one of ${STATUSES.join('|')}`);
  if (!mem.scope) errors.push('scope is required');
  if (!String(mem.body || '').trim()) errors.push('body is empty');

  if (mem.title && mem.title.length > LIMITS.title) errors.push(`title over ${LIMITS.title} chars`);
  if (mem.hook && mem.hook.length > LIMITS.hook) errors.push(`hook over ${LIMITS.hook} chars`);

  const len = String(mem.body || '').length;
  if (len > LIMITS.bodyMax) errors.push(`body ${len} chars exceeds hard limit ${LIMITS.bodyMax} - split it`);
  else if (len > LIMITS.bodyWarn) warnings.push(`body ${len} chars is long; aim under ${LIMITS.bodyWarn}`);

  // feedback and project memories are acted on by a later agent, so they must say why the rule
  // exists and what to do about it. A bare assertion is not actionable by someone who wasn't there.
  if (mem.type === 'feedback' || mem.type === 'project') {
    if (!/\*\*Why:\*\*/.test(mem.body || '')) warnings.push('missing a **Why:** line');
    if (!/\*\*How to apply:\*\*/.test(mem.body || '')) warnings.push('missing a **How to apply:** line');
  }
  if (mem.type === 'project' && !['in-progress', 'done', 'archived', 'superseded'].includes(mem.status)) {
    warnings.push('project memories should carry status in-progress|done so staleness is detectable');
  }
  if (!mem.tags || mem.tags.length === 0) warnings.push('no tags - retrieval will rely on body text alone');

  return { errors, warnings };
}

/** Derive searchable keywords when the author did not supply them. */
export function deriveKeywords(mem) {
  const counts = new Map();
  const add = (text, weight) => {
    for (const t of tokenize(text)) counts.set(t, (counts.get(t) || 0) + weight);
  };
  add(mem.title, 4);
  add(mem.hook, 3);
  add((mem.tags || []).join(' '), 4);
  add(String(mem.id || '').replace(/-/g, ' '), 2);
  add(mem.body, 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 18)
    .map(([t]) => t);
}

/**
 * Write a memory, creating or updating in place. Moving between scopes deletes the old file,
 * so the same id never exists twice under two scopes.
 */
export function write(mem, { force = false } = {}) {
  ensureStore();
  const id = slug(mem.id || mem.title);
  const existing = findById(id);

  const record = {
    id,
    title: String(mem.title || '').trim(),
    hook: String(mem.hook || '').trim(),
    type: mem.type || existing?.type || 'reference',
    scope: mem.scope || existing?.scope || GLOBAL_SCOPE,
    status: mem.status || existing?.status || 'active',
    confidence: mem.confidence || existing?.confidence || 'high',
    tags: mem.tags?.length ? mem.tags : (existing?.tags || []),
    keywords: [],
    links: mem.links?.length ? mem.links : (existing?.links || []),
    supersedes: mem.supersedes?.length ? mem.supersedes : (existing?.supersedes || []),
    created: existing?.created || mem.created || today(),
    updated: today(),
    expires: mem.expires ?? existing?.expires ?? null,
    source: mem.source ?? existing?.source ?? null,
    body: String(mem.body || '').trim(),
  };
  record.keywords = mem.keywords?.length ? mem.keywords : deriveKeywords(record);

  const { errors, warnings } = validate(record);
  if (errors.length && !force) return { ok: false, errors, warnings, record };

  const dir = join(paths.store, scopeToDir(record.scope));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const target = fileFor(record.scope, record.id);
  const { body, ...front } = record;
  writeFileSync(target, serialize(front, body), 'utf8');

  if (existing && existing.file !== target) rmSync(existing.file, { force: true });

  // A superseded memory is marked, never silently deleted: knowing that a rule was replaced is
  // itself useful, and `mem gc` stays the only thing allowed to remove a file.
  for (const oldId of record.supersedes) {
    if (oldId !== record.id && findById(oldId)) setField(oldId, 'status', 'superseded');
  }

  reindex();
  return { ok: true, errors: [], warnings, record, file: target };
}

export function setField(id, field, value) {
  const mem = findById(id);
  if (!mem) return false;
  const { body, file, ...front } = mem;
  front[field] = value;
  front.updated = today();
  writeFileSync(file, serialize(front, body), 'utf8');
  reindex();
  return true;
}

export function remove(id, { archive = true } = {}) {
  const mem = findById(id);
  if (!mem) return false;
  if (archive) {
    const dir = join(paths.backups, 'removed');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    renameSync(mem.file, join(dir, `${Date.now()}-${basename(mem.file)}`));
  } else {
    rmSync(mem.file, { force: true });
  }
  const stats = loadStats();
  delete stats.memories[id];
  saveStats(stats);
  reindex();
  return true;
}

/** Record that a memory was actually used. This is what makes the GC decisions evidence-based. */
export function recordHit(id) {
  const stats = loadStats();
  const s = (stats.memories[id] ??= { hits: 0, lastHit: null, firstHit: null });
  s.hits += 1;
  s.lastHit = new Date().toISOString();
  s.firstHit ??= s.lastHit;
  saveStats(stats);
}

/** Rebuild index.json and the human-readable INDEX.md from the files on disk. */
export function reindex() {
  const all = readAll();
  const stats = loadStats();
  const entries = all.map((m) => ({
    id: m.id,
    title: m.title || m.id,
    hook: m.hook || '',
    type: m.type,
    scope: m.scope,
    status: m.status,
    confidence: m.confidence || 'high',
    tags: m.tags,
    keywords: m.keywords?.length ? m.keywords : deriveKeywords(m),
    links: m.links,
    created: m.created || null,
    updated: m.updated || null,
    expires: m.expires || null,
    bytes: Buffer.byteLength(m.body, 'utf8'),
    hits: stats.memories[m.id]?.hits || 0,
    lastHit: stats.memories[m.id]?.lastHit || null,
  }));
  entries.sort((a, b) => a.scope.localeCompare(b.scope) || a.id.localeCompare(b.id));

  ensureStore();
  writeJson(paths.index, { version: 1, generated: new Date().toISOString(), entries });
  writeFileSync(paths.humanIndex, renderHumanIndex(entries), 'utf8');
  return entries;
}

export function loadIndex() {
  const idx = readJson(paths.index, null);
  if (!idx || !Array.isArray(idx.entries)) return reindex();
  return idx.entries;
}

function renderHumanIndex(entries) {
  const byScope = new Map();
  for (const e of entries) {
    if (!byScope.has(e.scope)) byScope.set(e.scope, []);
    byScope.get(e.scope).push(e);
  }
  const lines = [
    '# Memory index',
    '',
    `_Generated by \`mem reindex\` - ${entries.length} memories. Do not edit by hand._`,
    '',
    'Read one with `mem get <id>`.',
    '',
  ];
  for (const scope of [...byScope.keys()].sort()) {
    lines.push(`## ${scope}`, '');
    lines.push('| id | type | hook | tags | hits |');
    lines.push('|---|---|---|---|---|');
    for (const e of byScope.get(scope)) {
      const flag = e.status === 'active' ? '' : ` _(${e.status})_`;
      const hook = e.hook.replace(/\|/g, '\\|');
      lines.push(`| \`${e.id}\` | ${e.type}${flag} | ${hook} | ${e.tags.join(', ')} | ${e.hits} |`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}
