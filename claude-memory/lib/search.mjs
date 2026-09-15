/**
 * search.mjs - deciding which memory is worth a session's attention.
 *
 * Retrieval is lexical on purpose. An embedding index would need a model call, a vector
 * store and a warm cache on every prompt; at the size a personal memory store actually
 * reaches (tens to low hundreds of entries), weighted token overlap over a curated `hook`,
 * `tags` and `keywords` performs just as well and costs nothing. The curation is doing the
 * work an embedding would otherwise have to guess at.
 */
import { tokenize } from './store.mjs';
import { resolveScope, GLOBAL_SCOPE } from './scope.mjs';

// Field weights. `tags` and `hook` are author-curated and therefore trusted most; body text
// is the noisiest signal and only breaks ties.
const WEIGHTS = {
  id: 3.0,
  title: 2.0,
  hook: 2.0,
  tags: 3.5,
  keywords: 1.2,
};

const TYPE_BIAS = {
  feedback: 1.25,  // an instruction the user already gave; missing it repeats a past mistake
  user: 1.2,
  project: 1.15,   // resuming work is the headline use case
  decision: 1.0,
  reference: 0.95,
};

const STATUS_BIAS = {
  active: 1.0,
  'in-progress': 1.2,
  done: 0.5,
  superseded: 0.15,
  archived: 0.1,
};

// Credit for a near-miss ("shelve" against "shelved", "auth" against "authentication").
// Ordinary phrasing produces these constantly and exact matching misses every one of them.
const PREFIX_CREDIT = { tags: 1.6, id: 1.6, keywords: 1.0 };

function fieldTokens(entry) {
  return {
    id: new Set(tokenize(entry.id.replace(/-/g, ' '))),
    title: new Set(tokenize(entry.title)),
    hook: new Set(tokenize(entry.hook)),
    tags: new Set(tokenize((entry.tags || []).join(' '))),
    keywords: new Set(entry.keywords || []),
  };
}

/**
 * Inverse document frequency over the whole store.
 *
 * Without this, every query word counts the same, and the two failure modes show up
 * immediately: a throwaway word like "check" in "can you check kibana" scores a memory whose
 * id merely contains "check", while a decisive word like "unshelve" - which identifies exactly
 * one memory - counts no more than it does. Weighting by rarity fixes both at once, and it is
 * the one piece of statistics a lexical index genuinely needs.
 */
export function buildIdf(entries) {
  const df = new Map();
  for (const entry of entries) {
    const fields = fieldTokens(entry);
    const seen = new Set([...fields.id, ...fields.title, ...fields.hook, ...fields.tags, ...fields.keywords]);
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }
  const n = Math.max(entries.length, 2);
  const maxIdf = Math.log2(n);
  const factors = new Map();
  for (const [token, count] of df) {
    const idf = Math.log2(n / count);
    // A token unique to one memory lands near 1.7; one spread across a third of the store
    // lands near 0.7. Never zero: a common word is weak evidence, not anti-evidence.
    factors.set(token, 0.5 + Math.min(idf / maxIdf, 1) * 1.2);
  }
  return factors;
}

const DEFAULT_IDF = 1.0;

/**
 * Words that carry no topic on their own.
 *
 * Rarity alone cannot separate these from real signal: "review" is common across this store
 * yet is exactly what "review this diff" is about, while "check" is the filler verb in "check
 * kibana for the error". The distinction is semantic, not statistical, so it is stated
 * outright. These words still count when something else matched too - they are only barred
 * from being the *sole* reason a memory surfaces.
 */
const WEAK_ALONE = new Set([
  'check', 'time', 'add', 'fix', 'run', 'make', 'write', 'create', 'update', 'change',
  'need', 'want', 'look', 'find', 'call', 'put', 'show', 'tell', 'help', 'try', 'keep',
  'thing', 'stuff', 'please', 'done', 'going', 'able', 'good', 'new', 'old', 'file', 'code',
  'something', 'anything', 'everything', 'nothing', 'someone', 'somewhere', 'whatever',
]);
const LONE_MATCH_PENALTY = 0.3;

/**
 * Score one index entry against a set of query tokens.
 * Returns `{ score, matched }` so callers can explain *why* something surfaced.
 */
export function scoreEntry(entry, queryTokens, idf = null) {
  const fields = fieldTokens(entry);
  const rarity = (token) => (idf?.get(token) ?? DEFAULT_IDF);
  let score = 0;
  const matched = new Set();

  for (const token of queryTokens) {
    for (const [field, weight] of Object.entries(WEIGHTS)) {
      if (fields[field].has(token)) {
        score += weight * rarity(token);
        matched.add(token);
        break; // one field hit per token; repeating the same word across fields is not more evidence
      }
    }
  }

  for (const token of queryTokens) {
    if (matched.has(token) || token.length < 5) continue;
    for (const [field, credit] of Object.entries(PREFIX_CREDIT)) {
      if ([...fields[field]].some((k) => k.startsWith(token) || token.startsWith(k))) {
        score += credit * rarity(token);
        matched.add(token);
        break;
      }
    }
  }

  if (score === 0) return { score: 0, matched: [] };

  // A single filler word is not evidence. "can you check kibana" matched `go-reuse-check` on
  // "check" alone, and "what time is standup" matched a memory on "time" alone - both scoring
  // high enough to crowd out genuinely relevant entries.
  if (matched.size === 1 && WEAK_ALONE.has([...matched][0])) score *= LONE_MATCH_PENALTY;

  score *= TYPE_BIAS[entry.type] ?? 1;
  score *= STATUS_BIAS[entry.status] ?? 1;

  // A memory that has proved useful before is more likely to be useful again, but the effect
  // is capped so that an early favourite cannot permanently crowd out newer, better entries.
  score *= 1 + Math.min(entry.hits || 0, 10) * 0.02;

  return { score: Number(score.toFixed(3)), matched: [...matched] };
}

/** Is this entry readable from the given working directory? */
export function inScope(entry, cwd) {
  const here = resolveScope(cwd);
  return entry.scope === here || entry.scope === GLOBAL_SCOPE || entry.scope.startsWith('topic.');
}

export function search(entries, query, { cwd = process.cwd(), k = 5, minScore = 0, allScopes = false } = {}) {
  const tokens = [...new Set(tokenize(query))];
  if (tokens.length === 0) return [];
  // Rarity is measured over the whole store, not just the in-scope slice: how distinctive a
  // word is does not change because of which directory the session happens to be in.
  const idf = buildIdf(entries);
  return entries
    .filter((e) => allScopes || inScope(e, cwd))
    .map((e) => ({ entry: e, ...scoreEntry(e, tokens, idf) }))
    .filter((r) => r.score > minScore)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, k);
}

/**
 * The session-start catalog: one line per memory, no bodies.
 *
 * Ordering matters more than it looks. When the catalog is truncated to the budget it is the
 * *tail* that is dropped, so the ordering here decides what a session is allowed to forget:
 * standing instructions and live work first, background reference last.
 */
export function buildCatalog(entries, cwd, { maxEntries = 40 } = {}) {
  const visible = entries
    .filter((e) => inScope(e, cwd))
    .filter((e) => e.status !== 'superseded' && e.status !== 'archived')
    .filter((e) => !isExpired(e));

  const rank = (e) => {
    if (e.status === 'in-progress') return 0;
    if (e.type === 'user' || e.type === 'feedback') return 1;
    if (e.type === 'decision') return 2;
    if (e.type === 'project') return 3;
    return 4;
  };

  const sorted = visible.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return String(b.updated || '').localeCompare(String(a.updated || '')) || a.id.localeCompare(b.id);
  });

  return { shown: sorted.slice(0, maxEntries), hidden: Math.max(0, sorted.length - maxEntries) };
}

export function isExpired(entry, now = new Date()) {
  if (!entry.expires) return false;
  const t = Date.parse(entry.expires);
  return Number.isFinite(t) && t < now.getTime();
}

// A catalog line only has to answer "could this be the one?". Anything past that is paid for
// on every single session, so hooks are clipped hard here even though the stored hook is longer.
const CATALOG_HOOK_CHARS = 78;

function clip(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Render the catalog as the compact block a hook injects into context. */
export function renderCatalog(catalog, scope) {
  if (catalog.shown.length === 0) return '';
  const lines = [
    `MEMORY CATALOG - scope ${scope} (${catalog.shown.length} entries; bodies NOT loaded)`,
  ];
  for (const e of catalog.shown) {
    const mark = e.status === 'in-progress' ? '*' : ' ';
    const tags = e.tags?.length ? ` [${e.tags.slice(0, 2).join(',')}]` : '';
    lines.push(`${mark}${e.id}${tags} - ${clip(e.hook, CATALOG_HOOK_CHARS)}`);
  }
  if (catalog.hidden > 0) lines.push(`  (+${catalog.hidden} more; \`mem search <query>\` to find them)`);
  lines.push('Load the full text of exactly the one you need with: mem get <id>');
  return lines.join('\n');
}
