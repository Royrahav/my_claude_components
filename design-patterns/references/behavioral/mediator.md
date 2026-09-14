# Mediator

## Intent
Reduce chaotic many-to-many dependencies between objects by forcing them to communicate indirectly through a mediator object instead of referencing each other directly.

## Also known as
Intermediary, Controller

## Problem
When components communicate directly with each other (a checkbox that directly toggles a text field, which directly triggers a submit button's enabled state, which directly...), each component ends up holding references to several others. Any component becomes hard to reuse or modify in isolation because it's entangled with the specifics of its neighbors, and the web of direct references grows more tangled as components are added.

## Solution
Introduce a mediator object that all the components talk to instead of talking to each other. Components notify the mediator of events happening to them ("I changed", "I was clicked") without knowing or caring who else might be interested; the mediator contains the logic for how those events should affect other components, and calls them accordingly. Components become decoupled from each other, depending only on the mediator's interface.

## Structure
- **Component** — a class with business logic, holding a reference to a Mediator interface, unaware of other components' concrete types
- **Mediator** (interface) — declares a notification method components use to inform it of events
- **ConcreteMediator** — encapsulates how components should react to each other's events; typically holds references to all the components it coordinates
- **Client** — wires components and the mediator together

## Code example
```typescript
interface Mediator {
  notify(sender: string, event: string): void;
}

class CheckoutFormMediator implements Mediator {
  private couponApplied = false;
  private paymentValid = false;

  constructor(private submitButton: SubmitButton) {}

  notify(sender: string, event: string): void {
    if (sender === "coupon" && event === "applied") {
      this.couponApplied = true;
    }
    if (sender === "payment" && event === "valid") {
      this.paymentValid = true;
    }
    // Mediator centralizes the cross-component rule, instead of scattering it:
    this.submitButton.setEnabled(this.paymentValid);
  }
}

class SubmitButton {
  setEnabled(enabled: boolean) { /* update UI state */ }
}

class CouponField {
  constructor(private mediator: Mediator) {}
  apply() {
    // ...validate coupon...
    this.mediator.notify("coupon", "applied");
  }
}

class PaymentField {
  constructor(private mediator: Mediator) {}
  validate() {
    // ...validate card...
    this.mediator.notify("payment", "valid");
  }
}

// CouponField and PaymentField never reference each other or SubmitButton directly.
const submitButton = new SubmitButton();
const mediator = new CheckoutFormMediator(submitButton);
new CouponField(mediator).apply();
new PaymentField(mediator).validate();
```

## When to use
- A group of components is tightly, messily interconnected, making changes to one risk breaking several others
- Components can't easily be reused elsewhere because they're entangled with specific neighbors
- You keep creating subclasses just to adjust how a component reacts to one or two other components

## When NOT to use / pitfalls
- The mediator itself can grow into a "God Object" that knows about and controls everything, becoming just as unmaintainable as the tangled web it replaced — watch for this and split responsibilities if it happens
- For two or three components with a simple, stable relationship, direct references are more straightforward than routing everything through a mediator
- Adds an indirection layer that can make tracing "what actually happens when X changes" harder to follow by reading code alone (you must read the mediator's logic to know the effect)

## Relations to other patterns
- **Chain of Responsibility**, **Command**, and **Observer** are alternative ways of connecting senders and receivers; Mediator's distinguishing trait is eliminating direct links between colleagues entirely, centralizing coordination in one place
- **Facade** also centralizes access, but Facade provides a simplified one-way interface *into* a subsystem, while Mediator coordinates communication *between* peer components that are aware of and depend on it
- Often implemented internally using **Observer** (components subscribe to the mediator's notifications), while still keeping the mediator's centralized control
