# Strategy

## Intent
Define a family of interchangeable algorithms, encapsulate each one in its own class behind a common interface, and let a context object use any of them interchangeably at runtime.

## Also known as
(none commonly used)

## Problem
A class that needs to support several variants of an algorithm (e.g. different shipping-cost calculation methods, different route-finding strategies) often accumulates a large conditional block selecting between them inline. Every new variant makes the class bigger and riskier to change — a bug fix to one algorithm variant risks breaking the conditional logic for the others, and the class violates single-responsibility by owning every variant's implementation itself.

## Solution
Extract each algorithm variant into its own class implementing a shared Strategy interface. The context class holds a reference to a Strategy and delegates the algorithm-specific work to it, remaining ignorant of which concrete strategy it holds. The concrete strategy to use is chosen and injected by the client — often at construction time, sometimes swapped at runtime — so adding a new algorithm variant means adding a new Strategy class, not modifying the context.

## Structure
- **Context** — holds a reference to a Strategy and delegates algorithm-specific work to it via the Strategy interface
- **Strategy** (interface) — declares the method(s) common to all algorithm variants
- **ConcreteStrategies** — each implements one specific algorithm variant
- **Client** — selects and constructs the appropriate concrete strategy and hands it to the context

## Code example
```typescript
interface ShippingStrategy {
  calculate(weightKg: number, distanceKm: number): number; // returns cost in cents
}

class StandardShipping implements ShippingStrategy {
  calculate(weightKg: number, distanceKm: number) {
    return Math.round(weightKg * 50 + distanceKm * 2);
  }
}

class ExpressShipping implements ShippingStrategy {
  calculate(weightKg: number, distanceKm: number) {
    return Math.round(weightKg * 120 + distanceKm * 5);
  }
}

class FreezerShipping implements ShippingStrategy {
  calculate(weightKg: number, distanceKm: number) {
    return Math.round(weightKg * 200 + distanceKm * 8 + 500); // flat refrigeration fee
  }
}

class ShippingCalculator {
  constructor(private strategy: ShippingStrategy) {}

  setStrategy(strategy: ShippingStrategy) { this.strategy = strategy; } // swappable at runtime
  quote(weightKg: number, distanceKm: number) {
    return this.strategy.calculate(weightKg, distanceKm);
  }
}

// Client picks the strategy based on order attributes, context stays agnostic:
const calculator = new ShippingCalculator(new StandardShipping());
calculator.quote(2, 100);
calculator.setStrategy(new ExpressShipping());
calculator.quote(2, 100);
```
In TypeScript, a plain object of functions or a `Record<string, (...) => T>` lookup often achieves the same swap-by-key behavior with less class ceremony when the strategies are stateless.

## When to use
- A context needs to switch between multiple interchangeable algorithm variants, potentially at runtime
- A class is accumulating conditional branches selecting between algorithm variants and needs to isolate each one to keep it maintainable
- You want to unit-test each algorithm variant in isolation from the class that uses it

## When NOT to use / pitfalls
- If there's genuinely only one implementation and no second one on the horizon, adding a Strategy interface "for future flexibility" is speculative complexity — don't add it "just in case"; wait until a second variant is actually needed
- Clients must understand the differences between strategies to choose correctly, which pushes some complexity outward rather than eliminating it
- In languages/codebases with first-class functions (TypeScript included), a simple function parameter or a lookup map is often a lighter-weight way to achieve the same interchangeability than a full class hierarchy

## Relations to other patterns
- **Bridge**, **State**, and **Adapter** share the composition-based structure but solve different problems
- **Command**: similar shape (both wrap behavior behind an interface passed around), but Command represents a *request to perform*, often deferred/queued/undoable, while Strategy represents an *interchangeable algorithm* a context repeatedly delegates to
- **Decorator** changes an object's external behavior/appearance; Strategy changes its internal algorithm
- **Template Method** achieves similar variability via inheritance and is static (compile-time); Strategy achieves it via composition and is dynamic (can change at runtime)
- **State** can be seen as Strategy extended to allow the swappable objects to trigger transitions between each other
