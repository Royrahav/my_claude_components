# Change map inputs

`build_prmap.py --dir WORK out.html --repo ROOT` reads these files from `WORK`: files.json and meta.json
(written by `prepare.py`), inventory.json, scenarios.json, story.json (or `story_*.json` parts, merged), layout.json,
and narration.json (written by `narrate.py`). Refs everywhere are `path/from/repo/root → Symbol` (a function, a
method as `Type.Method`, a type, a constant, or a unique string in the file); the builder greps each one and
refuses to build if one does not resolve.

## files.json and meta.json: written by prepare.py, never by hand

```json
[{ "path": "src/printgateway/internal/printer/address.go", "status": "added", "add": 396, "del": 0 }]
```
```json
{ "kind": "Pull request", "title": "...", "number": 4, "url": "https://github.com/o/r/pull/4", "repo_url": "https://github.com/o/r",
  "base": "main", "head": "feature/x", "sha": "<head sha>", "diff_base": "<merge-base sha>", "unit": "commits",
  "commits": [{ "oid": "24d8571", "headline": "...", "url": ".../commit/24d8571" }] }
```
`diff_base`..`sha` is the exact diff every excerpt is cut from. For Perforce, `kind` is "Changelist" or "Shelved
changelist", `unit` is "CLs", and there is no `diff_base`. Instead `prepare.py` prints every file of the CL before and
after it into `WORK/p4/old|new` (`meta.snapshot`); excerpts, ref checks and line counts use that snapshot, so the
workspace never needs to be synced to the CL or unshelved (it is often synced past it). Agents read changed files
from `WORK/p4/new`, and `diff -u WORK/p4/old/<path> WORK/p4/new/<path>` is `{RANGE}` for one file.

## inventory.json: what each part is for

```json
{ "modules": [{ "id": "printer", "name": "Printer addresses", "path": "src/printgateway/internal/printer",
                "job": "Parses printer strings into targets and enforces the address allowlist.",
                "status": "new", "entry": "src/printgateway/internal/printer/address.go → Parse" }],
  "files": [{ "path": "...", "module": "printer", "kind": "code", "job": "max 14 words",
              "change": "max 16 words: what it introduces, or what this change did to it", "symbols": ["Parse"] }],
  "edges": [{ "from": "printgw", "to": "printer", "label": "parse and vet addresses" }] }
```
`kind`: code | test | docs | deploy | tooling | config. Module `status`: new | changed | unchanged. Edges come from
real imports or calls. Buckets such as deploy, docs, tests and tooling are modules too; they are listed beside the
map instead of on it.

## layout.json: positions and the world outside the repo

```json
{ "title": "PR #4 change map",
  "summary": "One sentence: what the change does for its users.",
  "problem_order": ["address", "driver", "check", "windows"],
  "nodes": { "client": { "at": [0, 1], "name": "Caller", "path": "LIS, curl", "job": "...", "status": "external" },
             "httpapi": { "at": [1, 1] } } }
```
Every node outside the repo that a scenario visits (caller, daemon, database, device, third-party service) must be
declared here with a name and a one-line job. `at` is `[column, row]`; nodes without one are placed
automatically (column = hops from the first scenario's first node) and the build says which. Set positions by hand
only to tidy the map: 5-6 columns at most, request flow left to right, side calls above or below.
`problem_order` fixes the walkthrough order when the story comes in several `story_*.json` parts.

## story.json: the walkthrough

Schema and writing rules in `story.md`; beats in `narration.md`. Items carry `ref` (and an optional `span` to show
one part of a long unit, or in change mode `whole` to show a modified unit untrimmed), the explanations, and
`beats`; the builder adds each item's code excerpt (code mode: the whole unit; change mode: a modified unit's changed
lines with context), the resolved row range of every beat, module, commits and simulator links, and writes
`WORK/lint.txt` (lines no beat explains, long excerpts without `span`, parts that leave lines unshown or changed
lines no excerpt shows, doubtful block detection, simulator jumps).

## scenarios.json: the simulator

```json
{ "request_defaults": { "base": "http://localhost:8090", "token_header": "X-Labos-Print-Token" },
  "scenarios": [{
    "id": "ipp-first", "title": "First print to an IPP printer (max 8 words)",
    "purpose": "Which flow this is and what it is for, one sentence, max 25 words (shown and spoken before the first step)",
    "teaches": "optional, legacy: what this run shows", "note": "optional, e.g. which values are examples",
    "request": { "method": "POST", "path": "/print", "content_type": "multipart/form-data",
                 "body": { "printer": "ipp://10.77.0.10", "file": "printDemo.pdf" } },
    "env": ["PRINTER_AUTO_PROVISION=true"],
    "steps": [{ "node": "cups", "ref": "src/printgateway/internal/cups/provision.go → findReady",
                "title": "No queue yet: start setup", "does": "One sentence, max 26 words",
                "in": "lpstat -v pgw-10-77-0-10-dc6c835c", "out": "no such destination → create",
                "decision": "optional: the branch taken and the alternative", "fail": false }],
    "result": { "status": 200, "body": { "...": "..." }, "side_effects": ["queue pgw-10-77-0-10-dc6c835c created"] },
    "say_intro": "spoken intro", "say_end": "spoken outcome" }] }
```
Every step also has a spoken `say` (see `narration.md`).
5-8 scenarios: the happy path, the repeat (caches, existing state), each important fork, each failure. Steps follow
the order the code runs; consecutive steps on different nodes become the solid "call in a scenario" edges, so the
packet always travels a drawn line. Each hop must be a real call (or the return to the caller), so `inventory.json`
has an edge between every two consecutive nodes, in either direction; the build lists a hop without one as a
`jump` in `lint.txt`: add the step in between, or the missing edge. When a callee's result comes back and the caller
does more work, show the return as its own step on the caller. Values in `in`/`out` are real formats from code, tests and end-to-end scripts.
When a value is an example (a hostname, an IP), say so in `note`.

## deck.json: the Brief tab (optional)

A stakeholder presentation (value, purpose, how it works, risk and release) with speaker notes; absent means no Brief
tab. Schema, writing rules and what the build checks: `deck.md`.
