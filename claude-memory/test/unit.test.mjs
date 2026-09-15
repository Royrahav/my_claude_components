/**
 * Unit tests. Run with: node --test test/
 *
 * Every test drives a throwaway store via CLAUDE_MEMORY_HOME so nothing here can touch a real
 * memory store. The environment variable is set before any library module is imported, because
 * lib/paths.mjs resolves the store root at call time but caches config.
 */
process.env.CLAUDE_MEMORY_HOME = process.env.CLAUDE_MEMORY_HOME
  || new URL('./.testrun', import.meta.url).pathname.replace(/^\//, '');

import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { parse, serialize } from '../lib/frontmatter.mjs';
import { normalizeRemote, slug, scopeToDir } from '../lib/scope.mjs';
import * as store from '../lib/store.mjs';
import { scoreEntry, buildIdf, buildCatalog, renderCatalog, isExpired } from '../lib/search.mjs';
import { analyze, overlap, archivable } from '../lib/gc.mjs';
import { paths } from '../lib/paths.mjs';

function freshStore() {
  rmSync(paths.root, { recursive: true, force: true });
  mkdirSync(join(paths.store, 'global'), { recursive: true });
}

describe('frontmatter', () => {
  test('round-trips a value containing a colon without compounding escapes', () => {
    // Regression: values matching the "needs quoting" rule were written with JSON.stringify
    // but read back by stripping quotes, so every save/load cycle re-escaped the inner quotes.
    const hook = 'pin the reviewer to Opus (model: "opus"), always';
    let text = serialize({ id: 'x', hook }, 'body');
    for (let i = 0; i < 3; i += 1) {
      const round = parse(text);
      assert.equal(round.data.hook, hook, `escaping drifted on cycle ${i}`);
      text = serialize({ id: 'x', hook: round.data.hook }, round.body);
    }
  });

  test('parses inline arrays and preserves them', () => {
    const { data } = parse(serialize({ id: 'x', tags: ['a', 'b-c'], links: [] }, 'body'));
    assert.deepEqual(data.tags, ['a', 'b-c']);
    assert.deepEqual(data.links, []);
  });

  test('reads the legacy nested metadata block', () => {
    const legacy = ['---', 'name: old-thing', 'description: a legacy memory', 'metadata:',
      '  type: feedback', '  modified: 2026-09-14T08:09:20.038Z', '---', '', 'Body text.'].join('\n');
    const { data, body } = parse(legacy);
    assert.equal(data.name, 'old-thing');
    assert.equal(data.metadata.type, 'feedback');
    assert.equal(body, 'Body text.');
  });

  test('treats a document with no frontmatter as all body', () => {
    const { data, body, hadFrontmatter } = parse('just text');
    assert.equal(hadFrontmatter, false);
    assert.deepEqual(data, {});
    assert.equal(body, 'just text');
  });
});

describe('scope', () => {
  test('https and ssh remotes for one repo collapse to the same key', () => {
    assert.equal(
      normalizeRemote('https://github.com/LabOS-co/printer-service.git'),
      normalizeRemote('git@github.com:LabOS-co/printer-service.git'),
    );
  });

  test('rejects a remote with no owner/name pair', () => {
    assert.equal(normalizeRemote('not-a-url'), null);
    assert.equal(normalizeRemote(''), null);
  });

  test('scope names map to filesystem-safe directories', () => {
    assert.equal(scopeToDir('repo.labos-vcpp'), 'repo-labos-vcpp');
    assert.equal(scopeToDir('topic.labos-platform'), 'topic-labos-platform');
    assert.equal(slug('C:\\P4SPACE\\Labs'), 'c-p4space-labs');
  });
});

describe('store', () => {
  beforeEach(freshStore);

  test('writes, reads back and indexes a memory', () => {
    const r = store.write({
      id: 'sample-rule', title: 'Sample rule', hook: 'never do the thing',
      type: 'reference', scope: 'global', tags: ['x'], body: 'The thing must not be done.',
    });
    assert.ok(r.ok, r.errors.join('; '));
    const got = store.findById('sample-rule');
    assert.equal(got.title, 'Sample rule');
    assert.deepEqual(store.loadIndex().map((e) => e.id), ['sample-rule']);
  });

  test('rejects a memory that is missing its required fields', () => {
    const r = store.write({ id: 'broken', scope: 'global', type: 'reference', body: '' });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes('title')));
    assert.ok(r.errors.some((e) => e.includes('body')));
  });

  test('warns when a feedback memory omits Why / How to apply', () => {
    const r = store.write({
      id: 'bare-feedback', title: 'Bare', hook: 'do it this way', type: 'feedback',
      scope: 'global', tags: ['x'], body: 'Just an assertion with no reasoning.',
    });
    assert.ok(r.ok);
    assert.ok(r.warnings.some((w) => w.includes('Why')));
    assert.ok(r.warnings.some((w) => w.includes('How to apply')));
  });

  test('moving a memory between scopes leaves only one file', () => {
    store.write({ id: 'movable', title: 'Movable', hook: 'h', type: 'reference', scope: 'global', tags: ['t'], body: 'b' });
    const first = store.fileFor('global', 'movable');
    store.write({ id: 'movable', title: 'Movable', hook: 'h', type: 'reference', scope: 'topic.things', tags: ['t'], body: 'b' });
    assert.equal(existsSync(first), false, 'old scope file should be removed');
    assert.equal(store.readAll().filter((m) => m.id === 'movable').length, 1);
  });

  test('supersede marks the old memory rather than deleting it', () => {
    store.write({ id: 'old-way', title: 'Old way', hook: 'h', type: 'reference', scope: 'global', tags: ['t'], body: 'b' });
    store.write({
      id: 'new-way', title: 'New way', hook: 'h', type: 'reference', scope: 'global',
      tags: ['t'], body: 'b', supersedes: ['old-way'],
    });
    assert.equal(store.findById('old-way').status, 'superseded');
  });

  test('recordHit accumulates into the index', () => {
    store.write({ id: 'counted', title: 'Counted', hook: 'h', type: 'reference', scope: 'global', tags: ['t'], body: 'b' });
    store.recordHit('counted');
    store.recordHit('counted');
    store.reindex();
    assert.equal(store.loadIndex().find((e) => e.id === 'counted').hits, 2);
  });

  test('tokenizer keeps short domain tokens but drops filler', () => {
    const tokens = store.tokenize('run p4 unshelve on the CL');
    assert.ok(tokens.includes('p4'));
    assert.ok(tokens.includes('cl'));
    assert.ok(!tokens.includes('on'));
    assert.ok(!tokens.includes('the'));
  });
});

describe('search ranking', () => {
  const entries = [
    { id: 'go-reuse-check', title: 'Go reuse check', hook: 'check go-packages first', type: 'feedback', scope: 'global', status: 'active', tags: ['go', 'reuse'], keywords: ['go', 'reuse', 'check', 'packages'], hits: 0 },
    { id: 'kibana-autodist', title: 'Kibana autodist', hook: 'autodist has no job_id in kibana', type: 'feedback', scope: 'global', status: 'active', tags: ['kibana'], keywords: ['kibana', 'autodist', 'job'], hits: 0 },
    { id: 'no-unshelve', title: 'No unshelve', hook: 'never p4 unshelve a shelved CL', type: 'feedback', scope: 'global', status: 'active', tags: ['p4'], keywords: ['unshelve', 'shelved', 'p4'], hits: 0 },
  ];
  const idf = buildIdf(entries);
  const find = (id) => entries.find((e) => e.id === id);

  test('a lone filler word does not carry a match', () => {
    const weak = scoreEntry(find('go-reuse-check'), ['check'], idf);
    const strong = scoreEntry(find('kibana-autodist'), ['kibana', 'autodist'], idf);
    assert.ok(weak.score < strong.score * 0.5, `expected ${weak.score} to be well below ${strong.score}`);
  });

  test('a lone distinctive word still carries a match', () => {
    assert.ok(scoreEntry(find('no-unshelve'), ['unshelve'], idf).score > 3);
  });

  test('prefix matching bridges an inflected query word', () => {
    assert.ok(scoreEntry(find('no-unshelve'), ['shelve'], idf).score > 0);
  });

  test('a query sharing nothing scores zero', () => {
    assert.equal(scoreEntry(find('no-unshelve'), ['weather', 'tomorrow'], idf).score, 0);
  });
});

describe('catalog', () => {
  const mk = (id, over) => ({
    id, title: id, hook: `hook for ${id}`, type: 'reference', scope: 'global',
    status: 'active', tags: [], keywords: [], hits: 0, updated: '2026-01-01', ...over,
  });

  test('unfinished work sorts to the top and is marked', () => {
    const entries = [mk('a-ref'), mk('z-live', { status: 'in-progress' }), mk('b-rule', { type: 'feedback' })];
    const { shown } = buildCatalog(entries, process.cwd(), { maxEntries: 10 });
    assert.equal(shown[0].id, 'z-live');
    assert.equal(shown[1].id, 'b-rule');
    assert.match(renderCatalog({ shown, hidden: 0 }, 'global').split('\n')[1], /^\*z-live/);
  });

  test('superseded, archived and expired entries never reach the catalog', () => {
    const entries = [
      mk('kept'),
      mk('gone', { status: 'superseded' }),
      mk('filed', { status: 'archived' }),
      mk('lapsed', { expires: '2020-01-01' }),
    ];
    const { shown } = buildCatalog(entries, process.cwd(), { maxEntries: 10 });
    assert.deepEqual(shown.map((e) => e.id), ['kept']);
  });

  test('the budget truncates and reports the remainder', () => {
    const entries = Array.from({ length: 12 }, (_, i) => mk(`m${i}`));
    const catalog = buildCatalog(entries, process.cwd(), { maxEntries: 5 });
    assert.equal(catalog.shown.length, 5);
    assert.equal(catalog.hidden, 7);
    assert.match(renderCatalog(catalog, 'global'), /\+7 more/);
  });

  test('isExpired only fires on a date in the past', () => {
    assert.equal(isExpired({ expires: '2020-01-01' }), true);
    assert.equal(isExpired({ expires: '2999-01-01' }), false);
    assert.equal(isExpired({ expires: null }), false);
    assert.equal(isExpired({ expires: 'not-a-date' }), false);
  });
});

describe('gc', () => {
  const now = Date.parse('2026-09-15T00:00:00Z');
  const ago = (days) => new Date(now - days * 86400000).toISOString();

  const base = {
    type: 'reference', scope: 'global', status: 'active', tags: [], keywords: [],
    links: [], bytes: 400, hits: 0, lastHit: null,
  };

  test('flags a never-retrieved memory once it is old enough', () => {
    const f = analyze([{ ...base, id: 'cold', updated: ago(200).slice(0, 10) }], { now });
    assert.deepEqual(f.unused.map((x) => x.id), ['cold']);
  });

  test('a used memory is stale, not unused', () => {
    const f = analyze([{ ...base, id: 'warm', updated: ago(200).slice(0, 10), hits: 5, lastHit: ago(200) }], { now });
    assert.equal(f.unused.length, 0);
    assert.deepEqual(f.stale.map((x) => x.id), ['warm']);
  });

  test('a finished project memory is archivable only after its grace period', () => {
    const recent = analyze([{ ...base, id: 'just-done', type: 'project', status: 'done', updated: ago(5).slice(0, 10) }], { now });
    assert.equal(recent.finished.length, 0);
    const older = analyze([{ ...base, id: 'long-done', type: 'project', status: 'done', updated: ago(90).slice(0, 10) }], { now });
    assert.deepEqual(older.finished.map((x) => x.id), ['long-done']);
  });

  test('near-duplicates in the same scope are reported as merge candidates', () => {
    const kw = ['perforce', 'shelve', 'changelist', 'review'];
    const f = analyze([
      { ...base, id: 'dup-a', keywords: kw, updated: '2026-09-01' },
      { ...base, id: 'dup-b', keywords: [...kw, 'extra'], updated: '2026-09-01' },
    ], { now });
    assert.equal(f.duplicates.length, 1);
    assert.equal(f.duplicates[0].with, 'dup-b');
  });

  test('merge candidates are never queued for automatic archiving', () => {
    const kw = ['alpha', 'beta', 'gamma', 'delta'];
    const f = analyze([
      { ...base, id: 'dup-a', keywords: kw, updated: '2026-09-14' },
      { ...base, id: 'dup-b', keywords: kw, updated: '2026-09-14' },
    ], { now });
    assert.equal(archivable(f).length, 0);
  });

  test('a dangling link is reported', () => {
    const f = analyze([{ ...base, id: 'linker', links: ['nowhere'], updated: '2026-09-14' }], { now });
    assert.equal(f.brokenLinks.length, 1);
  });

  test('overlap is symmetric and bounded', () => {
    assert.equal(overlap(['a', 'b'], ['a', 'b']), 1);
    assert.equal(overlap(['a'], ['b']), 0);
    assert.equal(overlap([], ['a']), 0);
    assert.equal(overlap(['a', 'b'], ['b', 'a']), overlap(['b', 'a'], ['a', 'b']));
  });
});

describe('store resilience', () => {
  beforeEach(freshStore);

  test('a corrupt index is rebuilt rather than fatal', () => {
    store.write({ id: 'survivor', title: 'Survivor', hook: 'h', type: 'reference', scope: 'global', tags: ['t'], body: 'b' });
    writeFileSync(paths.index, 'not json at all', 'utf8');
    assert.deepEqual(store.loadIndex().map((e) => e.id), ['survivor']);
  });

  test('a memory file with no frontmatter still loads under its filename', () => {
    writeFileSync(join(paths.store, 'global', 'loose-note.md'), 'a note someone dropped in', 'utf8');
    const got = store.findById('loose-note');
    assert.ok(got);
    assert.equal(got.type, 'reference');
  });
});
