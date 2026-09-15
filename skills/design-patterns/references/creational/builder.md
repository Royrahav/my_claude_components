# Builder

## Intent
Construct complex objects step by step, so the same construction process can produce different representations of the object.

## Also known as
(none commonly used)

## Problem
An object needs many fields to construct, many of them optional, and initialization order or combination matters (e.g. building an `Order` with items, discounts, shipping method, gift wrap, notes). Two bad options emerge: a subclass for every combination (combinatorial explosion), or one constructor with a dozen optional parameters (a "telescoping constructor" that's error-prone and unreadable at call sites).

## Solution
Extract the construction steps into a separate Builder object with one method per settable piece, each returning the builder (or void) so steps can be called selectively and in a readable order. An optional Director encapsulates common construction recipes (e.g. `buildGiftOrder()`) for reuse. The client either drives the builder directly for one-off configurations, or hands the builder to a director for a named recipe.

## Structure
- **Builder** (interface) — declares construction steps common to all builders
- **ConcreteBuilder** — implements steps, holds the product under construction, and returns the finished product on demand
- **Product** — the resulting object; concrete builders need not share a base product type
- **Director** (optional) — knows the order of steps to build specific configurations
- **Client** — creates a builder (and optionally a director) and retrieves the finished product

## Code example
```typescript
interface OrderItem { sku: string; qty: number; }

class Order {
  items: OrderItem[] = [];
  giftWrapped = false;
  shippingMethod: "standard" | "express" = "standard";
  notes?: string;
}

class OrderBuilder {
  private order = new Order();

  addItem(sku: string, qty: number): this {
    this.order.items.push({ sku, qty });
    return this;
  }
  withGiftWrap(): this {
    this.order.giftWrapped = true;
    return this;
  }
  withExpressShipping(): this {
    this.order.shippingMethod = "express";
    return this;
  }
  withNotes(notes: string): this {
    this.order.notes = notes;
    return this;
  }
  build(): Order {
    return this.order;
  }
}

// Client drives the builder directly with only the steps it needs:
const order = new OrderBuilder()
  .addItem("SKU-1", 2)
  .withExpressShipping()
  .withGiftWrap()
  .build();

// Or a Director encapsulates a named recipe reused across the app:
class OrderRecipes {
  static giftOrder(builder: OrderBuilder, sku: string): Order {
    return builder.addItem(sku, 1).withGiftWrap().withExpressShipping().build();
  }
}
```
This "fluent builder" style (chained methods returning `this`) is the idiomatic TypeScript form.

## When to use
- An object has many optional parameters and a telescoping constructor would be unreadable
- The same step sequence should be able to produce different representations (e.g. build a `Order` and an `OrderConfirmationEmail` from the same director steps)
- Constructing a complex object/tree where steps may be skipped, reordered, or run recursively

## When NOT to use / pitfalls
- For objects with 2-3 required fields and no optional variability, a plain constructor or object literal is simpler
- Introduces an extra class (or more) per product — not worth it for simple DTOs
- If all fields are always required and always set together, a single validated constructor is more honest than a builder that allows incomplete intermediate states

## Relations to other patterns
- Many designs start with **Factory Method** and evolve into Builder as flexibility needs grow
- Unlike **Abstract Factory**, Builder returns the product only after all steps complete; Abstract Factory returns immediately
- Effective for constructing **Composite** trees step by step
- Can be combined with **Bridge**: Director plays the abstraction role, builders act as implementations
