#!/usr/bin/env node
/**
 * Stop hook - the capture pass that makes "will it remember?" stop being a question.
 *
 * This is the only hook that interrupts rather than informs: it returns `decision: block`,
 * which hands the model one more turn to write down what the session learned. That is
 * intrusive by nature, so it is fenced in hard:
 *
 *   - never when `stop_hook_active` is set (that turn IS the capture pass; blocking again loops)
 *   - at most once per session, then a cooldown before the same session can be asked again
 *   - never for a session too short to have learned anything
 *   - never when the user has switched it off in config
 *
 * The instruction it returns is explicit that writing nothing is the correct outcome when
 * nothing durable happened, because a capture pass that always writes something fills the
 * store with noise and makes every future catalog worse.
 *
 * Optional second-brain integration: if the `second-brain` skill's PostToolUse hook left a
 * per-session state file (it only does this when it actually nudged on a file in an ingested
 * codebase this session), the capture pass also asks about vault findings - this repo has no
 * hard dependency on that skill, the check is read-only and degrades to a no-op if the file
 * or skill isn't present.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runHook, readPayload, cwdOf, emitJson, claimOnce, claimCooldown, transcriptWeight } from './_common.mjs';
import { loadConfig } from '../lib/paths.mjs';
import { resolveScope } from '../lib/scope.mjs';

function secondBrainTouchedThisSession(sessionId) {
  try {
    const key = String(sessionId || 'nosession').replace(/[^A-Za-z0-9_-]/g, '_');
    const stateFile = join(tmpdir(), 'second-brain-hooks', `${key}.json`);
    if (!existsSync(stateFile)) return false;
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    return Array.isArray(state.nudged) && state.nudged.length > 0;
  } catch {
    return false;
  }
}

// Below roughly this much transcript, the session was a question and an answer, not work.
const MIN_TRANSCRIPT_BYTES = 6000;

await runHook(async () => {
  const payload = readPayload();
  if (payload.stop_hook_active) return;

  const { stopHookEnabled, stopHookCooldownMinutes } = loadConfig().capture;
  if (!stopHookEnabled) return;

  if (transcriptWeight(payload) < MIN_TRANSCRIPT_BYTES) return;

  // claimOnce fires the first block. claimCooldown gates every block after that - but its
  // marker file does not exist yet at that point, and claimCooldown claims unconditionally
  // when its marker is missing, so left alone it fires a second, immediate block right after
  // the first (the "cooldown" never actually elapses because it never started). Seed the
  // cooldown marker in the same instant the first claim succeeds, so the timer starts there
  // instead of on the next Stop attempt.
  const firstClaim = claimOnce('capture', payload.session_id);
  if (firstClaim) {
    claimCooldown('capture-cooldown', payload.session_id, stopHookCooldownMinutes);
  } else if (!claimCooldown('capture-cooldown', payload.session_id, stopHookCooldownMinutes)) {
    return;
  }

  const scope = resolveScope(cwdOf(payload));

  const reasonLines = [
    'MEMORY CAPTURE PASS (automatic, once/session). Do this now, then finish.',
    `Scope: ${scope}. Decide what from this session a future session could not work out alone:`,
    '  feedback: correction/preference (global scope if it is about how you work anywhere)',
    '  reference: non-obvious system/codebase fact (topic.<area> scope if it spans repos)',
    '  decision: a decision plus its reasoning',
    '  unfinished work: `mem checkpoint`, status in-progress, next concrete step',
    'Skip: anything already in code/git history/CLAUDE.md, anything conversation-only, or a',
    'restatement of an existing memory (update that one instead; `mem search "<topic>"` first).',
    'Write with: mem write --stdin (frontmatter: id/title/hook/type/scope/tags, then body,',
    'under ~1800 chars; feedback/decision bodies need Why: and How to apply: lines).',
    'Nothing durable: write nothing, say nothing, stop. Mention this pass only if you wrote one,',
    'in one line.',
  ];

  if (secondBrainTouchedThisSession(payload.session_id)) {
    reasonLines.push(
      '',
      'SECOND-BRAIN CHECK: this session touched an ingested codebase. Before finishing, also',
      'decide whether anything belongs in the vault - a `findings` bullet on an existing note',
      'for something learned that is not written down yet, or an `ingest` for a type you',
      'worked with closely that the vault does not cover at all. Same rule: nothing durable,',
      'touch nothing - do not force a note.',
    );
  }

  emitJson({ decision: 'block', reason: reasonLines.join('\n') });
});
