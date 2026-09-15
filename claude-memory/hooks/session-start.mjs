#!/usr/bin/env node
/**
 * SessionStart hook - the catalog, and only the catalog.
 *
 * This is the one place the memory system spends context unconditionally, so it spends it on
 * the smallest thing that still makes recall possible: one line per in-scope memory, no bodies.
 * The session learns *what exists and how to fetch it*, and pays for a body only when it
 * decides it actually needs one.
 *
 * Unfinished work is called out separately, because resuming it is the single case where the
 * user should never have to re-explain where things stood.
 */
import { runHook, readPayload, cwdOf, emit } from './_common.mjs';
import { loadIndex } from '../lib/store.mjs';
import { buildCatalog, renderCatalog } from '../lib/search.mjs';
import { resolveScope } from '../lib/scope.mjs';
import { loadConfig, paths } from '../lib/paths.mjs';

await runHook(async () => {
  const payload = readPayload();
  const cwd = cwdOf(payload);
  const scope = resolveScope(cwd);
  const entries = loadIndex();
  if (entries.length === 0) return;

  const catalog = buildCatalog(entries, cwd, { maxEntries: loadConfig().budget.catalogMaxEntries });
  const body = renderCatalog(catalog, scope);
  if (!body) return;

  const open = catalog.shown.filter((e) => e.status === 'in-progress');

  const lines = [body];
  if (open.length > 0) {
    lines.push('', `UNFINISHED WORK in this scope (${open.length}) - marked * above.`);
    lines.push('If the user picks any of it back up, `mem get <id>` first and verify the memory');
    lines.push('against current reality (git status, the plan file it names) before acting on it;');
    lines.push('it is a point-in-time snapshot, not live state. Say so plainly if they disagree.');
  }
  lines.push('', `Memory store: ${paths.root} - see the \`memory\` skill for the write protocol.`);

  emit(lines.join('\n'));
});
