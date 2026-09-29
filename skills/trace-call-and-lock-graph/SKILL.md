---
name: trace-call-and-lock-graph
description: Use when auditing code for concurrency hazards - data races, deadlocks, lock-order inversions, TOCTOU, ABA, lost or spurious wakeups, leaked or silently-dying threads/goroutines/tasks. Maps a symbol's callers and callees to a bounded depth, the execution context each frame runs in, the synchronization primitives held across the call stack, the shared state each context touches, and the lock-order edges between them, and emits a trace manifest other reliability skills consume. Primary inspection skill of the System Reliability Agent; usable standalone for "is this thread-safe", "can this deadlock", "who calls this from which thread".
---

# Trace Call and Lock Graph

Build the concurrency picture around one symbol precisely enough that a race or deadlock claim
becomes a concrete interleaving - or is disproved. This is a procedure you execute with the LSP
tools, Read and Grep. It is not a tool call.

## Inputs

| Input | Meaning | Default |
|---|---|---|
| `symbol` | Function, method, type, field or global at the centre of the trace. | - (required) |
| `max_depth` | Call-graph hops to follow up (callers) and down (callees). | 3; use 2 for a large diff, 4-5 only when a lock is acquired far from the shared state it guards. |

## Procedure

### 1. Establish the runtime model

Before tracing, decide what "concurrent" means in this codebase. Read
`references/primitives-by-language.md` for the language, then answer:

- Which contexts can run code at the same time? OS threads, thread pools, goroutines, async tasks,
  timers, signal handlers, UI thread vs workers, request handlers (most web frameworks run
  handlers concurrently), message consumers.
- Where is execution serialized for you? Single-threaded event loops, actors, a single-consumer
  queue, `@MainActor`, a strand, a DB unique constraint, process-per-request.

A race claim that ignores serialization the runtime already provides is a false positive.

### 2. Resolve the symbol and walk the graph

1. Resolve `symbol` with the LSP (`goToDefinition`, `findReferences`, call hierarchy). Fall back to
   Grep only for dynamic dispatch the LSP cannot see: reflection, string-keyed handlers, DI
   registration, callbacks passed as values, virtual/interface calls. Name each dispatch you had to
   resolve by hand.
2. Walk callers up and callees down to `max_depth`. Stop early at a frame that neither touches
   shared state nor acquires or releases a primitive.
3. For every frame, record:
   - `file:line` of the call
   - **context**: which thread/task/pool/handler it runs on, and how you know (the spawn site, the
     framework contract, the executor passed in)
   - **held on entry**: primitives already held by the caller chain
   - **acquires / releases**: every lock, semaphore, monitor, condition variable, channel
     operation, atomic RMW, DB transaction boundary - with line numbers
   - **blocking calls made while holding anything**: I/O, `await`, sleep, channel send/receive,
     `join`, RPC, logging that can block, callbacks into code you do not control

### 3. Build the shared-state table

For every variable, field, global, static, cache, collection or file reached from more than one
context:

| state | contexts that touch it | access (R/W/RMW) | protecting primitive per access | happens-before edge |
|---|---|---|---|---|

A **data race** exists when two contexts access the same state, at least one writes, and there is
no common lock and no happens-before edge between them (atomic with adequate ordering, channel
handoff, `join`, thread start after write, `volatile`/`Interlocked`, safe publication).

Check specifically:
- Compound operations on "thread-safe" containers: `if (!map.contains(k)) map.put(k, v)` is a
  race even on a concurrent map. Python's GIL does not make `+=`, `d[k] = d.get(k, 0) + 1` or
  check-then-set atomic.
- Iteration over a collection another context mutates (iterator invalidation,
  `ConcurrentModificationException`, reallocation under a reader).
- Lazy initialization and double-checked locking without a correct barrier.
- Objects published to other threads before their constructor finishes (`this` escaping).
- Per-object locks guarding state that is actually shared across objects (static fields, shared
  caches).

### 4. Build the lock-order graph

Add an edge `A -> B` whenever `B` is acquired while `A` is held, across calls included. Then:

- **Cycle** `A -> B` and `B -> A` from two contexts that can run concurrently: deadlock. Record both
  acquisition paths with lines.
- **Lock held across a blocking call** that can wait on another context needing the same lock:
  deadlock (lock + `join`, lock + synchronous RPC back into the same service, lock + `await` on a
  task that needs the lock, `.Result`/`.Wait()` on a sync-context-bound task in C#).
- **Re-entrancy**: a non-reentrant lock acquired again on the same thread through a callback or
  virtual call.
- **Starvation and convoying**: a lock held across I/O or long computation on a hot path; a
  reader-writer lock whose writers can starve; a fair lock under heavy contention.

### 5. Check the remaining hazard classes

- **TOCTOU**: a check and the act it guards are not under the same lock or transaction - including
  the file system (`exists` then `open`), permissions checks, and SELECT-then-INSERT/UPDATE (hand
  the SQL to `query-plan-and-index-analyzer`). In async code, any `await` between check and act
  is a preemption point.
- **Condition variables**: `wait` not inside a predicate loop (spurious wakeup); state changed
  outside the lock that guards the predicate, or notify issued before the waiter can be waiting
  (lost signal); `notify_one` with waiters that wait on different predicates.
- **Lock-free code**: CAS loops on pointers or indices that can be recycled (ABA); relaxed memory
  ordering where acquire/release is required; tagged pointers or hazard pointers missing.
- **Thread and task lifecycle**: who joins, cancels or awaits each spawned context? A goroutine
  blocked forever on a channel no one reads; a detached thread using stack references of a frame
  that has returned; an exception in a worker that kills it silently; a fire-and-forget task whose
  failure is never observed; shutdown that does not stop or drain workers.

### 6. Emit the trace manifest

The manifest is the input to `synthesize-repro-test` and the source of the
`deterministic_failure_trace`. Keep it factual - every entry has a line number.

```json
{
  "symbol": "OrderCache::Get",
  "runtime_model": "thread pool (8 workers) + 1 timer thread",
  "contexts": [{"id": "T-worker", "entry": "Api.cpp:88", "evidence": "handler dispatched on pool"}],
  "call_edges": [{"from": "Api.cpp:88", "to": "OrderCache.cpp:40", "context": "T-worker"}],
  "lock_edges": [{"held": "m_cacheLock", "acquired": "m_dbLock", "at": "OrderCache.cpp:52"}],
  "shared_state": [{"state": "m_entries", "accesses": [{"at": "OrderCache.cpp:44", "kind": "R", "context": "T-worker", "guard": "none"}]}],
  "candidate_hazards": [{"type": "DATA_RACE", "summary": "...", "interleaving": ["T-worker reads m_entries at :44", "T-timer clears m_entries at Timer.cpp:19", "..."]}]
}
```

## Restraint - do not report

- State confined to one context, or immutable after safe publication.
- Access serialized by the runtime or framework (step 1) - say which mechanism.
- A benign, documented racy read of a flag that uses an atomic type with adequate ordering.
- A lock-order cycle whose two paths cannot run concurrently (e.g. one only at startup before
  workers exist) - prove it from the spawn sites.
- A "missing lock" on state that another primitive already orders (channel handoff, `join`,
  future completion).
- Rust safe code: data races are excluded by the compiler; look only at `unsafe`, deadlocks, lock
  poisoning, and `RefCell`/`Rc` misuse.

A candidate hazard without an interleaving that names real lines stays in `candidate_hazards` and
is **not** reported as an issue.
