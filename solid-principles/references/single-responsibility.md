# Single Responsibility Principle (SRP)

## Deeper explanation

"A class should have one, and only one, reason to change." The word "responsibility" here
means "reason to change tied to a specific actor or stakeholder," not "does one thing" in
the literal sense of one method. A class can have several methods and still satisfy SRP if
all of them serve the same responsibility and would only ever need to change for the same
underlying reason.

SRP is violated when a single class accumulates logic that serves multiple, independent
stakeholders or concerns — e.g., a rule change from Finance (tax calculation), a change to
persistence technology (switching databases), and a change to how customers are notified
(switching email providers) all land in the same file. When those concerns are coupled,
a change requested by one stakeholder can break behavior another stakeholder depends on,
and the file becomes a merge-conflict magnet touched by everyone on the team for unrelated
reasons.

SRP applies at multiple levels: functions, classes, modules, and services/microservices all
have "reasons to change," and the same reasoning scales up.

## Before (violates SRP)

```ts
// order.ts — mixes domain calculation, persistence, and notification concerns
import { Pool } from "pg";
import nodemailer from "nodemailer";

const db = new Pool();
const mailer = nodemailer.createTransport({ host: "smtp.example.com" });

class Order {
  id: string;
  items: { price: number; qty: number }[];
  customerEmail: string;

  constructor(id: string, items: { price: number; qty: number }[], customerEmail: string) {
    this.id = id;
    this.items = items;
    this.customerEmail = customerEmail;
  }

  calculateTotal(): number {
    const subtotal = this.items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const tax = subtotal * 0.08; // tax rule — Finance's concern
    return subtotal + tax;
  }

  async saveToDatabase(): Promise<void> {
    // persistence concern — Infra's concern
    await db.query("INSERT INTO orders (id, total) VALUES ($1, $2)", [
      this.id,
      this.calculateTotal(),
    ]);
  }

  async sendConfirmationEmail(): Promise<void> {
    // notification concern — Marketing/CRM's concern
    await mailer.sendMail({
      to: this.customerEmail,
      subject: "Order confirmed",
      text: `Your order ${this.id} total is $${this.calculateTotal()}`,
    });
  }
}
```

Three unrelated stakeholders (Finance, Infra, Marketing) can each force a change to this one
file. A tax-rule tweak now risks breaking email formatting tests, and testing the total
calculation requires a real (or heavily mocked) database and mail transport.

## After (satisfies SRP)

```ts
// order.ts — pure domain model + calculation, no I/O
export interface OrderItem {
  price: number;
  qty: number;
}

export class Order {
  constructor(
    public readonly id: string,
    public readonly items: OrderItem[],
    public readonly customerEmail: string,
  ) {}

  calculateSubtotal(): number {
    return this.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  }
}

// pricing.ts — tax/pricing rules, owned by Finance
export class PricingCalculator {
  constructor(private readonly taxRate: number) {}

  calculateTotal(order: Order): number {
    const subtotal = order.calculateSubtotal();
    return subtotal + subtotal * this.taxRate;
  }
}

// orderRepository.ts — persistence, owned by Infra
import { Pool } from "pg";

export class OrderRepository {
  constructor(private readonly db: Pool) {}

  async save(order: Order, total: number): Promise<void> {
    await this.db.query("INSERT INTO orders (id, total) VALUES ($1, $2)", [order.id, total]);
  }
}

// orderNotifier.ts — notification, owned by Marketing/CRM
import nodemailer from "nodemailer";

export class OrderNotifier {
  constructor(private readonly mailer: nodemailer.Transporter) {}

  async sendConfirmation(order: Order, total: number): Promise<void> {
    await this.mailer.sendMail({
      to: order.customerEmail,
      subject: "Order confirmed",
      text: `Your order ${order.id} total is $${total}`,
    });
  }
}

// orderService.ts — orchestrates the collaborators for a use case
export class OrderService {
  constructor(
    private readonly pricing: PricingCalculator,
    private readonly repo: OrderRepository,
    private readonly notifier: OrderNotifier,
  ) {}

  async placeOrder(order: Order): Promise<void> {
    const total = this.pricing.calculateTotal(order);
    await this.repo.save(order, total);
    await this.notifier.sendConfirmation(order, total);
  }
}
```

Each class now has exactly one reason to change, can be unit-tested in isolation (e.g.,
`PricingCalculator.calculateTotal` needs no database or mailer), and a tax-rule change
cannot accidentally break email formatting.

## Common real-world scenarios

- **God services**: a `UserService` that handles authentication, profile updates, billing,
  and analytics tracking all in one class.
- **Controllers with embedded business logic**: an HTTP route handler that validates input,
  applies business rules, talks to the database, and formats the response, all inline.
  Splitting into controller → domain service → repository fixes this.
- **React/UI components** that fetch data, transform it, and render — mixing data-fetching
  concerns with presentation concerns (fixed by extracting hooks/data layers).
- **Utility/helper "junk drawer" classes** (`Utils`, `Helpers`) that accumulate unrelated
  static methods over time because it's the path of least resistance for new code.
- **Config/env-loading mixed with business logic** — a module that reads environment
  variables and also implements a domain algorithm; a change to deployment config touches
  code that has nothing to do with deployment.

## Interaction with other principles

- SRP is often the enabling step for **DIP**: once persistence/notification are split out
  of `Order`, it becomes natural to depend on interfaces for those collaborators rather than
  concrete classes.
- SRP and **OCP** work together: a class with a single, well-defined responsibility is much
  easier to extend without modification, because its boundary is clear.
- Overzealous SRP (splitting a cohesive concern into many tiny classes that always change
  together) creates unnecessary indirection — see `anti-patterns.md`. A responsibility is
  defined by "reason to change," not by "number of lines" or "number of methods."
