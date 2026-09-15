---
name: solid-principles
description: This skill should be used when the user asks to "apply SOLID principles", "review this class design", "is this violating SRP/OCP/LSP/ISP/DIP", "refactor this for better design", "improve the architecture of this module", or whenever Claude is writing, designing, or reviewing object-oriented or modular code (classes, interfaces, modules, services, dependency wiring) and should proactively check for SOLID compliance. Also use when the user asks whether code is "over-engineered", has "too many abstractions", or when deciding whether to introduce an interface, factory, or dependency-injection layer.
---

# SOLID Principles

Apply the five SOLID principles to catch and fix design problems in object-oriented and
modular code — and, equally, to avoid introducing needless abstraction where none is
warranted. SOLID is a tool for managing change and complexity, not a checklist to satisfy
for its own sake.

## How to use this skill

1. Read the relevant principle section(s) below for a quick diagnosis.
2. When a violation is suspected or a refactor is needed, open the matching reference file
   in `references/` for the deeper explanation and full before/after TypeScript examples.
3. Before adding any abstraction (interface, factory, DI layer, strategy class), check
   `references/anti-patterns.md` first — over-application is as common a mistake as
   under-application, and this skill should push back on it just as hard.
4. When reviewing code, do not report a SOLID violation as a finding unless it correlates
   with a real symptom (hard to test, hard to extend, fragile subclassing, forced dummy
   implementations, or hard-coded concrete dependencies). A "technical" violation with no
   practical consequence is not worth flagging.

## The five principles

### S — Single Responsibility Principle (SRP)

**Plain language:** A class or module should have one reason to change — one job, owned by
one actor/stakeholder. This is not "one method per class"; it's about not bundling unrelated
concerns (e.g., business logic + persistence + formatting) into the same unit, because a
change to one concern then risks breaking or forces a redeploy of the others.

**Code smells:**
- A class name is vague (`OrderManager`, `UserService`, `Helper`, `Utils`) and its methods
  don't obviously relate to each other.
- The class imports things from unrelated layers (e.g., a domain class importing an HTTP
  client, a logger, a database driver, and an email SDK all at once).
- Changes for unrelated reasons keep touching the same file (e.g., both "change tax rules"
  and "change how receipts are emailed" require editing `Order.ts`).
- Large classes/functions with sections separated by comments like `// --- validation ---`,
  `// --- persistence ---`.

**How to check:**
- [ ] Can you describe the class's job in one sentence without using "and"?
- [ ] List the actors/stakeholders who could request a change to this class. Is it more than one?
- [ ] Do all the class's methods use most of its fields? (Low cohesion → split candidate.)
- [ ] Would unit-testing one piece of behavior require mocking unrelated concerns?

See `references/single-responsibility.md` for full examples.

```ts
// Smell: mixes calculation, persistence, and notification
class Order { calculateTotal() {...} saveToDb() {...} sendConfirmationEmail() {...} }
```

### O — Open/Closed Principle (OCP)

**Plain language:** Code should be open for extension but closed for modification — you
should be able to add new behavior without editing and re-testing code that already works.
In practice this usually means depending on abstractions (interfaces, polymorphism, strategy
objects, configuration/registration) at the points where new variants are known to be
added over time, rather than a chain of `if`/`switch` statements over a type tag.

**Code smells:**
- A `switch`/`if-else` chain on a type/kind field that gets a new branch every time a new
  variant is added (`if (paymentType === 'card') ... else if (paymentType === 'paypal') ...`),
  especially when the same switch is duplicated in multiple places.
- Adding a new feature variant requires editing a function that is already covered by
  existing tests, risking regressions in unrelated variants.
- Comments like `// add new case here` as a maintenance instruction.

**How to check:**
- [ ] Search the codebase for the type/kind tag used in the switch — is it duplicated elsewhere?
- [ ] When a new variant was last added, how many existing files had to change vs. how many new files were added?
- [ ] Is the varying behavior genuinely expected to grow, or is this the only variant that will ever exist? (If the latter, a switch is fine — see trade-offs below.)

See `references/open-closed.md` for full examples.

```ts
// Smell: every new discount type requires editing this function
function applyDiscount(type: string, price: number) {
  if (type === 'percentage') return price * 0.9;
  else if (type === 'flat') return price - 10;
  // else if (type === 'newType') ...  <- keeps growing
}
```

### L — Liskov Substitution Principle (LSP)

**Plain language:** A subtype must be usable anywhere its base type is expected without
breaking the caller's expectations. Subclasses shouldn't strengthen preconditions, weaken
postconditions, throw new exception types the base doesn't declare, or leave inherited
behavior unimplemented. This is about behavioral compatibility, not just matching method
signatures.

**Code smells:**
- A subclass overrides a method to throw `NotSupportedException` / `NotImplementedError`.
- Callers do `if (obj instanceof SpecificSubclass)` to special-case behavior — a sign the
  subclass isn't truly substitutable.
- A subclass override silently does nothing (empty override) to "opt out" of inherited behavior.
- A subclass narrows accepted input or returns a subtly different result shape than the base
  contract promises.

**How to check:**
- [ ] Can every subclass be passed to code written against the base type/interface with no `instanceof` checks and no surprises?
- [ ] Does any override throw, no-op, or return null/undefined where the base type wouldn't?
- [ ] Do subclass method pre/postconditions match or loosen (never tighten) the base contract?

See `references/liskov-substitution.md` for full examples.

```ts
// Smell: Square breaks the Rectangle contract's independent width/height setters
class Square extends Rectangle {
  setWidth(w: number) { this.width = this.height = w; } // surprises callers of setHeight
}
```

### I — Interface Segregation Principle (ISP)

**Plain language:** Clients shouldn't be forced to depend on methods they don't use. Prefer
several small, focused interfaces over one large "fat" interface, so implementers only need
to provide what's relevant to them and callers only see what they need.

**Code smells:**
- An interface has methods that most implementers stub out with `throw new Error('not
  implemented')` or a no-op.
- A consumer only calls 1-2 methods of an object but the injected type is a large interface
  with a dozen unrelated methods, making the dependency's real surface area unclear.
- Changing an unrelated method on a fat interface forces recompilation/retesting of
  implementers that never used it.

**How to check:**
- [ ] For each implementer of an interface, are there methods it doesn't meaningfully implement?
- [ ] For each consumer of an interface, what subset of methods does it actually call? Is it much smaller than the full interface?
- [ ] Would splitting the interface by role (e.g., `Readable` / `Writable`) let some implementers avoid stub methods entirely?

See `references/interface-segregation.md` for full examples.

```ts
// Smell: read-only repositories forced to implement write methods they don't support
interface Repository<T> { find(id: string): T; save(t: T): void; delete(id: string): void; }
```

### D — Dependency Inversion Principle (DIP)

**Plain language:** High-level modules (business/domain logic) shouldn't depend on
low-level modules (databases, HTTP clients, SDKs, filesystems); both should depend on
abstractions. And abstractions shouldn't depend on details — details should depend on
abstractions. In practice: domain code depends on an interface it defines/owns, and the
concrete implementation (e.g., a specific database client) is plugged in from outside
(constructor injection, factory, DI container), not `new`'d directly inside the domain logic.

**Code smells:**
- Business logic classes directly `new` up a concrete database client, HTTP SDK, or
  third-party API wrapper inside a method body.
- Unit-testing domain logic requires spinning up a real database, mocking a global module,
  or monkey-patching, because there's no seam to inject a fake.
- Swapping a vendor (e.g., Stripe → another payment processor) requires editing domain
  logic files rather than just writing a new adapter.
- Import statements in a "core"/"domain" folder reach into "infrastructure" (SDKs, ORM
  models, HTTP libraries).

**How to check:**
- [ ] Does the domain/business-logic layer import any concrete infrastructure SDK directly?
- [ ] Can this class be unit-tested by passing in a fake/stub, with no real network/DB/file access?
- [ ] Is the dependency direction: infrastructure → domain (via interfaces domain owns), not domain → infrastructure?

See `references/dependency-inversion.md` for full examples.

```ts
// Smell: OrderService is coupled to a concrete Stripe client, hard to test/swap
class OrderService { private stripe = new StripeClient(apiKey); charge() { this.stripe.charge(...); } }
```

## When SOLID trades off against simplicity

SOLID principles exist to manage **change and complexity** in code that will be extended,
maintained, and modified by multiple people over time. They are not a mandate to add
interfaces, factories, or DI containers to every piece of code regardless of its lifecycle.
Applying them where there is no real variability or team boundary to manage produces
speculative generality — more files, more indirection, more cognitive overhead — for zero
actual benefit. This is itself a design defect, not a virtue.

Before applying a principle, ask:

- **Will this actually vary or grow?** A one-off script, a single build step, or a function
  with exactly one known implementation and no plausible second one does not need an
  interface "just in case." YAGNI (You Aren't Gonna Need It) applies.
- **Is there a real seam to protect?** DIP earns its keep when there's a genuine boundary —
  e.g., swappable vendors, or a unit-test boundary that needs a fake. If nothing will ever
  be swapped and tests are fine hitting the real thing (e.g., a pure in-memory data
  structure), a constructor-injected interface adds ceremony without payoff.
  A concrete class or configuration branch is often the correct answer for a fixed, small,
  known set of cases.
- **Who is the audience?** Code with one author, short lifespan, or a throwaway/prototype
  purpose can reasonably violate SRP/OCP for speed; code that will be maintained by a team
  for years, or that models a genuinely evolving domain, benefits far more from these
  principles.
- **Does the abstraction pay for itself in fewer lines/less risk, or does it just move the
  same complexity sideways?** If introducing an interface only ever has one implementation
  and one call site, and no test double is needed, it is very likely premature.

When reviewing code, weigh a SOLID violation against the cost of fixing it. Flag it when it
correlates with a real, current pain point (hard to test, hard to extend, fragile, tightly
coupled to a vendor). Do not flag it, or recommend against fixing it, when the "fix" would
only add indirection to satisfy the letter of a principle. See `references/anti-patterns.md`
for a full catalogue of over-engineering pitfalls to avoid introducing.

## Reference Files

- `references/single-responsibility.md` — SRP deep dive, before/after TypeScript example, real-world scenarios
- `references/open-closed.md` — OCP deep dive, before/after TypeScript example, real-world scenarios
- `references/liskov-substitution.md` — LSP deep dive, before/after TypeScript example, real-world scenarios
- `references/interface-segregation.md` — ISP deep dive, before/after TypeScript example, real-world scenarios
- `references/dependency-inversion.md` — DIP deep dive, before/after TypeScript example, real-world scenarios
- `references/anti-patterns.md` — over-engineering pitfalls from misapplying SOLID (premature interfaces, excessive DI, factory-of-factories, speculative generality) and how to avoid them
