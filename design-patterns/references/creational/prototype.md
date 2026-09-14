# Prototype

## Intent
Copy existing objects without making code depend on their concrete classes, by delegating the cloning logic to the objects themselves.

## Also known as
Clone

## Problem
Copying an object from outside is often impossible or unsafe: private fields aren't accessible, and even when they are, the copying code needs to know the concrete class — which reintroduces the coupling patterns like Factory Method try to avoid. This gets worse with objects that hold references to other objects or partially-initialized/expensive-to-recompute state.

## Solution
Give objects a common `clone()` method they implement themselves — since the method runs inside the class, it has full access to its own private state and can copy it directly, including deciding whether to deep- or shallow-copy nested objects. Client code calls `clone()` through a common interface without knowing the concrete class. A Prototype Registry can additionally hold a set of pre-configured prototype instances that are cloned instead of constructed from scratch.

## Structure
- **Prototype** (interface) — declares the cloning method
- **ConcretePrototype** — implements cloning, copying its own fields into a new instance
- **Client** — produces new objects by asking a prototype to clone itself, instead of calling `new`
- **Prototype Registry** (optional) — a lookup table of ready-to-clone prototypes by key

## Code example
```typescript
interface Cloneable<T> {
  clone(): T;
}

class ProductVariant implements Cloneable<ProductVariant> {
  constructor(
    public sku: string,
    public price: number,
    public attributes: Record<string, string>,
  ) {}

  clone(): ProductVariant {
    // deep-copy the nested attributes object so the clone is independent
    return new ProductVariant(this.sku, this.price, { ...this.attributes });
  }
}

// A base "template" variant configured once...
const baseTShirt = new ProductVariant("TSHIRT-BASE", 1999, { material: "cotton" });

// ...cloned and tweaked per size/color instead of rebuilt from scratch each time:
const redLarge = baseTShirt.clone();
redLarge.sku = "TSHIRT-RED-L";
redLarge.attributes.color = "red";
redLarge.attributes.size = "L";

// Prototype registry example:
class VariantRegistry {
  private prototypes = new Map<string, ProductVariant>();
  register(key: string, proto: ProductVariant) { this.prototypes.set(key, proto); }
  create(key: string): ProductVariant {
    const proto = this.prototypes.get(key);
    if (!proto) throw new Error(`Unknown prototype: ${key}`);
    return proto.clone();
  }
}
```

## When to use
- Code must copy objects whose concrete class shouldn't be a compile-time dependency (e.g. objects that arrived from a plugin or third-party API)
- You have many near-identical pre-configured objects and want to avoid a subclass or config path per variant — clone a configured prototype instead
- Object initialization is expensive and a cached "template" instance can be copied faster than rebuilt

## When NOT to use / pitfalls
- Objects with circular references or complex object graphs make correct deep-cloning tricky and error-prone
- In TypeScript/JS, plain object literals with spread (`{ ...obj }`) or `structuredClone()` already solve simple copying — only reach for the Prototype pattern's `clone()` method when copying needs class-specific logic (e.g. resetting an id, deep-copying only some fields)
- Don't use it just to avoid writing a constructor; that's not the problem it solves

## Relations to other patterns
- Alternative to **Factory Method** when the "recipe" for a new object is more easily expressed as "start from this configured instance" than as parameters
- Complements **Abstract Factory**, which can be implemented using prototypes instead of subclassing
- Related to **Memento**: both copy state, but Memento's copies are opaque snapshots for restoration, not editable new objects
- Prototype registries are often themselves **Singletons**
