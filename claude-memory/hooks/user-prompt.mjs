#!/usr/bin/env node
/**
 * UserPromptSubmit hook - name the candidates, load nothing.
 *
 * The catalog told the session what exists. This narrows it to the two or three entries that
 * match what the user just asked for, and stops there. Bodies stay on disk until the model
 * decides one is worth reading, which is the whole point: relevance is cheap to guess and
 * expensive to be wrong about, so a wrong guess here costs one wasted line, not a wasted
 * page of context.
 *
 * Each id is suggested at most once per session. Repeating a suggestion the model already
 * saw and passed on is pure noise.
 */
import { runHook, readPayload, cwdOf, emit, recallSet, recallAdd } from './_common.mjs';
import { loadIndex } from '../lib/store.mjs';
import { search } from '../lib/search.mjs';
import { loadConfig } from '../lib/paths.mjs';

await runHook(async () => {
  const payload = readPayload();
  const prompt = String(payload.prompt || '').trim();
  if (!prompt || prompt.startsWith('/')) return;

  const entries = loadIndex();
  if (entries.length === 0) return;

  const { promptTopK, promptMinScore } = loadConfig().budget;
  const results = search(entries, prompt, {
    cwd: cwdOf(payload),
    k: promptTopK * 2,
    minScore: promptMinScore,
  });
  if (results.length === 0) return;

  const alreadySuggested = recallSet('suggested', payload.session_id);
  const fresh = results.filter((r) => !alreadySuggested.has(r.entry.id)).slice(0, promptTopK);
  if (fresh.length === 0) return;

  recallAdd('suggested', payload.session_id, fresh.map((r) => r.entry.id));

  const lines = ['RELEVANT MEMORY (not loaded - fetch only what you need):'];
  for (const r of fresh) {
    lines.push(`  ${r.entry.id} - ${r.entry.hook}`);
  }
  lines.push(`  -> mem get ${fresh.map((r) => r.entry.id).join(' ')}`);
  emit(lines.join('\n'));
});
