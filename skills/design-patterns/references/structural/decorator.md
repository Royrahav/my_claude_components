# Decorator

## Intent
Attach new behavior to an individual object dynamically, by wrapping it in a decorator object that implements the same interface, without affecting other instances of the same class.

## Also known as
Wrapper

## Problem
You want to add behavior to objects (extra logging, caching, compression, validation) but subclassing every combination of behaviors leads to a combinatorial explosion — e.g. a notification system needing Email, SMS, Email+SMS, Email+Slack, Email+SMS+Slack requires a subclass per combination if done through inheritance. Behavior also often needs to be added or removed at runtime, which static subclassing can't do at all.

## Solution
Wrap the original object in one or more decorator objects, each implementing the same interface as the object they wrap and holding a reference to it. Each decorator does its own work, then delegates the call to the wrapped object (before and/or after its own logic). Because decorators share the wrapped object's interface, they can be stacked in any combination, and the client code interacting with the outermost wrapper doesn't need to know how many layers are underneath.

## Structure
- **Component** (interface) — common interface for wrapped objects and decorators
- **ConcreteComponent** — the base object with default behavior
- **BaseDecorator** — implements Component, holds a reference to a wrapped Component, delegates all calls to it
- **ConcreteDecorators** — override methods to add behavior before/after delegating to the wrapped object
- **Client** — composes decorators around a component as needed

## Code example
```typescript
interface OrderPricer {
  getTotalCents(): number;
}

class BaseOrderPricer implements OrderPricer {
  constructor(private subtotalCents: number) {}
  getTotalCents(): number {
    return this.subtotalCents;
  }
}

abstract class PricerDecorator implements OrderPricer {
  constructor(protected wrapped: OrderPricer) {}
  getTotalCents(): number {
    return this.wrapped.getTotalCents();
  }
}

class WithExpressShippingFee extends PricerDecorator {
  getTotalCents(): number {
    return super.getTotalCents() + 999;
  }
}

class WithLoyaltyDiscount extends PricerDecorator {
  constructor(wrapped: OrderPricer, private percentOff: number) {
    super(wrapped);
  }
  getTotalCents(): number {
    const base = super.getTotalCents();
    return Math.round(base * (1 - this.percentOff / 100));
  }
}

// Stack decorators in whatever combination the order needs, decided at runtime:
let pricer: OrderPricer = new BaseOrderPricer(5000);
pricer = new WithExpressShippingFee(pricer);
pricer = new WithLoyaltyDiscount(pricer, 10);

console.log(pricer.getTotalCents()); // (5000 + 999) * 0.9, rounded
```

## When to use
- You need to add responsibilities to individual objects at runtime, without affecting other instances of the same class
- Extending via inheritance is impossible (sealed/final classes) or would require an impractical number of subclasses for each combination
- Cross-cutting concerns (logging, caching, retry, compression) need to be layered onto core behavior in flexible combinations

## When NOT to use / pitfalls
- Removing one specific decorator from the middle of an existing stack is awkward — decorators are easy to add, hard to selectively remove
- Behavior can become order-dependent in subtle ways (e.g. compress-then-encrypt vs encrypt-then-compress produce different results) — stack order matters and isn't always obvious from the call site
- Deeply stacked decorators make debugging harder (many thin layers to step through); don't stack decorators for behavior that's simpler as one function
- If there's only ever one fixed combination of behaviors, just write one class — don't build a decorator stack for a combination that never varies

## Relations to other patterns
- **Adapter** changes an object's interface; Decorator keeps the same interface and extends behavior
- **Proxy** has an identical structure to Decorator, but Proxy manages the lifecycle of the object it wraps (e.g. lazy-loads it); Decorator's wrapped object is always supplied and controlled by the client
- **Chain of Responsibility** looks similar but can stop the chain; decorators always delegate through
- **Composite** also wraps recursively, but Composite aggregates results across many children while Decorator adds behavior around a single wrapped object
- **Strategy** changes an object's internal algorithm ("guts"); Decorator changes its external behavior/"skin"
