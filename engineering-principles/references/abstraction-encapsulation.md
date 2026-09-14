# Abstraction and Encapsulation

Abstraction and encapsulation are frequently conflated but answer different questions:

- **Abstraction** — does the caller need to know the *mechanism*, or just the *concept*?
  ("Charge the customer" vs. "POST to `/v1/charges` with this exact header set and retry
  on 429.")
- **Encapsulation** — can the caller reach in and directly manipulate *state* in a way
  that breaks the object's invariants? ("Push directly onto `order.items`" vs. "call
  `order.addItem(item)`, which validates first.")

A leaky abstraction problem is about callers needing to understand *how* something works
internally to use it correctly. An encapsulation violation is about callers being able to
directly *mutate* internal state and put the object into an invalid configuration. Both
are fixed the same way in spirit — narrow the public surface to what's actually needed —
but they show up differently in code.

## Fixing a leaky abstraction

**Before — leaky.** A `PaymentGateway` abstraction exists, but callers still need to know
implementation details of the specific provider behind it to use it correctly: they must
manually construct a provider-specific idempotency key, know that amounts are in cents
for this provider, and handle a provider-specific error shape.

```ts
interface PaymentGateway {
  charge(params: {
    amountInCents: number;          // leaks that this provider wants cents, not dollars
    idempotencyKey: string;         // caller must know to generate this themselves
    stripeCustomerId: string;       // leaks the concrete provider's ID naming
  }): Promise<{ raw: unknown }>;    // leaks the provider's raw response shape
}

class StripeGateway implements PaymentGateway {
  async charge(params: { amountInCents: number; idempotencyKey: string; stripeCustomerId: string }) {
    const res = await stripeSdk.charges.create(
      { amount: params.amountInCents, customer: params.stripeCustomerId },
      { idempotencyKey: params.idempotencyKey },
    );
    return { raw: res };
  }
}

// Caller has to know Stripe-specific concerns to use a "generic" gateway:
async function checkout(customerId: string, amountDollars: number, gateway: PaymentGateway) {
  const key = crypto.randomUUID(); // caller shouldn't need to think about idempotency at all
  const result = await gateway.charge({
    amountInCents: Math.round(amountDollars * 100), // caller shouldn't do unit conversion
    idempotencyKey: key,
    stripeCustomerId: customerId,
  });
  if ((result.raw as any).status === 'failed') throw new Error('payment failed'); // parsing raw shape
}
```

If this "abstraction" were swapped for a different processor, every caller would break,
because callers are really coded against Stripe, just through an extra layer of
indirection that adds cost without adding safety.

**After — the interface exposes the concept, hides the mechanism:**

```ts
interface PaymentGateway {
  charge(customerId: string, amount: Money): Promise<ChargeResult>;
}

type ChargeResult = { status: 'succeeded' | 'failed'; chargeId: string };

class StripeGateway implements PaymentGateway {
  async charge(customerId: string, amount: Money): Promise<ChargeResult> {
    const idempotencyKey = crypto.randomUUID(); // generated internally, not a caller concern
    const res = await stripeSdk.charges.create(
      { amount: amount.toCents(), customer: customerId },
      { idempotencyKey },
    );
    return { status: res.status === 'succeeded' ? 'succeeded' : 'failed', chargeId: res.id };
  }
}

async function checkout(customerId: string, amount: Money, gateway: PaymentGateway) {
  const result = await gateway.charge(customerId, amount);
  if (result.status === 'failed') throw new Error('payment failed');
}
```

Now `checkout` only knows the concept (charge a customer some money, check success/
failure) and a different `PaymentGateway` implementation (a different processor, or a
fake for tests) can be swapped in with zero changes to `checkout`.

## Fixing an encapsulation violation

**Before — internal state exposed, invariant not enforced.** A `ShoppingCart`'s items and
running total are both public and independently mutable, so nothing stops them from
drifting out of sync:

```ts
class ShoppingCart {
  items: { sku: string; price: number; qty: number }[] = [];
  total: number = 0; // caller must remember to keep this in sync manually
}

// Any caller anywhere can do this and silently corrupt the cart:
const cart = new ShoppingCart();
cart.items.push({ sku: 'A1', price: 10, qty: 2 });
// forgot to update cart.total -> now total (0) doesn't match items (20)

cart.total = -50; // nothing stops an invalid total either
```

Every call site that touches the cart has to remember the invariant ("total must equal
the sum of items") itself, and every one is a chance to get it wrong.

**After — state is private, the invariant is enforced in one place:**

```ts
class ShoppingCart {
  private items: { sku: string; price: number; qty: number }[] = [];

  addItem(sku: string, price: number, qty: number): void {
    if (qty <= 0) throw new Error('qty must be positive');
    this.items.push({ sku, price, qty });
  }

  removeItem(sku: string): void {
    this.items = this.items.filter(i => i.sku !== sku);
  }

  get lineItems(): readonly { sku: string; price: number; qty: number }[] {
    return this.items; // read access is fine, no invariant risk
  }

  get total(): number {
    return this.items.reduce((sum, i) => sum + i.price * i.qty, 0); // always derived, never stale
  }
}

const cart = new ShoppingCart();
cart.addItem('A1', 10, 2);
cart.total; // always correct, can't be set to an invalid value directly
```

The invariant ("total is the sum of items") is now enforced by construction — it's
computed, not stored redundantly — and there is exactly one place (`addItem`) that
validates new entries, instead of every call site being responsible for correctness.

## Rule of thumb

When designing a class's public surface, ask two separate questions: "does this expose a
mechanism the caller shouldn't need to know?" (abstraction) and "does this let a caller
put me into an invalid state?" (encapsulation). Fix leaky abstraction by renaming/
reshaping the interface around the concept. Fix encapsulation violations by making
mutation go through validating methods and keeping read access open where it's harmless.
