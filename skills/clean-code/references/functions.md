# Functions `[FUN]`

Source: *Clean Code* ch. 3 + ch. 17 function and general heuristics. **Load when** writing or
changing a function or method body: its logic, conditionals, loops, parameters, return values,
or its size and structure.

Core idea: functions are the verbs of the system's language. Each should be small, do one thing
at one level of abstraction, and have a name that makes reading its body unnecessary.

## Size and structure
**FUN-1 Small, then smaller** `[M]` — Functions should be a handful of lines and rarely exceed
~20. Blocks inside `if`/`else`/`while` should ideally be a single line: a call to a well-named
function. Detect: needs scrolling; has blank-line "sections"; is longer than about one screen.

**FUN-2 Shallow nesting** `[M]` — Keep control-flow indentation to 1–2 levels. Detect: `if`
inside `for` inside `if` inside `try`. Fix: guard clauses, extracted functions, polymorphism.

**FUN-3 Do one thing** `[M]` — A function does one thing when every step in it sits exactly one
level of abstraction below its name. It should read as a "to" paragraph: *to check out a cart,
we price the items, apply discounts, then charge the customer*. The test: if you can extract
another function whose name is not just a restatement of the code, the original did more than
one thing. Detect: sections labelled declare / initialise / process; the word "and" in an honest
description.

**FUN-4 One level of abstraction** `[M]` — Don't mix high-level policy (`applyDiscounts()`) with
low-level detail (string appends, index math, raw SQL) in the same body. Mixed levels make the
reader guess which lines are essential and invite more detail to pile up.

**FUN-5 Stepdown rule** `[L]` — Code reads top-down: each function is followed by the functions
it calls, one level lower. Callers go above callees.

## Names and arguments
**FUN-6 Switch/if-chains on type: at most once** `[M]` — A switch over a type code grows with
every new type (breaking SRP and OCP), and usually repeats in other functions. Tolerate it once,
buried in a factory that creates polymorphic objects; the rest of the system dispatches through
the interface. Detect: the same `switch (employee.type)` in `pay()`, `isPayday()` and `report()`.

**FUN-7 Descriptive, consistent names** `[L]` — A long, descriptive name beats a short cryptic
name plus a comment. Keep phrasing consistent within a module (`loadDraftOrders`,
`loadPaidOrders`). The name must say what the function does: `date.add(5)` is ambiguous;
`addDays(5)` is not. Keyword-style names can encode argument order (`assertExpectedEqualsActual`).

**FUN-8 Few arguments** `[L→M]` — Zero arguments is ideal, one good, two acceptable, and three
needs justification; more needs a very good reason. Arguments burden both readers and tests
(every combination). Detect: 3+ params; adjacent same-typed params the caller can swap by
mistake. Fix: an argument object for a concept that travels together (`DateRange`, `Point`); move
the function onto the object that owns the data; split the function. Two arguments are fine when
they form a natural pair (`Point(x, y)`).

**FUN-9 Clean monads** `[L]` — Common one-argument forms: ask a question about the argument
(`fileExists(path)`); transform it and *return* the result (`open(path) -> Stream`); or signal an
event (input only, changes system state; name it so it's clearly an event). Don't transform an
argument in place and return void.

**FUN-10 No flag arguments** `[M]` — A boolean (or selector enum/int) parameter announces that
the function does two things. Detect: `render(true)`, `save(user, false)`, a parameter used only
to pick a branch. Fix: two intention-named functions (`exportAsDraft()`, `exportAsFinal()`).

**FUN-11 No output arguments** `[M]` — Readers expect arguments to be inputs. If a function must
change state, let it change its own object: `invoice.addTaxLine()`, not `addTaxLine(invoice)`.

## Behaviour and side effects
**FUN-12 No hidden side effects** `[H]` — A function that promises one thing but also changes
other state (initialises a session, mutates a global, edits its argument, writes a cache the
caller relies on) is a lie that creates temporal coupling and order-dependent bugs. Detect: a
`check*`, `get*`, `is*` or `validate*` function that writes. Fix: remove the effect, or split it
out and name it (NAM-18).

**FUN-13 Command–query separation** `[M]` — A function either does something or answers
something, never both. `if (enableFeature("beta"))` leaves the reader unsure whether it asks or
tells. Fix: `if (!isFeatureEnabled("beta")) enableFeature("beta")`. Exception: operations
whose atomicity is the point (`compareAndSet`, `putIfAbsent`, `pop`) may combine them.

**FUN-14 Error handling is one thing** `[M]` — Prefer exceptions (or the language's idiomatic
error channel) to returned status codes that force nested checks (ERR-2). Extract the body of a
`try` into its own function; a function that handles errors should do nothing else. If `try`
appears, it is the first statement and nothing follows the `catch`/`finally`.

**FUN-15 No error-code magnet** `[L→M]` — A shared enum or class of error codes imported
everywhere makes every new error expensive, so people reuse old, wrong codes. Use derived
exception types (or per-module error types) instead; new ones can be added without touching old
code.

**FUN-16 Hidden temporal coupling** `[M→H]` — If calls must happen in a set order, make the order
unavoidable: have each step return what the next step needs (`parsed = parse(raw);
report = summarize(parsed)`), so the order is visible and a wrong order fails to compile or run.
Detect: `a(); b(); c();` sharing mutable fields, where swapping lines silently breaks things.

**FUN-17 Be precise** `[M→H]` — Don't be lazy about decisions: don't use floating point for money;
handle the empty, null or duplicate case you know can happen; don't assume a query returns
exactly one row; guard against concurrent updates when they are possible; don't leave ambiguous
behaviour for the caller to guess.

## Readability of logic
**FUN-18 Encapsulate conditionals** `[L]` — Name boolean logic: `if (isEligibleForRefund(order))`
over `if (order.isPaid() && !order.isShipped() && order.ageDays() < 30)`.

**FUN-19 Avoid negative conditionals** `[L]` — `if (cache.isStale())` over
`if (!cache.isNotStale())`.

**FUN-20 Explanatory variables** `[L]` — Break a dense calculation into intermediate values with
meaningful names (`key`, `value`, `isOverdue`). More variables are fine if each one explains.

**FUN-21 Encapsulate boundary conditions** `[L]` — Put `+1`/`-1` adjustments in one named place
(`nextLevel = level + 1`) rather than scattering them across expressions.

**FUN-22 Make logical dependencies physical** `[M]` — A function shouldn't silently assume
something about another module (a hard-coded page size that really belongs to the formatter).
Ask the owning module explicitly (`formatter.pageSize()`).

**FUN-23 Understand the algorithm** `[M]` — Don't stop when tests pass after you've piled on
`if`s and flags. Refactor until the function is so clean it's obviously correct.

**FUN-24 Delete dead functions** `[L]` — Remove functions that are never called. Version control
remembers them.

**FUN-25 DRY** `[M]` — Repeated algorithms, sequences or conditionals belong in one place.
For how far to go, see `emergence.md` (EMG-3).

## How to write functions like this
Nobody writes them this way on the first pass. Write the draft: long, nested, clumsy names,
duplication. Cover it with tests, then refine: extract, rename, remove duplication, reorder.
Keep the tests passing after every small step. Stop when each function tells its part of the
story in a few lines.

## Don't over-apply
- Extraction that produces many one-line functions called once, forcing readers to jump around,
  is over-application; minimal elements still counts (EMG-5).
- If extracting would require passing five locals, extract a class (method object) instead.
- Hot inner loops may justify inlining; measure first and comment the reason.
- Language idioms win: Go's `(value, err)` returns, Rust's `Result`, early returns and guard
  clauses are all fine. Single-entry/single-exit only matters in large functions, and small
  functions may use `return`, `break` and `continue` freely (never `goto`).
