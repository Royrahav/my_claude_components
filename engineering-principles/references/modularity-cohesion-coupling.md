# Modularity, Cohesion, and Coupling

These three are usually discussed together because they describe the same underlying
question — "how is this system decomposed, and how do the pieces relate?" — from three
angles:

- **Modularity** — is the system broken into units at all, and along what boundaries?
- **Cohesion** — within one unit, how related are the responsibilities it bundles?
- **Coupling** — between units, how much does one need to know about another's internals?

The target state is **high cohesion, low (loose) coupling, modular boundaries drawn
around responsibilities**. Every antipattern in this space is some combination of:
modules that are too coarse or too fine, modules whose contents don't belong together, or
modules that reach into each other's internals.

## What a well-modularized system looks like

- Each module can be summarized in one sentence, and that sentence doesn't contain "and."
- You can predict which file a given change belongs in before opening the codebase.
- A module's public surface (what it exports) is small relative to its implementation —
  most of the code inside is private/internal detail, not exported.
- Deleting or rewriting one module's internals doesn't require touching unrelated
  modules, only the (small) set that directly imports it.
- New features usually mean *adding* a module/file, not *editing* an ever-growing central
  one.

Warning signs of poor modularity, regardless of cohesion/coupling specifics:
- A `utils/`, `common/`, `shared/`, or `helpers/` module that has become a dumping ground
  with no unifying theme — it is modular in the sense of "a separate file" but not in the
  sense of "a coherent unit."
- A "God object" or "God module" that every other part of the system imports and that
  keeps growing because it's the path of least resistance for new code.

## Recognizing high vs. low cohesion

A concrete way to check cohesion in a class or module: for each method, list which fields
(or which other methods) it actually touches. High cohesion looks like most methods
touching most of the fields — the data and behavior are genuinely intertwined. Low
cohesion looks like disjoint clusters: methods 1-3 only ever touch fields A and B, methods
4-6 only ever touch fields C and D, and nothing connects the two clusters. That's a strong
signal the module is really two modules glued together by file location.

Other cohesion smells:
- The module's name had to be generic (`Manager`, `Service`, `Processor`) to cover
  everything inside it, because no specific name fits.
- Two different features each need to modify the same file, for reasons that have nothing
  to do with each other — a violation of the "single reason to change" idea (this is also
  SRP from SOLID, applied at the module level instead of the class level).
- Comments inside a file that section it by technical concern (`// -- validation --`,
  `// -- formatting --`) rather than by domain concept — the sections are cohesive
  internally but not cohesive with each other.

## Recognizing tight vs. loose coupling

Ask: if I change the *internals* of module A (not its public signature, just its
implementation) does anything outside A break? If yes, A is tightly coupled to its
consumers. Concretely:

- **Tight coupling signals:** consumers import A's internal types/fields directly rather
  than going through A's exported API; consumers know A's internal ordering or timing
  requirements ("call `init()` before `use()` or it silently fails"); two modules must
  always change together in the same commit; a shared mutable object is passed around and
  multiple modules mutate it directly.
- **Loose coupling signals:** consumers only depend on a small, explicit interface; A can
  be replaced with a fake/mock in a test with no changes to the consumer; A and B can be
  deployed, versioned, or rewritten independently; communication happens through
  well-defined data (function arguments/return values, events) rather than shared mutable
  state.

Coupling isn't binary — it's a spectrum, and *some* coupling is unavoidable and fine (a
consumer is always coupled to *some* stable public interface of its dependency). The goal
is to minimize coupling to *volatile* details (internals likely to change), not to
eliminate all dependency relationships.

## Before/after: restructuring for cohesion and coupling

**Before — low cohesion, tight coupling.** One `OrderManager` class mixes order
calculation, persistence, and shipping-label formatting. Fields are used by disjoint
subsets of methods, and a `ShippingLabelPrinter` elsewhere reaches directly into
`order.items` to compute label lines:

```ts
// order-manager.ts
class OrderManager {
  items: LineItem[] = [];
  discountCode?: string;
  dbConnection: DbConnection;

  constructor(db: DbConnection) { this.dbConnection = db; }

  addItem(item: LineItem) { this.items.push(item); }

  calculateTotal(): number {
    const subtotal = this.items.reduce((sum, i) => sum + i.price * i.qty, 0);
    return this.discountCode ? subtotal * 0.9 : subtotal;
  }

  async save(): Promise<void> {
    await this.dbConnection.query('INSERT INTO orders ...', [this.items, this.discountCode]);
  }
}

// shipping-label.ts — reaches into OrderManager's internals directly
function printLabel(order: OrderManager) {
  const lines = order.items.map(i => `${i.qty}x ${i.name}`); // tight coupling to .items shape
  console.log(lines.join('\n'));
}
```

Problems: `OrderManager` bundles pricing, persistence, and (implicitly) shipping-related
data access into one low-cohesion class — `calculateTotal` never touches `dbConnection`
and `save` never touches `discountCode`. `printLabel` is tightly coupled to
`OrderManager`'s internal `items` field shape rather than a stable interface, so any
internal refactor of `OrderManager` risks silently breaking label printing.

**After — split by cohesion, decoupled via a small interface:**

```ts
// order.ts — pure domain: pricing/business rules only, no I/O
export interface LineItem { name: string; price: number; qty: number; }

export class Order {
  private items: LineItem[] = [];
  constructor(private discountCode?: string) {}

  addItem(item: LineItem) { this.items.push(item); }

  get lineItems(): readonly LineItem[] { return this.items; } // controlled read access
  calculateTotal(): number {
    const subtotal = this.items.reduce((sum, i) => sum + i.price * i.qty, 0);
    return this.discountCode ? subtotal * 0.9 : subtotal;
  }
}

// order-repository.ts — persistence only, depends on Order's public API
export class OrderRepository {
  constructor(private db: DbConnection) {}
  async save(order: Order): Promise<void> {
    await this.db.query('INSERT INTO orders ...', [order.lineItems]);
  }
}

// shipping-label.ts — depends only on the small public surface (lineItems)
function printLabel(order: Order) {
  const lines = order.lineItems.map(i => `${i.qty}x ${i.name}`);
  console.log(lines.join('\n'));
}
```

Now each module is cohesive (`Order` is only pricing rules, `OrderRepository` is only
persistence), and `printLabel` is coupled only to the stable `lineItems` read accessor —
`Order`'s internal representation (e.g., swapping the array for a `Map`) can change
without touching `printLabel` or `OrderRepository`.

## Rule of thumb

When reviewing or designing a module boundary, check cohesion first (does this belong
together?), then coupling (does this need to know that much about its neighbor?). Fixing
cohesion often fixes coupling as a side effect, because well-cohesioned modules naturally
have smaller, more stable public surfaces to couple against.
