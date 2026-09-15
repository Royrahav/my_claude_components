---
name: clean-code
description: This skill should be used when writing, refactoring or reviewing code and the concern is craftsmanship at the name, function, class, test or module level — readability, naming, function size and arguments, comments, formatting, objects vs data structures, error handling and nulls, third-party boundaries, unit-test quality, class responsibilities, system wiring, duplication and simple design, or concurrency. Also use when the user mentions "clean code", "Uncle Bob", "code smells", "is this readable", "refactor this", or asks for a clean-code review. Also use when the user asks for a clean-code "dry run" or "demo", or wants to see what this skill can do: it then generates a random, feature-rich but messy program, refactors it by the skill's rules and shows the before/after differences. The skill is a router distilled from Robert C. Martin's *Clean Code* (17 chapters + Appendix A). Load this file first; it tells a developer or reviewer agent which one to three topic files under references/ to load for the code at hand. Never bulk-load the references.
---

# Clean Code — core and router

This file stays small on purpose. It holds the always-on rules and two maps that decide which
knowledge files to load for the code in front of you. The knowledge lives in `references/`, one
tagged file per topic, and each rule has a stable ID (`FUN-10`) and a severity tag
(`[H]`/`[M]`/`[L]`).

## Loading protocol (follow exactly)
1. **Pick your mode.** WRITE: you are producing or changing code. REVIEW: you are judging code,
   including your own before calling it done. DRY RUN: the user wants a demonstration of the
   skill. Load `dry-run.md` and follow it; it drives REVIEW mode and then WRITE mode over code
   it generates.
2. **Match the code in scope against the map for your mode.** In scope means the diff, the
   function you're about to write, or the file you're editing. WRITE mode uses the Context map;
   REVIEW mode uses the Symptom map.
3. **Load only the files the map names. Budget: ≤ 3 files per pass, never more than 4.** If more
   match, take the ones covering the most changed lines, and load the rest only if the work
   reaches them.
4. **Load lazily.** When work drifts into a new area (you start adding a lock, a `try`, a test),
   load that file *then*. Never load a file "just in case".
5. **Don't reload** a file that is already in context this session.
6. **Read by mode.** WRITE mode reads each rule's statement and *Fix*. REVIEW mode reads *Detect*
   and always the file's **Don't over-apply** section before reporting.

## Always-on rules (apply without loading anything)
- **Names reveal intent.** If a name needs a comment, rename it. No magic literals.
- **Functions are small and do one thing** at one level of abstraction. No flag arguments, no
  hidden side effects, and a function either does something or answers something (not both).
- **No duplication:** the same knowledge lives in one place.
- **Comments explain *why*,** never *what*. Delete commented-out code.
- **Errors never disappear silently.** Don't return or pass null when the language offers
  better options.
- **Tests are production-grade code:** fast, independent, repeatable, and written with the change.
- **Project conventions and language idioms override** the book's Java-era style.
- **Boy Scout Rule:** leave touched code a little cleaner, within the scope of the task.

## Context map — WRITE mode (what are you about to write or change?)
| The code you're about to write or change involves… | Load |
|---|---|
| New or renamed identifiers: variables, functions, classes, files, constants | `references/naming.md` |
| A function or method body: logic, conditionals, loops, parameters, return values | `references/functions.md` |
| Comments, docstrings, TODOs, file headers | `references/comments.md` |
| A new file, file reorganisation, member ordering, style or formatter config | `references/formatting.md` |
| DTOs, records, structs, entities, getters and setters, chained access `a.b().c()` | `references/objects-and-data.md` |
| `try`/`catch`/`throw`, error codes or values, null/None/nil, Optional | `references/error-handling.md` |
| A third-party library, SDK or external API; wrapping one; an API that doesn't exist yet | `references/boundaries.md` |
| Test files, fixtures, test helpers, TDD | `references/unit-tests.md` |
| Creating or growing a class or module: responsibilities, fields, inheritance, interfaces | `references/classes.md` |
| `main` or bootstrapping, DI wiring, factories, config and defaults, frameworks, cross-cutting logging/tx/auth/caching, build scripts | `references/systems.md` |
| Removing duplication, choosing how far to abstract, "is this over-engineered?", rules in conflict | `references/emergence.md` |
| Threads, async tasks, executors, locks, atomics, shared mutable state, queues, worker shutdown | `references/concurrency.md` |
| Tests for concurrent code; intermittent failures that might be races | `references/concurrency-testing.md` |
| Restructuring existing or legacy code, multi-step refactors, reviewing a whole module | `references/refactoring-workflow.md` |
| Justifying cleanup vs. deadline; explaining to a human why it matters | `references/foundations.md` |

**Quick picks:**
- new feature logic → `functions` + `naming`
- new class → `classes` + `naming` (+ `objects-and-data` for data holders)
- integrating an API → `boundaries` + `error-handling`
- writing tests → `unit-tests` (+ `concurrency-testing` for threaded code)
- cleaning up legacy code → `refactoring-workflow` + whatever the Symptom map flags

## Symptom map — REVIEW mode (also the WRITE-mode self-check before "done")
Scan the code for these signals *without loading anything*. Load a file only to confirm a rule
you intend to cite (see the review rules below).

| You see… | Suspect | File |
|---|---|---|
| `d`, `tmp`, `data`, `info`, `obj` in non-trivial scope; a name needing a comment | NAM-1, NAM-4, NAM-5 | naming |
| Bare literal with domain meaning (`== 4`, `* 86400`, `"X"`) | NAM-2 | naming |
| Type/member prefixes (`strName`, `m_x`); a list name on a set; near-identical names | NAM-6, NAM-3 | naming |
| Sibling APIs using different verbs for one concept, or one word for two meanings | NAM-11, NAM-12 | naming |
| Name describes implementation (`dial`, `hashMapOfX`) or hides what the function really does | NAM-16, NAM-18 | naming |
| Function > ~20 lines, blank-line "sections", nesting > 2 levels | FUN-1, FUN-2, FUN-3 | functions |
| Business steps mixed with low-level string/index/SQL detail | FUN-4 | functions |
| Boolean or selector parameter (`export(true)`) | FUN-10 | functions |
| ≥ 3 parameters; adjacent same-typed params; output argument mutated | FUN-8, FUN-11 | functions |
| `get`/`check`/`is`/`validate` that also writes state | FUN-12 `[H]` | functions |
| Returns status *and* changes state (`if (set(...))`) | FUN-13 | functions |
| Calls that must run in an order nothing enforces | FUN-16 | functions |
| Same `switch`/`if` chain on a type in more than one place | FUN-6, CLS-13 | functions |
| Dense boolean expression inline; `!isNot…`; scattered `+1`/`-1` | FUN-18, FUN-19, FUN-21 | functions |
| Float for money; "can't happen" case unhandled; assumes a single row | FUN-17 | functions |
| Comment restating code; boilerplate doc on trivial members; changelog/author comments | CMT-10, CMT-14, CMT-13 | comments |
| Commented-out code | CMT-18 | comments |
| Comment contradicting code, or describing code elsewhere | CMT-11, CMT-20 | comments |
| Comment explaining a messy block a name could replace | CMT-15 | comments |
| File > ~500 lines; callees above callers; declarations far from use; SQL/HTML strings embedded in logic | FMT-2, FMT-6, FMT-7, FMT-12 | formatting |
| Getter + setter for every field; a class with public data *and* business behaviour | OBJ-1, OBJ-5 | objects-and-data |
| `a.getB().getC().doD()` across objects | OBJ-3, OBJ-4 | objects-and-data |
| A method using another object's getters more than its own fields; business rules in DTOs/ORM models | OBJ-7, OBJ-6 | objects-and-data |
| Empty `catch`; catch-log-continue; disabled warnings or tests | ERR-9 `[H]` | error-handling |
| Returns or passes null where empty/Optional/special-case would do | ERR-7, ERR-8 | error-handling |
| Status codes checked by callers; `if err` pyramids; try/catch as normal control flow | ERR-1, ERR-6 | error-handling |
| Exception without message/context, or cause dropped; same multi-catch copied around a library | ERR-4, ERR-5 | error-handling |
| `try` plus other work in the same function | FUN-14 | functions |
| SDK clients, raw maps or ORM entities passed across modules or returned from public APIs | BND-1, BND-5 | boundaries |
| Dependency upgrade with no tests exercising how we use it | BND-3 | boundaries |
| Production change with no test change; only the happy path tested; missing edges | TST-10, TST-11 | unit-tests |
| Long, plumbing-heavy test; no arrange/act/assert shape; several behaviours in one test | TST-3, TST-4, TST-8 | unit-tests |
| Tests sharing state, order-dependent, using the real clock/network/sleep | TST-9 `[H]` | unit-tests |
| Commented-out or reasonless skipped tests; multi-step manual test run | TST-13, TST-15 | unit-tests |
| Vague class name (`Manager`, `Util`); can't describe the class without "and" | CLS-3, CLS-4 | classes |
| Methods clustering on disjoint subsets of fields | CLS-5 | classes |
| New variant requires editing an existing class in several places | CLS-6 | classes |
| `new ConcreteService()` inside business logic; hard to test in isolation | CLS-7, SYS-4 | classes |
| Base class references a subclass; protected fields "for later"; wide public surface | CLS-8, CLS-9 | classes |
| Lazy init or service-locator lookups inside domain methods | SYS-1, SYS-4 | systems |
| Logging/transaction/auth code repeated inside business methods; domain extends framework types | SYS-6, SYS-7 | systems |
| Hard-coded default, port, timeout or path deep in a utility | SYS-12 | systems |
| Build needs more than one command | SYS-13 | systems |
| Copy-pasted or near-duplicate blocks; parallel hierarchies | EMG-3 | emergence |
| Interface per class; pass-through layers; abstraction with one use and no test need | EMG-5 | emergence |
| Shared mutable state touched from several threads/tasks; `x++` or check-then-act on it | CON-3, CON-8 `[H]` | concurrency |
| Two or more calls on a shared object that must hold together | CON-9 `[H]` | concurrency |
| Nested locks in different orders; locks held across I/O | CON-11 `[H]`, CON-10 | concurrency |
| Threading mixed into business logic; no shutdown path for workers | CON-2, CON-12 | concurrency |
| Flaky test "fixed" by retry or sleep | CTS-1 `[H]` | concurrency-testing |
| Big restructure mixed with behaviour change; legacy refactor without tests first | REF-3, REF-4 | refactoring-workflow |

If a signal isn't in this table, pick the file from the Context map by the kind of code involved.

## When rules conflict
1. **Project conventions and language idioms** beat the book's Java/2008 style (see below).
2. **Simple-design priority:** tests pass > no duplication > expresses intent > fewest elements
   (details in `emergence.md`).
3. **Correctness and safety** beat readability, and readability beats brevity.

## WRITE mode (developer agents)
- Load files by the Context map *before* writing the code they cover. Write the draft, get it
  green, then refine in small steps (REF-1, REF-3).
- Stay within the task. Boy-Scout cleanups are limited to code you already touch; anything bigger
  goes in a follow-up note, not your diff.
- Before declaring done, run the Symptom map over your own diff. Fix what you find, or leave a
  deliberate, commented reason.

## REVIEW mode (reviewer agents)
- **Scope:** changed lines and their immediate context. Don't demand cleanup of untouched code;
  note it as a follow-up.
- **Cite IDs:** `path:line — [clean-code FUN-12] <one-sentence defect> — <concrete fix>`.
- **Verify before citing:** for `[M]` and `[H]` findings, load the rule's file and check its
  *Don't over-apply* section first. `[L]` findings may be cited from the map alone.
- **Severity:** tags are defaults; context can raise or lower them.
  - `[H]` means a likely defect or safety risk (hidden side effects, silenced errors, races,
    flaky tests) → BLOCKER or MAJOR.
  - `[M]` means debt that compounds or will mislead → MAJOR if introduced by this change and
    material, otherwise MINOR.
  - `[L]` means readability or style → MINOR, and never a reason by itself to block a change.
- **Skip what tools own:** if a formatter or linter runs in CI, don't report what it enforces.
- **Be professional (REF-9):** specific, explained, actionable. Say what's good too when it
  helps the author.

## DRY-RUN mode (demonstration)
Triggered by "dry run", "demo", or "show me what this skill can do". Load `dry-run.md` (at the
skill root, not in `references/`, and not counted in the loading budget) and follow its steps.
It rolls a random language, domain and set of smells, generates a feature-rich program with
planted mess and decoys, reviews and refactors it with the protocol above, verifies behaviour,
and presents the differences with a planted-vs-caught scorecard. It writes only to a temp
workspace, never to the user's project.

## Language adaptation
The book's examples are Java. Keep the *intent* of each rule and express it in the host
language's idiom:
- **Go, Rust, C:** use error values or `Result` instead of exceptions (ERR-1, FUN-14). Keep the
  happy path clear and never ignore an error.
- **Checked exceptions (ERR-3)** apply to Java only.
- **Naming:** Go allows short names in small scopes, C# uses the `I` interface prefix, Python uses
  `snake_case` and properties instead of getters. The language convention wins.
- **Functional and data-oriented code:** OBJ-2 maps to "algebraic data types plus functions" vs.
  "protocols or type classes". Records and structs are legitimate data structures.
- **Non-null type systems** (Kotlin, TypeScript `strict`, C# NRT, Swift, Rust) enforce ERR-7 and
  ERR-8. Rely on them rather than on manual checks.

## Sibling skills (if installed)
This skill owns line-, function- and class-level craftsmanship and the Clean Code rule IDs. For
depth, defer to:
- `solid-principles` for full SRP/OCP/LSP/ISP/DIP analysis;
- `design-patterns` for choosing or checking Template Method, Strategy, Factory, Adapter or
  Special Case;
- `unit-testing` for test strategy, mocking and coverage policy;
- `engineering-principles` for DRY vs. premature abstraction trade-offs at the architecture level;
- `code-quality-review` to coordinate a full review.
Don't re-derive their content here.

## Knowledge base index
| File | Tag | Book source |
|---|---|---|
| `references/foundations.md` | FND | ch. 1 Clean Code |
| `references/naming.md` | NAM | ch. 2 Meaningful Names + ch. 17 (names) |
| `references/functions.md` | FUN | ch. 3 Functions + ch. 17 (functions, general) |
| `references/comments.md` | CMT | ch. 4 Comments + ch. 17 (comments) |
| `references/formatting.md` | FMT | ch. 5 Formatting + ch. 17 (general) |
| `references/objects-and-data.md` | OBJ | ch. 6 Objects and Data Structures + ch. 17 |
| `references/error-handling.md` | ERR | ch. 7 Error Handling |
| `references/boundaries.md` | BND | ch. 8 Boundaries |
| `references/unit-tests.md` | TST | ch. 9 Unit Tests + ch. 17 (tests, environment) |
| `references/classes.md` | CLS | ch. 10 Classes + ch. 17 (general) |
| `references/systems.md` | SYS | ch. 11 Systems + ch. 17 (environment, general) |
| `references/emergence.md` | EMG | ch. 12 Emergence + ch. 17 (duplication) |
| `references/concurrency.md` | CON | ch. 13 Concurrency + Appendix A |
| `references/concurrency-testing.md` | CTS | ch. 13 + Appendix A (testing) |
| `references/refactoring-workflow.md` | REF | ch. 14 Successive Refinement, ch. 15 JUnit Internals, ch. 16 Refactoring SerialDate |
