/**
 * Retrieval eval - the scoreboard for ranking changes.
 *
 * This is not a unit test with an assertion on an implementation detail; it measures a
 * heuristic. Field weights, the IDF curve, the weak-word rule and `promptMinScore` are all
 * judgement calls, and the only honest way to change one is to watch hit rate and
 * false-positive rate move together.
 *
 *   node test/retrieval.eval.mjs [minScore]
 *
 * It seeds its own fixture store, so it is reproducible on any machine and never reads
 * anyone's real memories. `want` lists ids that should appear in the top K; `avoid` lists ids
 * that must not. A false positive costs more than a miss - a confidently wrong suggestion
 * sends a session down the wrong path, while a miss merely leaves it where it started.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CLAUDE_MEMORY_HOME = mkdtempSync(join(tmpdir(), 'mem-eval-'));

const { write, loadIndex } = await import('../lib/store.mjs');
const { search } = await import('../lib/search.mjs');

const CWD = process.cwd();
const K = 3;

/**
 * Fixtures deliberately mirror the *shapes* a real store contains - a standing instruction, a
 * platform quirk, a schema gotcha, unfinished work - without carrying anyone's actual content.
 */
const FIXTURES = [
  ['reuse-go-packages', 'Check shared go-packages before writing new Go code', 'check the shared go-packages repo before writing a new Go utility', 'feedback', ['go', 'reuse'], ['golang', 'utility', 'helper', 'duplicate']],
  ['queue-logs-no-job-id', 'Queue worker logs carry no job id', 'queue worker entries are not searchable by job_id in the log viewer', 'feedback', ['logs', 'queue'], ['kibana', 'elasticsearch', 'worker', 'trace']],
  ['never-unshelve-before-edit', 'Never unshelve before editing a shelved changelist', 'editing a shelved CL means edit then re-shelve, never unshelve', 'feedback', ['vcs', 'changelist'], ['unshelve', 'shelved', 'perforce', 'overwrite']],
  ['jobs-table-column-names', 'Jobs table column names differ from the docs', 'verify jobs/queue column names against the live schema before writing SQL', 'feedback', ['db', 'sql'], ['column', 'schema', 'postgres', 'table', 'select']],
  ['review-is-report-only', 'Code review reports, it never fixes', 'a review pass reports findings and never edits code without approval', 'feedback', ['review'], ['audit', 'findings', 'diff', 'approve']],
  ['review-every-language', 'Apply the review checklist in every repo', 'the review checklist applies in any language and any repo, not just the main one', 'feedback', ['review'], ['checklist', 'diff', 'standards']],
  ['api-needs-bearer-token', 'Platform API calls need a Bearer token', 'every platform API call needs an Authorization Bearer header, not just the auth step', 'feedback', ['api', 'auth'], ['token', 'authenticate', 'curl', 'header', 'bearer']],
  ['external-auth-curl', 'Working curl for the external auth endpoint', 'the exact curl invocation for the external-authentication endpoint', 'reference', ['api', 'auth'], ['curl', 'authenticate', 'external', 'sso']],
  ['sso-application-code', 'SSO application code differs per server', 'the SSO application code is per-server; the documented default is wrong here', 'reference', ['api', 'auth'], ['keycloak', 'sso', 'application', 'authenticate']],
  ['structured-logger-only', 'Use the structured logger, not the raw writer', 'never call the raw log writer; use the structured logger levels', 'feedback', ['logging'], ['logger', 'error', 'warning', 'write', 'structured']],
  ['worker-needs-startup-flags', 'Workers need explicit startup flags in dev', 'the queue workers will not start in dev without their explicit flags', 'feedback', ['ops', 'dev-env'], ['startup', 'flags', 'worker', 'environment', 'launch']],
  ['default-mail-recipient', 'Default recipient for outgoing mail', 'who to send to by default when mailing a summary out', 'reference', ['mail'], ['email', 'mail', 'send', 'recipient', 'summary', 'inbox']],
  ['no-em-dash', 'Never use em dashes in output', 'never use an em dash in any output; use a hyphen or rephrase', 'feedback', ['writing'], ['dash', 'punctuation', 'hyphen', 'style']],
  ['implement-one-step', 'Implement a plan one approved step at a time', 'describe and get approval for each step before writing any code', 'feedback', ['process'], ['plan', 'step', 'approval', 'incremental']],
  // Keywords carry the words a prompt would actually use ("utf-16", "ansi") rather than only
  // the words the memory's own text uses - the curation the memory skill asks for.
  ['preserve-file-encoding', 'Never change a file on-disk encoding', 'an edit must never alter the file encoding; verify before and after', 'feedback', ['editing'], ['encoding', 'utf8', 'utf-16', 'ansi', 'bom', 'charset', 'encode']],
  ['deploy-readiness-plan', 'Deploy readiness work, milestone 2 of 4', 'in-progress deploy-readiness plan; next is wiring service discovery', 'project', ['deploy'], ['nomad', 'consul', 'milestone', 'readiness', 'rollout']],
];

for (const [id, title, hook, type, tags, keywords] of FIXTURES) {
  const extra = type === 'feedback' || type === 'project'
    ? '\n\n**Why:** recorded so a later session does not relearn it.\n**How to apply:** follow it before touching the relevant code.'
    : '';
  const r = write({
    id, title, hook, type, scope: 'global', tags, keywords,
    status: type === 'project' ? 'in-progress' : 'active',
    body: `${hook}.${extra}`,
  });
  if (!r.ok) throw new Error(`fixture ${id} failed: ${r.errors.join('; ')}`);
}

const CASES = [
  { prompt: 'the queue job failed, can you check the logs for the error', want: ['queue-logs-no-job-id'], avoid: ['reuse-go-packages'] },
  { prompt: 'add a column to the jobs table query then shelve the changelist', want: ['jobs-table-column-names', 'never-unshelve-before-edit'] },
  { prompt: 'write a new go helper to parse the printer config', want: ['reuse-go-packages'] },
  { prompt: 'can you review this diff before I commit it', want: ['review-is-report-only', 'review-every-language'] },
  { prompt: 'I need to authenticate against the platform API with curl', want: ['api-needs-bearer-token', 'external-auth-curl', 'sso-application-code'] },
  { prompt: 'add an error log line to this service', want: ['structured-logger-only'] },
  { prompt: 'why is the worker not starting up in my dev environment', want: ['worker-needs-startup-flags'] },
  { prompt: 'email me a summary of this when you are done', want: ['default-mail-recipient'] },
  { prompt: 'unshelve the CL so I can edit the files', want: ['never-unshelve-before-edit'] },
  { prompt: 'use an em dash in the release note heading', want: ['no-em-dash'] },
  { prompt: 'where did we get to on the deploy readiness work', want: ['deploy-readiness-plan'] },
  { prompt: 'save this file as utf-16', want: ['preserve-file-encoding'] },
  // Prompts that should retrieve nothing: any suggestion here is pure context waste.
  { prompt: 'what time is the standup tomorrow', want: [], expectEmpty: true },
  { prompt: 'rename this local variable to something clearer', want: [], expectEmpty: true },
  { prompt: 'thanks, that looks good', want: [], expectEmpty: true },
];

try {
  const minScore = Number(process.argv[2] ?? 2.5);
  const entries = loadIndex();

  let hits = 0;
  let wanted = 0;
  let falsePositives = 0;
  let noise = 0;
  const failures = [];

  for (const c of CASES) {
    const ids = search(entries, c.prompt, { cwd: CWD, k: K, minScore }).map((r) => r.entry.id);

    if (c.expectEmpty) {
      noise += ids.length;
      if (ids.length > 0) failures.push(`NOISE    "${c.prompt}" -> ${ids.join(', ')}`);
      continue;
    }

    wanted += 1;
    if (c.want.some((id) => ids.includes(id))) hits += 1;
    else failures.push(`MISS     "${c.prompt}" -> ${ids.join(', ') || '(nothing)'} ; wanted ${c.want.join(' | ')}`);

    for (const bad of c.avoid || []) {
      if (ids.includes(bad)) {
        falsePositives += 1;
        failures.push(`FALSEPOS "${c.prompt}" -> surfaced ${bad}`);
      }
    }
  }

  const rate = ((hits / wanted) * 100).toFixed(0);
  console.log(`minScore=${minScore}  hit rate ${hits}/${wanted} (${rate}%)  false positives ${falsePositives}  noise ${noise}`);
  for (const f of failures) console.log(`  ${f}`);
  process.exitCode = failures.length > 0 ? 1 : 0;
} finally {
  rmSync(process.env.CLAUDE_MEMORY_HOME, { recursive: true, force: true });
}
