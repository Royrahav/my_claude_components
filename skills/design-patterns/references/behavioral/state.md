# State

## Intent
Let an object alter its behavior when its internal state changes, so that it appears to change its class — by delegating state-specific behavior to separate state objects instead of branching on a state field everywhere.

## Also known as
(closely related to the Finite-State Machine concept)

## Problem
An object with several distinct states (e.g. an `Order` that's Draft, Placed, Shipped, or Cancelled) often ends up with methods full of conditionals switching on the current state: "if state is Draft, do X; if Placed, do Y; ...". As more states and more state-dependent methods are added, these conditionals are duplicated across every method and grow increasingly unmanageable, and it's easy to miss updating one of them when a new state is introduced.

## Solution
Create a separate class for each state, all implementing a common State interface with one method per state-dependent behavior. The context object (the `Order`) holds a reference to a current state object and delegates state-dependent calls to it instead of branching internally. Transitioning to a new state just means swapping which state object the context currently holds — the swap can be triggered by the context or by the state objects themselves.

## Structure
- **Context** — holds a reference to the current State object; delegates state-specific work to it; exposes a way to change the current state
- **State** (interface) — declares state-specific methods common to all concrete states
- **ConcreteStates** — implement behavior for one specific state; may trigger transitions to other states (often holding a back-reference to the context to do so)

## Code example
```typescript
interface OrderState {
  ship(order: Order): void;
  cancel(order: Order): void;
}

class DraftState implements OrderState {
  ship(order: Order) { throw new Error("Cannot ship a draft order"); }
  cancel(order: Order) { order.setState(new CancelledState()); }
}

class PlacedState implements OrderState {
  ship(order: Order) { order.setState(new ShippedState()); }
  cancel(order: Order) { order.setState(new CancelledState()); }
}

class ShippedState implements OrderState {
  ship(order: Order) { throw new Error("Already shipped"); }
  cancel(order: Order) { throw new Error("Cannot cancel a shipped order"); }
}

class CancelledState implements OrderState {
  ship(order: Order) { throw new Error("Cannot ship a cancelled order"); }
  cancel(order: Order) { /* no-op: already cancelled */ }
}

class Order {
  private state: OrderState = new DraftState();

  setState(state: OrderState) { this.state = state; }
  ship() { this.state.ship(this); }
  cancel() { this.state.cancel(this); }
}

const order = new Order();
order.setState(new PlacedState());
order.ship(); // transitions Placed -> Shipped, no conditional logic in Order itself
```

## When to use
- An object's behavior depends heavily on its current state, with many distinct states and behavior that changes with each
- A class already has large conditional blocks (`if`/`switch` on a state field) scattered across multiple methods, duplicated in each one
- New states are expected to be added over time and you want adding one to not require touching every existing method

## When NOT to use / pitfalls
- For a small number of states (two or three) with simple, rarely-changing behavior, a single boolean/enum flag with a small conditional is simpler and easier to read than a class per state
- Adds one class per state, which is real overhead for state machines that aren't actually complex
- Concrete states are allowed to know about and transition to other states, which can make the overall flow harder to trace than a single centralized switch statement — document the valid transitions somewhere (tests, a diagram) since they're now spread across classes

## Relations to other patterns
- Structurally related to **Bridge**, **Strategy**, and **Adapter** — all use composition/delegation
- **State can be considered an extension of Strategy**: both delegate behavior to a swappable object via composition, but Strategy objects are independent and unaware of each other, while State objects are explicitly allowed to know about and transition the context to other states
