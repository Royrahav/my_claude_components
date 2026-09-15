# Composite

## Intent
Compose objects into tree structures to represent part-whole hierarchies, and let clients treat individual objects and compositions of objects uniformly through a shared interface.

## Also known as
Object Tree

## Problem
Some domains are naturally tree-shaped: a product catalog with categories containing subcategories and products, a filesystem, an order made of items and bundles-of-items. Code that must process such a structure ends up full of type checks — "is this a leaf or a container?" — with different handling paths, making traversal and aggregation (e.g. summing a total price) awkward and hard to extend.

## Solution
Define one common interface implemented by both leaf objects and container objects. A container implements the interface by delegating to (and aggregating results from) its children, each of which may itself be a leaf or another container. Client code calls the same method on the root and lets the recursion handle the rest, never needing to know whether it's talking to a leaf or a subtree.

## Structure
- **Component** — common interface declaring operations for both simple and complex elements (and often optional child-management methods)
- **Leaf** — a basic element with no children; implements Component operations directly
- **Composite** (Container) — holds a list of child Components; implements operations by delegating to children and aggregating results
- **Client** — interacts only through the Component interface

## Code example
```typescript
interface CatalogNode {
  getTotalPriceCents(): number;
}

class ProductLeaf implements CatalogNode {
  constructor(private priceCents: number, private qty: number) {}
  getTotalPriceCents(): number {
    return this.priceCents * this.qty;
  }
}

class CategoryBundle implements CatalogNode {
  private children: CatalogNode[] = [];

  add(node: CatalogNode): void {
    this.children.push(node);
  }

  getTotalPriceCents(): number {
    return this.children.reduce((sum, child) => sum + child.getTotalPriceCents(), 0);
  }
}

// Build an arbitrarily nested tree of bundles and products...
const accessoryBundle = new CategoryBundle();
accessoryBundle.add(new ProductLeaf(1500, 2));
accessoryBundle.add(new ProductLeaf(500, 1));

const cart = new CategoryBundle();
cart.add(new ProductLeaf(9999, 1));
cart.add(accessoryBundle); // a bundle nested inside another container

// ...and the client calls one method regardless of nesting depth:
console.log(cart.getTotalPriceCents());
```

## When to use
- The core domain model is naturally a tree (hierarchies, nested groupings, recursive structures)
- Client code should be able to treat a single item and a group of items identically, without branching on type

## When NOT to use / pitfalls
- Forcing a uniform interface across leaves and containers can push toward an overly generic interface with no-op or throwing methods on leaves (e.g. `add()` making no sense on a Product) — a sign the abstraction is being stretched too far
- Not worth it for flat, non-hierarchical collections — a plain array/list is simpler
- Deep or unbounded trees can make debugging and reasoning about aggregate operations (like total price) harder to trace than explicit iteration

## Relations to other patterns
- **Builder** can construct Composite trees step by step
- **Iterator** and **Visitor** are commonly used to traverse or apply operations across a Composite tree
- **Chain of Responsibility** is often implemented over an object tree, where leaves pass requests up through their parent chain
- **Flyweight** can be used to share leaf nodes that are identical across many places in the tree
- Similar structure to **Decorator**, but Decorator wraps a single child and adds behavior, while Composite aggregates results across many children
