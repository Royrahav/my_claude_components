# skill-creator review: understand-code

Process: the company skill-creator (`.claude/skills/skill-creator`, identical to the user-level synced copy),
run 2026-10-19/20. Results are in `iteration-1/*/grading.json`, graded by `evals/grade.py` from the real
outputs (it rebuilds each page and reads its data), never by hand.

understand-code runs on understand-change's engine (code mode); install and move the two skills together.

| Stage | Status |
|---|---|
| Capture intent, interview | Done with the requesting developer: separate skill, same method as understand-change, engine shared, eval targets chosen |
| Draft SKILL.md, references, scripts | Done; engine code mode added to understand-change (`prepare.py --code`, `collect_code.py`, code-mode build/template), change mode verified unchanged (page data identical to a pre-edit build) |
| Real runs on test cases | Done: 3 real scopes, each built, voiced (Kokoro) and published |
| Evals with assertions (`evals.json`) | Done: 4 evals, 18 assertions |
| Grading | Done, with `grade.py`, `selftest.py` and a headless-Edge render check of the code-mode page |
| Baseline (without skill) runs and benchmark | Not run: without the skill the output is a text explanation, not a page, so a pass-rate comparison measures nothing useful; each run also costs ~200k tokens and up to an hour of narration |
| Human review of outputs | Done: the developer reviewed the published pages and accepted iteration 1 for real use |
| Description optimization (trigger evals) | Not run |

## Results (iteration 1)

| Eval | Passed | Notes |
|---|---|---|
| go-single-package (`internal/printer`, SMALL) | 7 / 7 | 30 pieces, 4 scenarios, 155 voiced lines; https://claude.ai/artifact/Wn62eDnQ2CViuz9EH7MAyf |
| vcpp-class-p4 (`SendByRest`, MainRls, P4) | 5 / 5 | 21 pieces, all 19 `Class::Method` excerpts start at the definition; https://claude.ai/artifact/TZ2pFTDGmAt4RuSWmTHLY3 |
| go-library-medium (`internal/cups`, MEDIUM, 4 agents) | 5 / 5 | 39 pieces, 8 scenarios, 276 voiced lines; https://claude.ai/artifact/V8iEESsTtuEbV4CVjGZBQa |
| script-smoke | 1 / 1 | both selftests PASS (13 and 11 checks) |

Cost per run (`timing.json`): SMALL about 200k tokens and 13 minutes to build; MEDIUM about 545k tokens over
three agents. Narration is CPU time on top: 155 lines took about 25 minutes, 276 lines over 2 hours while the
machine was under load.

## Open items (iteration 2, from `iteration-1/*/skill_notes.md`)

- Builder should lint narration (beat 8-35 words, step say 20-45, no IDs/paths spoken); both agents wrote their own.
- SKILL.md step 3 says "in parallel" but SMALL means do it yourself; define `{MODULE_HINT}`; say whether item
  `say` or `beats` is used; say the checklist is built from `maintain`.
- Simulator renders `curl` and "HTTP <status>" for a `CALL` entry; code mode needs a plain call/return view.
- C++: a file holding two classes; methods defined inline in the header; suggest `p4 filelog -s -l` for history.
- Tracer brief: "the repeat (caches, existing state)" only if one exists; grep config validation for env coupling.
- Inventory: no empty bucket modules; auto-place context modules the scenarios never visit; header counts the
  tests bucket as a module in scope; say where the second-brain vault is and to skip it when it has no notes.
- `prepare.py --code` counts `testdata/` fixtures as code; `narrate.py` progress prints are block-buffered when
  redirected to a file.

## Iteration 2 (2026-10-20): user feedback on the player and on explanation depth

User feedback on the published pages, five items: a chapter click must start playback (Pause shown) and Pause/Play
must resume in place; the controls must float with the scroll; a static light-green row glowed on every page (the
`focus` highlight); every function or class shown must be explained in full (split into parts if long) with its
core intention, and no shown code may go unexplained; the simulator must run each flow in real call order and say
which flow it is and its purpose before running. Implemented in the shared engine (understand-change) through
dev-flow: Back End Agent, Opus Code Reviewer (rounds 1-3d, final verdict PASS, 0 open Critical/High).

| Check | Result |
|---|---|
| `selftest.py` (both skills) | PASS: understand-change 39 checks, understand-code 22 checks |
| Headless Chrome player test (`puppeteer-core`, 34 checks: chapter click plays, pause/resume offset, sticky bar, autoplay, simulator step/reset races, phone width, no page errors) | 34 / 34 on the old eval-1 page and on the regenerated one |
| Back-compat: iteration-1 eval-1 and understand-change PR #4 work dirs rebuilt unchanged | exit 0, 0 unresolved refs; the new lints report what old JSON leaves unexplained |
| eval-1 regenerated end to end (`internal/printer`) | 56 pieces (was 30), 8 scenarios / 103 steps (was 4 / 35), `beats: 0 items leave code unexplained`, `units: 0 definitions no item shows`, 0 jump findings, 290 voiced lines; https://claude.ai/artifact/QWABVRZhDEqj3UyATmLFo9 |

Follow-ups (review Lows, not fixed): dead `…` gap/`more` code in the page; `to` on a null/unresolved anchor is
dropped silently; `export type`/`export const` refs fall back to a literal match; the units lint misses C++ free
functions and nests Python inner defs under their class. Human review of the regenerated page: pending.

## Iteration 3 (2026-10-20): standalone install

This folder now holds its own copy of the engine (scripts except `selftest.py`, `assets/prmap.html`,
`references/{story,narration,prmap-schema}.md`), so it no longer needs `../understand-change`. The source stays in
understand-change; `tools/sync_understand_engine.py` at the repo root syncs it and `--check` reports drift. The
same sync brought understand-change's change-mode trimming (inactive in code mode). Checks: selftest PASS 22
checks with the skill copied alone into an empty folder; `prepare.py --code` and `show_snippet.py` on
`internal/printer` show `Parse` whole. Not run: no new eval page or review.

## Iteration 4 (2026-11-01): stakeholder Brief deck

Same engine change as `../understand-change/evals/REVIEW.md` "Iteration 4": an optional `deck.json` renders a
Brief tab for stakeholders. In code mode the slides cover what the area does for the business, why it exists and how
it works, with no before/after slide (linted). New eval 5 `stakeholder-brief`.

| Check | Result |
|---|---|
| `selftest.py` | PASS 45 checks (the shared deck checks in code mode) |
| No regression: printgateway code map, baseline vs new engine | stdout, data JSON and lint.txt identical |
| Eval 5 (`iteration-4/eval-5-stakeholder-brief/grading.json`) | 1 / 4: only the no-regression assertion ran; no real code-mode deck was written yet |
