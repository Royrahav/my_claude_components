---
name: unit-testing
description: This skill should be used when the user asks to "write unit tests", "add test coverage", "make sure this doesn't regress", "test this function/class", "write a test for this bug", or whenever Claude has written or changed non-trivial logic and should add or update unit tests to guard against regressions before considering the change complete. Also use when reviewing existing tests for quality (flaky tests, over-mocking, tests that assert nothing meaningful) or when deciding what does and doesn't need a test.
---

# Unit Testing for Regression Prevention

Write unit tests whose job is to catch regressions cheaply and pin down intended behavior —
not to hit a coverage number. A passing suite that doesn't actually constrain behavior is
worse than no suite at all, because it produces false confidence: a reviewer or future
change sees green checkmarks and assumes correctness that was never verified.

## Core purpose

Before writing a single test, be clear on what it's for:

- **Catch regressions cheaply.** A unit test should fail immediately and precisely when
  behavior breaks, long before the bug reaches integration tests, staging, or production.
- **Pin down intended behavior.** A test is executable documentation of what a unit is
  supposed to do, especially at its edges.
- **NOT** to satisfy a coverage percentage, to look thorough, or to make CI green as an end
  in itself.

A test that always passes regardless of whether the logic is correct — because it asserts
something trivial, or because it mocks away the exact behavior it claims to verify — gives
false confidence. Flag and fix these; they are worse than having no test, because they hide
the fact that the behavior is unverified.

## How to use this skill

1. Before writing tests, identify the unit's **public contract** — what it promises callers,
   including edge cases and error behavior — not its internal steps.
2. Write tests using Arrange-Act-Assert (or Given-When-Then) structure with scenario-based
   names. See `references/test-structure-and-naming.md` for before/after examples.
3. Decide what to fake, stub, or mock at the boundary vs. what to exercise for real. See
   `references/mocking-and-test-doubles.md` — over-mocking is the single most common way a
   test suite becomes false confidence.
4. When the task is a bug fix, follow the regression-guard workflow below and in
   `references/regression-test-workflow.md`: reproduce first, fix second.
5. When deciding what's worth testing at all, see
   `references/coverage-and-what-not-to-test.md` — coverage is a diagnostic, not a target.

## What makes a good unit test

- **Fast.** Milliseconds, not seconds. A slow unit test suite gets skipped or run less often,
  which defeats its purpose.
- **Isolated and deterministic.** No shared mutable state between tests, no dependence on
  test execution order, no real network/clock/filesystem/randomness — unless that exact
  thing is the unit under test. Same input, same result, every time, in any order, alone or
  in parallel with other tests.
- **One logical behavior per test.** A test should have a single reason to fail. Multiple
  unrelated assertions in one test obscure which behavior actually broke and make failures
  expensive to diagnose.
- **Named for scenario and expected outcome**, not for the method under test. `test1`,
  `testFoo`, and `testCalculate` say nothing when they fail at 2am in CI. A name like
  `throws InsufficientFundsError when withdrawal exceeds balance` tells you exactly what
  broke without opening the file.
- **Arrange-Act-Assert (or Given-When-Then) structure.** Set up state, perform the one
  action being tested, assert the one outcome. Keep the three sections visually distinct
  (blank line or comment) so the test reads top-to-bottom without backtracking.

## What to test

- **Public behavior and contracts** — what a caller can observe: return values, thrown
  errors, state changes visible through the public API, side effects on injected
  collaborators (a call was made, a message was published).
- **Not private implementation details.** Testing internals (private methods, intermediate
  variables, the specific sequence of internal calls) makes tests brittle: a refactor that
  preserves behavior but changes the internal path breaks the test for no real reason. This
  is a critical anti-pattern — it trains people to "fix the test" reflexively instead of
  treating a break as a signal, which erodes the whole suite's credibility.
- **Boundary and edge conditions**, not just the happy path: empty input, null/undefined,
  zero, negative numbers, max/overflow values, duplicate entries, single-element collections,
  off-by-one boundaries (exactly at a limit, one under, one over).
- **Error paths.** What happens on invalid input, a failed dependency, a timeout. If the
  contract says "throws X when Y," there must be a test proving it does.

## Mocking discipline

Mock or fake dependencies **at the boundary** of the system — network calls, databases,
filesystem, wall-clock time, randomness, third-party SDKs. These are slow, non-deterministic,
or require live infrastructure, so a real call has no place in a unit test.

Do not over-mock cheap, in-process collaborators just because they're "another class." Over-
mocking has two costs:

1. It makes the test re-describe the implementation (mock every internal call, assert every
   mock was called with the exact arguments the code already uses) instead of verifying an
   outcome — the test becomes a mirror of the code, so it passes even when the logic is
   wrong, as long as the *shape* of the calls matches.
2. It hides real integration breakage — two collaborators can each pass their mocked tests
   while being incompatible with each other in production.

Prefer fakes/in-memory implementations (an in-memory repository instead of a mocked database
client) over mocks with elaborate expectation-setting, wherever the real or fake dependency
is cheap enough to use directly. See `references/mocking-and-test-doubles.md` for the full
dummy/stub/fake/spy/mock taxonomy and a worked over-mocking example.

**When the unit under test is a thin wrapper around a third-party call with filter/query
parameters** (a "fetch the right subset of X" function, a search/list API client), faking
only the wrapper's *return value* is not enough — that proves parsing works given
already-correct input, but says nothing about whether production code ever asks the
third-party API for the right thing. A real incident: a fetch wrapper silently dropped its
type filter, so "get the 60 most recent files" returned the wrong file type entirely once
real traffic volume grew — every test still passed because each one faked the wrapper
function and handed it pre-filtered, correctly-typed data directly. The fix is to fake the
underlying client/library object one level down and assert on the *arguments* your code
passed to it (the filter, the query, the limit) — that's the only way to catch "we stopped
asking for the right thing" instead of just "we can parse the right thing once we have it."

## Regression-guard workflow (bug fixes)

When the task is "fix this bug," do not fix first and test after — the order matters:

1. **Reproduce the bug in a failing test first.** Write the smallest test that exercises the
   reported scenario and assert the *correct* behavior. Run it and confirm it fails for the
   expected reason (not a typo or setup error).
2. **Fix the code.**
3. **Re-run the test and confirm it now passes.** This proves the test would have caught the
   original bug, and it stays in the suite permanently as a regression guard.

Skipping step 1 means there is no proof the test would ever have caught the bug — it might
pass trivially regardless of the fix. See `references/regression-test-workflow.md` for a full
worked example from bug report to permanent regression test.

## What NOT to do

- Don't write tests that just re-assert the implementation — mocking every internal call so
  the test literally restates the code line-by-line provides zero regression value; if the
  logic itself is wrong, a test built this way still passes.
- Don't chase 100% coverage as a goal in itself. High coverage on trivial code (getters,
  pure config, generated code) is wasted effort; low coverage on complex business logic is
  the actual risk. See `references/coverage-and-what-not-to-test.md`.
- Don't leave flaky tests skipped or silently ignored in the suite. A skipped or
  intermittently-failing test that nobody fixes is a blind spot wearing a disguise of
  coverage — either fix the flakiness (usually shared state, real time, or real network) or
  delete the test; a disabled test that never gets re-enabled is worse than no test.
- Don't assert on incidental output (e.g., exact log message wording, internal object
  identity) when the contract only promises the meaningful part (e.g., the log level and
  that an error was logged).

## Relation to sibling skills

This skill focuses on the tests themselves. Two sibling skills in this personal library cover
related but distinct concerns:

- **`engineering-principles`** — covers *testability* as a property of the code being
  written (e.g., dependency injection, avoiding hidden global state, small focused units).
  Use it when the code under test is hard to test at all; use `unit-testing` for how to
  write the tests once the code is testable.
- **`code-quality-review`** — covers reviewing code quality broadly. When a review turns up
  test-specific smells (over-mocking, brittle assertions on internals, missing edge-case
  coverage on new logic), apply this skill's guidance to fix them.

## Reference files

- `references/test-structure-and-naming.md` — badly-named/structured vs. well-structured
  test examples, and how to organize `describe`/`context` blocks by scenario.
- `references/mocking-and-test-doubles.md` — dummy/stub/fake/spy/mock taxonomy, when each is
  appropriate, and a worked over-mocked-test-that-gives-false-confidence example.
- `references/regression-test-workflow.md` — step-by-step: bug report → failing test →
  fix → passing test that stays in the suite.
- `references/coverage-and-what-not-to-test.md` — what's not worth testing, what's
  high-value, and how to treat coverage as a diagnostic signal rather than a target.
