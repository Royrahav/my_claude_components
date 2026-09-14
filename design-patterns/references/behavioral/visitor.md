# Visitor

## Intent
Separate an algorithm from the object structure it operates on, so new operations can be added to a class hierarchy without modifying the classes in it.

## Also known as
(implemented via the "Double Dispatch" technique)

## Problem
A hierarchy of related classes (e.g. different catalog node types: Product, Bundle, Category) sometimes needs new cross-cutting operations performed on it (export to XML, compute a report, validate pricing rules). Adding each new operation as a method on every class in the hierarchy pollutes those domain classes with unrelated concerns, risks breaking production code with every change, and means every new operation requires touching every existing class.

## Solution
Move each new operation into its own separate Visitor class, with one method per concrete element type it needs to handle (e.g. `visitProduct`, `visitBundle`). Each element class gets a single, stable `accept(visitor)` method that calls back into the appropriate visitor method for its own type — this "double dispatch" (the call goes through both the element's and the visitor's types) is what lets the correct overload run without type-checking or casting. Adding a new operation means adding a new Visitor class; the element classes themselves don't change.

## Structure
- **Visitor** (interface) — declares one visiting method per concrete element type in the hierarchy
- **ConcreteVisitor** — implements a specific operation across all element types
- **Element** (interface) — declares `accept(visitor)`
- **ConcreteElement** — implements `accept` by calling the matching method on the visitor, passing itself
- **Client** — traverses the object structure and calls `accept` on each element with the chosen visitor

## Code example
```typescript
interface CatalogVisitor {
  visitProduct(node: ProductNode): void;
  visitBundle(node: BundleNode): void;
}

interface CatalogElement {
  accept(visitor: CatalogVisitor): void;
}

class ProductNode implements CatalogElement {
  constructor(public sku: string, public priceCents: number) {}
  accept(visitor: CatalogVisitor) { visitor.visitProduct(this); }
}

class BundleNode implements CatalogElement {
  constructor(public name: string, public children: CatalogElement[]) {}
  accept(visitor: CatalogVisitor) { visitor.visitBundle(this); }
}

// New operation added without touching ProductNode/BundleNode at all:
class XmlExportVisitor implements CatalogVisitor {
  private xml = "";
  visitProduct(node: ProductNode) {
    this.xml += `<product sku="${node.sku}" price="${node.priceCents}"/>`;
  }
  visitBundle(node: BundleNode) {
    this.xml += `<bundle name="${node.name}">`;
    for (const child of node.children) child.accept(this); // recurse via double dispatch
    this.xml += `</bundle>`;
  }
  getXml() { return this.xml; }
}

const catalog = new BundleNode("Starter Pack", [new ProductNode("SKU-1", 999)]);
const exporter = new XmlExportVisitor();
catalog.accept(exporter);
console.log(exporter.getXml());
```

## When to use
- An object structure with several distinct element types needs new operations applied across it periodically, and modifying every element class each time is undesirable
- You want to gather related behavior for one operation into a single class rather than scattering fragments of it across every element class
- Some operations only make sense for a subset of element types and shouldn't pollute the base hierarchy

## When NOT to use / pitfalls
- Every time a new element type is added to the hierarchy, every existing Visitor implementation must be updated to handle it — this is the mirror-image cost of the flexibility it buys, and can be worse than the problem it solves if element types change often
- Visitors typically need public (or otherwise externally accessible) access to element data, which can force loosening encapsulation that would otherwise be private
- Adds meaningful indirection (double dispatch through two method calls) for what might be, for a single simple operation, just as clear as a regular method on each class — don't reach for Visitor for one-off operations that aren't going to multiply

## Relations to other patterns
- Can be thought of as a more powerful, structure-crossing version of **Command**, operating across heterogeneous element types instead of one receiver
- Frequently combined with **Composite**, visiting every node while traversing a tree
- Frequently combined with **Iterator** to drive the traversal that feeds elements to the visitor
