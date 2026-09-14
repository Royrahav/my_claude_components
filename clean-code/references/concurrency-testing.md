# Concurrency — testing threaded code `[CTS]`

Source: *Clean Code* ch. 13 (testing threaded code) + Appendix A (testing multithreaded code,
tool support). **Load when** writing or reviewing tests for concurrent code, or investigating
intermittent ("flaky") failures that could be races.

Core idea: tests can't prove concurrent code correct, but well-designed tests can make failures
much more likely to show up. Write tests that can expose problems, run them often and in many
configurations, and chase down *every* failure.

**CTS-1 Treat spurious failures as threading bugs** `[H]` — Never dismiss a one-off failure as a
"cosmic ray" or "just flaky". Rare failures are the hardest to reproduce, and dismissing them
lets real races ship. Detect: retries added to make a test pass; `@Flaky` or rerun annotations
with no investigation.

**CTS-2 Get the non-threaded code working first** `[M]` — Make sure the logic works on its own as
plain code, tested outside any thread. Don't chase logic bugs and threading bugs at the same time.

**CTS-3 Make threaded code pluggable** `[M]` — Be able to run it with one thread, several, or
many; with real collaborators or test doubles; with doubles that run fast, slow or at variable
speed; and for a configurable number of iterations. That usually means injecting the
executor/scheduler and keeping the task logic separate (CON-2).

**CTS-4 Make it tunable** `[L]` — Thread counts and pool sizes are configurable, ideally at
runtime. Consider self-tuning based on throughput and utilisation.

**CTS-5 Run with more threads than cores** `[M]` — Forcing frequent task switching exposes missing
critical sections and deadlocks.

**CTS-6 Run on every target platform, early** `[M]` — Threading behaviour differs between
operating systems, runtimes and hardware. Run the suite on all deployment platforms from the start.

**CTS-7 Instrument to force failures** `[M]` — Vary the interleavings deliberately:
- *Hand-coded:* insert yields and sleeps at suspect points. This is scattershot, it pollutes the
  code, and it must never reach production.
- *Automated (preferred):* a jiggle hook that is a no-op in production and randomly sleeps,
  yields or proceeds in test runs, placed through decoration or AOP; or dedicated tools. Modern
  equivalents: Go `-race`, ThreadSanitizer (C/C++/Rust), jcstress and stress harnesses (JVM),
  Coyote (.NET), loom-style model checkers (Rust).
Run many iterations: each run explores different orderings.

**CTS-8 Assert invariants under load** `[M]` — For a suspected race, run the operation from many
threads many times and check an invariant (the final count equals the number of operations; no
duplicate IDs handed out). Use latches or barriers to line threads up so they collide on purpose.

**CTS-9 Test shutdown paths** `[M]` — Include tests that stop the system mid-work and assert that
workers terminate, queues drain or are rejected cleanly, and nothing hangs (with a timeout on the
test itself).

## Don't over-apply
- Sleeping in a test to "wait for" async work is a flakiness source, not instrumentation. Wait on
  explicit signals (futures, latches, polling with a timeout).
- Pure-logic unit tests shouldn't spin up threads. Keep those fast (TST-9).
