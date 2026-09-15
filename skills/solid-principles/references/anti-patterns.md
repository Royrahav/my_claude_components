# Anti-Patterns: Over-Engineering from Misapplied SOLID

SOLID principles are guardrails for managing change and complexity in code that will grow
and be maintained by multiple people over time. Applied mechanically, without regard to
whether real variability or a real team boundary exists, they produce the opposite of their
intent: more files, more indirection, and more cognitive load, for code that is actually
harder to change because a simple edit now ripples across several layers of abstraction.
This file catalogues the most common over-application pitfalls so this skill pushes back on
them as actively as it pushes for the principles themselves.

## 1. Premature interface extraction

**Pattern:** Every class gets a matching `I`-prefixed or same-named interface (`UserService`
+ `IUserService`), even when there is exactly one implementation, no test double is ever
substituted, and no second implementation is realistically coming.

```ts
// Unnecessary: one implementation, no substitution ever happens
interface IUserRepository {
  findById(id: string): Promise<User>;
}
class UserRepository implements IUserRepository {
  async findById(id: string): Promise<User> { /* ... */ return {} as User; }
}
// Everywhere in the codebase: `constructor(private repo: IUserRepository)`
// but only UserRepository is ever passed in, in prod and in tests.
```

**Why it hurts:** Every reader has to jump from the interface to the (only) implementation
to understand behavior. Renames and refactors require touching two files instead of one.
The interface communicates "this varies" when it doesn't, misleading future maintainers.

**When it's actually justified:** There are two or more real implementations, or tests
substitute a fake/stub for this exact type, or the boundary crosses a genuine
vendor/infrastructure seam (see `dependency-inversion.md`). If none of those are true yet,
export the concrete class directly; extract the interface later, when a second
implementation or a test double actually shows up (this is cheap to do retroactively in
TypeScript — extracting an interface from an existing class is a low-risk refactor).

## 2. Excessive dependency injection for things that will never vary

**Pattern:** Constructor-injecting pure, deterministic values or utilities that have no
alternate implementation and no reason to be swapped — e.g., injecting a `Formatter` for a
single, fixed date format, or injecting a `MathUtils` object to wrap `Math.round`.

```ts
// Unnecessary ceremony for something with one behavior, ever
interface Rounder { round(n: number): number; }
class StandardRounder implements Rounder { round(n: number) { return Math.round(n); } }
class PriceCalculator {
  constructor(private rounder: Rounder) {} // DI for Math.round — no real seam here
  total(price: number) { return this.rounder.round(price); }
}
```

**Why it hurts:** Adds a constructor parameter, an interface, and a wiring step for
something that could be a plain function call. It also obscures genuinely important
injected dependencies (like a real payment gateway or database) by putting them on equal
footing with trivial ones — reviewers can no longer tell which constructor parameters
matter.

**When it's actually justified:** The value legitimately varies by environment/config
(e.g., currency rounding rules differ by locale and that's a real, live requirement), or
it's a genuine impurity that tests need to control (time, randomness, network).

## 3. Factory-of-factories / builder-of-builders

**Pattern:** Introducing a `Factory` to construct an object, then an `AbstractFactory` to
choose which `Factory` to use, then a `FactoryProvider` to configure the `AbstractFactory`
— for object graphs that are actually static and known at startup.

```ts
// Unnecessary layers for a graph that's fixed at startup
interface NotifierFactory { create(): Notifier; }
class EmailNotifierFactory implements NotifierFactory { create() { return new EmailNotifier(); } }
class NotifierFactoryProvider {
  static getFactory(kind: string): NotifierFactory {
    if (kind === "email") return new EmailNotifierFactory();
    throw new Error("unknown kind");
  }
}
// vs. simply:
const notifier = new EmailNotifier();
```

**Why it hurts:** Each layer adds a class and an indirection hop with no corresponding
increase in flexibility — the "choice" the factory-of-factories claims to defer is actually
made once, at startup, and never varies at runtime. Debugging requires stepping through
several layers to find where an object actually gets constructed.

**When it's actually justified:** The concrete type genuinely must be chosen at runtime
based on data not known until then (e.g., picking a shipping-rate strategy per order based
on destination country, where the set of strategies is data-driven and growing). Even then,
prefer one factory/registry, not a chain of factories producing factories.

## 4. Splitting interfaces or classes past the point of cohesion

**Pattern:** Taking ISP or SRP to the point where every single method gets its own
interface, or every field access gets its own class, destroying the cohesive "role" that
made the original grouping meaningful.

```ts
// Over-segregated: these always change and are always used together
interface HasId { id(): string; }
interface HasName { name(): string; }
interface HasPrice { price(): number; }
// vs. simply:
interface Product { id: string; name: string; price: number; }
```

**Why it hurts:** Fields/methods that are always read and written together as a unit
(genuinely one cohesive concept) get scattered across many types, forcing consumers to
compose several interfaces just to describe one simple thing, and making the codebase
harder to navigate for no compensating benefit (no implementer ever needed a subset).

**When it's actually justified:** Different consumers genuinely use disjoint, meaningful
subsets of a large type's surface (see the `Worker` example in
`interface-segregation.md`), not "any type with more than N fields."

## 5. Speculative generality / configuration for imagined futures

**Pattern:** Building a generic, pluggable, config-driven system to handle hypothetical
future requirements that have not been requested and may never arrive ("what if someday we
need to support five payment providers" when there is one, with no roadmap for a second).

**Why it hurts:** Pays complexity cost today for a benefit that may never materialize, and
often guesses wrong about the shape the real future requirement will take, meaning the
abstraction gets thrown away or reworked anyway when the real need shows up. It also slows
down everyone reading the code today for a hypothetical future reader's convenience.

**When it's actually justified:** There is a concrete, near-term, committed requirement for
the second variant (already scoped, not merely plausible), or the cost of retrofitting the
abstraction later is unusually high (e.g., a public API contract that's expensive to change
after release) — in that narrow case, designing the seam up front can be worth it.

## Quick self-check before adding an abstraction

Ask these before introducing an interface, DI seam, factory, or strategy pattern:

- [ ] Does a second real implementation exist today, or is one concretely planned (not just
      "might happen")?
- [ ] Does a test actually need to substitute a fake/stub here, or would the real
      implementation work fine in tests as-is?
- [ ] Is there a genuine external/vendor boundary being crossed (network, DB, filesystem,
      third-party SDK)?
- [ ] Would removing the abstraction and inlining the concrete implementation make the code
      easier or harder to read *today*, ignoring hypothetical futures?

If the answer to all of these is no, prefer the simpler, direct version. It is
cheap to introduce the abstraction later, the moment a second implementation or a test
double actually appears — that is the point at which SOLID's benefits become real rather
than speculative.
