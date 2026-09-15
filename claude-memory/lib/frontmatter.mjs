/**
 * frontmatter.mjs - a deliberately small YAML subset.
 *
 * Bringing in a YAML dependency would make the tool harder to hand to another developer
 * (install step, lockfile, supply chain) for no gain: the memory schema is flat scalars,
 * inline arrays, and at most one level of nesting (legacy files use a `metadata:` block).
 * Anything richer than that is a schema smell, not a parser gap.
 */

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseScalar(raw) {
  const v = raw.trim();
  if (v === '' || v === '~' || v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\[.*\]$/.test(v)) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((s) => unquote(s.trim())).filter(Boolean);
  }
  return unquote(v);
}

/**
 * Undo whatever `emitScalar` did. Double-quoted values are written with JSON.stringify, so
 * they must be read back with JSON.parse: merely stripping the outer quotes would leave the
 * inner escapes in the value, and every save/load cycle would then escape them again.
 */
function unquote(s) {
  if (s.length >= 2 && s[0] === '"' && s.at(-1) === '"') {
    try {
      return JSON.parse(s);
    } catch {
      return s.slice(1, -1);
    }
  }
  if (s.length >= 2 && s[0] === "'" && s.at(-1) === "'") return s.slice(1, -1);
  return s;
}

/** Split `key: value`, tolerating colons inside the value (URLs, timestamps). */
function splitKey(line) {
  const i = line.indexOf(':');
  if (i === -1) return null;
  return [line.slice(0, i).trim(), line.slice(i + 1)];
}

export function parse(text) {
  const m = FENCE.exec(text);
  if (!m) return { data: {}, body: text.trim(), hadFrontmatter: false };

  const data = {};
  let block = null;        // key of the nested map currently being filled
  let listKey = null;      // key of the dash-list currently being filled

  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indented = /^\s+/.test(line);

    // `  - item` continues whichever list is open.
    const dash = /^\s*-\s+(.*)$/.exec(line);
    if (dash && listKey) {
      const target = block ? (data[block] ??= {}) : data;
      (target[listKey] ??= []).push(unquote(dash[1].trim()));
      continue;
    }

    const kv = splitKey(line);
    if (!kv) continue;
    const [key, rawValue] = kv;

    if (indented && block) {
      data[block][key] = parseScalar(rawValue);
      listKey = rawValue.trim() === '' ? key : null;
      continue;
    }

    if (rawValue.trim() === '') {
      // Either a nested map or a dash-list; the next line decides. Prepare for both.
      block = key;
      listKey = key;
      data[key] = {};
      continue;
    }

    block = null;
    listKey = null;
    data[key] = parseScalar(rawValue);
  }

  // A `key:` that turned out to be a list left an empty object behind; normalise it away.
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) {
      data[k] = null;
    }
  }

  return { data, body: text.slice(m[0].length).trim(), hadFrontmatter: true };
}

const NEEDS_QUOTES = /^[\s>|&*!%@`{}[\]#]|:\s|[\r\n]|^$/;

function emitScalar(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  if (typeof v !== 'string') return String(v);
  return NEEDS_QUOTES.test(v) ? JSON.stringify(v) : v;
}

/** Serialise in a fixed key order so diffs stay readable and reviewable. */
const KEY_ORDER = [
  'id', 'title', 'hook', 'type', 'scope', 'status', 'confidence',
  'tags', 'keywords', 'links', 'supersedes',
  'created', 'updated', 'expires', 'source',
];

export function serialize(data, body) {
  const keys = [...KEY_ORDER.filter((k) => k in data), ...Object.keys(data).filter((k) => !KEY_ORDER.includes(k))];
  const lines = keys
    .filter((k) => data[k] !== undefined)
    .map((k) => `${k}: ${emitScalar(data[k])}`.trimEnd());
  return `---\n${lines.join('\n')}\n---\n\n${String(body).trim()}\n`;
}
