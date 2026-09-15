---
name: engineering-principles
description: This skill should be used when the user asks to "apply engineering best practices", "is this code modular/cohesive/scalable", "review the architecture for coupling/cohesion", "is this DRY enough", "will this scale", "is this CI/CD friendly", or whenever Claude is designing or writing non-trivial code and should proactively apply foundational software engineering principles beyond just making it work. Also use when the user asks about abstraction layers, encapsulation, testability, code duplication, or general "clean code" / "good design" review.
---

# Core Software Engineering Principles

Apply ten foundational principles — modularity, cohesion, loose coupling, scalability,
CI/CD-friendliness, abstraction, encapsulation, testability, DRY, and SOLID — to catch and
fix design problems while writing or reviewing code. These principles pull against each
other as often as they reinforce each other; the point of this skill is judgment about
which one wins in a given spot, not reciting definitions.

## How to use this skill

1. Read the relevant principle section(s) below for a quick diagnosis and the smell to
   look for.
2. For the eight principles covered in depth here, open the matching reference file in
   `references/` when a real restructuring or before/after example is needed.
3. For **SOLID** and **Testability**, this skill only summarizes — go to the sibling
   `solid-principles` skill and the sibling `unit-testing` skill for depth.
4. When reviewing code, only flag a violation if it correlates with a real symptom (hard to
   change, hard to test, fragile, duplicated bugs, unbounded growth). A "technical"
   violation with no practical consequence is not worth flagging, and over-applying any one
   of these principles is itself a design defect — see the "tension" note under each
   principle before recommending a fix.

## The ten principles

### 1. Modularity

**Plain language:** Break a system into distinct units (modules, packages, services) each
with a well-defined purpose and a clear boundary, so a piece can be understood, changed,
tested, and replaced largely on its own. Modularity is about the *shape* of the system —
how it's decomposed — as opposed to cohesion (what belongs together) and coupling (how
the pieces talk to each other), which describe the *quality* of that decomposition.

**Code smells:**
- A single file or folder mixes concerns that have no natural relationship (e.g., a
  `utils/` folder that is really "everything nobody wanted to name").
- To understand one module you must read three other modules first, because responsibilities
  are smeared across all of them.
- There is no clear place to put new code — every feature touches the same 2-3 giant files.

**How to apply it:** Draw the boundary around a responsibility, not around a file-size
target. A module should be describable in one sentence and expose a small, intentional
public surface (see Encapsulation) while hiding its internals.

**Tension — modularity vs. fragmentation:** Splitting too eagerly produces a maze of
tiny modules where understanding one behavior requires jumping through a dozen files, which
is just as costly as one giant file. Rule of thumb: split when a piece has a distinct
reason to change or a distinct owner/audience; don't split solely to keep files under a
line-count target. See `references/modularity-cohesion-coupling.md` for a full before/after
example.

### 2. Cohesion

**Plain language:** Cohesion measures how closely the responsibilities *within* a single
module relate to each other. High cohesion means everything in the module works together
toward one purpose and uses the same data; low cohesion means the module is a grab-bag of
loosely related functions bundled together by accident of file location.

**Code smells:**
- Methods in a class use disjoint subsets of its fields (some methods never touch fields
  that others rely on) — a strong signal the class is really two classes.
- The module name is generic (`Manager`, `Helper`, `Utils`, `Common`) because no single
  sentence captures what it does.
- Two unrelated features both require editing the same file for unrelated reasons.

**How to apply it:** Group by "changes for the same reason and uses the same data," not by
technical category (don't create a module purely because two things are both "validators").
See `references/modularity-cohesion-coupling.md` for how to measure this concretely.

### 3. Loose Coupling

**Plain language:** Coupling measures how much one module knows about, and depends on, the
internal details of another. Loose coupling means modules interact through small, stable,
well-defined interfaces and can change their internals independently; tight coupling means
a change in one module routinely forces changes in another.

**Code smells:**
- A change to a function's internals (not its signature) breaks callers elsewhere.
- Module A reaches past module B's public API to touch B's internal state or private
  fields directly.
- Two modules must always be deployed/changed together even though they model different
  concerns.
- Deep import paths (`import { helper } from '../../../other-feature/internal/utils'`)
  reaching into another feature's implementation details.

**How to apply it:** Depend on the smallest stable interface a collaborator exposes, pass
data rather than reaching into shared mutable state, and prefer events/callbacks over
direct calls when the direction of dependency should be invertible.

**Tension — loose coupling vs. indirection cost:** Decoupling via extra interfaces, event
buses, or dependency injection has a real cost in navigability — "go to definition" stops
working, and a one-call-site abstraction adds ceremony for no payoff. Rule of thumb: pay
for decoupling at genuine seams (things that vary independently, cross team ownership, or
need a test double); don't decouple two pieces of code that will only ever change together.
See `references/modularity-cohesion-coupling.md` for a before/after tight-to-loose coupling
restructuring.

### 4. Scalability

**Plain language:** Code should tolerate growth — more data, more requests, more
concurrent users — without a redesign, ideally by adding capacity rather than rewriting
logic. At the code level (as opposed to infrastructure) this mostly comes down to avoiding
patterns that get linearly or quadratically more expensive as inputs grow, and avoiding
hidden state that prevents horizontal scaling.

**Code smells:**
- Loading an entire table/collection into memory before filtering, instead of filtering
  at the source (DB query, streaming).
- An N+1 query pattern: fetching a list, then looping over it to fetch a related record
  per item.
- In-memory caches, counters, or session state stored in process memory with no eviction
  and no external store, silently growing forever or breaking under multiple instances.
- No pagination on an endpoint or query that returns an unbounded collection.

**How to apply it:** Prefer streaming/paginating over "load everything," push filtering
and aggregation to the data layer, and keep request-handling code stateless so any
instance can serve any request. See `references/scalability-and-cicd.md` for concrete
patterns and fixes.

**Tension — scalability vs. YAGNI/over-engineering:** Designing for a scale that will
never arrive (sharding a database for an app with 200 users, building a distributed queue
for a job that runs once a day) burns time and adds operational complexity for zero
benefit. Rule of thumb: apply cheap scalability habits by default (don't load unbounded
data, don't hold state in memory that should be in a store, paginate anything
list-shaped) because they cost almost nothing up front — but do not build for a specific
large-scale architecture (sharding, multi-region, queues, caching layers) until there is
a concrete, measured need. Cheap defaults now, expensive infrastructure only on evidence.

### 5. Continuous Integration and Delivery (CI/CD)

**Plain language:** Code should be structured and written so it can be integrated,
tested, and released frequently and safely — small changes, verified automatically, merged
often — rather than in large, risky, manually-verified batches. This is a code-authoring
discipline (how you branch, how you size changes, how deterministic your tests are) as much
as a pipeline configuration.

**Code smells:**
- Long-lived feature branches that diverge from main for weeks and produce painful merges.
- Tests that are flaky (pass/fail non-deterministically) or slow enough that people skip
  running them locally.
- A single PR that bundles an unrelated refactor with the actual feature, making it hard
  to review or revert.
- Half-finished features committed directly to main without a flag, requiring the whole
  branch to be reverted if something is wrong.

**How to apply it:** Keep changes small and independently reviewable, make builds and
tests deterministic (no reliance on real network calls, real clocks, or execution order),
and gate incomplete work behind feature flags rather than long-lived branches so main is
always releasable. See `references/scalability-and-cicd.md` for details.

**Tension — CI/CD discipline vs. delivery speed on genuinely large changes:** Some
changes (a schema migration, a framework upgrade) are hard to slice into small PRs.
Rule of thumb: default to small increments merged behind flags; reserve a longer branch
only when the change is not safely splittable, and even then keep it rebasing against
main frequently rather than diverging for weeks.

### 6. Abstraction

**Plain language:** Abstraction means exposing only the essential concept a piece of code
represents ("charge a customer") while hiding the mechanism behind it ("call this specific
payment gateway's REST API with these headers and retry semantics"). Good abstraction lets
a caller reason about *what* happens without needing to know *how*.

**Code smells:**
- A "leaky" abstraction: callers must know an implementation detail to use it correctly
  (e.g., a `Repository` interface that still requires callers to manage a raw SQL
  transaction object).
- The abstraction has grown parameters/flags for every edge case of every implementation
  it wraps, so callers must know which implementation is behind it anyway.
- An abstraction exists for a concept with exactly one implementation and no plausible
  second one ("just in case" abstraction).

**How to apply it:** Name the abstraction after the concept, not the mechanism, and make
sure it can fully hide at least one real alternative implementation (even a fake for
tests) without callers changing. See `references/abstraction-encapsulation.md` for a
before/after leaky-abstraction fix.

**Tension — abstraction vs. simplicity:** Every abstraction layer is a detour — it costs
a reader an extra hop to understand what actually happens, and a wrong or premature
abstraction is often more expensive to undo than duplicated code would have been. Rule of
thumb: introduce an abstraction when there are two real implementations (or one real +
one test double) behind it today, not in anticipation of a hypothetical future one; when
in doubt, write the concrete version first and extract the abstraction once a second
caller/case actually shows up.

### 7. Encapsulation

**Plain language:** Encapsulation means bundling data with the operations that act on it
and hiding the data's internal representation behind a controlled interface, so the
object's invariants (rules that must always hold) can't be violated by code outside it.
It's closely related to abstraction but specifically about protecting internal *state*,
not just hiding mechanism.

**Code smells:**
- A class exposes public mutable fields directly (`order.items.push(...)`), so any caller
  can put the object into an invalid state without going through validation logic.
- Getters/setters exist for every field with no behavior, effectively making "private"
  fields public with extra steps — and callers reach through several of them to make a
  coordinated change that should have been one method.
- Invariants (e.g., "total must equal the sum of line items") are checked in multiple
  call sites instead of being enforced once, inside the object.

**How to apply it:** Keep state private, expose behavior (methods that enforce
invariants) rather than raw data, and make illegal states unrepresentable through the
object's own API. See `references/abstraction-encapsulation.md` for a before/after
exposed-internal-state fix.

**Tension — encapsulation vs. observability/testability:** Hiding everything can make
state impossible to inspect in tests or debug in production, pushing people toward
reflection hacks or excessive mocking. Rule of thumb: hide *mutation* paths tightly
(nothing external should be able to corrupt invariants), but keep *read* access to
state reasonably open (getters, serialization, debug output) since reads can't violate
invariants.

### 8. Testability

**Plain language:** Code is testable when its behavior can be verified in isolation,
quickly, deterministically, and without heavy setup (no real network, database, or
clock dependencies unless that's specifically what's being tested). Testability is
mostly a side effect of the other principles here — good modularity, loose coupling,
and dependency inversion (from SOLID) naturally produce testable code, while tight
coupling and hidden global state naturally produce untestable code.

For a full treatment of writing and structuring tests, see the sibling `unit-testing`
skill for depth. When reviewing for testability here, the quick check is: can this
behavior be exercised with a plain unit test and a fake/stub, with no real I/O?

### 9. DRY (Don't Repeat Yourself)

**Plain language:** Every piece of knowledge (a business rule, a policy, a calculation)
should have one authoritative representation in the system, so a change to that rule is
made in exactly one place and can't silently drift out of sync in a copy elsewhere. DRY is
about *knowledge*, not *text* — two blocks of code can look textually identical while
representing different, independently-changing rules, and merging them is a mistake.

**Code smells:**
- The same business rule (a tax rate, a validation regex, a discount formula) is
  hardcoded or reimplemented in more than one file, and a bug fix was applied to one copy
  but not the others.
- A shared "helper" function has grown a pile of boolean flags/parameters
  (`format(x, { isEmail: true, legacy: false, forInvoice: true })`) to serve call sites
  that started out similar and have since diverged in behavior.

**How to apply it:** Unify code when it represents the *same rule for the same reason*.
Leave it duplicated when it merely looks similar today but belongs to different concerns
that are likely to evolve independently. See `references/dry-and-duplication.md` for the
concrete "wrong abstraction" trap and a worked example of each case.

**Tension — DRY vs. premature/wrong abstraction:** This is the single most common
over-application in this whole list. Forcing two coincidentally-similar pieces of code
into one shared function/class, only to bolt on flags and conditionals as they diverge
over time, produces code far worse than the original duplication. Rule of thumb: three
occurrences of truly identical *knowledge* justify extraction (the "rule of three");
two occurrences that are merely similar-looking are better left alone until a third
confirms the pattern — and the moment a shared abstraction needs an `if (caseA)`
branch to serve a new caller, that's the signal to un-merge it back into separate
functions rather than adding the flag.

### 10. SOLID Principles

**Plain language:** SOLID (Single Responsibility, Open/Closed, Liskov Substitution,
Interface Segregation, Dependency Inversion) is a set of five object-oriented design
principles for managing change and complexity in classes, interfaces, and modules — used
here as the class-level counterpart to the module-level principles above (modularity,
cohesion, coupling). See the sibling `solid-principles` skill for depth — full
definitions, code smells, and before/after TypeScript examples for each of the five.

## Reference Files

- `references/modularity-cohesion-coupling.md` — deep dive on modularity, cohesion, and
  coupling together: what a well-modularized system looks like, how to recognize
  high/low cohesion, how to recognize tight/loose coupling, before/after TypeScript
  restructuring example.
- `references/abstraction-encapsulation.md` — deep dive on abstraction and encapsulation
  with before/after TypeScript examples: fixing a leaky abstraction, fixing an
  encapsulation violation (exposed internal state).
- `references/scalability-and-cicd.md` — deep dive on code-level scalability
  (unbounded in-memory state, statelessness, N+1 queries, pagination/streaming) and
  CI/CD-friendly code (small reviewable changes, deterministic builds/tests, feature
  flags vs. long-lived branches, fast test suites).
- `references/dry-and-duplication.md` — deep dive on DRY, the "wrong abstraction"
  problem, and a worked example of duplication that should be tolerated vs. duplication
  that should be unified.
