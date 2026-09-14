# Adapter

## Intent
Convert the interface of a class into another interface clients expect, allowing otherwise-incompatible interfaces to collaborate.

## Also known as
Wrapper

## Problem
Existing client code expects one interface, but a component you need to use (a third-party library, a legacy module, an external API response shape) exposes an incompatible one. You can't or shouldn't modify the incompatible component's source (it's vendored, or changing it would break its own consumers), and rewriting the client to speak the foreign interface everywhere would spread that coupling throughout the codebase.

## Solution
Create an adapter class that implements the interface the client already expects, and internally wraps/delegates to the incompatible object, translating calls and data shapes as needed. The client only ever talks to the adapter through the familiar interface.

## Structure
Two common implementations:
- **Object Adapter** (composition-based, works in any OO language): the adapter implements the client's expected interface and holds a reference to the wrapped (adaptee) instance, translating calls to it
- **Class Adapter** (inheritance-based, needs multiple inheritance — not directly applicable in TypeScript/JS)

Participants: **Client**, **Client Interface** (what client expects), **Service/Adaptee** (the incompatible existing class), **Adapter** (implements Client Interface, wraps Service)

## Code example
```typescript
// The interface our billing code expects everywhere:
interface PaymentProcessor {
  charge(amountCents: number, currency: string): Promise<{ transactionId: string }>;
}

// A third-party SDK with an incompatible shape we don't control:
class LegacyPaymentGatewaySDK {
  async submitPayment(input: { amount: string; curr: string }): Promise<{ ref: string }> {
    return { ref: "legacy-ref-123" };
  }
}

// Adapter translates between the two:
class LegacyGatewayAdapter implements PaymentProcessor {
  constructor(private readonly legacy: LegacyPaymentGatewaySDK) {}

  async charge(amountCents: number, currency: string) {
    const result = await this.legacy.submitPayment({
      amount: (amountCents / 100).toFixed(2),
      curr: currency,
    });
    return { transactionId: result.ref };
  }
}

// Client code only ever depends on PaymentProcessor:
async function checkout(processor: PaymentProcessor) {
  return processor.charge(2599, "USD");
}

checkout(new LegacyGatewayAdapter(new LegacyPaymentGatewaySDK()));
```

## When to use
- Integrating a third-party library, legacy module, or external API whose interface doesn't match what your code expects
- You want to reuse an existing class but its interface is incompatible with the rest of your abstractions
- Wrapping several similar-but-incompatible SDKs (e.g. multiple payment providers) behind one common interface your application code uses

## When NOT to use / pitfalls
- If you control the incompatible class's source and changing it is safe, just change it — an adapter adds indirection to solve a problem you could remove directly
- Don't create adapters "just in case" for interfaces that already match; there's nothing to adapt
- A pile of adapters wrapping unrelated things can be a signal the app should standardize on one internal interface further upstream

## Relations to other patterns
- **Bridge** is designed upfront to let two hierarchies evolve independently; Adapter is typically retrofitted after the fact onto an already-incompatible interface
- **Decorator** preserves/extends the same interface it wraps; Adapter changes the interface entirely
- **Proxy** keeps the exact same interface as what it wraps; Adapter deliberately provides a different one
- **Facade** simplifies access to an entire subsystem; Adapter typically wraps a single object to match one specific interface
