---
name: taint-and-lifecycle-tracker
description: Use when auditing code for resource and memory safety or for untrusted input reaching dangerous sinks - memory, handle, socket, connection, cursor or lock leaks; missing release on error, exception or early-return paths; use-after-free, double-free, dangling references, buffer overflows, iterator invalidation, ownership mismatches, reference cycles, caches and registries that only grow; and taint flowing into SQL, shells, file paths, deserializers, format strings or allocation sizes. Traces a symbol's allocation, ownership, retention and release across every branch, unwind and error exit within a scope. Inspection skill of the System Reliability Agent; usable standalone for "does this leak", "who owns this pointer", "can user input reach this query".
---

# Taint and Lifecycle Tracker

Follow one value from where it is born to every place it can end up - released, leaked, freed
twice, used after death, or handed to a sink that trusts it. Two modes share the same path walk:
**lifecycle** (does every acquisition get exactly one release on every path?) and **taint** (can
untrusted data reach a dangerous sink without a sanitizer on that path?).

## Inputs

| Input | Meaning |
|---|---|
| `symbol` | The variable, pointer, handle, resource type or input parameter to follow. |
| `scope_root` | Where the walk stops: the function, class, module or request handler that bounds the value's intended lifetime. Choose the smallest scope that contains every owner. |

## Procedure - lifecycle mode

### 1. Find every acquisition

Allocation and acquisition sites inside `scope_root`: `new`, `malloc`/`calloc`/`realloc`,
factory calls that return owned objects, `open`/`fopen`/`CreateFile`, sockets, `connect`, pool
`get`/`acquire`, `BEGIN` transaction, cursor/list open, lock acquire, `subscribe`/`addListener`,
timer/interval start, thread/goroutine/task spawn, temp file/dir creation, native handles in FFI.
In labOS: `OpenList`/`CloseList`, `NextObj`/`Release`, and the Cl* ownership idioms
(`ClPointer` return-from-function, container ownership policies).

### 2. Name the owner

For each acquisition, state who is responsible for the release and how a reader can tell: an RAII
wrapper, `using`/`with`/`defer`/`try-with-resources`/`finally`, a documented ownership transfer, an
ownership annotation or policy (e.g. `MemoryPolicy`), a container whose policy deletes its
elements. **An owner you cannot name is a finding candidate.**

### 3. Enumerate every exit path

From each acquisition to the end of `scope_root`: normal return, each early return, each
`throw`/panic/unwind, each error return (`if err != nil { return }`), `break`/`continue`/`goto`
out of a loop holding the resource, cancellation (`ctx.Done()`, `CancellationToken`,
`asyncio.CancelledError`), and ownership transfer (returned, stored in a field/collection, passed
to a callee that takes ownership). For each path record: released? how many times? used after
release?

Error and exception paths are the most common miss. Walk them explicitly - do not assume RAII
covers a spot where a raw `new`/`malloc`/handle was used instead.

### 4. Check the lifecycle hazards

- **Leak**: some path with no release, or release only on the happy path. Finalizer- or
  GC-based closing of OS resources (sockets, files, DB connections) counts as a leak under load:
  it is not deterministic.
- **Retention leak** (GC languages too): the object stays reachable forever - a static map keyed
  by request data, a listener or callback never unregistered, a cache with no bound or eviction, a
  registry that only grows, a `ThreadLocal` in a pooled thread, a closure capturing a large
  object, a substring/slice pinning a large backing array.
- **Double release**: two owners both free; release in both a `catch` and a `finally`; a
  container policy that deletes elements the caller also deletes.
- **Use after release**: dangling pointer or reference, returning a reference/`string_view`/span
  to a local or temporary, a callback firing after its target is destroyed, a cursor used after
  its list closed.
- **Iterator/reference invalidation**: container mutated (`push_back`, `erase`, rehash, `realloc`)
  while a pointer, reference or iterator into it is held.
- **Ownership mismatch**: ownership transferred without the old owner giving up its reference;
  `unique`/`ClPointer` released into a raw pointer nobody frees; `shared_ptr`/`Rc`/`Arc` cycles.
- **Buffer bounds**: size and index arithmetic (signed/unsigned mix, `size_t` underflow,
  off-by-one on `<=`), `memcpy`/`strcpy`/`sprintf` into fixed buffers, lengths taken from input.
- **Pool exhaustion**: a pooled connection or handle held across remote I/O or user think time,
  not returned on an error path, or pool size below the concurrency that can hold one at a time.

Release idioms and their failure modes per language are in `references/release-idioms-and-sinks.md`.

## Procedure - taint mode

### 1. Sources

Anything an untrusted party controls: HTTP params, headers, cookies, bodies, uploaded files and
their names, message-queue payloads, webhook payloads, CLI args in services, environment in
multi-tenant settings, DB fields that users wrote, third-party API responses.

### 2. Propagate

Follow the value through assignments, string formatting and concatenation, collections, object
fields, function arguments and returns, serialization round-trips. Keep the path as a list of
`file:line` hops.

### 3. Sinks

| Sink | Hazard |
|---|---|
| SQL built by concatenation/formatting, ORM `raw`/`extra`/`FromSqlRaw` with interpolation, dynamic identifiers (table/column/ORDER BY) | SQL injection |
| Shell: `system`, `popen`, `exec*` with a shell, `subprocess(..., shell=True)`, `Runtime.exec(String)`, `child_process.exec` | Command injection |
| File paths: `open`, `join`, archive extraction | Path traversal, zip-slip |
| Deserializers: `pickle`, Java native serialization, `BinaryFormatter`, YAML full loaders | Remote code execution |
| Format strings: `printf(user)` | Memory disclosure / corruption |
| Allocation sizes, `memcpy` lengths, array indices | Overflow, memory corruption |
| Loop bounds, batch sizes, thread/task counts, regex patterns, decompression | DoS / resource exhaustion (ReDoS, zip bombs, unbounded ingestion) |

### 4. Sanitizers

A sanitizer counts only if it is on **every** path from source to sink and fits the sink:
parameterized queries or bound parameters; an allowlist for identifiers; argument arrays with no
shell; canonicalize-then-check-prefix for paths; safe loaders; explicit bounds or size caps
before allocation or iteration; rate/concurrency limits. Escaping for the wrong context (HTML
escaping before SQL) is not a sanitizer.

## Output

```json
{
  "lifecycle": [
    {"resource": "conn", "acquired_at": "Repo.cs:31", "owner": "local, using-block missing",
     "paths": [{"exit": "Repo.cs:40 early return on not-found", "released": false}],
     "hazard": "RESOURCE_LEAK"}
  ],
  "taint": [
    {"source": "Request.Query[\"sort\"] at Api.cs:12", "sink": "string.Format into SQL at Repo.cs:58",
     "path": ["Api.cs:12", "Service.cs:20", "Repo.cs:58"], "sanitizer": "none", "hazard": "SECURITY_HAZARD"}
  ]
}
```

Feed each confirmed entry to `synthesize-repro-test`.

## Restraint - do not report

- Process-lifetime singletons and intentionally immortal objects (documented, bounded in count).
- Memory in a short-lived CLI that exits after one pass - unless it grows per iteration of a loop
  whose size is unbounded.
- GC-managed memory that becomes unreachable - that is not a leak.
- A taint path whose source is not actually attacker-controlled in this deployment (e.g. a config
  file only operators write). Say why.
- A sink reached only with values from a closed enum or a validated allowlist.
- A second release that is a documented no-op (e.g. `close()` on an already-closed stream in
  languages that define it as idempotent).
