/**
 * Migration tests.
 *
 * Migration is the one operation that touches a user's existing data, and it is expected to be
 * run more than once (dry run, apply, apply again after a fix). The properties that matter are
 * therefore about what it must *not* do: not clobber a memory someone has since edited, not
 * mistake an index for a memory, not lose the connection between several checkouts of one repo.
 */
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sandbox = mkdtempSync(join(tmpdir(), 'mem-migrate-'));
process.env.CLAUDE_HOME = sandbox;
process.env.CLAUDE_MEMORY_HOME = join(sandbox, 'memory');

const { runMigration } = await import('../lib/migrate.mjs');
const store = await import('../lib/store.mjs');
const { paths } = await import('../lib/paths.mjs');

after(() => rmSync(sandbox, { recursive: true, force: true }));

function legacyMemory(projectSlug, fileName, frontmatter, body) {
  const dir = join(sandbox, 'projects', projectSlug, 'memory');
  mkdirSync(dir, { recursive: true });
  const fm = Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`).join('\n');
  writeFileSync(join(dir, fileName), `---\n${fm}\n---\n\n${body}\n`, 'utf8');
  return join(dir, fileName);
}

function resetStore() {
  rmSync(join(sandbox, 'memory'), { recursive: true, force: true });
  rmSync(join(sandbox, 'projects'), { recursive: true, force: true });
  mkdirSync(join(sandbox, 'memory', 'store', 'global'), { recursive: true });
}

describe('migrate', () => {
  beforeEach(resetStore);

  test('imports a legacy memory and derives its type from the filename prefix', () => {
    legacyMemory('C--GitProjects-widget', 'feedback_never_force_push.md',
      { name: 'feedback_never_force_push', description: 'never force push to a shared branch' },
      'Force pushing rewrites history others have pulled.');

    runMigration({ apply: true });

    const got = store.findById('never-force-push');
    assert.ok(got, 'memory should have been imported');
    assert.equal(got.type, 'feedback');
    assert.match(got.hook, /never force push/);
  });

  test('re-running leaves an already-imported memory untouched', () => {
    legacyMemory('C--GitProjects-widget', 'feedback_never_force_push.md',
      { name: 'feedback_never_force_push', description: 'never force push to a shared branch' },
      'Original body.');
    runMigration({ apply: true });

    // Stand in for any hand-curation done after the first import.
    store.setField('never-force-push', 'keywords', ['rebase', 'history', 'shared']);
    const result = runMigration({ apply: true });

    assert.deepEqual(store.findById('never-force-push').keywords, ['rebase', 'history', 'shared']);
    assert.ok(result.report.some((l) => l.includes('already in the store')));
  });

  test('--force re-imports and overwrites', () => {
    legacyMemory('C--GitProjects-widget', 'feedback_never_force_push.md',
      { name: 'feedback_never_force_push', description: 'never force push to a shared branch' },
      'Original body.');
    runMigration({ apply: true });
    store.setField('never-force-push', 'keywords', ['curated']);

    runMigration({ apply: true, force: true });
    assert.notDeepEqual(store.findById('never-force-push').keywords, ['curated']);
  });

  test('index files are never imported as memories', () => {
    const dir = join(sandbox, 'projects', 'C--GitProjects-widget', 'memory');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'MEMORY.md'), '# Memory Index\n\n- [A thing](a.md) - a hook\n', 'utf8');
    // The shape a previous migration leaves behind, which a second run used to ingest.
    writeFileSync(join(paths.root, 'MEMORY.legacy.md'), '# Memory Index\n\n- [A thing](a.md)\n', 'utf8');
    legacyMemory('C--GitProjects-widget', 'reference_a.md', { name: 'reference_a', description: 'a real memory' }, 'Body.');

    runMigration({ apply: true });

    const ids = store.readAll().map((m) => m.id);
    assert.deepEqual(ids, ['a']);
  });

  test('several checkouts of one codebase collapse into a single scope', () => {
    legacyMemory('C--P4SPACE-Labs-MainRls-Labs-VC--', 'feedback_alpha.md',
      { name: 'feedback_alpha', description: 'a rule learned on MainRls' }, 'Body.');
    legacyMemory('C--P4SPACE-Labs-Stable-Labs-VC--', 'feedback_beta.md',
      { name: 'feedback_beta', description: 'a rule learned on Stable' }, 'Body.');

    runMigration({ apply: true });

    assert.equal(store.findById('alpha').scope, 'repo.labos-vcpp');
    assert.equal(store.findById('beta').scope, 'repo.labos-vcpp');
  });

  test('the same memory saved in two workspaces converges on one copy', () => {
    legacyMemory('C--P4SPACE-Labs-MainRls-Labs-VC--', 'feedback_shared.md',
      { name: 'feedback_shared', description: 'the older copy' }, 'Old body.');
    legacyMemory('C--P4SPACE-Labs-Stable-Labs-VC--', 'feedback_shared.md',
      { name: 'feedback_shared', description: 'the newer copy' }, 'New body.');

    runMigration({ apply: true });

    assert.equal(store.readAll().filter((m) => m.id === 'shared').length, 1);
  });

  test('a dry run writes nothing', () => {
    legacyMemory('C--GitProjects-widget', 'feedback_dry.md',
      { name: 'feedback_dry', description: 'should not be written' }, 'Body.');

    const result = runMigration({ apply: false });

    assert.equal(store.readAll().length, 0);
    assert.equal(result.planned.length, 1);
  });

  test('retiring legacy indexes renames rather than deletes, and only when applied', () => {
    const dir = join(sandbox, 'projects', 'C--GitProjects-widget', 'memory');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'MEMORY.md'), '# Memory Index\n', 'utf8');

    runMigration({ apply: false, retireLegacy: true });
    assert.ok(existsSync(join(dir, 'MEMORY.md')), 'dry run must not rename');

    runMigration({ apply: true, retireLegacy: true });
    assert.equal(existsSync(join(dir, 'MEMORY.md')), false);
    assert.ok(existsSync(join(dir, 'MEMORY.superseded.md')), 'content must survive under the new name');
  });
});
