# Template Method

## Intent
Define the skeleton of an algorithm in a base class, with certain steps deferred to subclasses, so subclasses can customize specific steps of the algorithm without changing its overall structure.

## Also known as
(none commonly used)

## Problem
Several classes implement algorithms that are almost identical except for a few steps (e.g. importing data from PDF, DOC, and CSV files all involve open-parse-validate-close, but the parse step differs per format). Without a shared skeleton, this leads to duplicated boilerplate around the varying step, and client code often needs conditional logic to pick the right class for the right variant.

## Solution
Break the algorithm into a sequence of steps, each its own method. Put the overall sequencing in one non-overridable "template method" on a base class, calling the step methods in order. Steps that vary by subclass are declared abstract (subclasses must implement) or given a default implementation subclasses may optionally override; steps that never vary are implemented once in the base class and never overridden. Subclasses customize only the parts that differ, while the algorithm's shape stays fixed and centralized.

## Structure
- **AbstractClass** — declares the template method (implemented once, typically `final`/non-overridable in spirit) and the step methods (some abstract, some with default implementations)
- **ConcreteClass** — implements the abstract steps and optionally overrides the default ones; never touches the template method itself

## Code example
```typescript
abstract class ImportJob {
  // Template method: the fixed skeleton, not meant to be overridden
  run(filePath: string): void {
    const raw = this.readFile(filePath);
    const records = this.parse(raw);
    this.validate(records);
    this.persist(records);
    this.logCompletion(records.length);
  }

  protected readFile(filePath: string): string {
    return readFileFromDisk(filePath); // shared, same for every format
  }

  protected abstract parse(raw: string): unknown[]; // must differ per format

  protected validate(records: unknown[]): void {
    if (records.length === 0) throw new Error("No records found");
  }

  protected abstract persist(records: unknown[]): void; // format-specific destination logic

  private logCompletion(count: number) {
    console.log(`Imported ${count} records`);
  }
}

class CsvImportJob extends ImportJob {
  protected parse(raw: string): unknown[] {
    return raw.split("\n").map((line) => line.split(","));
  }
  protected persist(records: unknown[]): void { /* insert rows into DB */ }
}

class JsonImportJob extends ImportJob {
  protected parse(raw: string): unknown[] {
    return JSON.parse(raw);
  }
  protected persist(records: unknown[]): void { /* insert rows into DB, different mapping */ }
}

new CsvImportJob().run("orders.csv"); // same run() sequence, different steps underneath
```

## When to use
- Multiple classes implement algorithms that are structurally identical but differ in a few specific steps
- You want to let subclasses extend specific parts of an algorithm without letting them change its overall structure or sequencing
- You want to eliminate duplicated boilerplate (setup/teardown/sequencing) across several near-identical classes

## When NOT to use / pitfalls
- Relies on inheritance, which is a rigid, compile-time relationship — if the variation needs to change at runtime, prefer **Strategy** (composition) instead
- Subclasses can feel constrained by a skeleton that doesn't fit a new variant well, forcing awkward workarounds (empty overrides, throwing "not supported" from a step) — a sign the shared skeleton no longer fits and shouldn't be forced
- Overriding a step to skip default behavior can silently violate the Liskov Substitution Principle if callers assume the base class's documented behavior always holds
- For just two variants with only one differing line, a template method hierarchy can be more ceremony than simply parameterizing a function

## Relations to other patterns
- **Factory Method** is often used as one step within a Template Method's algorithm (a specialization of it)
- **Strategy** is the composition-based alternative: prefer Strategy when the varying behavior needs to be swappable at runtime rather than fixed by subclass choice at compile time
