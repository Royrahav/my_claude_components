# Harness templates

Minimal shapes for each language. Adapt names, fixtures and primitives to the project. Each
template forces the interleaving with a barrier or latch and bounds every wait with a timeout.

## Go - race with a forced interleaving

```go
func TestReserveConcurrent(t *testing.T) {
    barrier := make(chan struct{})
    var arrived sync.WaitGroup
    arrived.Add(2)
    repo := &fakeRepo{qty: 1, onGet: func() { arrived.Done(); <-barrier }}
    svc := NewService(repo)

    errs := make(chan error, 2)
    for i := 0; i < 2; i++ {
        go func() { errs <- svc.Reserve("sku", 1) }()
    }
    arrived.Wait()   // both have read qty
    close(barrier)   // release both writers

    ok := 0
    for i := 0; i < 2; i++ {
        select {
        case err := <-errs:
            if err == nil { ok++ }
        case <-time.After(5 * time.Second):
            t.Fatal("timeout")
        }
    }
    if ok != 1 || repo.qty != 0 { t.Fatalf("ok=%d qty=%d", ok, repo.qty) }
}
// go test -race -run TestReserveConcurrent -count=20 ./...
```

Goroutine leak: assert with `go.uber.org/goleak` (`defer goleak.VerifyNone(t)`) if the project
uses it, otherwise compare `runtime.NumGoroutine()` before and after with a short settle loop.

## C++ (GTest) - deadlock with timeout

```cpp
// TwoPartyBarrier: test helper (mutex + condition_variable) - ArriveAndWait() returns when both
// sides arrived or after 1 s, so the fixed code (which serializes the two transfers) still passes.
TEST(TransferTest, OppositeOrderDoesNotDeadlock) {
    Account a{100}, b{100};
    TwoPartyBarrier firstLockHeld;
    std::atomic<int> done{0};
    std::thread ta([&] { Transfer(a, b, 10, /*hookAfterFirstLock*/ [&] { firstLockHeld.ArriveAndWait(); }); ++done; });
    std::thread tb([&] { Transfer(b, a, 10, [&] { firstLockHeld.ArriveAndWait(); }); ++done; });
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(5);
    while (done < 2 && std::chrono::steady_clock::now() < deadline)
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    if (done < 2) {                        // deadlocked threads cannot be joined - fail loudly
        ADD_FAILURE() << "deadlock: opposite lock order";
        std::abort();
    }
    ta.join(); tb.join();
    EXPECT_EQ(a.Balance() + b.Balance(), 200);
}
// Do not use std::async here: its future's destructor joins, so a real deadlock hangs the suite.
// Build with -fsanitize=thread (Clang/GCC) for races. MSVC has no TSan: rely on the forced
// interleaving and assertions there; /fsanitize=address covers memory errors.
```

Leak: loop the failing path K times and assert zero leaks under ASan/LeakSanitizer
(`-fsanitize=address`) or `valgrind --leak-check=full --error-exitcode=1`. On Windows without
LeakSanitizer, use CRT debug heap checkpoints (`_CrtMemCheckpoint` / `_CrtMemDifference`) or the
project's own allocation tracking.

## Java - race / lost update

```java
@Test void concurrentReserveKeepsInvariant() throws Exception {
    CyclicBarrier afterRead = new CyclicBarrier(2);
    Repo repo = new FakeRepo(1, () -> await(afterRead));   // blocks inside get()
    Service svc = new Service(repo);
    ExecutorService pool = Executors.newFixedThreadPool(2);
    List<Future<Boolean>> results = pool.invokeAll(List.of(() -> svc.reserve("sku"), () -> svc.reserve("sku")), 5, TimeUnit.SECONDS);
    long ok = results.stream().filter(f -> !f.isCancelled() && get(f)).count();
    assertEquals(1, ok);
    assertEquals(0, repo.qty());
    pool.shutdownNow();
}
```

Memory-model bugs (visibility, reordering) need jcstress; a unit test cannot force them reliably.

## C# (xUnit/NUnit) - async race and sync-over-async deadlock

```csharp
[Fact]
public async Task ConcurrentReserve_KeepsInvariant()
{
    var afterRead = new Barrier(2);
    var repo = new FakeRepo(qty: 1, onGet: () => afterRead.SignalAndWait(TimeSpan.FromSeconds(5)));
    var svc = new Service(repo);
    var results = await Task.WhenAll(Task.Run(() => svc.ReserveAsync("sku")), Task.Run(() => svc.ReserveAsync("sku")))
                            .WaitAsync(TimeSpan.FromSeconds(5));
    Assert.Equal(1, results.Count(r => r));
    Assert.Equal(0, repo.Qty);
}
```

Sync-over-async deadlock: run the call under a single-threaded `SynchronizationContext` (e.g. a
test helper `AsyncContext.Run` from Nito.AsyncEx if the project has it) and assert completion
within a timeout.

## Python - thread race and N+1

```python
def test_concurrent_reserve():
    barrier = threading.Barrier(2, timeout=5)
    repo = FakeRepo(qty=1, on_get=barrier.wait)
    svc = Service(repo)
    results = []
    threads = [threading.Thread(target=lambda: results.append(svc.reserve("sku"))) for _ in range(2)]
    for t in threads: t.start()
    for t in threads: t.join(timeout=5)
    assert results.count(True) == 1 and repo.qty == 0

def test_list_orders_query_count(db, django_assert_num_queries):   # or a SQLAlchemy event counter
    make_orders(n=20, lines_each=3)
    with django_assert_num_queries(2):          # constant, not 1 + 20
        list_orders_with_lines()
```

## JavaScript / TypeScript - await-interleaving race

```ts
test('concurrent reserve keeps invariant', async () => {
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  let reads = 0;
  const repo = fakeRepo({ qty: 1, onGet: async () => { if (++reads === 2) release(); await gate; } });
  const svc = new Service(repo);
  const results = await Promise.all([svc.reserve('sku'), svc.reserve('sku')]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(repo.qty).toBe(0);
});
```

## SQL - two-session collision fixture (any engine)

Drive two real connections to the test database from the test, step by step:

```
S1: BEGIN;
S1: SELECT qty FROM stock WHERE sku = 'X';          -- reads 1
S2: BEGIN;
S2: SELECT qty FROM stock WHERE sku = 'X';          -- reads 1
S2: UPDATE stock SET qty = 0 WHERE sku = 'X'; COMMIT;
S1: UPDATE stock SET qty = 0 WHERE sku = 'X'; COMMIT;   -- lost update: two reservations, one unit
ASSERT: reservations = 1   (fix: SELECT ... FOR UPDATE / UPDLOCK, or UPDATE ... WHERE qty >= 1 and check rows affected)
```

Deadlock fixture: S1 updates row A then B, S2 updates B then A, interleaved after the first
update each; assert neither session gets a deadlock error once updates are ordered by key. Set a
lock timeout on both sessions so the test fails rather than hangs.

Plan assertion: run the engine's `EXPLAIN` on the SQL the code generates (captured from the ORM
logger) against a seeded schema with realistic statistics, and assert the scan node is absent.
Seed enough rows that the planner would not pick a scan for a small table anyway.
