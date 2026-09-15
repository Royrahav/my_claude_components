/**
 * gc.mjs - lifecycle analysis: what can be archived, merged, or is quietly rotting.
 *
 * Everything here *reports*. Nothing deletes on its own, and nothing is ever hard-deleted:
 * `mem gc --apply` archives, and archived files move to backups/. A memory store that can
 * silently drop a fact the user relies on is worse than one that grows a little.
 */
import { loadConfig } from './paths.mjs';
import { isExpired } from './search.mjs';

const DAY = 86400000;

function daysSince(iso, now) {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (now - t) / DAY : Infinity;
}

/** Jaccard overlap of two keyword sets - cheap, symmetric, and good enough to flag a merge. */
export function overlap(a, b) {
  const A = new Set(a || []);
  const B = new Set(b || []);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const x of A) if (B.has(x)) shared += 1;
  return shared / (A.size + B.size - shared);
}

/**
 * Classify every entry. A memory can appear under several findings (a done project memory
 * that is also stale), so callers should de-duplicate by id when acting.
 */
export function analyze(entries, { now = Date.now(), config = loadConfig() } = {}) {
  const { staleDays, doneGraceDays, duplicateThreshold } = config.gc;

  const expired = [];
  const finished = [];
  const stale = [];
  const unused = [];
  const duplicates = [];
  const brokenLinks = [];
  const oversized = [];

  const byId = new Map(entries.map((e) => [e.id, e]));

  for (const e of entries) {
    if (isExpired(e, new Date(now))) {
      expired.push({ id: e.id, reason: `expires ${e.expires} has passed` });
      continue;
    }

    if (e.type === 'project' && e.status === 'done') {
      const age = daysSince(e.updated, now);
      if (age > doneGraceDays) {
        finished.push({ id: e.id, reason: `project done, untouched ${Math.round(age)}d (grace ${doneGraceDays}d)` });
      }
    }

    const sinceHit = daysSince(e.lastHit, now);
    const sinceUpdate = daysSince(e.updated, now);
    const idle = Math.min(sinceHit, sinceUpdate);

    // Never-retrieved entries are the clearest waste: they cost catalog space every session
    // and have never once been opened.
    if ((e.hits || 0) === 0 && sinceUpdate > staleDays) {
      unused.push({ id: e.id, reason: `never retrieved, written ${Math.round(sinceUpdate)}d ago` });
    } else if (idle > staleDays && (e.hits || 0) > 0) {
      stale.push({ id: e.id, reason: `last used ${Math.round(sinceHit)}d ago` });
    }

    if (e.bytes > 2400) {
      oversized.push({ id: e.id, reason: `${e.bytes} bytes - compress or split into linked memories` });
    }

    for (const link of e.links || []) {
      if (!byId.has(link)) brokenLinks.push({ id: e.id, reason: `links to missing memory [[${link}]]` });
    }
  }

  // Near-duplicates: same scope, same type, heavy keyword overlap. Reported as merge
  // candidates for a human or agent to judge - automatic merging would lose nuance.
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      if (a.scope !== b.scope || a.type !== b.type) continue;
      const score = overlap(a.keywords, b.keywords);
      if (score >= duplicateThreshold) {
        duplicates.push({ id: a.id, with: b.id, score: Number(score.toFixed(2)), reason: `${Math.round(score * 100)}% keyword overlap with ${b.id}` });
      }
    }
  }

  return { expired, finished, stale, unused, duplicates, brokenLinks, oversized };
}

/** Findings that `--apply` will act on, flattened and de-duplicated. Merge candidates are never auto-applied. */
export function archivable(findings) {
  const seen = new Map();
  for (const group of [findings.expired, findings.finished, findings.unused]) {
    for (const f of group) if (!seen.has(f.id)) seen.set(f.id, f.reason);
  }
  return [...seen.entries()].map(([id, reason]) => ({ id, reason }));
}

export function summarize(findings) {
  return Object.fromEntries(Object.entries(findings).map(([k, v]) => [k, v.length]));
}
