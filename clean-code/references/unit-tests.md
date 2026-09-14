# Unit tests `[TST]`

Source: *Clean Code* ch. 9 + ch. 17 test and environment heuristics. **Load when** writing or
reviewing test code, test helpers or fixtures, practising TDD, or judging whether a change is
tested enough. For threaded code, also load `concurrency-testing.md`.

Core idea: test code is as important as production code. Tests are what make change safe. A
dirty suite gets harder to maintain until it's abandoned, and then the production code rots
because everyone is afraid to touch it.

## Discipline
**TST-1 Three laws of TDD** `[—]` — (1) Write no production code until a failing unit test
exists. (2) Write no more of a test than is enough to fail (not compiling counts as failing).
(3) Write no more production code than is enough to pass. The loop takes seconds to minutes, so
tests and code grow together. Where the team doesn't practise TDD, keep the spirit: tests are
written *with* the code (TST-9 Timely), not afterwards.

**TST-2 Keep tests clean** `[M]` — Dirty tests are worse than no tests: each production change
costs more test surgery until the suite is dropped. Test code gets the same design, naming and
refactoring care as production code.

## Clean test code
**TST-3 Readability first** `[M]` — What makes a test clean is clarity, simplicity and density of
expression: say a lot in few lines. Hide incidental detail (object construction, HTTP plumbing)
so the reader sees only what matters to this case. Detect: tests that need scrolling, repeated
low-level setup, assertions buried in plumbing.

**TST-4 Build–Operate–Check** `[L]` — Every test has three visible parts: build the data
(arrange/given), operate on it (act/when), check the result (assert/then).

**TST-5 A testing language** `[L]` — Grow domain-specific helpers that make tests read like
specifications (`givenCartWith(items)`, `whenCheckingOut()`, `thenTotalIs(42)`). They usually
emerge while refactoring repetitive tests.

**TST-6 Dual standard** `[—]` — Test code must be *clean* but needn't be *efficient* like
production code. A slower but clearer assertion helper, or a readable state-string comparison,
is fine. Never lower the bar on clarity.

**TST-7 Few asserts per test** `[L]` — Aim for one assertion per test. Several are fine when they
verify a single concept. Name tests given–when–then style. Remove the duplication that splitting
creates with shared setup or helpers, without making the flow hard to follow.

**TST-8 One concept per test** `[M]` — Don't test several unrelated behaviours in one long test.
When it fails you can't see what broke, and later assertions hide behind the first failure.
Detect: a test that exercises three scenarios in sequence with comments between them.

## F.I.R.S.T.
**TST-9 FIRST** `[M→H]`
- **Fast:** slow tests don't get run, and problems are found late.
- **Independent:** no test sets up the next; tests pass in any order and alone.
- **Repeatable:** the same result in any environment (CI, a laptop offline, the train). Replace
  the clock, network, randomness and OS timers with test doubles.
- **Self-validating:** pass or fail automatically; no reading logs or comparing files by hand.
- **Timely:** written just before (or with) the production code. Tests written afterwards find
  code that is hard to test.
Raise to [H] for order-dependence, shared mutable state or real-time/network reliance, because
those make tests flaky.

## Coverage heuristics
**TST-10 Test everything that could break** `[M]` — "Seems like enough" is not a stopping point.
Use a coverage tool to find untested branches, and don't skip trivial tests: they're cheap and
documentary. Detect: a production change with no test change; only the happy path covered.

**TST-11 Boundary conditions** `[M]` — Test the edges, not just the middle: empty, zero, one,
negative, maximum, first/last, off-by-one, duplicates, invalid input.

**TST-12 Bugs cluster** `[M]` — When you find a bug in a function, test that function
exhaustively, because its neighbours are likely broken too.

**TST-13 Ambiguity gets an explicit skip** `[L]` — When a requirement is unclear, write the test
and mark it skipped *with a reason* (the framework's skip/ignore annotation). Never leave it
commented out.

**TST-14 Read the patterns** `[L]` — Arrange cases so the *pattern* of failures points to the
cause (for example, every input over 1,000 fails, which suggests overflow). Code that passing
tests never execute also hints at why the failing ones fail.

**TST-15 One step to run** `[M]` — All tests run with one command or one click. Detect: manual
setup, ordered scripts, or tribal knowledge needed to get green.

## Don't over-apply
- Test helpers can overreach: a DSL that hides what is being asserted is worse than repetition.
- Integration and end-to-end tests have their own trade-offs. This file is about unit tests.
- For mocking strategy, test-double choice and coverage policy, defer to a dedicated unit-testing
  skill if one is available.
