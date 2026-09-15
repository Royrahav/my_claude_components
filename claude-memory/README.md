# claude-memory

Cross-project, cross-session memory for [Claude Code](https://claude.com/claude-code).

Claude Code ships a per-project memory directory whose index is loaded into every session. That
breaks down in two directions at once. It is keyed by **workspace path**, so four checkouts of
one codebase become four disconnected stores - a fact learned on one release branch is invisible
on the next. And its index is **all-or-nothing**: every entry costs context in every session,
whether or not it has anything to do with the task.

This replaces it with a single store, keyed by repo **identity** rather than path, plus a
retrieval layer that puts one line per memory into a session and loads a body only when the
session asks for it.

```
SessionStart  ──►  catalog: one line per in-scope memory, no bodies
UserPromptSubmit ─►  names the 1-3 ids that match this prompt
  (model decides) ─►  mem get <id>        ◄── the only thing that costs real context
Stop / PreCompact ►  capture pass: write down what survives the session
```

## Install

Requires Node 18+. No dependencies.

```bash
git clone <this repo> claude-memory
cd claude-memory
node install.mjs --path        # --path adds the shim dir to PATH on Windows
```

That creates the store at `~/.claude/memory`, installs a `mem` launcher, copies the `memory`
skill into `~/.claude/skills/`, and registers four hooks in `~/.claude/settings.json`. It merges
into existing settings and backs them up first; re-running it updates rather than duplicates.

Coming from the built-in per-project memory:

```bash
mem migrate            # dry run: shows every memory and the scope it would land in
mem migrate --apply    # imports them; the legacy files are left untouched
```

## How it works

### Scope - identity, not path

A memory belongs to one of three kinds of scope:

| Scope | Holds | Read from |
|---|---|---|
| `global` | who the user is; how to work anywhere | every session |
| `repo.<key>` | facts true only in one codebase | that codebase, any checkout of it |
| `topic.<area>` | a platform or tool that spans repos | every session |

The repo key is resolved, first match winning: a `.claude-scope` file in any ancestor directory,
then a path rule in `config.json`, then the normalised git `origin` remote, then the directory
name. So every clone of a git repo shares a scope automatically, and several Perforce streams of
one codebase are collapsed with a single config rule.

### Retrieval - catalog first, bodies on demand

The session-start catalog is one line per in-scope memory: id, tags, and a `hook` that states
what the memory *decides*. That is the whole budget the system spends unconditionally. Bodies
stay on disk until something runs `mem get`.

Ranking is lexical - weighted token overlap over hook, tags and curated keywords, with IDF
weighting so rare words carry the signal and common ones do not. At the scale a personal memory
store actually reaches (tens to low hundreds of entries), this matches what an embedding index
would do, with no model call, no vector store and no warm-up. `test/retrieval.eval.mjs` is the
scoreboard: it measures hit rate against false positives over realistic prompts, and it is the
only honest way to change a weight.

### Capture - at the end, and before compaction

A `Stop` hook gives the model one extra turn to write down what the session learned, once per
session and only for sessions long enough to have learned something. A `PreCompact` hook asks
for a checkpoint of work in flight before context is summarised away. Both are explicit that
writing nothing is the normal outcome - a store full of marginal entries makes every future
catalog worse.

### Lifecycle

`mem gc` classifies the store: expired, finished, never-retrieved, near-duplicate, oversized,
dangling links. `--apply` archives only the clear-cut categories; merge candidates and merely
cold entries are always reported for a human to judge. Nothing is ever hard-deleted - archiving
moves files to `backups/removed/`.

Usage stats live in `stats.json`, outside the memory files, so that reading a memory never
modifies a file under version control. They are what makes GC evidence-based rather than a
guess about age.

## Daily use

```bash
mem catalog                    # what this scope knows
mem search "shelve a CL"       # find it
mem get no-unshelve            # read it
mem write --stdin              # write one (see the memory skill for the schema)
mem gc                         # what could go
mem doctor                     # validate everything
mem stats                      # size, hit distribution, dead weight
```

`mem help` lists everything. `skill/references/cli.md` documents every flag;
`skill/references/schema.md` documents the file format and scope resolution.

## Layout

```
bin/mem.mjs        the CLI
lib/               paths, frontmatter, scope, store, search, gc, migrate
hooks/             the four Claude Code hooks (fail-safe: they always exit 0)
skill/             the `memory` skill installed into ~/.claude/skills
install.mjs        wires all of the above into a Claude Code install
test/              unit tests + the retrieval eval
```

The store lives at `~/.claude/memory`, deliberately outside this repo, so the tooling can be
reinstalled, moved or shared without touching anyone's data.

## Development

```bash
node --test test/                                  # unit tests
CLAUDE_MEMORY_HOME=/tmp/store node test/retrieval.eval.mjs   # ranking scoreboard
node install.mjs --link --dry-run                  # preview a dev install
```

`--link` symlinks the skill instead of copying it, so edits to `skill/` take effect without
reinstalling. `CLAUDE_MEMORY_HOME` points the whole system at a throwaway store.

## Sharing it

The store and the tooling are separate on purpose. To move a store between machines:

```bash
mem export ~/memory-backup     # on the old machine
mem import ~/memory-backup     # on the new one - keeps local memories that are newer
```

To hand the system to a teammate, they clone the repo and run `node install.mjs`. They get an
empty store, the skill, and the hooks. Nothing in the repo contains anyone's memories.
