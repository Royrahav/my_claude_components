# Observer

## Intent
Define a subscription mechanism so that multiple "subscriber" objects are automatically notified of any relevant events happening to the "publisher" object they're observing.

## Also known as
Event-Subscriber, Listener

## Problem
Some objects need to react whenever another object's state changes, but polling that object repeatedly to check for changes is wasteful, and hardcoding the publisher to know about and call every specific interested object directly creates tight coupling — the set of interested parties is often unknown ahead of time and changes at runtime (new listeners added, others removed).

## Solution
The publisher (subject) maintains a list of subscriber references and exposes methods to add/remove them. All subscribers implement a common interface with a notification method. Whenever a relevant event occurs, the publisher iterates its subscriber list and calls the notification method on each — without needing to know their concrete types. Subscribers can be added or removed dynamically at runtime.

## Structure
- **Publisher (Subject)** — holds a list of subscribers, exposes subscribe/unsubscribe, and triggers notifications on relevant events
- **Subscriber** (interface) — declares the notification method (e.g. `update()`)
- **ConcreteSubscribers** — implement reactions to notifications
- **Context data** — event-related information passed along with the notification
- **Client** — creates publisher and subscribers, and wires the subscriptions

## Code example
```typescript
interface OrderSubscriber {
  onOrderPlaced(orderId: string, totalCents: number): void;
}

class OrderPublisher {
  private subscribers: OrderSubscriber[] = [];

  subscribe(sub: OrderSubscriber) { this.subscribers.push(sub); }
  unsubscribe(sub: OrderSubscriber) {
    this.subscribers = this.subscribers.filter((s) => s !== sub);
  }

  placeOrder(orderId: string, totalCents: number) {
    // ...core order-placement logic...
    for (const sub of this.subscribers) {
      sub.onOrderPlaced(orderId, totalCents);
    }
  }
}

class InventorySubscriber implements OrderSubscriber {
  onOrderPlaced(orderId: string) { /* decrement stock */ }
}

class AnalyticsSubscriber implements OrderSubscriber {
  onOrderPlaced(orderId: string, totalCents: number) { /* record revenue metric */ }
}

// Publisher doesn't know or care how many subscribers exist, or what they do:
const publisher = new OrderPublisher();
publisher.subscribe(new InventorySubscriber());
publisher.subscribe(new AnalyticsSubscriber());
publisher.placeOrder("order-1", 4999);
```
In Node.js backends this is frequently implemented via the built-in `EventEmitter`, which provides the subscribe/notify machinery directly.

## When to use
- Multiple objects need to react to changes/events in another object, and the set of interested objects is unknown ahead of time or changes at runtime
- You want to eliminate polling for state changes
- Publisher and subscribers should be decoupled — new subscriber types shouldn't require changes to the publisher

## When NOT to use / pitfalls
- Notification order among subscribers is typically unspecified/unpredictable — don't rely on one subscriber running before another
- A growing web of publishers and subscribers across a codebase can make control flow hard to trace ("what actually happens when this event fires?" requires finding every subscriber)
- Careless subscription management (subscribing but never unsubscribing) is a common source of memory leaks and duplicate notifications, especially for long-lived publishers
- For a single, fixed, always-present reaction to an event, a direct function call is clearer than setting up a publisher/subscriber relationship

## Relations to other patterns
- Contrasted with **Chain of Responsibility** (sequential, one handler stops it), **Command** (encapsulates a single request, typically one direction), and **Mediator** (centralizes and controls communication rather than broadcasting)
- **Mediator** is sometimes implemented internally using Observer, but Mediator retains centralized control over reactions, while pure Observer allows many independent, decoupled subscribers
