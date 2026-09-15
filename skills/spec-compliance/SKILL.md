---
name: spec-compliance
description: This skill should be used when the user asks to "check this against the spec", "make sure we didn't miss anything", "verify all requirements are implemented", "did we cover everything in the ticket/PRD/design doc", "is this feature complete", or whenever Claude is implementing a feature from a written spec, ticket, PRD, or set of requirements and should systematically verify full coverage before declaring the work done — including implicit/edge-case requirements, not just the explicitly enumerated ones. Also use before marking a task, PR, or ticket as complete when it originated from a spec-like description, to catch silently dropped or half-built features and unrequested scope creep.
---

# Spec Compliance

Verify that implementation work matches what was asked for — completely, and only that.
This skill governs coverage: did the code do everything the spec asked, and nothing it
didn't. It does not govern code quality (see `code-quality-review`) or test mechanics
(see `unit-testing`) — see "Relationship to sibling skills" below.

Two failure modes are equally in scope:

- **Under-delivery**: a requirement is missing, half-built, or silently dropped because
  it turned out to be harder than expected.
- **Over-delivery**: extra features, abstractions, or "while I was in there" changes that
  nobody asked for. Scope creep is a spec-compliance failure too, not a bonus.

The workflow has four phases. Do not skip phase 1 by jumping straight to code.

## Phase 1 — Decompose the spec into a checklist BEFORE writing code

Read the full spec (ticket, PRD, design doc, or the user's written description) and turn
it into a discrete, numbered checklist of atomic, individually verifiable requirements.
"Atomic" means each item can be checked off true/false by looking at one behavior — split
compound sentences into separate items.

Skip this explicit checklist step only for genuinely trivial asks (a couple of
requirements, one obvious behavior). For anything larger, write the checklist out — either
in the response or in a scratch file — before touching code. A spec with more than two or
three requirements handled from memory is exactly how items get quietly dropped.

Include items the spec states outright AND items it implies but never says. Specs
systematically under-specify the unglamorous parts: cleanup, error handling,
confirmation steps, boundary conditions. A spec that says "users can delete their
account" implies a confirmation flow, cascading data cleanup, and error handling if
deletion fails — none of that may be written down, all of it is expected. Treat "the
spec didn't mention it" as a prompt to ask "would a competent reviewer expect this
anyway?", not as license to skip it.

Use `references/requirement-decomposition-checklist.md` as the category template for this
pass — it lists the buckets to scan explicitly (explicit functional requirements, implied
requirements, error states, edge cases, permission boundaries, validation rules,
non-functional requirements, backward-compatibility concerns, and explicit out-of-scope
items). Work through every category for every spec; write "none" for categories that
genuinely don't apply rather than skipping them silently — an empty category should be a
deliberate judgment, not an oversight.

## Phase 2 — Track acceptance criteria, not just feature descriptions

For each checklist item, distinguish two different things:

- **What the feature does** — the primary happy-path behavior (e.g. "user can add an
  item to the cart").
- **How to know it's done correctly** — the acceptance criteria: what happens at the
  edges, on failure, when empty, when unauthorized, under load (e.g. "adding an
  out-of-stock item is rejected with a specific error", "cart total updates atomically",
  "guest carts persist across a session but not across devices").

A spec that reads like a feature description rather than a formal acceptance-criteria list
still has acceptance criteria — they're implicit in domain norms and in anything the spec
says about behavior, constraints, or limits. Extract them anyway. Do not let "the ticket
only described the happy path" become an excuse for only implementing the happy path.

Explicitly hunt for these acceptance-criteria categories, because they're the ones most
often left as pure feature description with no stated criteria:

- Edge cases: empty/null inputs, zero/one/many, maximum sizes, concurrent access.
- Error and failure states: what the user sees, what the system does, whether it's
  recoverable.
- Empty states: first-run, zero-results, not-yet-configured.
- Permission and authorization boundaries: who can and can't trigger this, and what
  happens when they try anyway.
- Non-functional requirements mentioned or reasonably implied by the spec: performance
  budgets, accessibility, i18n/l10n, security constraints.
- External/third-party data source behavior under realistic conditions: if a feature
  depends on a third-party API/library's filtering, ordering, pagination, or rate limits,
  verify those empirically against live/realistic data volume during implementation —
  don't trust docs or a single successful call. A single happy-path fetch against a quiet
  test branch can pass while the real feature silently breaks once real data volume or
  request frequency exposes a library bug or a rate limit (a real incident: a "most recent
  N files" fetch worked once during a spike, then failed live because normal traffic
  volume meant the N-file window no longer contained the file type needed, and the
  third-party portal itself throttled repeated requests). If the spec/plan already flags a
  dependency as risky, that's a signal to stress it during the spike, not just prove it
  works once.

## Phase 3 — Re-read the spec against the diff before declaring done

After implementation (or after a subagent/teammate reports implementation done), go back
through the Phase 1 checklist item by item against the actual diff — not against a
recollection of what was intended, not against "there's code near this area that looks
related." For each item, find the specific lines that satisfy it. If no such lines exist,
the item is not done, regardless of how close the surrounding code gets.

This step exists specifically to catch three patterns that a general "did I finish"
feeling will miss:

1. **Partial implementation** — the common case is handled, the edge case in the same
   requirement is not (e.g. delete works, but the cascading cleanup half of it is a TODO
   or silently absent).
2. **Abandoned mid-task** — a requirement was started, then dropped when a harder
   requirement demanded attention, and never returned to.
3. **Quietly dropped because it was hard** — the requirement was understood but skipped,
   often with no comment or note marking the gap, because the easier requirements
   crowded it out and there was no checklist forcing a return trip.

Also re-check the checklist for the *inverse* problem: anything implemented that isn't on
the checklist and wasn't a necessary consequence of something that is. Flag it as scope
creep — either cut it, or call it out explicitly to the user as an addition beyond what
was asked, and let them decide whether it stays.

Produce a short pass/fail readout per checklist item (even just inline in the response) as
the closing step of any spec-driven task — do not declare a task "done" without this
readout when the checklist had more than a couple of items.

## Phase 4 — Flag ambiguity instead of guessing silently

When the spec is ambiguous, underspecified, or self-contradictory on a specific point,
surface it to the user rather than picking an interpretation and building on it silently.
A silent assumption baked into the implementation is a common root cause of "this doesn't
do what I asked for" discovered only after the work looks finished.

Not every ambiguity warrants stopping to ask — batch questions, and make a documented
default call for anything low-stakes and easily reversible. See
`references/handling-ambiguity.md` for the decision rule on when to ask versus when to
default, how to batch multiple open questions into a single round-trip instead of
interrupting repeatedly, and phrasing examples for each. As a rule of thumb: ask when the
two interpretations are hard to reverse, materially different in scope, or touch
security/data-loss/money; default (and say what was defaulted and why) when the
interpretations are cheap to change later or genuinely don't matter to the outcome.

## Relationship to sibling skills

This personal skill library separates spec-compliance from two adjacent concerns —
apply the relevant skill(s) together, not instead of each other, on any nontrivial task:

- **`code-quality-review`** governs the HOW: is the code well-designed, correct in its
  mechanics, maintainable, free of bugs in logic that isn't spec-related. This skill
  governs the WHAT: does the full set of asked-for behaviors exist at all. Code can pass
  a quality review while still being spec-incomplete (clean code that does 80% of the
  ticket), and code can be spec-complete while being poorly written — both checks matter,
  neither substitutes for the other.
- **`unit-testing`** governs how tests are written and structured. This skill's Phase 2
  output (the acceptance-criteria list) is what test cases should map back to: every
  checklist item should ideally have a corresponding test, and a checklist item with no
  test is a coverage gap worth flagging even if the code "looks right." When both skills
  apply, build the acceptance-criteria checklist first (this skill), then let it drive
  which tests get written (`unit-testing`).

## References

- `references/requirement-decomposition-checklist.md` — the category template for Phase 1.
- `references/worked-example.md` — a full worked example (checkout feature spec →
  checklist → code/test mapping), including one implied requirement a careless pass would
  miss and one ambiguity that should be flagged rather than assumed.
- `references/handling-ambiguity.md` — how to batch clarifying questions and when to
  default instead of asking, with phrasing examples.
