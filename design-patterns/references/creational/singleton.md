# Singleton

## Intent
Ensure a class has only one instance, and provide a well-defined global access point to it.

## Also known as
(none commonly used)

## Problem
Some resources genuinely must have exactly one instance shared across an entire program — a single connection pool, a single in-memory cache, a single configuration object. Plain global variables can be reassigned or shadowed accidentally by any code, and don't guarantee lazy or single-time initialization. There also needs to be a controlled way to reach that instance from anywhere without threading it through every function signature.

## Solution
Make the constructor private (or otherwise non-public) so no code outside the class can call `new` on it. Provide a static access method (`getInstance()`) that creates the instance on first call, caches it, and returns the cached instance on every subsequent call.

## Structure
- **Singleton** — declares the static access method, a private static field holding the sole instance, and a private constructor

## Code example
```typescript
class ConfigService {
  private static instance: ConfigService | undefined;
  private readonly values: Record<string, string>;

  private constructor() {
    this.values = loadConfigFromEnv();
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  get(key: string): string | undefined {
    return this.values[key];
  }
}

// Usage anywhere in the codebase:
const apiKey = ConfigService.getInstance().get("API_KEY");
```
In Node.js, module-level state is already a singleton in practice (a module is only evaluated once per process), so `export const configService = new ConfigService()` from a module often achieves the same guarantee with less ceremony than a `getInstance()` class.

## When to use
- Exactly one shared instance must exist for the lifetime of the program (e.g. a connection pool, a hardware/device handle)
- You need stricter control than a bare exported constant provides (e.g. lazy initialization with setup side effects)

## When NOT to use / pitfalls
- Widely considered one of the most overused/misused GoF patterns — reach for it only when a second instance would be a genuine bug, not out of habit
- Makes unit testing hard: the private constructor and static state resist mocking/resetting between tests unless you add extra escape hatches
- Hides dependencies — code that calls `Singleton.getInstance()` doesn't declare that dependency in its signature, unlike constructor/DI injection, which makes coupling and testing worse
- In multithreaded environments (not typical for single-threaded Node.js, but relevant in worker pools) naive lazy init is a race condition
- Prefer dependency injection of a single shared instance (created once at composition root) over a static `getInstance()` — same "one instance" guarantee, without the hidden global coupling

## Relations to other patterns
- **Facade** objects often end up implemented as Singletons since one facade instance is usually enough
- **Flyweight** looks similar (shared instances) but differs fundamentally: Flyweight allows *many* immutable shared instances, Singleton allows exactly *one* (potentially mutable) instance
- **Abstract Factory**, **Builder**, and **Prototype** can all be implemented as Singletons when only one factory/builder/registry is ever needed
