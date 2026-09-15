# Interface Segregation Principle (ISP)

## Deeper explanation

"Clients should not be forced to depend on methods they do not use." When an interface
bundles many unrelated methods together, every implementer must provide (or stub out) all
of them, even if a given implementer only genuinely supports a subset — and every consumer
that depends on the interface type is coupled to the whole surface, even if it only calls
one or two methods. This makes implementers brittle (forced fake implementations) and
consumers' real dependencies unclear (you can't tell what a function actually needs just by
looking at its parameter type).

The fix is to prefer several small, role-based interfaces over one large one, and have
implementers/consumers depend only on the slice(s) they actually need. This is really SRP
applied to interfaces: an interface should have one reason to change, i.e., serve one role.

## Before (violates ISP)

```ts
// worker.ts — one fat interface for every kind of background worker
interface Worker {
  processOrder(orderId: string): Promise<void>;
  generateReport(): Promise<Buffer>;
  sendEmailBlast(campaignId: string): Promise<void>;
  reconcileInventory(): Promise<void>;
}

// An order-processing worker is forced to implement methods it has nothing to do with
class OrderProcessingWorker implements Worker {
  async processOrder(orderId: string): Promise<void> {
    // real implementation
  }
  async generateReport(): Promise<Buffer> {
    throw new Error("not supported by OrderProcessingWorker");
  }
  async sendEmailBlast(campaignId: string): Promise<void> {
    throw new Error("not supported by OrderProcessingWorker");
  }
  async reconcileInventory(): Promise<void> {
    throw new Error("not supported by OrderProcessingWorker");
  }
}

// A scheduler that only needs to run report generation is still coupled to the full interface
function scheduleNightlyJob(worker: Worker) {
  worker.generateReport();
}
```

Three stubbed methods throw at runtime if ever called by accident, every new worker
capability grows the interface (and the stub list on every existing implementer), and
`scheduleNightlyJob`'s real dependency (report generation only) is hidden behind the fat
`Worker` type.

## After (satisfies ISP)

```ts
// worker.ts — small, role-based interfaces
interface OrderProcessor {
  processOrder(orderId: string): Promise<void>;
}

interface ReportGenerator {
  generateReport(): Promise<Buffer>;
}

interface EmailBlaster {
  sendEmailBlast(campaignId: string): Promise<void>;
}

interface InventoryReconciler {
  reconcileInventory(): Promise<void>;
}

// Each worker implements only the role(s) it actually supports
class OrderProcessingWorker implements OrderProcessor {
  async processOrder(orderId: string): Promise<void> {
    // real implementation
  }
}

class ReportingWorker implements ReportGenerator {
  async generateReport(): Promise<Buffer> {
    return Buffer.from("report");
  }
}

// A worker that genuinely spans two roles can implement both, explicitly
class MarketingWorker implements EmailBlaster, ReportGenerator {
  async sendEmailBlast(campaignId: string): Promise<void> { /* ... */ }
  async generateReport(): Promise<Buffer> { return Buffer.from("campaign report"); }
}

// The scheduler's dependency is now explicit and minimal
function scheduleNightlyJob(worker: ReportGenerator) {
  worker.generateReport();
}
```

No implementer needs a throwing stub, and `scheduleNightlyJob`'s signature documents
exactly what it needs — any object with a `generateReport()` method, nothing more.

## Common real-world scenarios

- **Generic `Repository<T>` interfaces** with `find`, `save`, `delete`, `bulkUpdate`,
  `stream`, etc., where most concrete repositories only meaningfully support a subset (e.g.,
  a read replica or an external read-only API-backed repository).
- **Plugin/adapter interfaces** that grow a method every time any one plugin needs a new
  capability, forcing all other plugins to add stub implementations.
- **"God" service clients** wrapping a third-party SDK with one interface exposing every
  SDK method, when most call sites only need one or two operations — makes mocking in tests
  unnecessarily heavy.
- **React/UI prop interfaces** that bundle unrelated concerns (data, styling, event
  handlers, feature flags) into one giant `Props` type used by many components, most of
  which only need a few fields.
- **gRPC/REST client interfaces** generated wholesale from a service spec and injected
  everywhere, instead of consumer-specific narrower interfaces (the "role interface"
  pattern) at each call site.

## Interaction with other principles

- ISP is SRP applied to interfaces/contracts rather than to implementation classes — a fat
  interface is itself a class-shaped violation of "one reason to change."
- Splitting a fat interface often resolves an **LSP** violation for free: a forced,
  throwing stub implementation is simultaneously an ISP problem (interface too broad) and
  an LSP problem (that implementer isn't truly substitutable for the interface). See the
  repository example in `liskov-substitution.md`.
- ISP supports **DIP**: small, focused interfaces are easier for high-level modules to own
  and depend on, and easier for multiple unrelated low-level modules to each implement only
  the relevant slice.
- Over-splitting is a real risk: an interface with a single method for every single
  implementer, resulting in dozens of one-method interfaces with no cohesive role, adds
  navigation overhead without a matching benefit. Segregate by *role* (a meaningful group of
  methods that consumers actually use together), not by mechanically making every method
  its own interface — see `anti-patterns.md`.
