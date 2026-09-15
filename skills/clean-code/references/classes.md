# Classes `[CLS]`

Source: *Clean Code* ch. 10 + ch. 17 heuristics on inheritance, coupling, placement and
polymorphism. **Load when** creating a class or module, growing one (new fields or methods),
designing inheritance or interfaces, or reviewing class-level structure.

Core idea: classes should be small, and "small" is measured in *responsibilities*, not lines.
A system of many small, cohesive classes, each with one reason to change, is easier to
understand, change and test than a few large ones.

**CLS-1 Conventional organisation** `[L]` — Follow the language's member order; the classic one
is constants, static fields, instance fields, then public methods, with each private helper
placed right after the public method that uses it (stepdown, FUN-5).

**CLS-2 Encapsulation first** `[L→M]` — Keep fields and helpers private. Loosen to
protected/package/internal *only* so tests can reach something, and only after looking for a way
to test through the public interface. Loosening encapsulation is the last resort.

**CLS-3 Small by responsibility** `[M]` — The name should describe the single responsibility. If
you can't find a concise name, the class does too much. Vague names (`Manager`, `Processor`,
`Super`, `Util`) signal aggregated responsibilities. Test: describe the class in about 25 words
without "if", "and", "or" or "but".

**CLS-4 Single Responsibility Principle** `[M]` — One reason to change. Detect: methods that
change for different reasons (pricing rules next to PDF layout next to e-mail sending); a class
touched by unrelated tickets. Getting code to work and making it clean are separate activities:
once it works, go back and split the overstuffed classes. Many small classes are a toolbox of
labelled drawers, not extra complexity.

**CLS-5 Cohesion** `[M]` — Keep the number of fields small and have each method use one or more of
them. When a subset of methods uses only a subset of fields, a class wants to get out. Keeping
functions small with few parameters makes fields multiply, and that is the signal to split.
Refactoring path: extract functions from a big function → promote shared locals to fields →
split the class by the groups of fields and methods that belong together.

**CLS-6 Organise for change (OCP)** `[M]` — A class you must open and edit for every new feature
variant (a `ReportExporter` with `toCsv`, `toPdf` and `toXlsx` branches in several methods) is
closed to extension. Split it so each variant is its own class behind a shared interface; new
features then add classes rather than edit old ones. Private helpers used by only one variant
move with it.

**CLS-7 Isolate from change (DIP)** `[M]` — Depend on abstractions, not on volatile concrete
details. An `InvoiceService` that talks to a `TaxRates` interface can be tested with a fixed
stub and survives a change of tax provider; one that constructs `VendorTaxApiClient` inside
cannot. Detect: `new ConcreteExternalThing()` inside business logic.

**CLS-8 Base classes don't know their derivatives** `[M]` — No references in a base class to its
subclasses' names or specifics. Exception: a closed, fixed set that is always deployed together
(sealed hierarchies, some state machines).

**CLS-9 Minimal surface** `[M]` — Hide as much as possible: few public methods, few fields, no
public mutable state, no protected fields "for subclasses someday". A wide interface creates
coupling to everything it exposes.

**CLS-10 No artificial coupling** `[L]` — Don't put general-purpose constants, enums or utility
functions inside an unrelated specific class because it was handy. Give them a proper home.

**CLS-11 Put code where readers expect it** `[L→M]` — Follow the principle of least surprise
when deciding where a function or constant lives (the totals calculation belongs with the order,
not with the report printer). Let names guide the placement.

**CLS-12 Prefer instance over static when behaviour may vary** `[L]` — Static is right for pure
functions of their arguments (`max(a, b)`). If there's any chance you'll want polymorphic
behaviour, make it an instance method.

**CLS-13 Polymorphism over repeated switches** `[M]` — For any given kind of selection, have at
most one switch (in a factory) that creates polymorphic objects. Everything else dispatches
through the interface (FUN-6).

**CLS-14 Structure over convention** `[L→M]` — Enforce design decisions with structure (abstract
methods, interfaces, types) rather than naming or comment conventions ("remember to handle every
enum value here"). Structure makes compliance compulsory.

**CLS-15 Don't be arbitrary** `[L]` — Structure should have a visible reason: no public class
nested in another it has nothing to do with, and no arbitrary splitting.

## Don't over-apply
- An interface with a single implementation and no test or variation need is ceremony (EMG-5).
- Small, stable data holders don't need SRP surgery.
- For full SOLID analysis (substitution, interface segregation, DI wiring), defer to a dedicated
  SOLID skill if one is available. For named-pattern choices (Strategy, Factory, Template
  Method), defer to a design-patterns skill.
