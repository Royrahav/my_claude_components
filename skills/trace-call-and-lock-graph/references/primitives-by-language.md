# Synchronization primitives and happens-before edges by language

Use this to decide (a) what can run concurrently, (b) which operations create a happens-before
edge, and (c) the traps that most often produce real hazards in that language. Project
conventions override: if the codebase wraps these primitives (e.g. labOS's own lock, global and
cache wrappers, documented in the `globals-caches-threading` skill), reason about the wrapper's
semantics and recommend the wrapper in fixes.

## C++ (C++11 and later; note which standard the project allows)

- **Primitives**: `std::mutex`, `std::recursive_mutex`, `std::shared_mutex` (C++17),
  `std::lock_guard`, `std::unique_lock`, `std::scoped_lock` (C++17), `std::lock` (C++11,
  deadlock-avoiding multi-lock), `std::condition_variable`, `std::atomic<T>` with
  `memory_order_*`, `std::call_once`, platform `CRITICAL_SECTION` / `SRWLOCK` / `pthread_mutex_t`.
- **Happens-before**: unlock -> later lock of the same mutex; release store -> acquire load that
  reads it; `std::thread` constructor -> thread body; thread body -> `join` return; `call_once`.
  Function-local `static` initialization is thread-safe since C++11 (MSVC: VS2015+).
- **Traps**: `shared_ptr` refcount is atomic but the pointee is not, and assigning the same
  `shared_ptr` object from two threads is a race; `memory_order_relaxed` used for a flag that
  publishes data; `volatile` used as if it were atomic; `cv.wait(lock)` without a predicate;
  iterator invalidation after `push_back`/`erase`; lambdas capturing locals by reference handed to
  another thread; destructor running while a callback registered with a worker still fires.
- **C++14 projects**: no `std::scoped_lock` or `std::shared_mutex` - use `std::lock` +
  `std::lock_guard(..., std::adopt_lock)` or `std::shared_timed_mutex`, or the house wrapper.

## Java / Kotlin (JVM)

- **Primitives**: `synchronized`, `ReentrantLock`, `ReadWriteLock`, `StampedLock`, `volatile`,
  `java.util.concurrent.atomic.*`, `ConcurrentHashMap`, `CountDownLatch`, `Semaphore`,
  `CompletableFuture`; Kotlin coroutines `Mutex`, `Channel`.
- **Happens-before**: monitor exit -> subsequent enter; volatile write -> subsequent read;
  `Thread.start` -> body; body -> `join`; `final` fields after constructor completes (if `this`
  does not escape); executor submission -> task execution; future completion -> `get`.
- **Traps**: check-then-act on `ConcurrentHashMap` (use `computeIfAbsent`/`merge`);
  `SimpleDateFormat`/`HashMap` shared across threads; double-checked locking without `volatile`;
  `synchronized` on a boxed or interned value; `ThreadLocal` leaks in pools; `parallelStream`
  with side effects; virtual threads pinned by `synchronized` around blocking I/O (JDK 21-23).

## C# / .NET

- **Primitives**: `lock` (`Monitor`), `SemaphoreSlim` (async-capable), `ReaderWriterLockSlim`,
  `Interlocked`, `volatile`, `Concurrent*` collections, `Channel<T>`, `Lazy<T>`.
- **Happens-before**: lock release -> acquire; `Interlocked` ops are full fences; `Task`
  completion -> `await` continuation; `Thread.Start` -> body.
- **Traps**: `.Result` / `.Wait()` on an async method under a single-threaded
  `SynchronizationContext` (UI, legacy ASP.NET) - deadlock; `lock` cannot contain `await` (people
  work around it wrongly); `async void` swallowing exceptions; `Dictionary` shared across requests;
  `ConcurrentDictionary.GetOrAdd` value factory running more than once; static mutable state in
  ASP.NET Core singletons.

## Go

- **Primitives**: `sync.Mutex`, `sync.RWMutex`, `sync.Once`, `sync.WaitGroup`, `sync/atomic`,
  channels, `context.Context` for cancellation.
- **Happens-before**: send -> corresponding receive completes; close -> receive that observes it;
  unlock -> later lock; `Once.Do` return; goroutine start happens after the `go` statement.
- **Traps**: maps are not safe for concurrent write (runtime fatal error, not a panic you can
  recover); loop variable capture before Go 1.22; goroutine leak on send to an unbuffered channel
  with no receiver or after the receiver returned on `ctx.Done()`; copying a struct containing a
  `sync.Mutex`; `WaitGroup.Add` called inside the goroutine; `RWMutex` recursive read lock
  deadlock when a writer is waiting.

## Rust

- **Primitives**: `Mutex`, `RwLock`, `Arc`, atomics, `mpsc`/`crossbeam` channels, `tokio::sync::*`.
- Safe Rust excludes data races. Remaining hazards: deadlocks (lock order, holding a
  `std::sync::Mutex` guard across `.await`), poisoning handled by `unwrap`, `Arc` cycles (leak),
  `RefCell` borrow panics, `unsafe` blocks and FFI, blocking calls inside async executors.

## Python

- **Primitives**: `threading.Lock/RLock/Condition/Event/Semaphore`, `queue.Queue`,
  `asyncio.Lock/Queue`, `multiprocessing`.
- The GIL (and its absence in free-threaded 3.13+ builds) does not make compound operations
  atomic. `x += 1`, `d[k] = d.get(k, 0) + 1`, `if k not in d: d[k] = ...` are races under threads.
- asyncio: no preemption between `await`s, so a sequence with no `await` inside is atomic with
  respect to other coroutines; any `await` between check and act is a race window.
- **Traps**: blocking calls (`requests`, `time.sleep`, sync DB drivers) inside `async def` stall
  the loop; `Condition.wait` without a predicate loop; daemon threads killed mid-write at exit.

## JavaScript / TypeScript (Node, browser)

- Single-threaded per isolate: no data races on ordinary objects. Races happen at `await` /
  callback boundaries (check-then-await-then-act, concurrent requests mutating shared module
  state), and with `SharedArrayBuffer` + `Atomics` across workers.
- **Traps**: module-level mutable state shared across concurrent requests; `Promise.all` over
  unbounded arrays (resource exhaustion); sync fs/crypto on the request path blocking the loop;
  unhandled promise rejections killing the process (Node 15+).

## Databases (as a concurrency primitive)

A transaction is a lock scope with its own isolation semantics. Treat `BEGIN ... COMMIT` like a
lock region and hand SELECT-then-write sequences, lock ordering between transactions and
isolation questions to `query-plan-and-index-analyzer`.
