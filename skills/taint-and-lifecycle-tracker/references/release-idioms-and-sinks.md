# Release idioms and where they fail

For each language: the idiom that guarantees release on every path, and the ways code slips past
it. Project conventions win - in a codebase with its own ownership types (e.g. labOS Cl* types,
`ClPointer`, list/cursor wrappers), check against those.

## C / C++

- **Idiom**: RAII - `std::unique_ptr` / `std::shared_ptr` / house smart pointers, `lock_guard`,
  file and handle wrappers whose destructor releases.
- **Slips**: raw `new` / `malloc` between acquisition and the wrapper taking ownership (an
  exception there leaks); `release()` with no one taking the result; `delete` vs `delete[]`
  mismatch; destructors that throw; handles (`HANDLE`, `FILE*`, sockets, `HKEY`, COM objects)
  held raw; `realloc` result assigned over the only pointer (leaks on failure); C-style early
  returns skipping `free`; `goto cleanup` blocks missing a label.
- **Use-after-free signals**: returning `const T&` to a member of a temporary; `c_str()` or
  `string_view` of a temporary; storing `this` in a callback registry without deregistering in
  the destructor; iterators kept across `push_back`/`insert`/`erase`/rehash.

## Java / Kotlin

- **Idiom**: try-with-resources (`AutoCloseable`); Kotlin `use {}`.
- **Slips**: resource created before the `try` and closed only in the happy path; streams from
  `Files.lines`/`Files.list` never closed; JDBC `ResultSet`/`Statement` not closed when the
  connection is pooled; `ExecutorService` never shut down; listeners registered on long-lived
  objects; `ThreadLocal` values in pooled threads; unbounded `static` caches.

## C# / .NET

- **Idiom**: `using` / `using var` / `await using` (`IDisposable`, `IAsyncDisposable`).
- **Slips**: `new HttpClient()` per call (socket exhaustion - use `IHttpClientFactory` or one
  shared instance); event handlers subscribed to longer-lived publishers and never removed;
  `DbContext` held beyond its unit of work or registered as a singleton; `CancellationTokenSource`
  and `Timer` not disposed; `MemoryCache` with no size limit.

## Go

- **Idiom**: `defer x.Close()` right after a successful acquisition.
- **Slips**: `defer` inside a loop (release only at function return - accumulates handles);
  `resp.Body` not closed (or not drained) on every path; `rows.Close()` missing, or `rows.Err()`
  unchecked; `time.Ticker` never stopped; goroutines blocked forever (leak their stacks and
  everything they reference); `context.WithCancel` / `WithTimeout` cancel func not called.

## Rust

- **Idiom**: ownership and `Drop`.
- **Slips**: `Rc`/`Arc` cycles (use `Weak`); `mem::forget` and `Box::leak`; `unsafe` raw pointers
  and FFI handles; a `MutexGuard` held across `.await`; unbounded channels.

## Python

- **Idiom**: `with` (context managers), `contextlib.ExitStack`, `async with`.
- **Slips**: `open()` without `with` on an error path; relying on refcount-GC to close sockets
  and files (non-deterministic on PyPy and in reference cycles); `requests.Session` or DB
  connections created per call; module-level caches and `lru_cache` without `maxsize` on methods
  (also pins `self`); `__del__` in reference cycles.

## JavaScript / TypeScript

- **Idiom**: `try/finally`, `using` / `await using` (explicit resource management, TS 5.2+ /
  recent runtimes), stream `pipeline()`.
- **Slips**: event listeners and intervals never removed (SPA component unmount, long-lived
  emitters); streams without error handling left open; DB clients from a pool not released on a
  thrown path (`client.release()` outside `finally`); closures capturing large objects in
  module-level maps.

## Taint sinks - safe form per sink

| Sink | Safe form |
|---|---|
| SQL values | Bound parameters / prepared statements. ORM query builders, not string interpolation. |
| SQL identifiers (table, column, sort direction) | Allowlist mapped to constants. Parameters cannot bind identifiers. |
| Shell | Argument array to a direct exec with no shell; allowlist the executable. |
| File paths | Resolve to a canonical absolute path, then verify it stays under the allowed root. Reject `..`, absolute input, and symlink escapes. |
| Deserialization | Data-only formats (JSON with a schema), safe YAML loaders; never native object deserialization of untrusted bytes. |
| Sizes, counts, batch lengths | Explicit upper bound checked before allocating, looping or spawning. |
| Regex from input | Escape it, or run it with a timeout / linear-time engine. |
