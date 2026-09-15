# `mem` CLI reference

Every command accepts `--json` for machine-readable output and `--cwd <dir>` to act as if run
from another directory (which is what decides scope).

## Recall

| Command | Does |
|---|---|
| `mem catalog [--max N]` | One line per in-scope memory, no bodies. What the SessionStart hook injects. |
| `mem search <query> [--k N] [--min S] [--all]` | Rank memories against a query. `--all` ignores scope. |
| `mem get <id> [<id>...]` | Print memories in full. Records a hit for each. |
| `mem get <id> --raw` | Print the file verbatim, frontmatter included. |
| `mem get <id> --quiet` | Print without recording a hit (for tooling, not for real use). |
| `mem list [--scope S] [--type T] [--status S] [--all]` | Filtered one-line listing. |
| `mem scope [--cwd DIR]` | Which scope a directory resolves to, and how many memories that makes visible. |

## Write

| Command | Does |
|---|---|
| `mem write --stdin` | Create or update from a markdown document on stdin. The normal path. |
| `mem write --file <path>` | Same, from a file. |
| `mem write --id X --title T --hook H --type T --body B [--tags a,b]` | Same, from flags. For one-liners. |
| `mem checkpoint --stdin` | Like `write`, defaulting `type: project` and `status: in-progress`. |
| `mem set <id> <field> <value>` | Change one field. `mem set x status done`. List fields take `a,b,c`. |
| `mem link <a> <b>` | Add a bidirectional link between two memories. |
| `mem touch <id>` | Record a hit without printing anything. |

Writes are validated. Errors (missing `title`, bad `type`, body over 4000 chars) reject the
write; warnings (long body, missing `**Why:**`, no tags) print to stderr and proceed.
`--force` writes despite errors - used by migration, and rarely justified otherwise.

## Maintain

| Command | Does |
|---|---|
| `mem gc` | Report expired, finished, never-retrieved, near-duplicate, oversized and dangling-link memories. |
| `mem gc --apply` | Archive the clear-cut ones into `backups/removed/`. Never touches merge candidates or stale entries. |
| `mem doctor` | Validate every file, check the index is current, find dangling links and misfiled scopes. Exits non-zero on errors. |
| `mem reindex` | Rebuild `index.json` and `INDEX.md` from the files on disk. |
| `mem stats` | Counts by scope and type, total size, never-retrieved count, most-used entries. |
| `mem init` | Create the store and a default `config.json`. |
| `mem migrate [--apply]` | Import legacy `~/.claude/projects/*/memory` stores. Dry-run by default. |
| `mem export <dir>` | Copy the store (plus index, stats, config) to a directory. |
| `mem import <dir>` | Merge an exported store in. Local memories newer than their imported copy are kept unless `--force`. |

## Categories `mem gc` reports

- **EXPIRED** - past their `expires` date. Archived by `--apply`.
- **FINISHED** - `type: project`, `status: done`, untouched past the grace period (30d). Archived by `--apply`.
- **NEVER USED** - written over `staleDays` (120) ago and never once retrieved. Archived by `--apply`.
- **STALE** - used before, but not lately. **Reported only** - still-correct facts can go cold.
- **MERGE CANDIDATES** - same scope and type, keyword overlap past `duplicateThreshold` (0.72). **Reported only** - merging loses nuance, so a human or agent decides.
- **OVERSIZED** - body over 2400 bytes. Split into linked memories or tighten it.
- **BROKEN LINKS** - `[[id]]` pointing at a memory that no longer exists.

Nothing is ever hard-deleted. `--apply` moves files to `backups/removed/` with a timestamp.

## Environment

- `CLAUDE_MEMORY_HOME` - override the store location. Used by the tests; also how you run a
  second, separate store.
- `CLAUDE_HOME` - override `~/.claude` when it is not in the default place.
