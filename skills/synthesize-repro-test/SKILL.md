---
name: synthesize-repro-test
description: Use when a concurrency, resource, performance, SQL or boundary hazard has been traced and needs a minimal deterministic reproduction - a concurrent stress harness under a race detector or TSan, a forced-interleaving test with barriers or latches, a deadlock test with a timeout, a leak test under ASan/Valgrind or handle counting, a complexity-scaling test, a query-count or plan assertion for N+1 and scans, a two-session transaction-collision fixture, or a hostile-input test. Produces a test definition that fails on the current code and passes once the fix enforces the invariant. Inspection skill of the System Reliability Agent (it specifies the test; the Unit Test Agent writes it); usable standalone for "write a repro for this race", "prove this leaks".
---

# Synthesize Repro Test

Turn a traced hazard into a test that **fails deterministically on the current code** and
**passes once the invariant holds**. A repro that fails one run in fifty proves little and makes
a flaky suite. Force the bad interleaving or workload; do not hope for it.

This skill produces a test **definition**. In the System Reliability Agent it becomes the
`negative_test_harness` field and the Unit Test Agent writes the actual test. Used standalone,
write the test only if the user asked for it.

## Inputs

| Input | Meaning |
|---|---|
| `hazard_type` | `DATA_RACE` \| `DEADLOCK` \| `RESOURCE_LEAK` \| `CPU_BOTTLENECK` \| `SQL_INEFFICIENCY` \| `MEMORY_CORRUPTION` \| `SECURITY_HAZARD` |
| `trace_manifest` | The output of the skill that found the hazard (`trace-call-and-lock-graph`, `taint-and-lifecycle-tracker`, `query-plan-and-index-analyzer`, `memory-and-contention-profiler`): the lines, contexts, interleaving or workload. |

## Procedure

### 1. Pick the repro shape for the hazard type

| hazard_type | Repro shape | Assertion |
|---|---|---|
| `DATA_RACE` | Two or more contexts driven to the racing lines, with the interleaving forced at the preemption point; run under the race detector / TSan where the language has one. | The invariant the race breaks (lost increment, duplicate row, torn read), or zero detector reports. |
| `DEADLOCK` | Two contexts acquiring in opposite orders, each paused at the midpoint by a barrier. | Both complete within a timeout. The test **fails on timeout** - it never hangs the suite. |
| `RESOURCE_LEAK` | Drive the leaking path (usually the error path) K times in a loop. | Open handles / pool checked-out count / live object count / RSS delta is constant in K - or zero leaks under ASan/LeakSanitizer/Valgrind. |
| `CPU_BOTTLENECK` | Run at N and at kN. | The runtime or operation-count ratio matches the intended bound (about k for linear), not k^2. Count operations when possible; wall-clock ratios need generous margins. |
| `SQL_INEFFICIENCY` | For N+1: load N parents through the real code path with a query counter. For scans: `EXPLAIN` the generated SQL on a seeded schema. For lock/transaction hazards: two sessions stepped explicitly. | Query count is constant in N; the plan does not contain the scan node on the table; the second session does not deadlock / lose the update. |
| `MEMORY_CORRUPTION` | The minimal input that drives the out-of-bounds, use-after-free or double-free line, run under ASan/UBSan (C/C++) or Miri (Rust `unsafe`). | Zero sanitizer reports; the value read back is intact. |
| `SECURITY_HAZARD` | The hostile input (injection payload, `../` path, oversized batch) sent through the real entry point. | The sink is never reached with the payload (assert on the query/command actually issued, or the file actually touched), or the input is rejected; resource use stays under the cap. |

### 2. Force the interleaving or workload

In order of preference:
1. **An existing seam** - an injectable dependency, a hook, a virtual method, a mock of the
   callee between check and act - that blocks on a latch/barrier until the other context reaches
   its point.
2. **Explicit stepping** - for DB hazards, two connections driven statement by statement from the
   test: `Tx1 BEGIN; Tx1 SELECT; Tx2 BEGIN; Tx2 UPDATE; Tx2 COMMIT; Tx1 UPDATE; Tx1 COMMIT;` then
   assert on the final row.
3. **Detector-assisted stress** - when there is no seam: many iterations across many contexts
   under the race detector or TSan, with preemption increased where possible (Go `-race
   -count=N`, Python `sys.setswitchinterval(1e-6)`, `-cpu` flags). Mark the harness
   **probabilistic** and name the seam the fix should introduce so it can become deterministic.

Keep timeouts on everything that can block. A repro that hangs CI is worse than none.

### 3. Fit the project

Detect the project's test framework, file layout, naming and fixtures, and write the definition
in them: `go test`, pytest, JUnit/jcstress, xUnit/NUnit/MSTest, GTest, Jest/Vitest, `cargo test`.
In labOS VC++ that is GTest under `UnitTests\VC++\UT_Runner_<Module>` with Cl* types - follow the
`testing-gtest` skill when it is available. Use the house synchronization primitives in the test
where the production code uses them. Templates per language are in
`references/harness-templates.md`.

### 4. State the pass/fail contract

The definition must say, concretely:
- **framework and file** - where the test goes;
- **setup** - fixtures, seeded data, and sizes (N, K, number of contexts);
- **forcing mechanism** - the seam, latch or stepping sequence, or `probabilistic` with the
  iteration count;
- **assertion** - what is checked, and why it fails now and passes after the fix;
- **run command** - including `-race`, sanitizer flags or build targets.

Keep the embedded code short (about 40 lines at most); the Unit Test Agent expands it.

## Output

A single string for `negative_test_harness`, or the same fields as an object when used
standalone:

```
Framework: go test (pkg ./inventory). File: inventory/reserve_race_test.go.
Setup: stock row qty=1; two goroutines call Reserve(sku, 1).
Forcing: inject a fake StockRepo whose Get() waits on a shared barrier(2), so both goroutines
read qty=1 before either writes.
Assert: exactly one Reserve returns nil and final qty == 0. Now: both succeed, qty == -1.
Run: go test -race -run TestReserveConcurrent -count=20 ./inventory
```

## Restraint

- Do not synthesize a repro for a hazard that has no trace. The repro proves a trace; it does not
  replace one.
- Do not design a test that passes only because of timing on the author's machine (fixed sleeps
  as synchronization). Use latches, barriers and explicit stepping.
- Do not assert on absolute wall-clock time for performance - use operation counts or ratios.
- Do not require infrastructure the project does not have (a real cluster, production data). Use
  the project's existing test database or container fixtures, or say what is missing.
