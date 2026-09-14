# Chain of Responsibility

## Intent
Pass a request along a chain of handlers, where each handler decides either to process the request or to forward it to the next handler in the chain.

## Also known as
CoR, Chain of Command

## Problem
A request needs to pass through a sequence of checks or processing steps (e.g. authentication, rate limiting, validation, caching) before or instead of reaching its final handler. Cramming all of these into one function or class creates a bloated, hard-to-modify block of conditional logic, and adding, removing, or reordering a check means editing that shared block — risky and easy to get wrong as checks accumulate.

## Solution
Extract each check/step into its own handler object with a single method and a reference to "the next handler." Each handler decides independently whether to act on the request, pass it along unchanged, or stop the chain entirely. The client assembles the chain (in whatever order is needed) and sends the request to the first handler, without needing to know the full chain or coordinate it.

## Structure
- **Handler** (interface) — declares the method for handling requests and (usually) setting the next handler
- **BaseHandler** (optional) — provides default "pass to next" boilerplate so concrete handlers only implement their own check
- **ConcreteHandlers** — implement a specific check; decide whether to handle, pass on, or stop
- **Client** — builds the chain and kicks off a request, typically at the first handler

## Code example
```typescript
interface RequestContext {
  userId?: string;
  path: string;
  ip: string;
}

abstract class Middleware {
  private next?: Middleware;

  setNext(next: Middleware): Middleware {
    this.next = next;
    return next; // allows chaining: a.setNext(b).setNext(c)
  }

  async handle(ctx: RequestContext): Promise<boolean> {
    if (this.next) return this.next.handle(ctx);
    return true; // end of chain, nothing rejected
  }
}

class AuthMiddleware extends Middleware {
  async handle(ctx: RequestContext): Promise<boolean> {
    if (!ctx.userId) return false; // stop the chain: reject the request
    return super.handle(ctx);
  }
}

class RateLimitMiddleware extends Middleware {
  async handle(ctx: RequestContext): Promise<boolean> {
    if (isRateLimited(ctx.ip)) return false;
    return super.handle(ctx);
  }
}

// Client assembles the chain and order is explicit and easy to change:
const auth = new AuthMiddleware();
auth.setNext(new RateLimitMiddleware());

const allowed = await auth.handle({ userId: "u1", path: "/checkout", ip: "1.2.3.4" });
```

## When to use
- More than one object may handle a request, and the handler (or set of handlers) isn't known until runtime
- A set of checks/steps must run in a specific, possibly-reconfigurable order
- You want to add or remove processing steps without touching the objects that send the request

## When NOT to use / pitfalls
- A request can silently fall through the chain unhandled if no handler processes it and there's no explicit fallback — make sure that's intentional, not a bug
- For a small, fixed, never-changing sequence of steps, a plain function calling steps in order is simpler and easier to trace than objects with `next` pointers
- Debugging a long chain means stepping through many small handlers — don't build a chain deeper than the actual variability in the problem calls for

## Relations to other patterns
- **Command, Mediator, Observer** are alternative ways to decouple senders from receivers of a request — CoR's distinguishing trait is the linear pass-along-until-handled structure
- Chains are often extracted from **Composite** trees, where leaf components pass unhandled requests up through their parent containers
- Similar structure to **Decorator**, but CoR handlers can stop the chain outright, whereas decorators always delegate through
- Individual handlers can be implemented as **Command** objects operating on a shared context
