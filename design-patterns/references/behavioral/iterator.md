# Iterator

## Intent
Provide a way to traverse the elements of a collection sequentially without exposing its underlying representation (array, tree, linked list, graph, etc).

## Also known as
(none commonly used)

## Problem
Different collections are backed by very different internal structures, and traversal logic (how to get "the next element") differs accordingly. If client code has to know a collection's internal structure to iterate it, that code becomes coupled to the implementation and breaks if the structure changes. It also becomes impossible to support multiple simultaneous or alternative traversal orders (e.g. breadth-first vs depth-first over the same tree) without polluting the collection class itself with traversal-specific methods.

## Solution
Extract traversal behavior into a separate iterator object implementing a common interface (typically "has next?" / "get next"). Each iterator tracks its own position independently, so multiple iterators can traverse the same collection concurrently without interfering with each other. The collection exposes a method to create a compatible iterator; client code works only through the iterator interface, unaware of the collection's internal structure.

In modern TypeScript/JavaScript, this pattern is largely built into the language via the `Iterable`/`Iterator` protocol and generators (`function*`), which is the idiomatic way to implement it.

## Structure
- **Iterator** (interface) — declares traversal operations (e.g. `next()`, `hasNext()`, or the native `Symbol.iterator` protocol)
- **ConcreteIterator** — implements traversal for one specific collection/order, tracking its own current position
- **Collection (Iterable)** — declares a method returning a compatible iterator
- **ConcreteCollection** — returns an iterator instance appropriate to its internal structure
- **Client** — consumes elements through the Iterator interface, or a `for...of` loop over an Iterable

## Code example
```typescript
class OrderHistory implements Iterable<string> {
  private orderIds: string[] = [];

  add(orderId: string) { this.orderIds.push(orderId); }

  // Native iterator protocol — enables `for...of` and spread over OrderHistory directly
  [Symbol.iterator](): Iterator<string> {
    let index = 0;
    const orderIds = this.orderIds;
    return {
      next(): IteratorResult<string> {
        if (index < orderIds.length) {
          return { value: orderIds[index++], done: false };
        }
        return { value: undefined, done: true };
      },
    };
  }

  // A second, differently-ordered iterator, without changing the collection's storage
  *reverseIterator(): Generator<string> {
    for (let i = this.orderIds.length - 1; i >= 0; i--) {
      yield this.orderIds[i];
    }
  }
}

const history = new OrderHistory();
history.add("order-1");
history.add("order-2");

for (const id of history) console.log(id);          // order-1, order-2
for (const id of history.reverseIterator()) console.log(id); // order-2, order-1
```

## When to use
- A collection has a complex internal structure that client code shouldn't need to know about to traverse it
- You need multiple simultaneous or alternative traversal strategies over the same collection
- You want to reduce duplicated traversal logic scattered across the codebase

## When NOT to use / pitfalls
- For a plain array or simple collection, native `for...of`, `.map()`, `.filter()`, etc. already provide this — don't hand-roll an Iterator class where the built-in protocol suffices
- Custom iterator objects can be less efficient than direct indexed access for structures that support it (e.g. random-access arrays) — don't add iterator indirection where direct access is simpler and just as safe
- Overkill when the collection's structure is simple and unlikely to change

## Relations to other patterns
- **Composite** trees are commonly traversed via an Iterator
- **Factory Method** can be used by a collection to return different iterator types
- **Memento** is sometimes used alongside Iterator to capture/restore iteration position
- **Visitor** is often combined with Iterator to apply operations while traversing complex structures
