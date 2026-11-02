# Subagent briefs

Use these word for word, filling the `{PLACEHOLDERS}`, so every map is built the same way. `{WORK}` is the
work folder, `{REPO}` the repo root, `{SKILL}` this skill's folder,
`{SCOPE}` the scope paths from `meta.json`, `{HISTORY}` how to read history (`git log -L :<func>:<file>` and
`git log --follow -- <file>`; for Perforce `p4 annotate -c <file>` then `p4 describe -s <CL>`). Every brief is
read-only for the repo and writes one JSON file. Launch the inventory and the tracer together; launch the story
writers and the deck writer after both are done.

## 1. Inventory (model: sonnet)

```
Build a file-by-file inventory of existing code so a developer new to it sees what each part is for and how
the parts connect. Read-only for the repo; write only the output file.
Repo: {REPO}. Files in scope with line counts: {WORK}/files.json (scope: {SCOPE}). Read each file. Schema
and rules: {SKILL}/references/prmap-schema.md, section "inventory.json", with these code-mode differences:
module status is "scope" for modules in scope; files have no "change" field. Group the files into the modules a
reader thinks in ({MODULE_HINT}), plus buckets for tests, docs, tooling and other. Then find the code around the
scope: grep the repo outside the scope for uses of its public types/functions (callers) and read the scope's
imports/includes (callees). Add each such caller or callee area as a module with status "context", a name, path
and one-line job, and no files. Edges only where a real import, include or call exists, labelled with what
flows across; also an edge for each call to or from an outside node listed in layout.json (a client, a service,
a daemon), labelled with the protocol, because the simulator may only hop along an edge. Every in-scope file
appears exactly once with its exact path. Symbols must occur in the file.
Write {WORK}/inventory.json. Reply with files per module, the context modules, and anything unclear, max 8 lines.
```

## 2. Tracer: scenarios and their narration (model: the session's best)

```
Trace real calls through existing code so a simulator can replay them step by step, and write the narration
for them. Read-only for the repo; write only the output file.
Repo: {REPO}. Scope: {SCOPE}. Overview: {DOCS}. Read first: {SKILL}/references/prmap-schema.md (section
"scenarios.json") and {SKILL}/references/narration.md.
Write 4-8 scenarios that show how the code is used: the main use first (from its most important real caller),
then the repeat (caches, existing state), then each important fork and each failure. The entry is whatever
really starts it: an HTTP request, a CLI command, a message, a timer, or a call from a caller module (method
"CALL", path = the call as written in the caller). Give each scenario a "purpose" (one sentence: which flow this
is and what it is for) and a say_intro that opens with it. Before writing a scenario's steps, list the real call
chain in execution order from the code. Each step is one component doing one job, in that order, using only
these node ids: {NODE_IDS}. Each hop is a real call or the return to the caller; never skip a component the
request passes through; when a callee's result comes back and the caller does more work, show the return as its
own step on the caller. The order of the steps is the order things happen, and every two consecutive nodes need
an edge in inventory.json (the build flags a jump). Take in/out values (formats, status codes, return values,
error strings, limits) from code, tests and scripts; never invent a field. Mark made-up example values in the
scenario's "note". Add say_intro, say (every step) and say_end per narration.md. Every ref is "path → Symbol"
and must occur in that file; for C++ methods use "path/File.cpp → ClOwner::Method". Before finishing, check:
refs resolve, word limits, no IDs/paths/hashes in say lines. Write {WORK}/scenarios.json. Reply with scenario
ids, step counts, and where you were unsure, max 10 lines.
```

## 3. Story writer: the walkthrough, with beats (model: the session's best; one per part)

```
Write part of a narrated walkthrough that explains existing code piece by piece, what each piece does and why
it is built that way, so a developer who now owns it can understand and maintain it. Read-only for the repo;
write only the output file.
Repo: {REPO}. Scope: {SCOPE}. Context: {WORK}/inventory.json, {WORK}/scenarios.json, {DOCS}. For the reasons
behind the design read comments, tests and docs, and the history: {HISTORY}. Read first and follow exactly:
{SKILL}/references/tour.md and {SKILL}/references/narration.md (including "Beats").
Your topics, in order: {PROBLEMS}. 3-8 pieces each. A piece is one whole unit: a function or method in full, or
for a class its declaration plus every method, each as its own piece. For every piece write
what/why/picture/maintain, and beats anchored to the code the reader will see: run
  python {SKILL}/scripts/show_snippet.py --dir {WORK} --repo {REPO} "<ref>" [more refs]
to print each piece's excerpt exactly as shown (the whole unit, with file line numbers), and copy each beat's
"code" from those lines. Cover every shown line with beats: the first beat is the core intention (why the piece
exists, what it guarantees), later beats explain blocks (use "to" or let a beat run to the next one). A unit over
about 60 lines is split into parts with "span" (titled "Name (2 of 5): ...") that together cover it. The build
prints uncovered lines in {WORK}/lint.txt and you must leave none.
{INTRO_LINE}
Never claim what the code does not do; mark inferred reasons with "probably". Before finishing, check: every
ref resolves, every beat anchor occurs in its excerpt, word limits, no IDs/paths/hashes in say lines.
Write {WORK}/story_{PART}.json as {"problems": [...]} (plus "intro"/"say_intro" if asked). Reply with pieces per
topic and anything unsure, max 8 lines.
```

`{INTRO_LINE}`: for exactly one writer, "Also write the top-level intro and say_intro for the WHOLE scope
(all topics: {ALL_PROBLEMS})"; for the others leave it empty.

## 4. Deck writer: the stakeholder Brief (model: sonnet)

```
Write a short presentation about a piece of existing code for stakeholders (release owner, risk assessor, product), who
do not read code, so they can judge its value and its risk. Read-only for the repo; write only the output file.
Repo: {REPO}. Scope: {SCOPE}; docs: {DOCS}; reasons and history: {HISTORY}.
Context: {WORK}/layout.json, {WORK}/inventory.json, {WORK}/scenarios.json (the flows to summarise),
{WORK}/files.json. Read first and follow exactly: {SKILL}/references/deck.md (schema, limits, writing rules).
Slides in this order: title, value, system, 1-3 flow (the major use cases only, each with the
scenario id it summarises), risk, takeaways. Follow every rule in deck.md "Writing for stakeholders" (product terms,
full scope then the example, high level not one integration, the core concept explained, what is left out with its why and how, separate parts, database tables, clear use cases, area why, business words, no invented
numbers, risk grounded in code, speaker notes). Say what the area does for the business and why it exists, not what
changed; risk is what breaks if the area is touched and what to watch when changing it. Re-check every fact against
the code; if a deck.json exists, never copy facts from it. Check before finishing: limits, notes, refs resolve.
Write {WORK}/deck.json. Reply with the slide list and anything you could not ground, max 8 lines.
```

## Sizing (from `prepare.py --code`)

| Size | Inventory | Tracer | Story writers | Deck writer |
|---|---|---|---|---|
| SMALL (≤5 code files, ≤1500 lines) | write it yourself | 2-4 scenarios, yourself | one, or yourself | yourself |
| MEDIUM (≤30 files, ≤10k lines) | one sonnet agent | one agent | one agent | one sonnet agent |
| LARGE (≤120 files, ≤40k lines) | one sonnet agent | one agent | two agents, topics split by area | one sonnet agent |

Pick the topics yourself before launching writers and put their order in `layout.json` as `problem_order`.
Do not read the agents' JSON yourself; the build prints everything you need to check.
