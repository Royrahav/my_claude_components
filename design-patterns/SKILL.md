---
name: design-patterns
description: This skill should be used when the user asks to "apply a design pattern", "what pattern fits this problem", "refactor using a design pattern", mentions a specific pattern by name (e.g. "use the Strategy pattern", "add a Factory"), or when Claude is designing a class/module structure and should consider whether a known pattern fits before inventing a bespoke structure.
---

# Design Patterns (Gang-of-Four Catalog)

Design patterns are reusable, named solutions to design problems that recur across codebases and languages. They are not code to copy-paste verbatim; they are shared vocabulary and proven structure for a problem shape that has already been solved many times — "make this a Strategy" communicates more precisely and faster than describing the structure from scratch. Using the right name for the right situation lets Claude and the user reason about a design at a higher altitude than individual classes and functions.

The critical discipline with patterns is: **apply a pattern because the problem it solves is actually present in the code, not because the pattern sounds sophisticated or "the code might need it someday."** Every pattern below trades some directness for some flexibility. That trade is only worth making when the flexibility is needed now, or is extremely likely to be needed very soon for a reason that's already known. Read the "anti-patterns / overuse warning" section at the end before applying anything from this catalog.

This skill indexes the 22 classic Gang-of-Four-style patterns exactly as cataloged at refactoring.guru, grouped into three categories: **Creational** (object creation), **Structural** (object/class composition), and **Behavioral** (object communication and responsibility assignment). Each pattern below has a one-line trigger and a reference file with full detail — intent, problem, solution, structure, a TypeScript code example, applicability signals, overuse pitfalls, and related patterns.

## Creational Patterns

Creational patterns abstract away the details of how objects get instantiated, so code isn't tightly bound to concrete classes at every `new` call site. They matter most when object creation itself carries complexity: many optional parameters, a need to swap implementations, families of objects that must stay consistent with each other, or expensive initialization worth reusing.

| Pattern | Use when... | Reference file |
|---|---|---|
| Factory Method | A method needs to create objects, but the exact concrete type should be decided by a subclass or config, not hardcoded at the call site | `references/creational/factory-method.md` |
| Abstract Factory | Code needs to create families of related objects (e.g. per-region, per-platform, per-tenant) that must stay mutually compatible | `references/creational/abstract-factory.md` |
| Builder | An object has many optional/combinable construction parameters and a single constructor would be an unreadable "telescoping constructor" | `references/creational/builder.md` |
| Prototype | Code needs to copy an object without depending on its concrete class, or wants to clone a pre-configured "template" instance instead of rebuilding from scratch | `references/creational/prototype.md` |
| Singleton | Exactly one instance of a class must exist for the program's lifetime, and it needs a single controlled access point | `references/creational/singleton.md` |

## Structural Patterns

Structural patterns describe ways to compose classes and objects into larger structures while keeping those structures flexible — adapting incompatible interfaces, decoupling abstraction from implementation, building part-whole hierarchies, and controlling access or adding behavior without touching the original class.

| Pattern | Use when... | Reference file |
|---|---|---|
| Adapter | An existing/third-party/legacy interface doesn't match what your code expects, and you can't or shouldn't change the source | `references/structural/adapter.md` |
| Bridge | A class needs to vary along two independent dimensions and subclassing across both would multiply classes combinatorially | `references/structural/bridge.md` |
| Composite | The domain is naturally tree-shaped (nested groups/items) and client code should treat a single item and a group of items uniformly | `references/structural/composite.md` |
| Decorator | Behavior needs to be added to individual objects at runtime, in flexible stackable combinations, without subclassing every combination | `references/structural/decorator.md` |
| Facade | A complex subsystem with many interdependent classes needs one simple entry point for the common use case | `references/structural/facade.md` |
| Flyweight | The app must create a very large number of similar objects and measured memory pressure requires sharing common state between them | `references/structural/flyweight.md` |
| Proxy | Access to an object needs to be controlled — lazy init, caching, access checks, logging, or a remote stand-in — without changing the object's interface | `references/structural/proxy.md` |

## Behavioral Patterns

Behavioral patterns are concerned with how responsibility is distributed and how objects communicate — passing requests along chains, encapsulating requests as objects, decoupling event sources from event handlers, and letting behavior vary independently of the objects using it.

| Pattern | Use when... | Reference file |
|---|---|---|
| Chain of Responsibility | A request should pass through a sequence of independent checks/handlers, where each can process it, pass it on, or stop it, in an order that may change | `references/behavioral/chain-of-responsibility.md` |
| Command | An operation needs to be represented as an object so it can be queued, logged, deferred, retried, or undone, decoupling the invoker from the operation | `references/behavioral/command.md` |
| Iterator | Code needs to traverse a collection with a non-trivial internal structure without exposing that structure, or needs multiple independent/alternate traversal orders | `references/behavioral/iterator.md` |
| Mediator | A group of components reference each other directly in a tangled, hard-to-modify web, and should instead communicate through one coordinator | `references/behavioral/mediator.md` |
| Memento | An object's state needs to be snapshotted and later restored (undo, rollback) without exposing its private internals to the code managing the snapshot | `references/behavioral/memento.md` |
| Observer | Multiple objects need to react to events/state changes in another object, and the set of interested listeners is unknown ahead of time or changes at runtime | `references/behavioral/observer.md` |
| State | An object's behavior depends heavily on its current state, and state-checking conditionals are duplicated across multiple methods | `references/behavioral/state.md` |
| Strategy | A context needs to swap between multiple interchangeable algorithm implementations, potentially at runtime, instead of branching inline on which to use | `references/behavioral/strategy.md` |
| Template Method | Several classes implement near-identical algorithms differing only in a few specific steps, and the differing steps should be overridable without changing the sequence | `references/behavioral/template-method.md` |
| Visitor | New operations need to be added across a stable hierarchy of element types without modifying those element classes each time | `references/behavioral/visitor.md` |

## How to use this skill

When a symptom in the tables above matches the problem currently being solved, read the corresponding `references/<category>/<pattern>.md` file before implementing anything — do not rely on memory alone for the structural details. Each reference file has been vetted against the canonical description of the pattern and includes the specific pitfalls and "when NOT to use" signals for that pattern, which are easy to get subtly wrong from memory (for example, confusing Strategy with State, or Decorator with Proxy, both of which share nearly identical structure but solve different problems).

Concretely:
1. Identify the symptom: what concrete problem does the current code (or the code about to be written) have? "This class has a switch statement selecting an algorithm that changes per environment" is a symptom; "this needs a design pattern" is not — start from the problem, not from wanting to use a pattern.
2. Scan the three tables above for a "Use when..." description matching that symptom.
3. Read the matching reference file fully before writing code. It contains the structure (participant roles), a realistic TypeScript example, and — just as important — the "when NOT to use" list, so the pattern isn't misapplied to a problem it doesn't actually fit.
4. Adapt the reference's structure and naming to the actual codebase's conventions; the reference file is a guide for shape and trade-offs, not a template to paste verbatim.
5. If two patterns in the tables both seem to fit, check each file's "Relations to other patterns" section — most of the commonly-confused pairs (Strategy/State, Decorator/Proxy, Adapter/Bridge, Facade/Mediator, Command/Strategy) are called out explicitly there with the distinguishing question to ask.

If Claude is designing a new class or module structure and notices a shape that matches one of these patterns, it's worth naming that match explicitly to the user ("this could be a Strategy — want me to structure it that way?") rather than silently picking either a pattern or a bespoke structure. The user may have context (this code is genuinely a one-off; a pattern would be premature) that changes the right call.

## Anti-patterns / overuse warning

Every pattern in this catalog adds a layer of indirection: an extra interface, an extra class, an extra hop between "caller" and "thing that actually does the work." That indirection is the price paid for flexibility — the ability to add a new variant, swap an implementation, or extend behavior without touching existing code. The price is worth paying only when that flexibility is actually needed.

Concrete signs a pattern is being applied prematurely or unnecessarily:

- **Adding Strategy (or Factory Method, or any "family of implementations" pattern) for a single implementation "just in case" a second one shows up later.** Wait for the second implementation. Two implementations of a straightforward `if/else` almost never justify a class hierarchy; three or more with real variability starts to.
- **Introducing a pattern because it was recently learned, discussed, or seen in another codebase**, rather than because the current code's shape calls for it. Pattern names are a solution vocabulary, not a checklist to work through.
- **Wrapping a class in Adapter, Decorator, or Proxy when the class could simply be edited directly.** These patterns exist for when you *can't* or *shouldn't* modify the original (third-party code, stable public API, multiple unrelated call sites) — not as a default habit for adding behavior.
- **Reaching for Singleton for anything reused across a module**, when a plain exported instance or constructor-injected dependency would do the same job with less hidden global state and far easier testing.
- **Building a Visitor or Composite for a hierarchy of two fixed, unlikely-to-grow types**, where a direct method or a plain switch is more legible and requires reading fewer files to understand.
- **Choosing a heavier composition-based pattern (Bridge, State) when the actual variability is only along one dimension**, or isn't expected to grow.

A useful check before applying any pattern from this catalog: can you point to the actual, present-tense problem (not a hypothetical future one) that the extra indirection removes? If not, prefer the simpler, more direct code — a pattern can always be introduced later, in a small refactor, once the second use case that justifies it actually exists. Retrofitting a pattern onto working code once the need is real is usually easy; unwinding a speculative pattern that never paid for itself is a needless subtraction later.
