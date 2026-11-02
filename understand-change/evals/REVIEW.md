# skill-creator review: understand-change

Process: the company skill-creator (`.claude/skills/skill-creator`, identical to the user-level synced copy),
run 2026-10-19. Results are in `iteration-1/*/grading.json`, graded from real outputs only.

| Stage | Status |
|---|---|
| Capture intent, interview | Done with the requesting developer over the session (direction changed from lesson → game → change map; user approved the map) |
| Draft SKILL.md, scripts, references | Done |
| Real run on a test case | Done: GitHub PR #4 of printer-service (91 files, +14110/-332), published and reviewed by the user |
| Review and improve (lean prompt, explain the why, bundle repeated work as scripts) | Done: dead lesson/game code removed; `prepare.py`, `show_snippet.py`, `selftest.py`, fixed briefs, coverage report, single audio bundle added |
| Evals with assertions (`evals.json`) | Done: 3 evals, 9 assertions |
| Grading | Done, from build output, `selftest.py` and a real-clock browser playback test |
| Baseline (without skill) runs and benchmark | Not run: each run traces a whole PR and records audio; cost judged not worth it against direct user review |
| Description optimization (trigger evals) | Not run |

## Results (iteration 1)

| Eval | Passed | Notes |
|---|---|---|
| large-github-pr | 6 / 7 | Coverage 22 of 30 changed code files (73%) is under the 80% target; IPP wire codec and capabilities parser lack items |
| script-smoke | 1 / 1 | `selftest.py`: 11 checks pass |
| perforce-cl | 0 / 1 | Not run; P4 path implemented but untested |

## Open items

- Add walkthrough items for the unexplained code files on PR #4, or confirm they are plumbing.
- Run eval 3 on a real shelved CL before moving the skill to the P4 skills folder.

## Iteration 2 (2026-10-20): player and explanation depth (shared with understand-code)

Same change as `../understand-code/evals/REVIEW.md` "Iteration 2": play state on chapter click with resume,
sticky controls, the static `focus` highlight removed (it glowed on 35 of 57 PR #4 items), range beats resolved
to rows, no excerpt truncation (`span` parts instead), coverage / units / jump / purpose lints in `WORK/lint.txt`,
Go const groups and receiver-qualified `Type.Method` excerpts. Selftest PASS 39 checks; Opus review PASS.
PR #4 rebuilt unchanged still exits 0 and now reports 52 of 57 items leaving shown code unexplained: the PR #4 map
is pre-iteration-2 content and needs new story writers to meet the new bar (not done; it is the org-shared map).

## Iteration 3 (2026-10-20): walkthrough focuses on the change; skill folders independent

User feedback: in understand-change the walkthrough should explain the CHANGES, not tour whole functions, unless
that is truly necessary (understand-code keeps whole units). Engine: in change mode `snippet(focus=True)` cuts a
modified unit to its changed lines plus 3 context lines, folding longer unchanged stretches into one gap row (the
page's existing `…` row); a new or untouched unit stays whole; item `"whole": true` / `show_snippet.py --whole`
overrides; `span` parts are trimmed the same way; change mode lints changed lines no excerpt shows (`changed_gaps`)
instead of unit lines no part shows. Docs: story.md, narration.md (first beat), briefs.md brief 3, prmap-schema.md.

Independence: understand-code now carries an identical engine copy; `tools/sync_understand_engine.py` (repo root,
dev-only) copies it from here and `--check` reports drift.

| Check | Result |
|---|---|
| `selftest.py` | PASS 50 checks (11 new: trim, gap row, hole fill, new/untouched whole, deletion-only, numbering, changed-line lint, `whole` override, end-to-end trimmed excerpt, span parts trimmed, two parts cover every changed line) |
| Real code, PR #4 range | `main.go → run` 148 → 40 shown lines, `config.go → Load` 193 → 57, every changed line kept |
| Real page build, one item on `config.go → Load` | exit 0, 0 unresolved, `beats: 0`, no changed-line findings; 57 rows with 3 gap rows, a beat range crossing a gap resolves to the intended rows |
| Each skill copied alone into an empty folder | both selftests PASS; understand-code `prepare --code` + `show_snippet` run |

Not run: no skill-creator eval loop, no Opus review, no headless player test (its script was not found). The PR #4 map's story JSON predates this and its
beats on now-hidden lines will be reported by the build until rewritten.

## Iteration 4 (2026-11-01): stakeholder Brief deck (shared with understand-code)

User request: a high-level, animated, step-by-step presentation for stakeholders (release and risk review) covering
business value, purpose and how it works, major use cases only, spoken over by the developer; no regression. New
optional `deck.json` (brief 4, the deck writer) renders a Brief tab, first in the tab bar; the page still opens on
Map and `#brief` deep-links. Slides: title, value, before/after (change mode only), system, 1-3 flows tied to
scenarios, risk and release, takeaways. Every slide has reveal steps and speaker notes, plus a Present overlay. The build validates it
(`deck.py`, exit 3 on a malformed deck), lints word limits, missing notes, stat sources and code-like words, and
resolves mitigation refs. Through dev-flow: Back End Agent, PM, live deck run on PR #4, Unit Test Agent, Opus Code
Reviewer (PASS WITH NITS, 0 Critical/High), 2 fix rounds.

| Check | Result |
|---|---|
| `selftest.py` | PASS 73 checks (deck: no-deck guard, embed, summary line, jargon lint vs product names, malformed shapes, refs, notes lint) |
| No regression, 3 real folders (P4 CL 1025106, PR #4, printgateway code map), baseline vs new engine | stdout, data JSON and lint.txt identical (`PYTHONHASHSEED=0`) |
| Live PR #4 deck (`iteration-4/stakeholder-brief/grading.json`) | 5 / 6: builds 8 slides, 2 flows, 32 steps, 0 lint, 0 unresolved |

Not verified: Present mode and the round-2 key/notes fixes were not re-checked in a browser after the fixes
(the run was stopped for low memory). The deck is not voiced (presenter speaks, by design).
