# Concurrency — design and writing `[CON]`

Source: *Clean Code* ch. 13 + Appendix A ("Concurrency II"). **Load when** code involves
threads, async tasks, executors or worker pools, locks, mutexes, atomics, shared mutable state,
queues between producers and consumers, or shutdown of workers. For *testing* such code, load
`concurrency-testing.md` instead of (or as well as) this file.

Core idea: concurrency decouples *what* gets done from *when*. It can improve throughput and
structure, but it adds overhead, changes the design fundamentally, and produces bugs that don't
reproduce. Writing clean concurrent code is hard even for simple problems.

## Know why, and the myths
**CON-1 Use it for a reason** `[—]` — Concurrency pays off when there is waiting to overlap (I/O,
network) or independent work across many cores. It doesn't always improve performance, it does
change the design, and understanding it still matters when a container or framework "handles
threads for you".

## Defence principles
**CON-2 Keep concurrency code separate (SRP)** `[M]` — Concurrency code has its own lifecycle
of development, change and tuning, and its own failure modes. Keep thread management,
scheduling and locking apart from business logic. The logic should be plain code that the
threading layer calls.

**CON-3 Limit the scope of shared data** `[H]` — Encapsulate shared mutable data and keep the
points that access it to a minimum. Every extra place that touches it is another chance to
forget the lock, duplicate it, or hide a bug.

**CON-4 Prefer copies and immutability** `[M]` — Avoid sharing: pass copies or immutable values,
let each thread work on its own, and merge results in one place. Creating extra objects usually
costs less than contended locks.

**CON-5 Keep threads independent** `[M]` — Design each thread or task to work on its own
partition of data, from an unshared source, using local state only.

## Know your library and models
**CON-6 Use the high-level library** `[M]` — Prefer thread-safe collections (concurrent maps and
queues), executors and worker pools, futures and promises, and non-blocking atomics
(compare-and-swap) to hand-rolled threads and locks. Know which library classes are *not*
thread-safe (many formatters, collections, connections and clients) and never share them
unguarded.

**CON-7 Recognise the execution models** `[—]` — Vocabulary: bound resources, mutual exclusion,
starvation, deadlock, livelock. Most real problems are variants of three classic models:
*producer–consumer* (a bounded queue plus signalling for not-empty and not-full),
*readers–writers* (throughput vs. stale data vs. writer starvation; consider read-write locks or
versioning), and *dining philosophers* (contention for several resources leads to deadlock,
livelock or starvation). Learn their standard solutions.

## Correctness hazards
**CON-8 "Atomic-looking" isn't atomic** `[H]` — `count++`, check-then-act (`if (!map.has(k))
map.set(k, v)`) and read-modify-write sequences can interleave. Even a trivial increment has a huge
number of possible interleavings. Assume non-atomic unless documented; use atomics, locks, or
single-call compound operations (`putIfAbsent`, `computeIfAbsent`).

**CON-9 Dependencies between synchronised methods** `[H]` — Each method on a shared object may be
thread-safe while the *sequence* isn't (`if (it.hasNext()) it.next()` across threads). Avoid
calling more than one method on a shared object in a sequence that must hold together. If you
must, in order of preference:
- *Server-based locking*: the object offers one method that does the whole compound step
  atomically (for example `nextOrNull()`). Preferred.
- *Adapted server*: when you can't change the class, wrap it in an adapter that adds the
  compound, locked operation.
- *Client-based locking*: every caller locks the shared object around the sequence. Fragile,
  because every caller must remember.
- *Tolerate*: only if the failure is provably harmless.

**CON-10 Keep synchronised sections small** `[M]` — Locks cost time and cause contention. Guard
only true critical sections, and don't hold locks across I/O, network calls or user callbacks.
Don't widen a lock beyond the critical region "to be safe".

**CON-11 Break a deadlock condition** `[H]` — Deadlock needs all four: mutual exclusion, lock
and wait, no preemption, circular wait. Remove any one:
- avoid mutual exclusion (atomics, copies, enough resources for every thread);
- no lock-and-wait (acquire everything up front, or release everything and retry; watch for
  starvation and livelock);
- allow preemption (a way to ask a holder to release);
- no circular wait (one global lock-acquisition order, used everywhere).
Detect: nested locks acquired in different orders on different paths.

**CON-12 Plan graceful shutdown early** `[H]` — Shutdown is harder than start-up. Watch for a
parent waiting forever on a stuck child, and for a producer that exits while its consumer blocks
on an empty queue (or the reverse). Use explicit shutdown signals, poison pills, timeouts and
cancellation. Design it from the start.

**CON-13 Measure before adding threads** `[M]` — Throughput gains come from overlapping waits.
CPU-bound work scales only up to the number of cores. Find out where time actually goes (I/O vs.
CPU) before adding threads; more threads can make things slower through contention and context
switching.

## Don't over-apply
- Single-threaded async (event loops) avoids data races, but not ordering bugs or blocking the
  loop. Apply CON-8, CON-10 and CON-12 to it too.
- Actor or message-passing frameworks already implement several of these principles. Review
  their usage against the framework's rules, not raw lock rules.
