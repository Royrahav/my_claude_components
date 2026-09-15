# Regression Test Workflow: A Worked Example

The core discipline: **when fixing a bug, write the failing test before touching the fix.**
This is the only way to prove the test would actually have caught the original bug — if the
test is written after the fix, there's no evidence it wasn't written to trivially pass
against the already-correct code.

## Step 0: The bug report

> "Applying a coupon code to an order with a single item priced exactly at the coupon's
> minimum-order threshold doesn't apply the discount. Coupon `SAVE10` requires a $50 minimum
> order; a $50.00 order gets no discount, but a $50.01 order does."

Reading the code turns up the culprit in `CouponService`:

```ts
// src/coupons/couponService.ts
applyCoupon(order: Order, coupon: Coupon): number {
  if (order.total > coupon.minimumOrder) {
    return order.total - coupon.discountAmount;
  }
  return order.total;
}
```

The bug: `>` should be `>=`. An order exactly at the threshold should qualify ("minimum
order" means "at least this much"), but strict `>` excludes it.

## Step 1: Write a failing test that reproduces the bug

Do this **before** changing `couponService.ts`. Name the test after the exact scenario from
the bug report, and assert the *correct* (currently unmet) behavior:

```ts
// src/coupons/couponService.test.ts
describe('CouponService.applyCoupon', () => {
  describe('minimum order threshold', () => {
    it('applies the discount when the order total exactly equals the minimum', () => {
      // Arrange
      const service = new CouponService();
      const order = { total: 50.00 } as Order;
      const coupon = { minimumOrder: 50.00, discountAmount: 10 } as Coupon;

      // Act
      const result = service.applyCoupon(order, coupon);

      // Assert
      expect(result).toBe(40.00); // discount applied: 50.00 - 10
    });
  });
});
```

Run it and confirm it **fails, and fails for the right reason**:

```
FAIL src/coupons/couponService.test.ts
  CouponService.applyCoupon > minimum order threshold
    ✕ applies the discount when the order total exactly equals the minimum

    Expected: 40
    Received: 50
```

This is the critical checkpoint. `Received: 50` confirms the failure is exactly the reported
bug (no discount applied at the threshold) — not a typo in the test setup, not an unrelated
crash. If the test failed with an error instead of a wrong value (e.g., `TypeError:
service.applyCoupon is not a function`), that would indicate a setup mistake, not a
reproduction of the real bug — fix the test setup before proceeding.

## Step 2: Fix the code

```ts
// src/coupons/couponService.ts
applyCoupon(order: Order, coupon: Coupon): number {
  if (order.total >= coupon.minimumOrder) {
    return order.total - coupon.discountAmount;
  }
  return order.total;
}
```

One-character fix: `>` to `>=`.

## Step 3: Re-run the test and confirm it passes

```
PASS src/coupons/couponService.test.ts
  CouponService.applyCoupon > minimum order threshold
    ✓ applies the discount when the order total exactly equals the minimum
```

This proves the test is actually coupled to the bug: it failed before the fix and passes
after, with no other change in between.

## Step 4: Check for neighboring untested boundaries while here

A boundary bug like this is a strong signal to also check the adjacent cases, since an
off-by-one mistake often has siblings:

```ts
it('does not apply the discount when the order total is just below the minimum', () => {
  const service = new CouponService();
  const order = { total: 49.99 } as Order;
  const coupon = { minimumOrder: 50.00, discountAmount: 10 } as Coupon;

  const result = service.applyCoupon(order, coupon);

  expect(result).toBe(49.99); // no discount
});

it('applies the discount when the order total is above the minimum', () => {
  const service = new CouponService();
  const order = { total: 75.00 } as Order;
  const coupon = { minimumOrder: 50.00, discountAmount: 10 } as Coupon;

  const result = service.applyCoupon(order, coupon);

  expect(result).toBe(65.00);
});
```

These weren't in the original bug report, but they lock down the full boundary (below,
exactly at, above the threshold) so a future edit can't reintroduce an off-by-one in either
direction.

## Step 5: Leave the test in the suite permanently

The test from Step 1 is not scaffolding to delete after the fix ships — it is now a permanent
regression guard. It stays in `couponService.test.ts` alongside the other coupon tests,
committed in the same change as the fix, so:

- Anyone who later touches the `>=` comparison (e.g., during a refactor) gets an immediate,
  specific failure if they reintroduce the bug.
- The test's name and location document the exact edge case that was once broken, which is
  useful context for the next person who touches this file.

## Why the order (test-first) matters

Writing the fix first and the test after produces a test that is guaranteed to pass the
moment it's written — it was written by looking at working code. It gives no evidence that
the test is actually sensitive to the bug's presence. Writing the test first and watching it
fail for the expected reason is the only way to know the test is load-bearing: it would have
caught this bug in code review or CI before the report ever happened, and it will catch a
recurrence the same way.
