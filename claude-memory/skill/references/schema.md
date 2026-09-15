# Memory schema

One fact per file, at `~/.claude/memory/store/<scope-dir>/<id>.md`.

```markdown
---
id: never-unshelve-before-edit        # kebab-case, unique across the whole store, stable forever
title: Never unshelve before editing  # <= 70 chars, human label
hook: editing a shelved CL means p4 edit, never p4 unshelve   # <= 110 chars
type: feedback                        # user | feedback | project | reference | decision
scope: repo.labos-vcpp                # global | repo.<key> | topic.<area>
status: active                        # active | in-progress | done | superseded | archived
confidence: high                      # high | medium | low
tags: [p4, perforce, changelist]      # 2-5, coarse subject labels; weighted heavily in search
keywords: [unshelve, shelved, revert] # the words a future *prompt* will use; auto-derived if omitted
links: [related-memory-id]            # [[id]] references, kept in sync by `mem link`
supersedes: [older-memory-id]         # marks those memories superseded on write
created: 2026-09-15                   # set once
updated: 2026-09-15                   # set on every write
expires:                              # optional ISO date; expired memories leave the catalog
source: migrated from C--P4SPACE-...  # optional provenance
---

Body. One fact, under ~1800 characters.

**Why:** required for feedback and project types.
**How to apply:** required for feedback and project types.
```

## Field notes

**`id`** is the address. It appears in the catalog, in `mem get`, and in other memories'
`[[links]]`. Renaming one breaks those links, so choose it to describe the *rule*, not the
occasion: `never-unshelve-before-edit`, not `perforce-thing-from-tuesday`.

**`hook`** is the entire retrieval surface. Until something runs `mem get`, this one line is all
any session knows about the memory. State the decision, not the topic.

**`tags`** vs **`keywords`**: tags are a handful of coarse subject labels and are weighted most
heavily in ranking; keywords are the long tail of terms that should match, including synonyms
the memory's own text never uses. Omitted keywords are derived from title/hook/tags/body, which
covers the obvious terms and misses exactly the synonyms worth adding by hand.

**`status`** drives both the catalog and GC. `in-progress` pins an entry to the top of the
catalog and marks it `*`; `done` drops its ranking and starts the archive grace period;
`superseded` and `archived` remove it from the catalog entirely without deleting the file.

**`expires`** is for facts with a known shelf life - a temporary workaround, a migration window,
a release-specific quirk. An expired memory disappears from the catalog and becomes a GC
candidate, without anyone having to remember to remove it.

## Storage layout

```
~/.claude/memory/
  store/
    global/                  scope: global
    repo-labos-vcpp/         scope: repo.labos-vcpp
    topic-labos-platform/    scope: topic.labos-platform
  index.json                 derived catalog - rebuildable with `mem reindex`
  stats.json                 hit counts and last-used timestamps - NOT derivable, keep it
  config.json               scope rules, context budget, GC thresholds
  INDEX.md                   human-readable mirror of index.json
  backups/removed/           archived memories; nothing is ever hard-deleted
```

`index.json` and `INDEX.md` are generated. Edit the `.md` files under `store/` (or use
`mem write`), never the index.

Hit counts live in `stats.json` rather than in the memory files so that *reading* a memory never
modifies a file under version control.

## Scope resolution

For a given working directory, in order - first match wins:

1. a `.claude-scope` file in that directory or any ancestor, containing the scope name
2. a `scopeRules` entry in `config.json` whose regex matches the path
3. the `origin` git remote, normalised to `repo.<owner>-<name>`
4. a slug of the directory name

Rule 1 is the per-project override; drop a `.claude-scope` file in a repo to force its scope.
Rule 2 is how several checkouts of one codebase are collapsed - the Perforce streams
`Labs/MainRls`, `Labs/Stable` and `Labs/5.31.0` all resolve to `repo.labos-vcpp` this way.
Rule 3 means any clone of a git repo, at any path on any machine, gets the same scope for free.

A session reads its own `repo.*` scope, plus `global`, plus every `topic.*` scope.

## Context budget

Set in `config.json` under `budget`:

- `catalogMaxEntries` (40) - hard ceiling on session-start catalog lines. When the store
  exceeds it, the tail is dropped, ordered so `in-progress` work and standing instructions
  survive and background reference is cut first.
- `promptTopK` (3) - candidate ids named per prompt. Ids are never repeated within a session.
- `promptMinScore` (2.5) - below this a candidate is treated as coincidence.

Raising `promptTopK` costs context on every prompt; raising `catalogMaxEntries` costs it once
per session. If the catalog feels long, the fix is usually `mem gc`, not a bigger budget.
