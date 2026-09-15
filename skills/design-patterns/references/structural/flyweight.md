# Flyweight

## Intent
Fit many more objects into available memory by sharing common, immutable parts of state between them instead of storing that data redundantly in every object.

## Also known as
Cache

## Problem
An application needs to create a very large number of similar objects (e.g. millions of order-line-item annotations, particle-effects in a game, or per-character text formatting), and each object naively stores all its data — including large chunks that are actually identical across many instances (e.g. a `discountRule` description, a `productCategory` label, a shared style object). Multiplied by a huge object count, this redundant storage exhausts memory.

## Solution
Split each object's state into:
- **Intrinsic state** — data that's shareable and identical across many objects (doesn't depend on context)
- **Extrinsic state** — data unique to each instance's context (e.g. position, quantity, timestamp)

Store intrinsic state once in a small number of shared, immutable "flyweight" objects; store only extrinsic state per instance, plus a reference to the appropriate shared flyweight. A Flyweight Factory manages the pool of shared flyweights, returning an existing one when the requested intrinsic state combination already exists, or creating and caching a new one otherwise.

## Structure
- **Flyweight** — holds immutable intrinsic state; methods take extrinsic state as parameters rather than storing it
- **Context** — pairs extrinsic state with a reference to the appropriate Flyweight
- **FlyweightFactory** — maintains a pool of flyweights keyed by intrinsic state, reuses or creates them on request
- **Client** — computes/holds extrinsic state and requests flyweights through the factory rather than constructing them directly

## Code example
```typescript
// Intrinsic state: shared, immutable, identical across many line items
class DiscountRule {
  constructor(
    public readonly code: string,
    public readonly description: string,
    public readonly percentOff: number,
  ) {}
}

class DiscountRuleFactory {
  private static pool = new Map<string, DiscountRule>();

  static get(code: string, description: string, percentOff: number): DiscountRule {
    const key = code;
    let rule = this.pool.get(key);
    if (!rule) {
      rule = new DiscountRule(code, description, percentOff);
      this.pool.set(key, rule);
    }
    return rule;
  }
}

// Extrinsic state: unique per line item, holds a reference to a shared rule
class OrderLineItem {
  constructor(
    public sku: string,
    public qty: number,
    public discount: DiscountRule, // shared flyweight, not copied per item
  ) {}
}

// Millions of line items across many orders share the same handful of DiscountRule instances:
const summerSale = DiscountRuleFactory.get("SUMMER10", "Summer Sale 10% Off", 10);
const item1 = new OrderLineItem("SKU-1", 2, summerSale);
const item2 = new OrderLineItem("SKU-2", 1, summerSale); // same DiscountRule instance reused
```

## When to use
- The application must create a very large number of similar objects, and that volume is causing real memory pressure
- Most of each object's state can be made extrinsic (context-dependent) while a smaller shared portion can be factored out and made intrinsic

## When NOT to use / pitfalls
- This is purely a memory optimization — don't reach for it unless memory consumption is a measured, real problem; it adds real complexity for no behavioral benefit otherwise
- Splitting state into intrinsic/extrinsic and routing everything through a factory obscures the object model and can confuse future readers
- Recomputing/passing extrinsic state on every call can trade memory savings for extra CPU work — verify that trade is actually worth it
- Rarely relevant in typical CRUD backend/web code where object counts are in the thousands, not millions; far more common in games, rendering engines, or very large in-memory datasets

## Relations to other patterns
- **Composite** trees often share leaf nodes implemented as Flyweights
- Differs from **Singleton**: Flyweight allows many shared instances (keyed by intrinsic state) and those instances are meant to be immutable, whereas Singleton allows exactly one instance which may be mutable
- Contrasted with **Facade**: Flyweight is about creating many small shared objects efficiently; Facade is about representing one whole subsystem behind a simple interface
