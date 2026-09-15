#!/usr/bin/env node
/**
 * PreCompact hook - the last chance before the conversation is summarised.
 *
 * Compaction is where cross-session continuity is most often lost: the detail that would have
 * made a good memory is exactly the detail a summary drops. This cannot block, so it injects a
 * reminder rather than forcing a turn, and it deliberately asks for a checkpoint of *live work*
 * only - a full capture pass belongs at the end of the session, not in the middle of one.
 */
import { runHook, readPayload, cwdOf, emit, claimCooldown } from './_common.mjs';
import { resolveScope } from '../lib/scope.mjs';

await runHook(async () => {
  const payload = readPayload();
  const scope = resolveScope(cwdOf(payload));

  // Auto-compaction can fire repeatedly in a long session; once every 30 minutes is plenty.
  if (!claimCooldown('precompact', payload.session_id, 30)) return;

  emit([
    'CONTEXT IS ABOUT TO BE COMPACTED - detail not written down now will be summarised away.',
    `If work is in flight, checkpoint it first (scope ${scope}):`,
    '  mem checkpoint --stdin   with status in-progress, what is done, and the next concrete step.',
    'Update the existing checkpoint id if one already covers this work rather than creating a second.',
    'Nothing in flight, or already checkpointed? Then do nothing.',
  ].join('\n'));
});
