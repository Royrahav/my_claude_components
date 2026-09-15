# Coverage and What Not to Test

Test coverage percentage measures one thing precisely: which lines executed during the test
run. It says nothing about whether the assertions in those tests actually verify correct
behavior. Treat it as a **diagnostic tool for finding gaps**, not a target to maximize.

## Coverage as diagnostic, not target

Useful ways to use a coverage report:

- Scan for **business-critical files with low or zero coverage** — a pricing engine, an
  auth check, a state-machine transition with 20% coverage is a real red flag worth
  investigating.
- Look at **which branches** are uncovered, not just which lines. 90% line coverage on a
  function with an untested `else` branch handling the error path is a meaningful gap, even
  though the number looks high.
- Use a coverage drop on a pull request (existing tests now cover a smaller % of new code) as
  a prompt to ask "was new logic added without a matching test?" — not as a hard gate to
  block on reflexively.

Misuses that produce the opposite of the intended effect:

- **Chasing 100%, or an arbitrary threshold, as a goal in itself.** This incentivizes writing
  tests for trivial code (to move the number) instead of thinking about which *behaviors*
  need protecting. A codebase can have 100% coverage and still ship a regression, if every
  test's assertions are weak or the wrong things are tested.
- **Treating coverage as a proxy for test quality.** A test with no meaningful assertion
  (`expect(result).toBeDefined()` on a function that returns a complex calculated value)
  contributes to coverage while verifying almost nothing.
- **Writing tests just to cover generated code, framework boilerplate, or straight
  passthroughs**, which adds maintenance cost (tests to update on every unrelated refactor)
  without adding any regression protection.

## What's usually not worth unit testing

- **Trivial getters/setters and pure data classes** with no logic (`get fullName() { return
  this.first + ' ' + this.last }` might be worth one test if formatting could plausibly be
  wrong, but a plain field accessor with no transformation is not).
- **Framework glue and wiring code** — dependency-injection container registration, route
  table definitions that just map a path to a handler, ORM entity/schema declarations. These
  are usually better covered by an integration or smoke test (does the app boot, does the
  route respond) than a unit test per binding.
- **Generated code** (protobuf/GraphQL codegen, ORM migrations, OpenAPI client stubs) —
  testing it tests the generator, not your logic, and it gets regenerated anyway.
- **Pure configuration** (a JSON/YAML config file, a constants file with no computed values,
  environment variable declarations) — there's no behavior to assert on.
- **Thin pass-through wrappers** that add no logic (`function getUser(id) { return
  repository.getUser(id); }` with zero transformation or error handling) — testing this
  duplicates a test of the thing it wraps and breaks every time the wrapper's signature
  changes, for zero regression value. If the wrapper adds logic later (retries, caching,
  validation), it becomes worth testing at that point.
- **Third-party library internals** — trust the library's own test suite; test *your usage*
  of it only where you have logic wrapped around the call (e.g., how you handle its errors).

## What's high-value to test

- **Business/domain logic** — calculations, pricing, discount rules, tax rules, scoring,
  ranking, anything with a specification a stakeholder could argue about.
- **State transitions and state machines** — order status flows, workflow/approval steps,
  anything where "can this go from state A to state B" has rules that could regress silently.
- **Boundary and edge-case handling** — empty collections, null/undefined, zero, negative
  numbers, exactly-at-a-limit values, duplicate/conflicting input, very large input.
- **Error handling and validation** — invalid input rejected with the right error type/
  message, partial-failure handling (e.g., one item in a batch fails — does the rest
  complete or does everything roll back), retry/timeout logic.
- **Anything that has already caused a production bug once.** Past bugs are the strongest
  possible signal of where untested complexity hides — always add a regression test per
  `references/regression-test-workflow.md` when fixing one.
- **Public API contracts of shared libraries/modules** used by multiple consumers — a
  regression here has a wide blast radius, so the cost of a thorough test suite is easily
  justified.

## A quick judgment heuristic

Ask: **"If this logic silently returned the wrong answer, would anything catch it before a
user or another team noticed?"**

- If the answer is "no, nothing else would catch it" — this is high-value to test directly.
- If the answer is "yes, it's trivial enough that a code reviewer or the type system already
  effectively guarantees it's right" (e.g., a getter, a strongly-typed constant) — it's
  usually not worth a dedicated test.

This heuristic naturally routes effort toward business logic, calculations, edge cases, and
error handling — and away from boilerplate, wiring, and generated code — without needing a
coverage number to decide.
