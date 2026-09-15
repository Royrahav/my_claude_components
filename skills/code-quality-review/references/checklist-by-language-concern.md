# Deep-Pass Checklist by Concern Area

Consult this file for a thorough review pass — a first-time review of unfamiliar or
critical code, code touching money/auth/user data, or anything explicitly flagged as
concurrent, security-sensitive, or performance-sensitive. Skip it for a quick sanity pass
on low-stakes code; use the five categories in SKILL.md for that instead.

## Concurrency bugs

- [ ] Shared mutable state (module-level variable, static field, singleton, cache) written
      from more than one thread/task/request handler — is access synchronized (lock,
      mutex, atomic, actor, single-threaded event loop guarantee) or is it a race?
- [ ] Check-then-act sequences (`if key not in cache: cache[key] = compute()`,
      `if not exists(row): insert(row)`) — can two callers interleave between the check
      and the act, producing a duplicate insert, lost update, or double-execution?
- [ ] Lock ordering — if more than one lock/mutex can be held at once, is the acquisition
      order consistent everywhere, or can two code paths acquire the same two locks in
      opposite order (deadlock)?
- [ ] Async/await correctness — is every promise/future/task actually awaited, or can a
      fire-and-forget call let an error escape unhandled or let the caller proceed before
      the operation completes?
- [ ] Cancellation and timeouts — if an operation is cancelled or times out mid-flight,
      is partially-mutated shared state left consistent, and are resources (connections,
      locks) still released?
- [ ] Idempotency of retried operations — if a network call is retried after a timeout
      (where the first attempt may have actually succeeded server-side), is the retried
      operation safe to apply twice (idempotency key, upsert, dedup check)?
- [ ] Signal/interrupt handling in long-running processes — does a shutdown signal let
      in-flight work finish or drop it silently?
- [ ] Ordering guarantees — does code assume events/messages arrive in the order sent,
      when the transport (queue, pub/sub, network) doesn't guarantee that?

## Security-relevant patterns

- [ ] Injection: is any user-controlled string concatenated directly into a SQL query,
      shell command, file path, regex, HTML template, or `eval`-like construct instead of
      using parameterization/escaping/allowlisting?
- [ ] Secrets in code: any API key, password, token, or connection string with embedded
      credentials committed as a literal, rather than sourced from environment/secret
      manager? (Check config files and test fixtures too, not just application code.)
- [ ] Path traversal: is a user-supplied filename/path used to read/write a file without
      normalizing and confirming it stays within an intended base directory?
- [ ] Authentication/authorization: does every endpoint/handler that needs an identity
      check actually run one, and does every action needing an ownership/permission check
      verify it against the *authenticated* actor (not a client-supplied ID field)?
- [ ] Insecure deserialization: is untrusted data passed to a deserializer capable of
      instantiating arbitrary types or executing code (e.g., unsafe pickle/YAML load,
      Java native deserialization) instead of a safe/schema-constrained parser?
- [ ] Sensitive data in logs: are passwords, tokens, full card numbers, or PII written to
      logs, error messages, or crash reports in plaintext?
- [ ] Cryptography: any use of a known-broken algorithm (MD5/SHA1 for passwords, ECB mode,
      a hand-rolled cipher), or a fixed/predictable IV, salt, or nonce?
- [ ] SSRF: does server-side code fetch a URL built from user input without restricting
      scheme/host (e.g., blocking internal/link-local addresses)?
- [ ] Randomness: is a non-cryptographic PRNG (e.g., `Math.random`, `rand()`) used to
      generate a token, password reset code, or session identifier?

## Performance footguns

- [ ] N+1 queries: does a loop over a collection issue one database/API call per element
      instead of a single batched call (look for a query call inside a `for`/`map` over
      rows just fetched)?
- [ ] Unbounded loops/allocations: can a loop's iteration count or a collection's growth
      be driven by external/user input with no upper bound or pagination, risking
      unbounded memory or CPU?
- [ ] Quadratic behavior on hot paths: is there a nested loop or repeated linear search
      (`.indexOf`/`.includes` inside a loop) over data whose size scales with user/production
      load, where a set/map lookup would make it linear?
- [ ] Synchronous blocking calls on a request-handling hot path (blocking I/O, `sleep`,
      heavy CPU work) in a single-threaded or limited-worker-pool runtime, which stalls
      other requests.
- [ ] Repeated expensive work with no caching/memoization where the input is provably
      unchanged across calls within the same request/operation.
- [ ] Large payloads loaded fully into memory (entire file, entire query result set) where
      streaming/pagination/cursor-based iteration is available and the data size is
      unbounded.
- [ ] Missing indexes implied by query patterns — a query filtering/sorting/joining on a
      column with no supporting index, on a table that will grow.
- [ ] Excessive object allocation inside a tight loop (e.g., allocating a new regex,
      formatter, or large data structure per iteration instead of hoisting it out).

## API contract stability

- [ ] Backward compatibility: does a change to a public function/endpoint/exported type
      alter its signature, remove a field, change a field's meaning, or change error
      behavior in a way that breaks existing callers who followed the old contract?
- [ ] Versioning: if a breaking change is genuinely necessary, is it introduced as a new
      version/endpoint/flag rather than mutating the existing contract in place?
- [ ] Silent semantic changes: does the *type signature* stay the same while the
      *behavior* changes (e.g., a function that used to return `null` for "not found" now
      throws, or a previously-inclusive range becomes exclusive)? These are the most
      dangerous because they don't show up as compile errors.
- [ ] Deprecation path: is a removed/changed capability given a deprecation warning and a
      migration window, or removed outright?
- [ ] Serialization stability: for data crossing a process boundary (API response, message
      queue payload, persisted record), does a field rename/removal break older
      producers/consumers still using the previous shape?
