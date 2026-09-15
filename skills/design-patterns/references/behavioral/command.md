# Command

## Intent
Turn a request into a standalone object that contains everything needed to perform an action, so requests can be parameterized, queued, logged, delayed, or undone.

## Also known as
Action, Transaction

## Problem
When UI or trigger code (buttons, menu items, keyboard shortcuts, schedulers) calls business logic directly, it becomes tightly coupled to that logic. The same operation invoked from multiple places (a toolbar button and a keyboard shortcut both triggering "save") duplicates wiring. Worse, undo/redo, queuing, or deferred/retryable execution is very hard to bolt on when the "request" is just a direct method call that leaves no trace of itself.

## Solution
Encapsulate a request as an object implementing a common `execute()` (and optionally `undo()`) interface, holding whatever parameters and receiver reference it needs. The invoker (button, scheduler, queue) only knows about the Command interface, not the concrete operation. Commands can be constructed once and reused, stored in a history stack for undo, serialized for persistence/queuing, or composed into macro-commands.

## Structure
- **Command** (interface) — declares the execution method (usually `execute()`)
- **ConcreteCommand** — implements execute by calling one or more methods on a Receiver; stores whatever parameters/state it needs (including pre-execution state, for undo)
- **Receiver** — contains the actual business logic the command invokes
- **Invoker (Sender)** — triggers a command's execution without knowing what it does
- **Client** — creates and configures concrete commands and hands them to invokers

## Code example
```typescript
interface Command {
  execute(): void;
  undo(): void;
}

class CartService {
  private items: string[] = [];
  addItem(sku: string) { this.items.push(sku); }
  removeItem(sku: string) {
    const idx = this.items.indexOf(sku);
    if (idx >= 0) this.items.splice(idx, 1);
  }
}

class AddItemCommand implements Command {
  constructor(private cart: CartService, private sku: string) {}
  execute(): void { this.cart.addItem(this.sku); }
  undo(): void { this.cart.removeItem(this.sku); }
}

class CommandHistory {
  private stack: Command[] = [];
  run(cmd: Command) {
    cmd.execute();
    this.stack.push(cmd);
  }
  undoLast() {
    this.stack.pop()?.undo();
  }
}

// Invoker (e.g. a UI button handler) only knows about Command, not CartService:
const history = new CommandHistory();
const cart = new CartService();
history.run(new AddItemCommand(cart, "SKU-1"));
history.undoLast(); // removes SKU-1 without the invoker knowing how
```

## When to use
- You need to parameterize an object (a button, a menu, a queue) with an operation to perform later
- Operations need to be queued, scheduled, logged, retried, or sent across a process/network boundary
- Undo/redo functionality is required
- You want to decouple code that invokes an operation from code that knows how to perform it

## When NOT to use / pitfalls
- For a simple, immediate, one-shot function call with no need for undo/queuing/logging, wrapping it in a Command class is pure overhead — just call the function
- Adds a class per distinct operation, which can proliferate quickly if overused for trivial actions
- Undo support in particular adds real complexity (state capture, careful ordering) — only build it if undo is an actual requirement, not speculatively

## Relations to other patterns
- **Chain of Responsibility** and **Command** both decouple sender from receiver but structure that decoupling differently (linear pass-along vs. encapsulated request object)
- **Command + Memento** is the common combination for implementing undo: the command captures a memento of pre-execution state
- Compared to **Strategy**: both wrap behavior behind a common interface, but Command represents a discrete *operation to perform* (often once, possibly deferred), while Strategy represents an interchangeable *algorithm* a context repeatedly delegates to
- **Visitor** can be thought of as a more powerful Command variant that operates across a whole object structure
