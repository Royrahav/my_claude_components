# Liskov Substitution Principle (LSP)

## Deeper explanation

"Subtypes must be substitutable for their base types." If code is written against a base
type (a class or interface), passing in any subtype/implementation should not change the
correctness of that code from the caller's point of view. This goes beyond matching method
signatures — it's about behavioral contracts:

- A subtype must not **strengthen preconditions** (e.g., a base method accepts any string,
  but an override throws for empty strings when the base never did).
- A subtype must not **weaken postconditions** (e.g., a base method guarantees a sorted
  result, but an override sometimes returns unsorted data).
- A subtype must not **throw new exception types** the caller isn't prepared to handle.
- A subtype must not leave inherited behavior **unimplemented or degraded** (throwing
  "not supported," silently no-op-ing, or returning a sentinel the base never returns).

LSP violations are usually invisible at compile time (TypeScript's structural typing will
happily accept a subclass with a narrower or throwing override) and only surface as runtime
bugs or defensive `instanceof` checks scattered through calling code.

## Before (violates LSP)

```ts
// shipping.ts — classic Rectangle/Square-style violation
class Rectangle {
  constructor(protected width: number, protected height: number) {}
  setWidth(w: number) { this.width = w; }
  setHeight(h: number) { this.height = h; }
  area(): number { return this.width * this.height; }
}

// Square "is-a" Rectangle geometrically, but not behaviorally: it can't support
// independent width/height mutation, so it breaks the base contract.
class Square extends Rectangle {
  setWidth(w: number) {
    this.width = w;
    this.height = w; // surprise side effect callers of Rectangle don't expect
  }
  setHeight(h: number) {
    this.width = h;
    this.height = h; // same surprise
  }
}

function resizeAndCheckArea(rect: Rectangle) {
  rect.setWidth(4);
  rect.setHeight(5);
  // A caller relying on Rectangle's contract expects area === 20.
  // Passing a Square silently gives area === 25 instead.
  console.assert(rect.area() === 20, "LSP violated: area is wrong for Square");
}
```

A more common real-world flavor of the same problem:

```ts
// repository.ts
interface Repository<T> {
  findById(id: string): Promise<T>;
  save(item: T): Promise<void>;
}

// A read-only, externally-synced repository forced into the same interface
class ReadOnlyCatalogRepository implements Repository<Product> {
  async findById(id: string): Promise<Product> { /* ... */ return {} as Product; }
  async save(item: Product): Promise<void> {
    throw new Error("save() not supported on read-only repository"); // LSP violation
  }
}

async function importProducts(repo: Repository<Product>, products: Product[]) {
  for (const p of products) {
    await repo.save(p); // blows up at runtime if repo happens to be read-only
  }
}
```

## After (satisfies LSP)

```ts
// Avoid inheritance for geometrically-similar-but-behaviorally-different types.
// Model them as distinct, non-substitutable types instead.
interface Shape {
  area(): number;
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}
  area(): number { return this.width * this.height; }
  withWidth(w: number): Rectangle { return new Rectangle(w, this.height); }
  withHeight(h: number): Rectangle { return new Rectangle(this.width, h); }
}

class Square implements Shape {
  constructor(private side: number) {}
  area(): number { return this.side * this.side; }
  withSide(s: number): Square { return new Square(s); }
}
```

```ts
// Split the fat, non-uniformly-implementable interface (also fixes ISP at the same time)
interface Readable<T> {
  findById(id: string): Promise<T>;
}

interface Writable<T> {
  save(item: T): Promise<void>;
}

class ReadOnlyCatalogRepository implements Readable<Product> {
  async findById(id: string): Promise<Product> { /* ... */ return {} as Product; }
}

class MutableProductRepository implements Readable<Product>, Writable<Product> {
  async findById(id: string): Promise<Product> { /* ... */ return {} as Product; }
  async save(item: Product): Promise<void> { /* ... */ }
}

// Callers that need to write now require Writable<T> in their type signature,
// so passing a ReadOnlyCatalogRepository is a compile-time error, not a runtime throw.
async function importProducts(repo: Writable<Product>, products: Product[]) {
  for (const p of products) await repo.save(p);
}
```

## Common real-world scenarios

- **"NotSupportedException" overrides**: any subclass whose override's entire body is
  throwing an error is very likely an LSP (and often ISP) violation — the subclass doesn't
  actually fit the base contract and is being forced into a hierarchy it shouldn't be in.
- **Optional/nullable fields introduced by a subclass** that the base type always guarantees
  are present, forcing every caller to add null checks only relevant to that one subtype.
- **Overridden methods with narrower accepted input** than the base method declares
  (violates parameter contravariance expected for substitutability).
- **Mock/test doubles that don't match production behavior**, causing tests to pass while
  the real implementation would fail (or vice versa) — a testing-time symptom of the same
  substitutability problem.
- **API client subclasses** for different environments (e.g., sandbox vs. production) where
  the sandbox subclass silently no-ops a side-effecting method instead of truly performing
  the equivalent operation.

## Interaction with other principles

- LSP violations are frequently *caused by* forcing a class to implement an interface that
  is too broad for it — fixing **ISP** (splitting the interface) often resolves the LSP
  violation for free, as shown in the repository example above.
- LSP is the safety property that makes **OCP** trustworthy: OCP says "add new
  implementations instead of editing existing code," but that's only safe if every new
  implementation truly honors the shared contract.
- Preferring composition over inheritance sidesteps many LSP problems outright (the
  Rectangle/Square fix above uses no inheritance at all) — when a subclass needs to
  override a method just to reject or alter the base behavior, that's a strong signal
  inheritance is the wrong tool here.
