# Open/Closed Principle (OCP)

## Deeper explanation

"Software entities should be open for extension, but closed for modification." Once a unit
of code is written, tested, and deployed, adding new behavior should not require editing
that unit's existing, working code — it should be possible to add a new implementation
alongside it. This matters because every edit to already-tested code risks a regression in
behavior that used to work, and the more call sites/branches a change touches, the higher
that risk.

The principle does not mean "never modify anything." It means: design the seams where
variation is *expected* (payment methods, discount types, shipping strategies, notification
channels...) so that new variants are additive — a new class/module/registration — rather
than an edit to a shared conditional. Achieving this typically relies on polymorphism
(interfaces + implementations), the Strategy pattern, or a registry/plugin mechanism.

OCP is a forward-looking principle: it only pays off where new variants are actually likely.
Applying it to something that has exactly one implementation and no realistic second one is
premature (see `anti-patterns.md`).

## Before (violates OCP)

```ts
// discount.ts — every new discount type requires editing this function
type DiscountType = "percentage" | "flatAmount" | "buyOneGetOne";

function applyDiscount(type: DiscountType, price: number, param: number): number {
  if (type === "percentage") {
    return price * (1 - param / 100);
  } else if (type === "flatAmount") {
    return Math.max(0, price - param);
  } else if (type === "buyOneGetOne") {
    return price / 2;
  }
  // Adding "seasonalBundle" means editing this function, retesting all branches,
  // and hoping nothing else depended on exhaustiveness of DiscountType elsewhere.
  throw new Error(`Unknown discount type: ${type}`);
}
```

Every new promotion type means editing a function that is already covered by tests for the
existing types, and the same `if/else` chain tends to get duplicated wherever discount type
is checked (e.g., in a receipt formatter, in an admin UI).

## After (satisfies OCP)

```ts
// discount.ts — new discount types are added, not edited in
export interface Discount {
  apply(price: number): number;
}

export class PercentageDiscount implements Discount {
  constructor(private readonly percent: number) {}
  apply(price: number): number {
    return price * (1 - this.percent / 100);
  }
}

export class FlatAmountDiscount implements Discount {
  constructor(private readonly amount: number) {}
  apply(price: number): number {
    return Math.max(0, price - this.amount);
  }
}

export class BuyOneGetOneDiscount implements Discount {
  apply(price: number): number {
    return price / 2;
  }
}

// Adding a new promotion is a new file; applyDiscount never changes.
export class SeasonalBundleDiscount implements Discount {
  constructor(private readonly bundlePrice: number) {}
  apply(price: number): number {
    return Math.min(price, this.bundlePrice);
  }
}

function applyDiscount(discount: Discount, price: number): number {
  return discount.apply(price);
}
```

Existing, tested `Discount` implementations are never touched when a new promotion type is
introduced; only a new class is added and wired up (e.g., via a lookup map or DI
registration) at the composition point.

## Common real-world scenarios

- **Payment processors**: `if (method === 'card') ... else if (method === 'paypal') ...`
  scattered across checkout code — fixed with a `PaymentStrategy` interface per method.
- **Notification channels**: email vs. SMS vs. push notifications handled by branching
  inside one `sendNotification` function instead of one implementation per channel.
- **Report/export formats**: CSV vs. PDF vs. JSON export logic crammed into one function
  with format-checking branches.
- **Feature flags / rollout logic**: conditional business logic keyed off flag names,
  copy-pasted at every call site instead of behind a strategy chosen once at the boundary.
- **Validation rule engines**: a giant `validate()` function with a growing list of
  `if (rule === ...)` — better served by a list of `Rule` objects each implementing a
  common `validate(input)` interface, iterated over.

## Interaction with other principles

- OCP is usually implemented *through* **DIP**: the code that varies depends on an
  abstraction, and concrete strategies are the "details" plugged in from outside.
- OCP relies on **LSP**: extension only stays safe if every new implementation of the shared
  interface is truly substitutable for the others — an implementation that secretly behaves
  differently defeats the safety OCP is meant to provide.
- OCP can conflict with simplicity when the variation isn't real: if there are only ever
  two fixed cases and no third is coming, a plain `if/else` is clearer and cheaper than an
  interface with two implementations. Don't build the extension point until a second real
  variant justifies it (rule of three: wait until you're about to write a third case before
  abstracting).
