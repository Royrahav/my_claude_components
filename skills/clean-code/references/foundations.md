# Foundations — why clean code matters `[FND]`

Source: *Clean Code* ch. 1. **Load only when** you must justify cleanup against schedule
pressure, decide how far to take a cleanup, or explain to a human why a finding matters.
Routine writing and reviewing do not need this file.

**FND-1 Code is the specification.** Anything precise enough for a machine to execute is code.
Better languages, DSLs and AI tools raise the level of abstraction; they do not remove the need
for a precise, verified, human-readable description of behaviour.

**FND-2 The mess compounds.** Each shortcut makes the next change slower and riskier until
productivity approaches zero and every change breaks something elsewhere. The "grand redesign"
rarely catches up with the moving system. The cure is continuous cleanliness, not a rewrite.
Warning signs: deep if/else nesting, poor names, duplicated logic, no tests, fear of changing code.

**FND-3 Professionalism under pressure.** Deadlines don't excuse a mess; the only way to go fast
is to keep the code clean. Developers own code quality the way a surgeon owns hygiene: explain
to managers, calmly and in terms of consequences, what a shortcut will cost later. Most managers
want good code; they rely on developers to say what it takes.

**FND-4 What clean code looks like.** It does one thing well; reads like well-written prose;
reveals intent; has minimal, explicit dependencies; contains no duplication; is covered by tests;
has small, well-named abstractions; and looks like it was written by someone who cared.
Efficiency matters, but elegance beats premature optimisation.

**FND-5 Code sense is learned.** Knowing the rules is not enough; you get a feel for clean code
by practice: reading other people's code, comparing alternative solutions, and refactoring.

**FND-6 We are authors.** Code is read far more often than it is written (well over 10:1), and
writing new code means reading the old. Making code easy to read makes it easier to write.

**FND-7 Boy Scout Rule.** Leave every module a little cleaner than you found it: one better name,
one extracted function, one duplication removed. Small, continuous improvement stops the rot.

**FND-8 Design principles are the backbone.** SRP, OCP, DIP and the other SOLID principles (from
the book's predecessor, *Agile Software Development*) are guidelines, not laws. Context decides
where to apply them. See `classes.md`.

## Using this file in a review
Never raise a finding *from* this file. Use it to explain the cost of a finding raised from
another file, or to argue for (or against) spending time on cleanup.
