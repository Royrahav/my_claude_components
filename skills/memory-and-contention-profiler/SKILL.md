---
name: memory-and-contention-profiler
description: Use when auditing code for performance and resource-growth hazards - hidden O(N^2) or worse complexity, hot-path allocations and heap churn, redundant copies and clones, unbounded buffers, queues, caches and collections, non-streaming payloads, unbuffered or chatty I/O, blocking calls on event loops, lock contention and convoys on critical paths, hot atomics, cache-line false sharing, and thundering herds. Analyzes loops, allocations and lock boundaries in a code block to estimate how often it runs, its complexity with a named realistic N, allocations per operation, memory growth bound and contention points. Inspection skill of the System Reliability Agent; usable standalone for "is this fast enough", "will this scale", "why does memory keep growing".
---

# Memory and Contention Profiler

Estimate what a block of code costs per operation and how that cost scales, then decide whether
it holds at production frequency and size. A cost only matters multiplied by how often it runs:
the first job is always to find the frequency.

## Inputs

| Input | Meaning |
|---|---|
| `code_block` | The function, loop, or region to profile, identified by `file:start-end`. |

## Procedure

### 1. Frequency class - how often does this run?

Find the call sites (LSP `findReferences`, call hierarchy) and classify the block:

| Class | Examples |
|---|---|
| `hot` | Per request, per message, per row of a large result, per frame/tick, inner loop of a batch. |
| `warm` | Per user action, per batch (not per item), periodic job every few seconds or minutes. |
| `cold` | Startup, shutdown, admin tools, migrations, one-shot scripts, error paths that should be rare. |

Cold blocks are out of scope unless the cost is catastrophic (unbounded memory, hours of CPU).

### 2. Complexity with a named N

For each loop and each call inside a loop, write the bound in terms of **named** inputs
("O(orders x lines)", not "O(N^2)"), then give each input's realistic size and where the size
comes from (schema, config limit, API page size, business volume, test fixtures).

Hidden-quadratic patterns to look for:
- A membership test or search on a list/array inside a loop: `in` on a list, `indexOf`,
  `contains`, `find`, `includes`, `Array.find` inside `.map`/`.filter`, LINQ `.Any()`/`.Count()`
  on a re-enumerated `IEnumerable`.
- Repeated string concatenation in a loop in languages with immutable strings (Java, C#, Python,
  Go, JS engines under some patterns) - use a builder or join.
- Removing from or inserting at the front of an array-backed list in a loop.
- Sorting or re-building an index inside a loop; compiling a regex inside a loop.
- Recomputing an aggregate over the whole collection per element.
- A query inside a loop - hand it to `query-plan-and-index-analyzer` as an N+1.
- Nested loops joining two collections that a hash map keyed on the join field would make linear.

### 3. Allocations per operation (hot and warm blocks)

Count what each execution allocates: temporary collections, boxing, closures and lambdas
capturing state, iterator objects, defensive copies, string formatting (including log messages
built before the level check), exceptions used for control flow, reflection or serialization per
call, regex objects. In C++: pass-by-value of containers and strings, missing `std::move`,
range-`for` by value, `std::function` wrapping, `shared_ptr` copies (atomic refcount traffic).
Compilers already elide some copies (RVO/NRVO, small-string optimization) - do not count those.

### 4. Memory growth bound

For every collection, buffer, queue, channel, cache or map the block writes to, state the bound
on its size and what enforces it. **No bound + fed by external input or time = unbounded growth.**
Check:
- Caches without size limit or eviction; maps keyed by request, user or time data.
- Unbounded queues or channels between a fast producer and a slower consumer (no backpressure).
- Reading a whole file, HTTP body, or result set into memory where streaming would do.
- Accumulating a full result before returning it when the caller streams it anyway.
- Slices, substrings or views that pin a much larger backing buffer.

### 5. Contention

- **Lock scope**: a lock held across I/O, logging, allocation-heavy work or callbacks on a hot path
  serializes every caller. Estimate the hold time and the number of contending contexts.
- **Global or coarse locks** on hot paths where sharding or lock striping would split contention.
- **Hot atomics**: a counter or flag written by every core on every operation - cache-line
  ping-pong. Fix with per-thread or sharded counters aggregated on read.
- **False sharing**: independent fields or array slots written by different threads that land in
  the same 64-byte cache line (arrays of per-thread counters, adjacent hot fields in one struct).
  Fix with padding or alignment (e.g. `alignas(64)`, `@Contended`, per-thread structs).
- **Reader-writer locks** where writers are frequent (worse than a plain mutex) or can starve.
- **Thundering herd**: `notify_all`/broadcast waking many waiters for one item; many callers
  recomputing the same expired cache entry at once (fix: single-flight / request coalescing).

### 6. I/O pattern

- Unbuffered reads or writes (byte-at-a-time, line-at-a-time on raw streams, `fsync` per record).
- Blocking I/O or CPU-heavy work on an event loop or UI thread - it stalls every other request.
- Many small network calls where a batch API exists; chatty RPC in a loop.
- Serialization overhead: re-encoding the same payload per hop, parsing huge JSON documents
  fully to read one field.

### 7. Quantify and, when cheap, measure

Write the estimate: frequency class, complexity with realistic N, allocations per op, growth
bound, contention points, and the N or load at which the block crosses its budget (request
latency target, batch window, memory limit). If the project already has a benchmark harness (Go
`testing.B`, JMH, BenchmarkDotNet, pytest-benchmark, Google Benchmark), you may run existing
benchmarks. Never add or edit files to measure.

## Output

```json
{
  "block": "Importer.cs:40-88",
  "frequency_class": "hot (per uploaded row; files up to 200k rows)",
  "complexity": {"time": "O(rows x existingSkus)", "space": "O(rows)", "realistic_N": "rows=200k, existingSkus=50k (catalog table)"},
  "allocations_per_op": "1 List<string> copy of the catalog per row",
  "growth_bound": "none - results list holds all rows before write",
  "contention_points": [],
  "hazards": [{"type": "CPU_BOTTLENECK", "summary": "List.Contains over 50k SKUs per row -> 10^10 comparisons per file", "fix": "HashSet<string> built once before the loop -> O(rows)"}]
}
```

## Restraint - do not report

- Anything in a `cold` block that is not catastrophic.
- Quadratic work over collections that are small and bounded by construction (name the bound).
- Micro-optimizations: a copy or allocation per operation on a warm path with no measurable
  impact at the stated frequency.
- Costs the compiler or runtime removes (copy elision, escape analysis, string interning).
- "Premature optimization" rewrites that trade clarity for speed with no stated budget being
  missed. If you cannot name the budget and the N that breaks it, it is not a hazard.
