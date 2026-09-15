# Common False Positives

The goal of this skill is precision: every reported finding should be worth the reader's
time. These patterns look like defects on a superficial read but usually aren't. Check
candidate findings against this list before reporting them, and drop or downgrade
(to a Question, per `severity-and-reporting.md`) anything that matches.

## Intentional simplicity

- A short script, one-off migration, notebook cell, or throwaway CLI tool with no error
  handling, no abstraction, and a hardcoded value. If it runs once, by a known operator,
  with known input, this is appropriate — not a missing try/catch or a missing config
  option. Ask "who runs this, how often, on what input" before flagging.
- A function with exactly one call site and one caller that will not plausibly gain a
  second implementation. Recommending an interface/strategy pattern here is over-
  engineering, not a fix. (See `solid-principles` skill's anti-patterns reference.)
- Inline logic instead of a helper function, when the logic is used exactly once and
  extracting it would add a level of indirection without removing duplication.

## Style differences that match project convention

- A naming/formatting choice that differs from your default preference but matches every
  neighboring file in the same repo (e.g., snake_case in a Python codebase, no semicolons
  in a JS codebase that's configured that way). Read at least one sibling file before
  flagging a style issue — "differs from what I'd write" is not a finding.
- A code organization pattern (e.g., all types in one `types.ts`, or co-located per
  feature) that's consistently applied across the codebase, even if a different layout is
  more common industry-wide. Consistency with the existing codebase outranks a personal
  or generic best-practice preference.
- Comment density or verbosity that matches the surrounding file's established style.

## Defensive code guarding a genuinely reachable boundary

- A null check, type check, or range check on a value that crosses a real trust boundary
  (HTTP request body, third-party API response, file/environment input, user-supplied
  CLI argument, message queue payload) is *not* unnecessary defensive code — it is the
  correct place to validate. Do not flag this as "dead code" or "unreachable branch."
- Distinguish this from the opposite false positive below: the check is warranted here
  specifically because the value's origin is external and not guaranteed by any type
  system or prior validation step in this process.

## Flagging incomplete handling for conditions that are actually impossible

- An `else` branch, default case, or error handler for a condition that is provably
  unreachable given the calling context — e.g., a private helper only ever called with
  values already validated by its single caller, or a switch over an enum where the
  language's exhaustiveness check already guarantees all cases are handled. Do not treat
  a defensive branch for such a case as evidence of a *missing* handling gap elsewhere,
  and do not demand a test for a state that cannot occur.
- A `!` non-null assertion or equivalent right after a guard clause that already
  established the value is non-null a few lines above, in a scope with no possibility of
  concurrent mutation in between.
- An "impossible" branch that exists only to satisfy a type checker's exhaustiveness
  requirement (e.g., a `default: throw new Error('unreachable')` after all real cases),
  which is a correct pattern, not evidence of sloppy error handling.

## Other patterns that often look wrong but aren't

- Duplication that is *coincidental* rather than *essential* — two code blocks that
  currently look similar but represent different domain concepts likely to evolve
  independently (e.g., validation rules for two different forms that happen to both check
  "is not empty" today). Extracting a shared abstraction here often creates false coupling
  that has to be un-done later when the rules diverge. Prefer to leave these separate;
  flagging this as DRY-violation noise is a common overreach.
- A long parameter list or large config object on a function that is a well-understood,
  stable integration point (e.g., a framework lifecycle hook, a documented plugin
  interface) where the shape is dictated by an external contract, not by the author's
  design choice.
- Broad `catch`/`except` at the outermost boundary of a process (top-level request
  handler, `main()`, a job runner) whose job is specifically to prevent one failure from
  crashing the whole process and to log/report it — this is a deliberate last-resort
  boundary, not silent failure, provided it does log/report and does not swallow the
  error entirely.
- Performance "issues" in code that provably runs a bounded, small number of times (e.g.,
  once at startup, on a small fixed-size config list) — an O(n^2) loop over ten items
  that never grows is not a performance footgun worth flagging under
  `checklist-by-language-concern.md`.
- A TODO/FIXME comment tied to a tracked follow-up (ticket reference, explicit
  known-limitation note) is a maintainability signal to note, not automatically a
  Should-fix defect in this review — treat it as a Question or a Nit unless the gap it
  marks is itself a live Blocker by the criteria in `severity-and-reporting.md`.

## The precision check before reporting

Before finalizing any finding, ask: "If I'm wrong about this, what did I miss?" Usually
it's one of: the calling context that makes a case impossible, a convention established
elsewhere in the repo, or a scope/lifetime fact (single execution, bounded input) that
changes the severity math entirely. If any of the checks above apply, drop the finding or
demote it to a Question rather than reporting it as a defect.
