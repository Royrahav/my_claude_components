# Abstract Factory

## Intent
Produce families of related objects without specifying their concrete classes, guaranteeing that products created together are compatible with each other.

## Also known as
(none commonly used)

## Problem
An application needs to create sets of related objects that must match each other — e.g. a checkout flow that needs a `PaymentGateway`, `InvoiceFormatter`, and `TaxCalculator` that are all consistent with one "region" (US vs EU vs UK). If these are instantiated independently and ad hoc, it's easy to accidentally mix an EU tax calculator with a US invoice formatter. Adding a new region variant means hunting down every place a member of the family is constructed.

## Solution
Declare an interface for each distinct product in the family, then declare an Abstract Factory interface with one creation method per product. Each concrete factory (e.g. `USCommerceFactory`, `EUCommerceFactory`) implements all the creation methods and is guaranteed to produce a mutually compatible set. Client code is configured with (or injected) one concrete factory instance and thereafter only calls the abstract factory/product interfaces.

## Structure
- **AbstractProductA/B/...** — one interface per distinct product type in the family
- **ConcreteProductA1/A2, B1/B2, ...** — variant implementations, grouped by "family" (1 = family one, 2 = family two)
- **AbstractFactory** — interface declaring a creation method per abstract product
- **ConcreteFactory1/2** — each produces only the products belonging to one family
- **Client** — works exclusively through AbstractFactory and AbstractProduct interfaces

## Code example
```typescript
interface PaymentGateway { charge(cents: number): Promise<string>; }
interface TaxCalculator { calculate(subtotalCents: number): number; }

class StripeUSGateway implements PaymentGateway {
  async charge(cents: number) { return "stripe-us-charge-id"; }
}
class USSalesTaxCalculator implements TaxCalculator {
  calculate(subtotalCents: number) { return Math.round(subtotalCents * 0.0725); }
}

class AdyenEUGateway implements PaymentGateway {
  async charge(cents: number) { return "adyen-eu-charge-id"; }
}
class EUVatCalculator implements TaxCalculator {
  calculate(subtotalCents: number) { return Math.round(subtotalCents * 0.20); }
}

interface CommerceFactory {
  createPaymentGateway(): PaymentGateway;
  createTaxCalculator(): TaxCalculator;
}

class USCommerceFactory implements CommerceFactory {
  createPaymentGateway() { return new StripeUSGateway(); }
  createTaxCalculator() { return new USSalesTaxCalculator(); }
}

class EUCommerceFactory implements CommerceFactory {
  createPaymentGateway() { return new AdyenEUGateway(); }
  createTaxCalculator() { return new EUVatCalculator(); }
}

// Chosen once, e.g. at request/session start based on region:
function checkout(factory: CommerceFactory, subtotalCents: number) {
  const tax = factory.createTaxCalculator().calculate(subtotalCents);
  return factory.createPaymentGateway().charge(subtotalCents + tax);
}
```

## When to use
- Your code must work with multiple families of related products, and the family must stay internally consistent
- The concrete classes are unknown ahead of time (plugin systems, multi-tenant/region config)
- You notice many independent Factory Methods being wired together by hand — consolidate them

## When NOT to use / pitfalls
- Only one product type exists, or products don't need to stay "matched" — plain Factory Method or DI is enough
- Adds a factory interface plus a concrete factory per family; for 2 products x 2 families this may be more indirection than it's worth versus just injecting the two dependencies directly
- Adding a new *product* (not just a new family) requires touching every concrete factory — a real maintenance cost

## Relations to other patterns
- Frequently built out of several **Factory Methods**
- **Builder** focuses on step-by-step construction of one complex object; Abstract Factory returns ready objects immediately
- Concrete factories are often implemented as **Singletons**
- Can be used as an alternative to **Facade** when the goal is to hide subsystem object creation
