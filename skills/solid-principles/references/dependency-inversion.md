# Dependency Inversion Principle (DIP)

## Deeper explanation

"High-level modules should not depend on low-level modules; both should depend on
abstractions. Abstractions should not depend on details; details should depend on
abstractions." High-level modules encode business/domain policy (what the application does
and why); low-level modules are implementation details (which database, which HTTP client,
which vendor SDK, which filesystem). Naively, business logic ends up importing and
instantiating concrete infrastructure classes directly, which means:

- The direction of source-code dependency runs from policy → detail, so a detail change
  (swap databases, swap payment vendor) forces edits in policy code.
- Business logic can't be unit-tested without the real infrastructure (or heavy mocking of
  concrete classes/modules), because there's no seam to substitute a fake.

DIP "inverts" this: the high-level module defines an abstraction (an interface) expressing
what it needs, in its own terms. The low-level module implements that interface. The
concrete wiring — which implementation gets used — happens at a composition point outside
both (e.g., in `main.ts`, a DI container, or a factory at the application boundary),
typically via constructor injection. Note DIP is not "always use a DI framework" — it's
about the *direction* of the dependency; passing a concrete instance through a constructor
that's typed as an interface already satisfies it.

## Before (violates DIP)

```ts
// orderService.ts — domain logic directly coupled to a concrete vendor SDK
import Stripe from "stripe";

class OrderService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2023-10-16" });

  async chargeCustomer(orderId: string, amountCents: number, customerId: string): Promise<void> {
    // Business logic (retry policy, order status update) tangled with a concrete SDK call
    await this.stripe.charges.create({
      amount: amountCents,
      currency: "usd",
      customer: customerId,
    });
    console.log(`Order ${orderId} charged.`);
  }
}
```

To unit-test `chargeCustomer`'s order-status/retry logic, tests must mock the `Stripe`
module globally (e.g. `jest.mock('stripe')`) or hit Stripe's real API. Switching payment
vendors means editing `OrderService` directly, and every other class that also
`new Stripe(...)`s independently repeats the same coupling.

## After (satisfies DIP)

```ts
// paymentGateway.ts — abstraction owned by the domain layer
export interface PaymentGateway {
  charge(amountCents: number, customerId: string): Promise<{ transactionId: string }>;
}

// stripePaymentGateway.ts — concrete detail, depends on the abstraction (implements it)
import Stripe from "stripe";
import { PaymentGateway } from "./paymentGateway";

export class StripePaymentGateway implements PaymentGateway {
  private stripe: Stripe;

  constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey, { apiVersion: "2023-10-16" });
  }

  async charge(amountCents: number, customerId: string): Promise<{ transactionId: string }> {
    const charge = await this.stripe.charges.create({
      amount: amountCents,
      currency: "usd",
      customer: customerId,
    });
    return { transactionId: charge.id };
  }
}

// orderService.ts — high-level module depends only on the abstraction
import { PaymentGateway } from "./paymentGateway";

export class OrderService {
  constructor(private readonly paymentGateway: PaymentGateway) {}

  async chargeCustomer(orderId: string, amountCents: number, customerId: string): Promise<void> {
    const { transactionId } = await this.paymentGateway.charge(amountCents, customerId);
    console.log(`Order ${orderId} charged, transaction ${transactionId}.`);
  }
}

// main.ts (or a DI container) — composition point wires the concrete detail in
const paymentGateway = new StripePaymentGateway(process.env.STRIPE_SECRET_KEY!);
const orderService = new OrderService(paymentGateway);
```

```ts
// orderService.test.ts — trivial to test with a fake, no network/mocking framework needed
class FakePaymentGateway implements PaymentGateway {
  async charge(amountCents: number, customerId: string) {
    return { transactionId: "fake-txn-123" };
  }
}

const service = new OrderService(new FakePaymentGateway());
await service.chargeCustomer("order-1", 1999, "cust-1"); // no real Stripe call
```

Swapping to a different payment vendor now means writing a new `PaymentGateway`
implementation and changing one line at the composition point — `OrderService` is untouched.

## Common real-world scenarios

- **Direct SDK instantiation in business logic**: `new Stripe(...)`, `new S3Client(...)`,
  `new Twilio(...)` called inside domain/service classes instead of injected as an interface.
- **Direct ORM/query builder use in domain code**: domain logic importing a specific ORM's
  model classes or query builder directly, rather than depending on a repository interface
  the domain owns.
- **Hard-coded `Date.now()` / `new Date()`, `Math.random()`, or global singletons** inside
  business logic, making time- or randomness-dependent behavior untestable without a seam
  (a `Clock` or `RandomSource` abstraction fixes this the same way).
- **Static/global module usage** (e.g., a globally imported logger or config singleton used
  directly everywhere) making substitution for tests awkward without module-level mocking.
- **LLM/AI provider coupling** (relevant for AI-assisted apps): business logic calling a
  specific model provider's SDK directly instead of depending on an `AIClient`/`ChatModel`
  interface, which makes swapping providers or testing conversation logic without live API
  calls unnecessarily hard.

## Interaction with other principles

- DIP is the mechanism that typically *implements* **OCP**: new implementations plug in
  behind the abstraction without editing the high-level module.
- DIP depends on **ISP** for the abstractions to be well-shaped: if the interface the domain
  depends on is a fat interface mirroring the vendor SDK's entire surface, DIP's testing and
  swappability benefits are diluted — keep the owned interface minimal and expressed in
  domain terms (`charge`, not `stripe.charges.create`).
- DIP does not mean every concrete class needs an interface. Apply it where there's a real
  seam to protect (an actual external system, a genuinely swappable vendor, or a unit-test
  boundary that needs a fake). Introducing an interface with exactly one implementation and
  no test double in sight is speculative generality — see `anti-patterns.md`.
