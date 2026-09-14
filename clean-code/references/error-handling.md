# Error handling `[ERR]`

Source: *Clean Code* ch. 7 (+ ch. 3 on try/catch, ch. 17 on overridden safeties).
**Load when** writing or reviewing `try`/`catch`/`throw`, error codes or error values,
null/None/nil returns or parameters, Optional/Maybe, or recovery logic.

Core idea: error handling matters, but if it obscures the logic, it's wrong. The happy path
should read cleanly, and the handling should live in its own place, where you can reason about
and test it independently.

**ERR-1 Exceptions over return codes** `[M]` — In exception-based languages, throw rather than
return status flags that every caller must check immediately. That separates the algorithm from
the handling and removes `if (err)` pyramids. *Language note:* in Go, Rust, C or Result-style
code, use the idiomatic error value but keep the principle: early returns, `?`/helpers, and never
ignoring an error.

**ERR-2 Write the try-catch-finally first** `[M]` — When writing code that can fail, start with
the `try` block. It defines a scope where anything can abort, and the `catch` must leave the
program in a consistent state. With TDD, first write a test that forces the failure, then make
it pass. Catch the narrowest exception type that fits.

**ERR-3 Unchecked by default (Java)** `[L]` — Checked exceptions break OCP: one new throw deep
down forces signature changes up the whole call chain, which breaks encapsulation. Reserve them
for critical library APIs where callers truly must handle the case.

**ERR-4 Provide context** `[M]` — Every exception says what operation was attempted and why it
failed, with enough detail to log meaningfully, and it preserves the original cause (chaining).
Detect: `throw new RuntimeException()` with no message; catch-and-rethrow that drops the cause;
messages like "error occurred".

**ERR-5 Define exceptions by the caller's needs** `[M]` — Classify exceptions by *how they are
caught*, not by where they came from. Wrap a third-party API so its many exception types become
one of yours (`PaymentGatewayUnavailable`). Detect: the same multi-`catch` block copied around
every call to a library. The wrapper also minimises dependency on the vendor and makes faking it
in tests easy (see `boundaries.md`).

**ERR-6 Define the normal flow (Special Case)** `[M]` — When a situation is *expected* (a customer
with no discount, a guest user with no profile), don't throw and catch inside business logic.
Return a special-case object that behaves correctly (`NoDiscount`, `GuestProfile`). Detect:
`try`/`catch` used as control flow around an ordinary branch.

**ERR-7 Don't return null** `[M→H]` — Every null return is a latent crash and forces checks at
every call site. Return an empty collection, an `Optional`/`Maybe`, a Special Case object, or throw.
Wrap third-party APIs that return null. Raise to [H] when callers dereference without checking.

**ERR-8 Don't pass null** `[M]` — Passing null into methods is worse than returning it. Make
non-null the codebase default and treat null arguments as a bug, unless an API explicitly
documents that it accepts one. Assertions document the rule but don't prevent the crash. Use
non-null types where the language offers them (Kotlin, TypeScript `strict`, C# nullable
reference types).

**ERR-9 Never silence failures** `[H]` — Empty `catch`; catch-log-and-continue when the caller
needs to know; catch-all blocks that hide bugs; turning off compiler warnings; skipping failing
tests to get green. These override the safeties that keep a system honest.

**ERR-10 Keep handling separate** `[M]` — Keep recovery and translation code in dedicated
functions or classes, apart from the main logic. A function that handles errors does nothing
else (FUN-14). Put the `try` around the smallest operation that can fail, not around a whole
loop of unrelated work.

## Don't over-apply
- Validate at trust boundaries (user input, external data); don't sprinkle defensive null checks
  on values the type system or caller already guarantees.
- Performance-critical or embedded code may legitimately use error codes; keep them local and
  consistent.
- Retries, fallbacks and circuit breakers are handling logic: they belong in the handling layer,
  not inline in business rules.
