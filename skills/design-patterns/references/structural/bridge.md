# Bridge

## Intent
Split a class (or closely related set of classes) into two independent hierarchies — an abstraction and an implementation — connected by composition, so each can vary and be extended independently.

## Also known as
(none commonly used)

## Problem
When a class needs to vary along two independent dimensions, subclassing along both explodes combinatorially. Classic example: shapes (Circle, Square) that each need to render on multiple platforms/renderers (SVG, Canvas) — subclassing gives `SvgCircle`, `CanvasCircle`, `SvgSquare`, `CanvasSquare`, and every new shape or renderer doubles the class count.

## Solution
Instead of inheriting both dimensions into one hierarchy, pick one dimension to extract into its own hierarchy (the "implementation") and have the other dimension (the "abstraction") hold a reference to it via composition. New shapes and new renderers can then be added independently — a `Triangle` doesn't need an `SvgTriangle` and `CanvasTriangle`, it just holds any `Renderer`.

## Structure
- **Abstraction** — high-level control object exposing the operations clients call; delegates the actual work to an Implementation object it holds a reference to
- **Refined Abstraction** — variant of the abstraction with extra/different control logic, still delegates to Implementation
- **Implementation** (interface) — declares primitive operations the Abstraction can call
- **Concrete Implementations** — platform/backend-specific implementations of those primitives
- **Client** — configures an Abstraction with a specific Implementation

## Code example
```typescript
// Implementation hierarchy: how to actually deliver a message
interface MessageChannel {
  deliver(to: string, body: string): Promise<void>;
}
class EmailChannel implements MessageChannel {
  async deliver(to: string, body: string) { /* SMTP send */ }
}
class SmsChannel implements MessageChannel {
  async deliver(to: string, body: string) { /* SMS gateway send */ }
}

// Abstraction hierarchy: what kind of notification is being sent
class Notification {
  constructor(protected channel: MessageChannel) {}
  async send(to: string, message: string) {
    await this.channel.deliver(to, message);
  }
}
class UrgentNotification extends Notification {
  async send(to: string, message: string) {
    await this.channel.deliver(to, `URGENT: ${message}`);
    // e.g. could also retry or escalate here, independent of the channel used
  }
}

// Any Notification variant can pair with any channel implementation:
new Notification(new EmailChannel()).send("a@b.com", "Order shipped");
new UrgentNotification(new SmsChannel()).send("+1555...", "Payment failed");
```

## When to use
- A class needs to vary along two (or more) independent dimensions, and subclassing across both would multiply classes
- You need to switch an implementation at runtime without touching the abstraction's client code
- You're designing upfront for extension in both directions (as opposed to Adapter, which retrofits after the fact)

## When NOT to use / pitfalls
- If a class only ever varies along one dimension, or the "second dimension" is speculative and not currently needed, this adds unnecessary indirection — don't build a Bridge for a hierarchy that isn't exploding yet
- Makes a cohesive class harder to read by splitting it into two coupled-but-separate hierarchies; only worth it once the combinatorial cost is real

## Relations to other patterns
- Differs from **Adapter**: Bridge is designed upfront for independent evolution; Adapter is applied after the fact to reconcile incompatible interfaces
- Structurally similar to **State** and **Strategy** (all use composition/delegation) but solves a different problem (structural decoupling vs. behavior swapping)
- Can be combined with **Abstract Factory** to have the factory decide which concrete Implementation to wire into an Abstraction
- A **Builder** Director can act as an abstraction while builders act as implementations
