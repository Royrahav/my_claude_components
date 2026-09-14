---
name: code-quality-review
description: This skill should be used when the user asks to "review this code for quality", "check the architecture", "is this well designed", "audit this for bugs and design issues", "does this meet our engineering standards", or whenever Claude has just written or modified a non-trivial chunk of code and should self-review it against high engineering standards before considering the task done — covering correctness, design/architecture soundness, coding standards, robustness, and maintainability. Distinct from the built-in diff-focused `/code-review` command: that command scans a git diff for correctness bugs and simplification opportunities; this skill goes deeper on architecture and design quality and can be applied to code that isn't sitting in a diff at all (a file, a module, a design in progress).
---

# Code Quality Review

Perform a rigorous, falsifiable review of code against five categories: correctness,
design & architecture, coding standards, robustness, and maintainability. Produce findings
a senior engineer would actually write in a review — specific, evidence-backed, and worth
the reader's time — not generic advice like "improve error handling" or "consider edge cases."

## How to use this skill

1. Establish scope: which files/functions/modules are under review, and what "surrounding
   convention" looks like (read neighboring files before judging style or naming).
2. Work through the five checklists below in order. Each item is a yes/no question that
   can be answered by pointing at a specific line — if a check can't be falsified against
   the actual code, skip it rather than speculating.
3. For anything non-trivial involving concurrency, security-sensitive patterns, or
   performance, consult `references/checklist-by-language-concern.md` for the deep-pass
   checklist before concluding the review.
4. Before finalizing any finding, check it against `references/common-false-positives.md`.
   A finding that turns out to be intentional simplicity, matched project convention, or
   defense against an unreachable state should be dropped, not reported with a hedge.
5. Write up findings using `references/severity-and-reporting.md` — triage each into a
   severity tier and report with file:line, a one-sentence defect description, and a
   concrete triggering scenario.
6. Cross-check design findings against sibling skills where relevant (see below) instead
   of re-deriving that analysis from scratch.

## Relationship to sibling skills

This skill is the entry point for a full review; it does not duplicate the deep content
of these sibling skills — invoke them for their specialty and fold the result back in:

- **`solid-principles`** — use when a design/architecture finding looks like a SOLID
  violation (wrong dependency direction, fat interface, fragile subclassing, a switch
  that should be polymorphism). Let that skill judge whether the violation is real and
  worth fixing versus over-engineering.
- **`design-patterns`** — use when considering whether a recurring structural problem
  warrants a named pattern (strategy, factory, decorator, etc.), or when reviewing code
  that already uses a pattern to check it's applied correctly and not just as ceremony.
- **`engineering-principles`** — use for broader engineering judgment calls this skill
  references but doesn't own outright: YAGNI vs. speculative generality, DRY vs.
  premature abstraction, KISS trade-offs, when "good enough" is actually the right call.
- **`unit-testing`** — use when the review's testability findings (see Maintainability
  below) need to turn into an assessment of actual test coverage/quality, or when a
  finding is "this is hard to test" and the fix requires designing the test itself.

A full review should touch all five categories below and pull in the sibling skills
where a category-specific question comes up — but this file stays the coordinating
checklist; go to the sibling skill for its depth rather than re-deriving it here.

## 1. Correctness

- [ ] Trace each conditional branch and loop bound by hand — does it do what the
      surrounding code/comments/tests claim, for at least one concrete input?
- [ ] Off-by-one: check every loop bound, array slice, and index arithmetic against the
      actual length/count involved (`<` vs `<=`, `length` vs `length - 1`, inclusive vs
      exclusive ranges).
- [ ] Null/undefined/None: for every value read from a function return, external call,
      map/dict lookup, or optional field, confirm the absent case is handled at the point
      of use, not assumed away.
- [ ] Race conditions: for any state shared across threads/async tasks/processes, check
      whether reads and writes are ordered/guarded, and whether a check-then-act sequence
      (e.g., "if not exists, create") can interleave with another actor.
- [ ] Error handling gaps: does every call that can throw/reject/return an error code have
      a handler, or is failure silently swallowed (empty catch, ignored return, unchecked
      promise)?
- [ ] Edge cases: empty input (empty string/array/collection), single-element input,
      maximum/minimum boundary values, duplicate entries, and — for concurrent code —
      overlapping/simultaneous calls.
- [ ] Resource leaks: every open (file handle, socket, DB connection, lock, subscription,
      timer) has a matching close/release on both the success path and every error/early-
      return path.

## 2. Design & Architecture

- [ ] Layering: does this code reach across layers it shouldn't (e.g., UI code doing SQL,
      domain logic importing an HTTP framework, a repository containing business rules)?
- [ ] Dependency direction: do concrete/infrastructure modules depend on
      abstract/domain modules, and not the reverse? (Full checklist: `solid-principles`.)
- [ ] Cohesion: do the members of this module/class actually work together on one
      responsibility, or is it a grab-bag reached by "put it somewhere"?
- [ ] Coupling: how many other modules does this one need to know about internally
      (not just through its public interface) to be understood or changed safely?
- [ ] Abstraction fit: is there exactly one implementation behind an interface that will
      never plausibly have a second (under-justified abstraction), or is a single function
      doing the job of what should be several composable pieces (missing abstraction)?
- [ ] Naming reflects intent: does the name of each function/class/variable describe what
      it *is for*, not just what it *is* or how it's implemented (`processData` vs.
      `applyLoyaltyDiscount`)?

## 3. Coding Standards

- [ ] Style consistency: does this code match the formatting, naming casing, import
      ordering, and idioms already used in neighboring files in the same repo (checked by
      reading at least one sibling file, not assumed)?
- [ ] Naming: are names specific enough that a reader wouldn't have to open the
      implementation to guess what they hold/do? Flag single-letter/`temp`/`data`/`obj`
      names outside of tight, obvious loop scopes.
- [ ] Size and single-purpose-ness: can each function be summarized in one sentence
      without "and"? Is any function/class long enough that it's doing visibly unrelated
      things (parsing + validating + persisting in one function body)?
- [ ] Duplication (DRY): is the same logic (not just similar-looking code) repeated in two
      or more places such that a bug fix would need to be applied in both? Distinguish this
      from coincidentally similar code that represents different concepts and would be
      wrongly conflated by extracting a shared abstraction.
- [ ] Comment quality: do comments explain *why* a non-obvious decision was made (a
      constraint, a workaround, a business rule), rather than restating *what* the next
      line already says in code?

## 4. Robustness

- [ ] Boundary validation: is every value entering the system from outside its trust
      boundary (HTTP request, CLI arg, file content, third-party API response, message
      queue payload) validated/sanitized before use?
- [ ] Defensive code is targeted: does each defensive check guard a state that's actually
      reachable from a real caller, or is it dead ceremony around a value already
      guaranteed by the type system or the calling code? (See
      `references/common-false-positives.md` before flagging either direction.)
- [ ] Error propagation vs. silent failure: when an operation fails, does the failure
      surface to whoever needs to react to it (exception, error return, logged + rethrown),
      or does it get caught and dropped, leaving the system in a state the caller believes
      succeeded?
- [ ] Failure mode for partial success: in a multi-step operation, if step 2 of 3 fails,
      is the system left in a consistent, documented state (rollback, compensating action,
      or explicit partial-failure signal) rather than an undefined one?
- [ ] Real-world data matching: does search/matching logic against external or
      user-facing text data (city/place names, addresses, free-text, anything from a
      third-party feed) assume the stored value matches user input as an exact/verbatim
      substring, or does it tolerate the abbreviations, reformatting, and inconsistent
      casing real-world data actually has? A demo/fixture value that happens to match
      verbatim can hide this until a real user hits it (e.g. a government open-data feed
      abbreviating a two-word city name, breaking a naive full-phrase substring match).
- [ ] Output-format injection: when free text — static copy the author wrote, user input,
      or third-party data (product names, descriptions) — is interpolated into a string
      that will be parsed by a strict downstream format (chat-client markup like Telegram/
      Slack HTML or Markdown, a shell command, a URL, a template engine), is it escaped for
      that format at the point of interpolation? A single unescaped `<`, `&`, backtick, or
      similar control character from *either* hand-authored copy *or* untrusted external
      data can make the whole downstream call fail outright (not just render wrong) — e.g.
      a literal `<placeholder>` in a bot's own help text broke every send of that message
      via a strict HTML parse mode, and the same gap would have broken on any product name
      containing `&`. Check both directions: the static strings the author wrote, and every
      call site that interpolates dynamic/external content into an outgoing formatted
      message.
- [ ] Unbounded external I/O under a shared lock/semaphore: does every `await` on a
      third-party network call (HTTP client, scraper library, external API) that runs
      *inside* a mutex/lock/connection-pool-slot have an explicit timeout? A single-threaded
      async runtime makes this worse than it looks — a hang doesn't just stall that one
      request, it holds the lock forever, so every *other* consumer of that lock queues up
      behind it with no way to recover short of a process restart. A real incident: a
      third-party price-data portal hung on one request with no response at all (not just
      slow), and because the fetch was awaited inside a shared `asyncio.Lock` with no
      timeout, it froze the entire bot process — every unrelated command, not just the
      feature making the call — until manually killed. Any external call made under a
      shared lock needs `asyncio.wait_for`/an equivalent timeout wrapped around it (or a
      library-level timeout), with a defined degraded behavior (empty result, cached
      failure) on expiry — never a bare, unbounded `await`.

## 5. Maintainability

- [ ] Testability: can this code be exercised by a unit test without standing up a real
      database/network/filesystem/clock? If not, is that because the code is inherently
      an integration point, or because a dependency wasn't injected? (Depth:
      `unit-testing`.)
- [ ] Safe to change: could a future engineer, unfamiliar with this code, change one
      behavior here without having to also understand and touch three unrelated call
      sites? If yes, what makes it fragile — implicit ordering, shared mutable state,
      duplicated logic?
- [ ] Dead code: any unreachable branch, unused parameter/import/variable, feature-flagged
      code with no live flag, or commented-out code block left behind?
- [ ] Documentation debt: does public API surface (exported functions/classes, endpoints)
      have enough signature/doc-comment information for a caller to use it correctly
      without reading the implementation?

## Deep-pass checklists

For concurrency bugs, injection/secrets patterns, and performance footguns (N+1 queries,
unbounded loops/allocations, quadratic behavior on hot paths, API contract stability),
consult `references/checklist-by-language-concern.md` — this is the checklist to run for
a thorough pass, not a quick one, and should not be inlined into every review by default.
