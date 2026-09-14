# Facade

## Intent
Provide a simplified, unified interface to a complex subsystem (a library, framework, or set of interdependent classes), so client code doesn't need to understand or coordinate the subsystem's internals directly.

## Also known as
(none commonly used)

## Problem
A subsystem — say, order checkout involving inventory reservation, payment authorization, tax calculation, shipping label creation, and confirmation email dispatch — has many classes with intricate initialization order and interdependencies. Client code that needs "checkout an order" ends up needing to know and correctly sequence all of that, tightly coupling every caller to subsystem internals and making the subsystem hard to change safely.

## Solution
Introduce a Facade class that exposes a small, purpose-built interface (e.g. `checkout(order)`) and internally coordinates the subsystem classes correctly. Client code depends only on the facade; the subsystem remains free to change internally as long as the facade's contract holds. The facade doesn't hide the subsystem entirely — advanced callers can still reach subsystem classes directly when needed — it just removes the need to for the common case.

## Structure
- **Facade** — knows which subsystem classes to call and in what order to satisfy a client request; contains no business logic of its own beyond coordination
- **Additional Facade** (optional) — a second facade to avoid one facade becoming a bloated "god object" when a subsystem has multiple unrelated use cases
- **Subsystem classes** — the complex set of collaborating classes, unaware the facade exists
- **Client** — talks to the facade instead of subsystem classes directly

## Code example
```typescript
class InventoryService {
  reserve(sku: string, qty: number) { /* ... */ }
}
class PaymentService {
  authorize(orderId: string, amountCents: number) { /* ... */ }
}
class ShippingService {
  createLabel(orderId: string) { /* ... */ }
}
class EmailService {
  sendConfirmation(orderId: string) { /* ... */ }
}

// Facade: one simple method hides the coordination of four subsystems
class CheckoutFacade {
  constructor(
    private inventory: InventoryService,
    private payments: PaymentService,
    private shipping: ShippingService,
    private email: EmailService,
  ) {}

  checkout(orderId: string, sku: string, qty: number, amountCents: number) {
    this.inventory.reserve(sku, qty);
    this.payments.authorize(orderId, amountCents);
    this.shipping.createLabel(orderId);
    this.email.sendConfirmation(orderId);
  }
}

// Client code, oblivious to the four collaborating services:
const checkout = new CheckoutFacade(
  new InventoryService(), new PaymentService(), new ShippingService(), new EmailService(),
);
checkout.checkout("order-123", "SKU-1", 1, 2599);
```

## When to use
- A subsystem is genuinely complex and most callers only need a small, common slice of its functionality
- You want to layer a system so each layer has one clear entry point, reducing coupling between layers
- You're wrapping a third-party library/framework and want to insulate the rest of the codebase from its API surface

## When NOT to use / pitfalls
- A facade that keeps growing to cover every possible use case turns into a "god object" coupled to everything — split into multiple, purpose-specific facades instead
- Don't add a facade in front of a subsystem that's already simple (one or two classes, one obvious call) — there's no complexity to hide
- A facade that becomes the *only* way to reach the subsystem can block legitimate advanced use cases; it should simplify the common path, not wall off the rest

## Relations to other patterns
- Differs from **Adapter**: Adapter changes a single object's interface to match what's expected; Facade simplifies access to a whole subsystem, and its interface generally doesn't match the subsystem's own
- **Abstract Factory** can be used as an alternative to Facade to hide subsystem object-creation logic specifically
- Facade objects often end up implemented as **Singletons** since one instance is normally enough
- Differs from **Mediator**: both centralize coordination, but Facade offers simplified *outward*-facing access, while Mediator centralizes communication *between* the subsystem's own internal components
