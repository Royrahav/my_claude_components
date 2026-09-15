/**
 * migrate.mjs - import the legacy per-project memory stores into the vault.
 *
 * The legacy layout keyed memories by *workspace path*, so one codebase checked out at four
 * paths produced four disconnected stores. Migration re-keys them by identity, and takes the
 * opportunity to promote two kinds of memory out of their accidental project:
 *
 *   global    - facts about the user or about how Claude should work anywhere
 *   topic.*   - facts about a platform/tool that follow you across checkouts
 *
 * Dry-run by default. `--apply` is required to write anything, and the legacy files are left
 * exactly where they are: migration copies, it never moves or deletes.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, renameSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { paths, loadConfig, resetConfigCache, DEFAULT_CONFIG, ensureStore } from './paths.mjs';
import { parse } from './frontmatter.mjs';
import * as store from './store.mjs';
import { slug, resolveScope, GLOBAL_SCOPE } from './scope.mjs';

/**
 * Workspace-slug -> scope. First match wins.
 * The labOS entry is the whole point of the exercise: MainRls, Stable and 5-31-0 are branches
 * of one codebase and must share one memory scope.
 */
const PROJECT_SCOPE_RULES = [
  { match: /^C--P4SPACE-Labs-(MainRls|Stable|5-31-0|[0-9-]+)-Labs-VC/i, scope: 'repo.labos-vcpp' },
  { match: /^C--P4SPACE-Labs-HL7Interfaces/i, scope: 'repo.labos-hl7interfaces' },
  { match: /^C--P4SPACE-Labs-StyleSheets/i, scope: 'repo.labos-stylesheets' },
  { match: /^c--P4SPACE-Products-zfind/i, scope: 'repo.zfind' },
  { match: /^C--Users-[^-]+-r?$/i, scope: 'repo.claude-config' },
  { match: /^C--Users-.*claude-skills/i, scope: 'repo.claude-config' },
  { match: /^C--Roy-Projects-Autolims2-0/i, scope: 'repo.autolims2-0' },
];

/**
 * Recover the real workspace path from a legacy project slug (`C--GitProjects-printer-server`
 * -> `C:\GitProjects\printer-server`). The encoding is lossy - both `\` and `-` become `-` -
 * so segments are matched longest-first against the filesystem, which resolves the ambiguity
 * for any directory that still exists.
 *
 * This matters more than it looks: a git-backed project must migrate to the scope its *live*
 * sessions resolve to (from the origin remote), or the imported memories land in a scope
 * nothing will ever read.
 */
function decodeWorkspacePath(projectSlug) {
  const m = /^([a-zA-Z])--(.+)$/.exec(projectSlug);
  if (!m) return null;
  let path = `${m[1].toUpperCase()}:\\`;
  if (!existsSync(path)) return null;

  const tokens = m[2].split('-');
  let i = 0;
  while (i < tokens.length) {
    let matched = null;
    for (let j = tokens.length; j > i; j -= 1) {
      const candidate = join(path, tokens.slice(i, j).join('-'));
      if (existsSync(candidate)) { matched = { path: candidate, next: j }; break; }
    }
    if (!matched) break;
    path = matched.path;
    i = matched.next;
  }
  return i > 0 ? path : null;
}

/**
 * Memory-id patterns that belong somewhere other than the project they were written in.
 * Checked before the project rule. Order matters; first match wins.
 */
const PROMOTION_RULES = [
  // Who the user is and how they want to be worked with - true in every repo.
  { match: /^(user[-_]identity|send[-_]mail[-_]preference)/i, scope: GLOBAL_SCOPE },
  // Instructions about Claude's own process: skills, reviews, dev-flow, writing style.
  {
    match: /^feedback[-_](use[-_]available[-_]skills|always[-_]load[-_]skills|skills?[-_]location|skill[-_]precedence|priority[-_]user[-_]skills|skill[-_]updates|code[-_]review|solid[-_]clean[-_]code|stepwise|implement[-_]review|dry[-_]convention|no[-_]em[-_]dash|never[-_]change[-_]file[-_]encoding|go[-_]reuse[-_]check)/i,
    scope: GLOBAL_SCOPE,
  },
  { match: /^project[-_](skill[-_]layout|dev[-_]flow[-_]agent[-_]skills)/i, scope: GLOBAL_SCOPE },
  // labOS platform knowledge: auth, APIs, log search. Needed from any checkout.
  { match: /^(labos-|kibana-)/i, scope: 'topic.labos-platform' },
  { match: /^feedback[-_](kibana|logging[-_]api|divertor|hl7[-_]autocomm|receive[-_]before[-_]divertor)/i, scope: 'topic.labos-platform' },
];

const LEGACY_TYPE_PREFIX = /^(user|feedback|project|reference|decision)[-_]/i;

/**
 * Legacy project memories carry no status, and guessing wrong is costly in both directions:
 * marking finished work `in-progress` keeps dead plans pinned to the top of every catalog,
 * while marking live work `done` lets GC quietly archive something still being worked on.
 * Finished work almost always says so in its own name or opening lines, so that is the signal
 * used, and everything unclear stays `in-progress` where a human will see it.
 */
const COMPLETED_SIGNAL = /\b(completed?|finished|landed|shipped|delivered|closed|all\s+milestones?\s+(are\s+)?(done|complete))\b/i;

function legacyProjectStatus(candidate) {
  const headline = `${candidate.id} ${candidate.data.description || ''} ${String(candidate.body).slice(0, 400)}`;
  return COMPLETED_SIGNAL.test(headline) ? 'done' : 'in-progress';
}

function scopeForProject(projectSlug) {
  // Explicit rules win: they encode a deliberate collapse of several checkouts into one scope,
  // which no amount of inspecting an individual directory could infer.
  for (const rule of PROJECT_SCOPE_RULES) {
    const m = rule.match.exec(projectSlug);
    if (m) return typeof rule.scope === 'function' ? rule.scope(m) : rule.scope;
  }
  const live = decodeWorkspacePath(projectSlug);
  if (live) return resolveScope(live);
  return `repo.${slug(projectSlug.replace(/^[a-z]--/i, ''))}`;
}

function scopeForMemory(fileName, projectSlug) {
  for (const rule of PROMOTION_RULES) {
    if (rule.match.test(fileName)) return rule.scope;
  }
  return scopeForProject(projectSlug);
}

/** Legacy files carry the type in the filename prefix, in `metadata.type`, or nowhere. */
function typeFor(data, fileName) {
  const declared = data?.metadata?.type || data?.type;
  if (store.TYPES.includes(declared)) return declared;
  const m = LEGACY_TYPE_PREFIX.exec(fileName);
  if (m && store.TYPES.includes(m[1].toLowerCase())) return m[1].toLowerCase();
  return 'reference';
}

/** A hook must fit one catalog line. Legacy `description` fields are often a full sentence. */
function hookFrom(description, title, body) {
  const raw = String(description || '').replace(/\s+/g, ' ').trim()
    || String(body || '').split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim()
    || title;
  const firstClause = raw.split(/\s+[--]\s+/)[0];
  const candidate = firstClause.length >= 20 ? firstClause : raw;
  return candidate.length <= store.LIMITS.hook ? candidate : `${candidate.slice(0, store.LIMITS.hook - 1).trimEnd()}…`;
}

function titleFrom(data, fileName) {
  const raw = String(data.title || data.name || fileName.replace(/\.md$/, '')).replace(/[-_]+/g, ' ').trim();
  const cased = raw.charAt(0).toUpperCase() + raw.slice(1);
  return cased.length <= store.LIMITS.title ? cased : `${cased.slice(0, store.LIMITS.title - 1).trimEnd()}…`;
}

function tagsFrom(id, scope, type) {
  const tags = new Set();
  if (scope.startsWith('topic.')) tags.add(scope.slice('topic.'.length));
  else if (scope.startsWith('repo.')) tags.add(scope.slice('repo.'.length));
  tags.add(type);
  for (const t of store.tokenize(id.replace(LEGACY_TYPE_PREFIX, '').replace(/-/g, ' '))) {
    if (tags.size >= 5) break;
    tags.add(t);
  }
  return [...tags].slice(0, 5);
}

/** `[[old_name]]` links refer to legacy filenames; rewrite them to the new kebab ids. */
function rewriteLinks(body, idMap) {
  return String(body).replace(/\[\[([^\]]+)\]\]/g, (whole, name) => {
    const target = idMap.get(name) || idMap.get(slug(name)) || slug(name);
    return `[[${target}]]`;
  });
}

function collectLegacyFiles() {
  const found = [];

  // Per-project stores.
  if (existsSync(paths.legacyProjects)) {
    for (const project of readdirSync(paths.legacyProjects, { withFileTypes: true })) {
      if (!project.isDirectory()) continue;
      const dir = join(paths.legacyProjects, project.name, 'memory');
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.md') || isIndexFile(f)) continue;
        found.push({ file: join(dir, f), projectSlug: project.name });
      }
    }
  }

  // Loose files in the old global memory dir, which is now the vault root. They sit beside
  // store/ rather than inside it, so a plain readdir of the root finds them.
  if (existsSync(paths.root)) {
    for (const f of readdirSync(paths.root, { withFileTypes: true })) {
      if (!f.isFile() || !f.name.endsWith('.md') || isIndexFile(f.name)) continue;
      found.push({ file: join(paths.root, f.name), projectSlug: 'C--Users-roy-r', forceScope: GLOBAL_SCOPE });
    }
  }

  return found;
}

/**
 * Index files are lists of pointers to memories, not memories. Migration renames them as it
 * goes (MEMORY.md -> MEMORY.legacy.md / MEMORY.superseded.md), so a second run would otherwise
 * find the renamed index sitting in the vault root and import the pointer list as a "memory".
 */
function isIndexFile(name) {
  return /^(MEMORY|INDEX)\b/i.test(name) || /\.(legacy|superseded)\.md$/i.test(name);
}

/** Seed config.json so *future* sessions in those paths resolve to the same collapsed scopes. */
function seedScopeRules(apply) {
  const rules = [
    { match: '[\\\\/]P4SPACE[\\\\/]Labs[\\\\/][^\\\\/]+[\\\\/]Labs[\\\\/]VC', scope: 'repo.labos-vcpp' },
    { match: '[\\\\/]P4SPACE[\\\\/]Labs[\\\\/]HL7Interfaces', scope: 'repo.labos-hl7interfaces' },
    { match: '[\\\\/]P4SPACE[\\\\/]Labs[\\\\/]StyleSheets', scope: 'repo.labos-stylesheets' },
    { match: '[\\\\/]P4SPACE[\\\\/]Products[\\\\/]zfind', scope: 'repo.zfind' },
    { match: '[\\\\/]\\.claude([\\\\/]|$)', scope: 'repo.claude-config' },
    { match: '[\\\\/]Users[\\\\/][^\\\\/]+[\\\\/]?$', scope: 'repo.claude-config' },
  ];
  if (!apply) return rules;

  ensureStore();
  const current = existsSync(paths.config)
    ? JSON.parse(readFileSync(paths.config, 'utf8'))
    : { ...DEFAULT_CONFIG };
  const existing = new Set((current.scopeRules || []).map((r) => r.match));
  current.scopeRules = [...(current.scopeRules || []), ...rules.filter((r) => !existing.has(r.match))];
  writeFileSync(paths.config, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  resetConfigCache();
  loadConfig();
  return rules;
}

/**
 * Retire the legacy per-project indexes.
 *
 * Migration copies rather than moves, which leaves every legacy `MEMORY.md` in place - and the
 * built-in memory system goes on loading them, so after migrating, a session pays for the same
 * facts twice: once in the legacy index, once in the catalog. Renaming the index disables that
 * auto-load while deleting nothing; the memories themselves stay on disk, and undoing it is a
 * rename back.
 */
export function retireLegacyIndexes({ apply = false } = {}) {
  const retired = [];
  if (!existsSync(paths.legacyProjects)) return retired;

  for (const project of readdirSync(paths.legacyProjects, { withFileTypes: true })) {
    if (!project.isDirectory()) continue;
    const index = join(paths.legacyProjects, project.name, 'memory', 'MEMORY.md');
    if (!existsSync(index)) continue;
    const target = join(paths.legacyProjects, project.name, 'memory', 'MEMORY.superseded.md');
    if (apply) renameSync(index, target);
    retired.push(`${project.name}/memory/MEMORY.md`);
  }
  return retired;
}

export function runMigration({ apply = false, retireLegacy = false, force = false } = {}) {
  const legacy = collectLegacyFiles();
  const report = [];
  const planned = [];
  const idMap = new Map();

  // Pass 1: decide id, scope and type for everything, resolving id collisions by recency so
  // that the same memory saved in two workspaces converges on the newer copy.
  const byId = new Map();
  for (const item of legacy) {
    const text = readFileSync(item.file, 'utf8');
    const { data, body } = parse(text);
    const fileName = basename(item.file);
    const legacyName = String(data.name || fileName.replace(/\.md$/, ''));
    const id = slug(legacyName.replace(LEGACY_TYPE_PREFIX, '') || legacyName);
    const type = typeFor(data, fileName);
    const scope = item.forceScope || scopeForMemory(fileName, item.projectSlug);
    const mtime = statSync(item.file).mtimeMs;

    idMap.set(legacyName, id);
    idMap.set(fileName.replace(/\.md$/, ''), id);

    const candidate = { id, type, scope, data, body, file: item.file, mtime, projectSlug: item.projectSlug };
    const prior = byId.get(id);
    if (!prior || mtime > prior.mtime) {
      if (prior) report.push(`  dedup  ${id}: keeping newer copy from ${item.projectSlug}`);
      byId.set(id, candidate);
    } else {
      report.push(`  dedup  ${id}: keeping newer copy from ${prior.projectSlug}`);
    }
  }

  // Pass 2: build records, now that every legacy name maps to a final id for link rewriting.
  for (const c of byId.values()) {
    const meta = c.data.metadata || {};
    const status = c.type === 'project' ? legacyProjectStatus(c) : 'active';
    const record = {
      id: c.id,
      title: titleFrom(c.data, basename(c.file)),
      hook: hookFrom(c.data.description, c.id, c.body),
      type: c.type,
      scope: c.scope,
      status: c.data.status || status,
      tags: tagsFrom(c.id, c.scope, c.type),
      links: [],
      created: String(meta.created || meta.modified || '').slice(0, 10) || undefined,
      source: `migrated from ${c.projectSlug}`,
      body: rewriteLinks(c.body, idMap),
    };
    planned.push(record);
  }

  planned.sort((a, b) => a.scope.localeCompare(b.scope) || a.id.localeCompare(b.id));

  report.unshift(
    apply ? `MIGRATING ${planned.length} memories into ${paths.root}` : `DRY RUN - ${planned.length} memories would be migrated into ${paths.root}`,
    '',
  );

  let currentScope = null;
  const failures = [];
  let skipped = 0;
  for (const record of planned) {
    if (record.scope !== currentScope) {
      currentScope = record.scope;
      report.push(`\n${currentScope}`);
    }

    // Migration is re-runnable, so it must never overwrite a memory that already exists: by
    // the second run those have been edited, re-scoped or had keywords curated by hand, and
    // the legacy copy is the *older* truth. `--force` is the explicit opt-in to re-import.
    const existing = !force && store.findById(record.id);
    if (existing) {
      skipped += 1;
      report.push(`  ${record.id.padEnd(36)} ${'(exists)'.padEnd(10)} left as-is`);
      continue;
    }

    if (apply) {
      const result = store.write(record, { force: true });
      if (!result.ok) failures.push(`${record.id}: ${result.errors.join('; ')}`);
    }
    report.push(`  ${record.id.padEnd(36)} ${record.type.padEnd(10)} ${record.hook.slice(0, 60)}`);
  }
  if (skipped > 0) {
    report.push('', `${skipped} memories already in the store were left untouched (--force re-imports them).`);
  }

  const rules = seedScopeRules(apply);
  report.push('', apply ? `seeded ${rules.length} scope rules into ${paths.config}` : `would seed ${rules.length} scope rules into ${paths.config}`);
  for (const r of rules) report.push(`  ${r.match}  ->  ${r.scope}`);

  // The legacy MEMORY.md at the vault root would otherwise be mistaken for the new index.
  const legacyIndex = join(paths.root, 'MEMORY.md');
  if (apply && existsSync(legacyIndex)) {
    renameSync(legacyIndex, join(paths.root, 'MEMORY.legacy.md'));
    report.push('', 'renamed MEMORY.md -> MEMORY.legacy.md (superseded by INDEX.md)');
  }

  if (failures.length) {
    report.push('', `${failures.length} memories failed validation:`);
    for (const f of failures) report.push(`  ${f}`);
  }

  const retired = retireLegacyIndexes({ apply: apply && retireLegacy });
  if (retired.length > 0) {
    report.push('');
    if (retireLegacy) {
      report.push(apply
        ? `retired ${retired.length} legacy MEMORY.md indexes (renamed to MEMORY.superseded.md):`
        : `would retire ${retired.length} legacy MEMORY.md indexes (rename to MEMORY.superseded.md):`);
      for (const r of retired) report.push(`  ${r}`);
    } else {
      report.push(`NOTE: ${retired.length} legacy MEMORY.md indexes are still auto-loaded by the built-in`);
      report.push('memory system, so these facts now cost context twice. Re-run with --retire-legacy to');
      report.push('rename them to MEMORY.superseded.md - that disables the auto-load without deleting');
      report.push('anything, and renaming them back undoes it.');
    }
  }

  if (apply) {
    store.reindex();
    report.push('', 'Legacy memory files were copied, not moved. Verify with `mem list --all`, then delete');
    report.push('the old ~/.claude/projects/*/memory directories yourself when you are satisfied.');
  } else {
    report.push('', 'Re-run with --apply to write these.');
  }

  return {
    report,
    planned: planned.map((p) => ({ id: p.id, scope: p.scope, type: p.type })),
    failures,
    retired,
  };
}
