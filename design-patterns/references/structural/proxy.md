# Proxy

## Intent
Provide a substitute or placeholder for another object that implements the same interface, controlling access to the real object and letting the proxy perform work before or after requests reach it.

## Also known as
(none commonly used)

## Problem
Sometimes you need to control access to an object rather than call it directly: the real object is expensive to create and shouldn't be instantiated until actually needed (lazy init), it lives remotely and needs network plumbing, it should be cached to avoid redundant expensive calls, or access to it needs to be logged/authorized. Scattering this concern across every call site duplicates logic and, for third-party classes, may not even be possible without modifying source you don't control.

## Solution
Create a proxy class implementing the exact same interface as the real service object. Client code depends on that shared interface and can't tell whether it's talking to the real object or the proxy. The proxy holds a reference to the real object (creating it lazily if needed) and adds its own logic — caching, access checks, logging, remote-call marshaling — before/after delegating the actual call to the real object.

## Structure
- **ServiceInterface** — the interface both the real Service and the Proxy implement
- **Service** — contains the real business logic
- **Proxy** — implements ServiceInterface, holds/manages a reference to a Service instance, and adds logic before/after delegating to it
- **Client** — interacts with Service or Proxy interchangeably through ServiceInterface

## Code example
```typescript
interface ProductCatalog {
  getProduct(sku: string): Promise<{ sku: string; name: string; priceCents: number }>;
}

class RemoteProductCatalog implements ProductCatalog {
  async getProduct(sku: string) {
    // expensive network call to a catalog microservice
    return fetchFromCatalogService(sku);
  }
}

// Caching proxy: same interface, adds a cache in front of the expensive real service
class CachedProductCatalog implements ProductCatalog {
  private cache = new Map<string, { sku: string; name: string; priceCents: number }>();

  constructor(private real: ProductCatalog) {}

  async getProduct(sku: string) {
    const cached = this.cache.get(sku);
    if (cached) return cached;

    const product = await this.real.getProduct(sku);
    this.cache.set(sku, product);
    return product;
  }
}

// Client code is unaware it's talking to a proxy:
const catalog: ProductCatalog = new CachedProductCatalog(new RemoteProductCatalog());
await catalog.getProduct("SKU-1"); // hits the network
await catalog.getProduct("SKU-1"); // served from cache
```

## When to use
- Lazy initialization of a heavyweight object that's expensive to create and not always needed
- Access control — checking permissions before forwarding a request to the real object
- Caching results of expensive/remote calls
- Logging or auditing calls to a service without modifying the service itself
- Local stand-ins for remote services (e.g. RPC client stubs)

## When NOT to use / pitfalls
- Adds an extra class and indirection layer — don't introduce a proxy for a cheap, local, unrestricted object with nothing to control
- Can introduce subtle latency or staleness bugs if used for caching without a clear invalidation strategy
- If the "extra logic" is unconditional and simple, it may be simpler to just put it directly in the real class rather than via a separate proxy layer

## Relations to other patterns
- **Adapter** changes the interface it wraps; **Decorator** extends behavior while keeping the interface; **Proxy** keeps the identical interface and manages the wrapped object's lifecycle/access — the three are structurally similar but solve different problems
- **Facade** also buffers access to something complex, but Facade's interface is unrelated to what it wraps (a whole subsystem), whereas Proxy deliberately mirrors the real service's interface so it's interchangeable with it
- Structurally near-identical to **Decorator**; the distinguishing factor is intent — Proxy controls lifecycle/access, Decorator adds behavior and is fully client-composed
