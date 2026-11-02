# Subagent briefs

Use these word for word, filling the `{PLACEHOLDERS}`, so every map is built the same way. `{WORK}` is the
work folder, `{REPO}` the repo root, `{SKILL}` this skill's folder, `{RANGE}` the diff (`git diff
{diff_base} {sha}`, or `p4 describe -du {CL}`). Every brief is read-only for the repo and writes one JSON file.
Launch the inventory and the tracer together; launch the story writers and the deck writer after both are done.

## 1. Inventory (model: sonnet)

```
Build a file-by-file inventory of a code change so a developer sees what was added, what changed, and what
each file is for. Read-only for the repo; write only the output file.
Repo: {REPO}. Changed files with status and line counts: {WORK}/files.json. See each file's change with
{RANGE} -- <path>; for added files read the file. Schema and rules: {SKILL}/references/prmap-schema.md,
section "inventory.json". Group files into the modules a reader thinks in ({MODULE_HINT}), plus buckets for
deploy, tooling, docs, tests and other. Edges only where a real import or call exists; derive them from import
statements, not from names; also add an edge for each call to or from an outside node listed in layout.json (a
client, a service, a daemon), labelled with the protocol, because the simulator may only hop along an edge. Every file appears exactly once with its exact path. Symbols must occur in the file.
Write {WORK}/inventory.json. Reply with files per module and anything unclear, max 8 lines.
```

## 2. Tracer: scenarios and their narration (model: the session's best)

```
Trace real request flows through a changed codebase so a simulator can replay them step by step, and write the
narration for them. Read-only for the repo; write only the output file.
Repo: {REPO}. The change: {RANGE}. Overview: {DOCS}. Read first: {SKILL}/references/prmap-schema.md (section
"scenarios.json") and {SKILL}/references/narration.md.
Write 5-8 scenarios that trigger the change in different ways: the main path first, then the repeat (caches,
existing state), then each important fork and failure. Give each a "purpose" (one sentence: which flow this is
and what it is for) and a say_intro that opens with it. Before writing a scenario's steps, list the real call
chain in execution order from the code. Each step is one component doing one job, in that order, using only
these node ids: {NODE_IDS}. Each hop is a real call or the return to the caller; never skip a component the
request passes through; when a callee's result comes back and the caller does more work, show the return as its
own step on the caller. The order of the steps is the order things happen, and every two consecutive nodes need
an edge in inventory.json (the build flags a jump). Take in/out values (formats, status codes, error
strings, timeouts) from code, tests and end-to-end scripts; never invent a field. Mark made-up example values
(hosts, IPs, names) in the scenario's "note". Add say_intro, say (every step) and say_end per narration.md.
Every ref is "path → Symbol" and must occur in that file. Before finishing, check: refs resolve, word limits,
no IDs/paths/hashes in say lines. Write {WORK}/scenarios.json. Reply with scenario ids, step counts, and where
you were unsure, max 10 lines.
```

## 3. Story writer: the walkthrough, with beats (model: the session's best; one per part)

```
Write part of a narrated walkthrough that explains, change by change, why each piece of code in this change
exists, so the developer who now owns it can understand and maintain it. Read-only for the repo; write only
the output file.
Repo: {REPO}. The change: {RANGE}; commit messages: git log {diff_base}..{sha} (they hold the real reasons).
Context: {WORK}/inventory.json, {WORK}/scenarios.json, {DOCS}. Read first and follow exactly:
{SKILL}/references/story.md and {SKILL}/references/narration.md (including "Beats").
Your problems, in order: {PROBLEMS}. 3-8 items each. For every item write why/what/picture/maintain, and
beats anchored to the code the reader will see: run
  python {SKILL}/scripts/show_snippet.py --dir {WORK} --repo {REPO} "<ref>" [more refs]
to print each item's excerpt exactly as shown (with file line numbers), and copy each beat's "code" from those
lines. Focus on the change: a modified function is shown as its changed lines plus a little context ("⋯" folds
the unchanged rest), and the beats explain those changes, the first in one clause saying what the function is for
and what this change does to it. A new function is shown and explained whole. Use "whole": true (preview with
--whole) only when the change cannot be understood without the whole function. Beats cover every shown line;
later beats explain blocks (use "to" or let a beat run to the next one). An excerpt over about 60 lines is split
into parts with "span" (titled "Name (2 of 5): ...") that together show every changed line. The build prints
uncovered lines in {WORK}/lint.txt and you must leave none.
{INTRO_LINE}
Never claim what the code does not do; mark inferred reasons with "probably". Before finishing, check: every
ref resolves, every beat anchor occurs in its excerpt, word limits, no IDs/paths/hashes in say lines.
Write {WORK}/story_{PART}.json as {"problems": [...]} (plus "intro"/"say_intro" if asked). Reply with items per
problem and anything unsure, max 8 lines.
```

`{INTRO_LINE}`: for exactly one writer, "Also write the top-level intro and say_intro for the WHOLE change
(all problems: {ALL_PROBLEMS})"; for the others leave it empty.

## 4. Deck writer: the stakeholder Brief (model: sonnet)

```
Write a short presentation about a code change for stakeholders (release owner, risk assessor, product), who
do not read code, so they can judge its value and its risk. Read-only for the repo; write only the output file.
Repo: {REPO}. The change: {RANGE}; commit messages: git log {diff_base}..{sha}; ticket and docs: {DOCS}.
Context: {WORK}/layout.json, {WORK}/inventory.json, {WORK}/scenarios.json (the flows to summarise),
{WORK}/files.json. Read first and follow exactly: {SKILL}/references/deck.md (schema, limits, writing rules).
Slides in this order: title, value, before_after, system, 1-3 flow (the major use cases only, each with the
scenario id it summarises), risk, takeaways. Follow every rule in deck.md "Writing for stakeholders" (product terms,
full scope then the example, high level not one integration, the core concept explained, what is left out with its why and how, separate parts, database tables, clear use cases, area why, business words, no invented
numbers, risk grounded in code, speaker notes). Re-check every fact against the code; if a deck.json exists, never
copy facts from it. Check before finishing: limits, notes, refs resolve.
Write {WORK}/deck.json. Reply with the slide list and anything you could not ground, max 8 lines.
```

## Sizing (from `collect_change.py`)

| Size | Inventory | Tracer | Story writers | Deck writer |
|---|---|---|---|---|
| SMALL (≤5 code files) | write it yourself | 2-3 scenarios, yourself | one, or yourself | yourself |
| MEDIUM | one sonnet agent | one agent | one agent | one sonnet agent |
| LARGE | one sonnet agent | one agent | two agents, problems split by area | one sonnet agent |

Pick the problems yourself before launching writers (5-9, named as capabilities a user or operator would
recognise, ordered core → extensions → hardening → tooling) and put that order in `layout.json` as
`problem_order`. Do not read the agents' JSON yourself; the build prints everything you need to check.
