# Scalability and CI/CD, at the Code Level

Both of these principles have well-known infrastructure dimensions (autoscaling clusters,
deploy pipelines) that are out of scope here. This reference is about what to actually
write differently *in application code* so that infrastructure-level scalability and
CI/CD are even possible.

## Designing for scalability in code

Scalability at the code level is mostly about avoiding patterns whose cost grows
faster than the useful work being done, and avoiding hidden state that prevents running
more than one instance of a service.

### Avoid unbounded in-memory state

```ts
// Before: an in-memory cache with no eviction, living in process memory.
// Grows forever; also silently diverges across instances once you scale to >1 process.
const cache = new Map<string, User>();
function getUser(id: string): User {
  if (!cache.has(id)) cache.set(id, loadUserFromDb(id));
  return cache.get(id)!;
}
```

```ts
// After: bounded (LRU with a max size / TTL) or moved to a shared external store
// (Redis, etc.) so it doesn't grow unboundedly and is consistent across instances.
const cache = new LRUCache<string, User>({ max: 10_000, ttl: 5 * 60 * 1000 });
async function getUser(id: string): Promise<User> {
  const cached = cache.get(id);
  if (cached) return cached;
  const user = await loadUserFromDb(id);
  cache.set(id, user);
  return user;
}
```

### Prefer statelessness in request-handling code

If a request handler stores per-user data in a module-level variable or in-process
session object instead of passing it through the request/response or an external store,
the app can no longer run more than one instance (or the user gets pinned to one
instance), which defeats horizontal scaling entirely. Keep handler functions stateless:
read what they need from the request/store, write results to the response/store, and
avoid module-level mutable variables that accumulate per-request data.

### Avoid N+1 query patterns

```ts
// Before: one query for the list, then one query per item — N+1 round trips.
const orders = await db.query('SELECT * FROM orders WHERE user_id = ?', [userId]);
for (const order of orders) {
  order.items = await db.query('SELECT * FROM line_items WHERE order_id = ?', [order.id]);
}
```

```ts
// After: a single query (join or batched IN clause) — O(1) round trips regardless of list size.
const orders = await db.query(
  `SELECT o.*, li.* FROM orders o
   LEFT JOIN line_items li ON li.order_id = o.id
   WHERE o.user_id = ?`,
  [userId],
);
const grouped = groupByOrderId(orders);
```

This pattern generalizes beyond SQL — any loop that makes one network/DB call per
iteration over a collection whose size isn't bounded is a scalability risk, regardless of
the specific data store.

### Paginate or stream large results

```ts
// Before: loads the entire table into memory to send it, however large it is.
app.get('/export', async (req, res) => {
  const all = await db.query('SELECT * FROM events');
  res.json(all);
});
```

```ts
// After: streams results in bounded chunks instead of buffering the whole result set.
app.get('/export', async (req, res) => {
  res.setHeader('Content-Type', 'application/x-ndjson');
  for await (const chunk of db.streamQuery('SELECT * FROM events')) {
    res.write(JSON.stringify(chunk) + '\n');
  }
  res.end();
});
```

Any list-returning API endpoint should default to a page size limit rather than "return
everything" — the failure mode of unbounded lists is invisible in dev/test with small
data and only shows up in production once a table grows.

### Rule of thumb — scalability vs. YAGNI

The patterns above (bounded caches, avoiding N+1, pagination, statelessness) cost
almost nothing to apply by default — they're not "extra infrastructure," just not writing
the naive unbounded version. Apply them by default. What should be deferred until there's
a measured need is *architecture* for scale: sharding, queues, multi-region
replication, caching layers, read replicas. Building those speculatively is
over-engineering; leaving obviously unbounded loops/memory in place because "we'll fix it
when we scale" is under-engineering. The dividing line is cost: if the scalable version
costs about the same to write as the naive one, write the scalable version now; if it
requires new infrastructure or meaningfully more code, wait for evidence of need.

## What CI/CD-friendly code looks like

CI/CD-friendliness is mostly about reducing the blast radius and flakiness of any single
change, so integration can happen continuously instead of in big risky batches.

### Small, reviewable changes

A PR that does one thing (fix a bug, add one feature) is fast to review, easy to revert
in isolation, and rarely conflicts with other in-flight work. A PR that bundles an
unrelated refactor with a feature (e.g., "also renamed 40 files while I was in there")
forces reviewers to separate the two concerns mentally and makes a revert an all-or-
nothing gamble. When a change is naturally large (e.g., a framework upgrade), look for a
way to land it in an ordered sequence of smaller PRs rather than one big one.

### Deterministic builds and tests

Tests that depend on real wall-clock time, real network calls, ambient global state, or
execution order will pass locally and fail in CI (or vice versa) unpredictably —
"flaky" tests. Flaky tests erode trust in the suite, and eventually people start
re-running failed CI jobs instead of investigating, which defeats the purpose of having
CI at all.

```ts
// Before: depends on real time passing and the real system clock — flaky and slow.
test('token expires after 1 hour', async () => {
  const token = issueToken();
  await sleep(60 * 60 * 1000);
  expect(isExpired(token)).toBe(true);
});
```

```ts
// After: inject a controllable clock — deterministic and instant.
test('token expires after 1 hour', () => {
  const clock = new FakeClock(Date.now());
  const token = issueToken(clock);
  clock.advance(60 * 60 * 1000);
  expect(isExpired(token, clock)).toBe(true);
});
```

### Feature flags instead of long-lived branches

Work that isn't finished yet should usually be merged to main behind a feature flag
(disabled by default) rather than kept on a long-lived branch. Long-lived branches
accumulate merge conflicts and drift from main, and by the time they land, the "diff"
being reviewed is enormous and hard to reason about. A flagged, incomplete feature merged
early keeps main releasable at all times and lets the feature be built incrementally with
each piece reviewed and tested in isolation. The cost is flag-management overhead (flags
need to be removed once a feature ships) — that's worth paying for anything that will
take more than a few days, and not worth it for a same-day change.

### Fast test suites

A test suite people wait minutes for is a test suite people skip running before pushing,
which pushes discovery of failures later (into CI, or into someone else's PR) where they
are more expensive to fix. Keep the feedback loop fast: prefer unit tests with fakes over
tests that spin up real infrastructure, and reserve slow end-to-end tests for a smaller,
separately-run suite rather than mixing them into the suite run on every commit.

## Rule of thumb

For both scalability and CI/CD, the theme is the same: pay a small, constant cost now
(don't write unbounded loops; keep changes small; make tests deterministic) to avoid a
large, unpredictable cost later (an outage under load; a week-long merge conflict; a
flaky suite nobody trusts). Don't confuse this with building speculative infrastructure —
that's a different, much more expensive bet that should wait for evidence.
