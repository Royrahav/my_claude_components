---
name: memory
description: Cross-project persistent memory. Use whenever the user says "remember this", "save that", "what did we decide", "where were we", "pick up where we left off", or refers to earlier sessions, past decisions, or prior work in any project. Also use before starting non-trivial work (to check for standing instructions and unfinished work in this scope), and at the end of a session (to capture what is durable). Covers recalling memories with `mem search`/`mem get`, writing them with `mem write`/`mem checkpoint`, and pruning them with `mem gc`.
---

# Memory

A cross-project store of facts worth surviving a session, at `~/.claude/memory`, driven by the
`mem` CLI. Hooks put a one-line catalog of what exists into every session; you load the full
text of an entry only when you decide you need it.

**The rule that makes this work: catalog lines are free, bodies are not.** Never bulk-load the
store. Fetch the one or two entries that bear on the task at hand.

## Recall

The session-start catalog already lists every in-scope memory as `id - hook`. From there:

```bash
mem get <id>                 # full text of one memory (records a hit)
mem get <id-a> <id-b>        # several at once
mem search "<what you need>" # rank the store when the catalog line is not enough
mem catalog                  # re-print the catalog
```

Do this **before** starting non-trivial work, not after: the standing instructions in scope
(`type: feedback`) are things the user has already told you once, and re-learning them by being
corrected again is the failure this store exists to prevent.

If a `RELEVANT MEMORY` block names ids, it is a suggestion from a keyword match, not a verdict.
Fetch what looks pertinent and ignore the rest.

**Memories are snapshots, not live state.** A `project` memory says what was true when it was
written. Before acting on one, verify it against reality - `git status`, `p4 opened`, the plan
file it names. If they disagree, say so plainly and ask; never silently trust it, and never
silently discard it.

## Scope: where a memory belongs

Scope is resolved from the working directory's *identity* (git remote, or a configured rule),
not its path, so several checkouts of one codebase share one scope. A session reads its own
repo scope plus `global` plus every `topic.*`.

| Scope | Holds | Example |
|---|---|---|
| `global` | Facts about the user, and how you should work **anywhere** | "never use em dashes"; "review is report-only" |
| `repo.<key>` | Facts true only in this codebase | "dbo.jobs column names differ from the docs" |
| `topic.<area>` | Facts about a platform or tool, true from **any** checkout | "labOS API needs a Bearer token" |

Getting this wrong is the most common mistake. A preference filed under `repo.x` is invisible
everywhere else; a repo quirk filed under `global` pollutes every unrelated session. When torn:
would this still be true working on a different codebase? Yes → `global` or `topic.*`.

## Writing

```bash
mem write --stdin <<'EOF'
---
id: never-unshelve-before-edit
title: Never unshelve before editing a shelved CL
hook: editing a shelved CL means p4 edit, never p4 unshelve
type: feedback
scope: repo.labos-vcpp
tags: [p4, perforce, changelist]
keywords: [unshelve, shelved, changelist, revert, overwrite]
---

Body: the fact, stated so someone who was not in this conversation can act on it.

**Why:** unshelving overwrites the workspace copy and silently loses local edits.

**How to apply:** `p4 edit` the file in the CL, change it, re-shelve. See [[other-memory-id]].
EOF
```

Rules, in order of how often they are broken:

1. **One fact per memory.** If the body needs a second heading, it is two memories. Link them
   with `[[id]]`.
2. **Write for a stranger.** No "as we discussed", no "the file we changed". Name the file, the
   command, the ticket. The reader is a fresh session with none of this context.
3. **`hook` is the whole retrieval surface.** It is the only thing a future session sees until
   it opens the file. Make it say what the memory *decides*, not what it is *about*:
   "never unshelve a shelved CL" beats "notes on Perforce workflow".
4. **`keywords` should be the words a future prompt will use, not the words you used.** A
   memory about `send-mail` that omits `email` will not be found by "email me the summary".
   Add the synonyms deliberately.
5. **`**Why:**` and `**How to apply:**` are required** for `feedback` and `project`. A rule
   without its reason gets overridden the first time it is inconvenient.
6. **Under ~1800 characters.** `mem write` warns past that and refuses past 4000.
7. **Check for an existing memory first** - `mem search "<topic>"`. Update that file rather than
   adding a near-duplicate. Use `supersedes: [old-id]` when a memory genuinely replaces another.

### What not to write

Anything already in the code, git history, the ticket, or CLAUDE.md. Anything that only mattered
inside this conversation. Anything you would have to guess at. **Writing nothing is a valid and
common outcome** - a store full of marginal entries makes every future catalog worse, and a wrong
memory is worse than no memory, because it is trusted.

### Types

`user` (who they are) · `feedback` (how to work - corrections, preferences, standing
instructions) · `project` (work in flight or recently finished) · `reference` (a durable fact)
· `decision` (a choice and its reasoning).

## Unfinished work

This is what makes "open a new session and keep going" work. Before a session ends with work in
flight, and whenever context is about to be compacted:

```bash
mem checkpoint --stdin <<'EOF'
---
id: pdf-printer-cfg-fallback
title: PDF printer cfg fallback, CL 1021434
hook: in-progress LAB-16894 work on shelved CL 1021434, next is the UT pass
type: project
status: in-progress
scope: repo.labos-vcpp
tags: [lab-16894, perforce]
---

**State:** shelved in CL 1021434; Developer and Product Manager phases signed off.
**Next:** run the Unit Test Agent over ClPrinterCfg, then the Code Reviewer.
**Blocked on:** nothing.

**Why:** dev-flow phases span sessions and the approval gates are easy to lose track of.
**How to apply:** verify with `p4 describe -S 1021434` before resuming; the CL is the truth.
EOF
```

Reuse the **same id** as work progresses so it updates in place. When it lands, close it out:
`mem set <id> status done` - a `project` memory still saying "in progress" after the work
shipped actively misleads the next session, which is worse than having written nothing.

## Maintenance

```bash
mem gc          # report expired / finished / never-retrieved / duplicate / oversized
mem gc --apply  # archive the clear-cut ones (to backups/, never hard-deleted)
mem doctor      # validate every file, the index, and all links
mem stats       # size, hit distribution, what is never used
```

Run `mem gc` when the user asks about memory hygiene or the catalog starts feeling long.
Report what it found; **never archive or merge without the user's say-so**. Merge candidates
and stale entries are always judgement calls and are never auto-applied.

To compress an oversized memory: split it into linked single-fact memories, or tighten the body
and re-`mem write` the same id. To retire one: `mem set <id> status archived`, or write the
replacement with `supersedes: [<old-id>]`.

## Reference

- `references/cli.md` - every command and flag
- `references/schema.md` - field-by-field frontmatter reference and the scope-resolution order
