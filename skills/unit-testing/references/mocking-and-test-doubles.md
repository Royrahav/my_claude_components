# Mocking and Test Doubles

"Mock" is often used loosely to mean any fake object substituted for a real dependency. Being
precise about which kind of test double is in use clarifies what a test is actually proving.

## The taxonomy

| Double | What it does | When to use it |
|---|---|---|
| **Dummy** | A placeholder object passed in because a parameter is required, but never actually used by the code path under test. | When a constructor/function requires an argument the test doesn't care about (e.g., a logger the code path never calls). |
| **Stub** | Returns canned/hard-coded answers to calls made during the test; has no logic and doesn't verify how it was called. | When the test needs a dependency to *return* a specific value/error, but the test doesn't care whether or how the dependency's methods were invoked. |
| **Fake** | A real, working, simplified implementation (e.g., an in-memory repository instead of a real database). Has actual behavior, just not production-grade (no persistence, no network). | When the dependency is a good candidate to exercise "for real" in-process — most repository/data-access interfaces, caches, queues. Fakes catch more bugs than stubs because they have real behavior a test can misuse just like production code would. |
| **Spy** | A real (or stub) object that also records how it was called, so the test can assert afterward: "was this called, how many times, with what arguments." | When the *fact that a call happened* is itself the behavior under test — e.g., verifying an email-send was triggered, without needing to fake the whole email system. |
| **Mock** | A pre-programmed object with explicit expectations set up *before* the test runs (`expect(x).toHaveBeenCalledWith(...)`), and the test fails if the expected interaction doesn't occur exactly as specified. | When the *precise interaction* with a boundary dependency is the contract being tested — e.g., "the payment gateway is charged exactly once, with this exact amount." Use sparingly; overuse turns tests into implementation mirrors (see below). |

General rule: reach for a **fake** before a **mock** whenever the dependency is cheap to
implement in-memory. Reach for a **stub** when you just need a canned return value. Reserve
**mocks** (verifying call shape/count/arguments) for real boundaries — network, payment
gateways, third-party APIs — where the interaction itself is the contract.

## Over-mocking: a worked example

Suppose `OrderService.placeOrder` is supposed to: validate the cart isn't empty, compute the
total via `PricingEngine`, and save the order via `OrderRepository`.

### Over-mocked test (false confidence)

```ts
it('places an order', () => {
  const pricingEngine = { calculateTotal: jest.fn().mockReturnValue(42) };
  const repository = { save: jest.fn() };
  const service = new OrderService(pricingEngine, repository);

  service.placeOrder({ items: [{ id: 'sku1', qty: 2 }] });

  expect(pricingEngine.calculateTotal).toHaveBeenCalledWith([{ id: 'sku1', qty: 2 }]);
  expect(repository.save).toHaveBeenCalledWith(
    expect.objectContaining({ total: 42 })
  );
});
```

Why this is false confidence:

- `pricingEngine.calculateTotal` is **mocked to return `42` unconditionally**, so the test
  never exercises real pricing logic — a bug in `PricingEngine` (wrong tax rate, wrong
  currency rounding) can never be caught by this test, no matter how badly it's broken.
- The assertions just check that `OrderService` called the two methods with the arguments it
  was always going to call them with, given the mock setup — the test is a mirror of
  `placeOrder`'s implementation. If someone refactors `placeOrder` to compute the total in a
  different (wrong) way but still happens to call `calculateTotal` with the same argument
  shape, this test still passes.
- It gives zero signal about whether `OrderService` and the real `PricingEngine` actually
  agree on shapes and behavior — the classic "both sides mocked their tests green,
  integration is broken in production" failure mode.

### Corrected test (real confidence)

```ts
it('saves an order with the total computed from the real pricing engine', () => {
  // Arrange: use the real PricingEngine (cheap, in-process, deterministic) —
  // only fake the repository, which is the actual boundary (persistence).
  const pricingEngine = new PricingEngine(FLAT_TAX_TABLE_FIXTURE);
  const repository = new InMemoryOrderRepository(); // fake, not a mock
  const service = new OrderService(pricingEngine, repository);

  // Act
  service.placeOrder({ items: [{ id: 'sku1', qty: 2, unitPrice: 20 }] });

  // Assert: check the actual saved state, not "was a method called"
  const saved = repository.findAll();
  expect(saved).toHaveLength(1);
  expect(saved[0].total).toBe(43.2); // 2 * 20 = 40, + real 8% tax from fixture table
});
```

Why this is better:

- `PricingEngine` runs for real — a bug in tax calculation, rounding, or currency handling
  now actually fails this test.
- `OrderRepository` is a **fake** (in-memory), not a mock — the test asserts on real saved
  state (`repository.findAll()`), not on "was `.save()` called with an object matching this
  shape." This survives refactors to *how* `placeOrder` calls the repository, as long as the
  order actually ends up saved with the right total.
- Only the true persistence boundary is faked; nothing else in the test setup pretends to be
  something it isn't.
- If a spy on `repository.save` call count were still needed (e.g., to prove it's called
  exactly once, not saved twice), that's a legitimate, narrow use of a spy layered on top of
  the fake — not a reason to mock the whole repository's behavior away.

## Rules of thumb

- Mock/fake at **architectural boundaries**: network calls, database/filesystem I/O,
  wall-clock time (`Date.now()`, timers), randomness, third-party SDKs, environment
  variables/feature flags that vary by deployment.
- Do not mock **pure functions or cheap in-process collaborators** just because they live in
  another file or class — running them for real is usually faster to write, more resilient
  to refactors, and catches more bugs.
- If writing a test requires mocking three or more collaborators to isolate one method, that
  is often a signal the method itself has too many responsibilities (see the
  `engineering-principles` and `solid-principles` skills) rather than a signal to mock harder.
- Prefer asserting on **observable outcomes** (return value, saved state, thrown error,
  message published) over asserting on **call shape** (`toHaveBeenCalledWith`) wherever an
  outcome-based assertion is possible — outcome assertions survive implementation refactors;
  call-shape assertions do not.
