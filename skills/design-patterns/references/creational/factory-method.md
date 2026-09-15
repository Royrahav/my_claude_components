# Factory Method

## Intent
Provide an interface for creating an object in a superclass (or module), but let subclasses (or configuration) decide which concrete class gets instantiated. Also known as: Virtual Constructor.

## Also known as
Virtual Constructor

## Problem
Code that directly instantiates concrete classes with `new` becomes tightly coupled to those classes. When a new variant needs to be supported (e.g. a shipping system that only knows about `Truck` needs to add `Ship`), every call site that does `new Truck()` has to be found and wrapped in conditional logic. This spreads and duplicates decision logic throughout the codebase.

## Solution
Define a common product interface, then push object creation behind a "factory method" — a method that concrete creators override to return the specific product type. Client code depends only on the abstract product and abstract creator, never on concrete classes. New product types are added by adding a new creator subclass (or a new branch in a factory function), not by editing existing call sites.

## Structure
- **Product** — interface all created objects implement
- **ConcreteProduct** — a specific implementation of Product
- **Creator** — declares the factory method (abstract or with a default implementation), and usually contains business logic that uses the product
- **ConcreteCreator** — overrides the factory method to return a specific ConcreteProduct

## Code example
```typescript
interface Notifier {
  send(message: string): Promise<void>;
}

class EmailNotifier implements Notifier {
  async send(message: string) { /* send via email provider */ }
}

class SmsNotifier implements Notifier {
  async send(message: string) { /* send via SMS provider */ }
}

abstract class NotificationCreator {
  // the factory method
  protected abstract createNotifier(): Notifier;

  async notifyCustomer(message: string): Promise<void> {
    const notifier = this.createNotifier();
    await notifier.send(message);
  }
}

class EmailNotificationCreator extends NotificationCreator {
  protected createNotifier(): Notifier {
    return new EmailNotifier();
  }
}

class SmsNotificationCreator extends NotificationCreator {
  protected createNotifier(): Notifier {
    return new SmsNotifier();
  }
}

// Client code depends only on NotificationCreator, never on EmailNotifier/SmsNotifier directly.
async function sendOrderConfirmation(creator: NotificationCreator, orderId: string) {
  await creator.notifyCustomer(`Order ${orderId} confirmed`);
}
```
In simpler TypeScript codebases this is often just a factory *function* returning a union-typed interface rather than a class hierarchy — same idea, less ceremony.

## When to use
- The exact concrete type needed isn't known until runtime (config, input, or environment-dependent)
- You're building a library/framework and want callers to be able to extend which objects get created without modifying your code
- You want to centralize and reuse expensive-object creation logic (pooling, caching) behind one seam

## When NOT to use / pitfalls
- If there's only one product type and no foreseeable second one, a plain constructor or factory function is simpler — don't add a class hierarchy speculatively
- Overkill for simple object graphs; adds a subclass per variant which can balloon the file count
- In TypeScript, a simple factory function with a switch/union type often achieves the same decoupling with far less boilerplate than a Creator class hierarchy

## Relations to other patterns
- Often the first step toward **Abstract Factory**, **Builder**, or **Prototype** as a design evolves to need more flexibility
- **Template Method** commonly calls a factory method as one of its steps
- **Abstract Factory** is typically implemented as a set of Factory Methods
