# Emergence — simple design `[EMG]`

Source: *Clean Code* ch. 12 (Kent Beck's rules of simple design) + ch. 17 duplication heuristic.
**Load when** removing duplication, deciding how far to abstract, arbitrating between rules that
conflict, or judging whether a design is over-engineered.

Core idea: good design emerges from following four rules, **in priority order**. A design:
1. **runs all the tests**,
2. **contains no duplication**,
3. **expresses the intent** of the programmer,
4. **minimises the number of classes and methods.**
Rules 2–4 are achieved by refactoring, which rule 1 makes safe.

**EMG-1 Runs all the tests** `[—]` — A system that can't be verified shouldn't ship. Making code
testable pushes the design towards small single-purpose classes, loose coupling, injected
dependencies and interfaces. Testability *is* a design force.

**EMG-2 Refactor continuously** `[—]` — After every few lines that work, stop and ask whether the
design just got worse, and if so, clean it immediately while the tests are green. Apply
everything you know: raise cohesion, lower coupling, separate concerns, shrink functions and
classes, choose better names.

**EMG-3 No duplication** `[M]` — Duplication is the main enemy of a well-designed system: extra
work, extra risk, extra complexity. Every duplication is a missed abstraction.
- *Obvious:* copy-pasted lines and blocks.
- *Subtle:* the same algorithm with different surface details; the same `switch`/`if` chain on a
  type in several places (FUN-6); parallel class hierarchies; near-identical functions that
  differ in one step.
- *Fixes:* extract the common part, even at a tiny scale, and look at where it lands (it often
  reveals an SRP violation and wants its own class). Use **Template Method** when an algorithm's
  skeleton is shared and a few steps vary (a base `ShippingQuote` computes, per-carrier subclasses
  supply the rate and surcharge steps), or **Strategy** when composition fits better.
- *Judgment:* duplication means the same *knowledge* in two places, which must change together.
  Similar-looking code that represents different concepts and changes for different reasons is
  not duplication, and merging it creates false coupling.

**EMG-4 Express intent** `[L→M]` — Most of a project's cost is long-term maintenance, and clear
code reduces it. Express intent through good names, small functions and classes, standard
vocabulary (pattern names in class names: `...Command`, `...Visitor`), and well-written unit
tests that serve as documentation by example. Most of all, *care*: spend a little time after it
works to make it readable, since the next reader is most likely you.

**EMG-5 Minimal classes and methods** `[L]` — Don't take the other rules to dogmatic extremes: an
interface for every class, data and behaviour always split into separate classes, a layer that
only passes calls through, micro-functions called once. Pragmatism beats dogma. This rule has the
**lowest priority**: tests, no duplication and clarity come first. Use it to flag over-engineering.

**EMG-6 Practice plus principles** `[—]` — Following these rules doesn't replace experience, but
it gives you in a short time much of what experienced developers learned the hard way.

## Using the priority order to settle conflicts
- Would a "cleaner" change break tests or make the code untestable? Rule 1 wins.
- Would removing duplication produce an obscure abstraction? Rule 2 usually still wins, but name
  the abstraction well (rule 3). If it can't be named clearly, it may not be real duplication.
- Would splitting for clarity create pointless classes? Clarity (rule 3) beats count (rule 4)
  only when the new pieces carry real meaning.
