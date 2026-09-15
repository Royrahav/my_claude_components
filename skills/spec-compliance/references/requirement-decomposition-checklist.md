# Requirement Decomposition Checklist

Use this template to turn a spec (ticket, PRD, design doc, or written description) into a
numbered list of atomic, checkable requirements before writing any code. Work through
every category below for every spec. Write "none" explicitly for a category that doesn't
apply — a category left blank without a note is indistinguishable from a category that
was never checked.

Number every item across all categories in one running list (R1, R2, R3, ...) so Phase 3
of the main skill can walk them in order against the diff.

## 1. Explicit functional requirements

Requirements the spec states outright. Split compound sentences into separate items —
"users can add items to the cart and remove them" is two requirements, not one.

- [ ] R1: ...
- [ ] R2: ...

## 2. Implied functional requirements

Requirements that are a necessary side effect of an explicit one, even though the spec
never spells them out. For every explicit requirement, ask: "what has to be true for this
to work correctly in practice?"

Common triggers:
- Any "create" implies an "undo/delete/edit" question even if not asked for — decide
  explicitly whether it's in scope, don't just omit it silently.
- Any "delete" or "remove" implies: confirmation before destructive action, cascading
  cleanup of dependent data, and behavior when the deletion itself fails partway.
- Any "add X" to a collection implies: what happens on duplicate add, what happens at
  capacity, what the empty/zero state looks like before the first add.
- Any state change implies: what triggers a UI/cache/downstream update, and whether the
  change is atomic or can be observed half-applied.
- Any user-facing action implies some form of feedback (success indication, loading
  state) even if the spec only describes the backend behavior.

- [ ] R_: ...

## 3. Error / failure states

For every explicit and implied requirement above, ask "what does the system do when this
fails?" — network failure, downstream service failure, invalid state, timeout, partial
failure. A requirement described only in terms of success is incomplete until its failure
behavior is decided.

- [ ] R_: ...

## 4. Edge cases

Scan explicitly for:
- Empty / null / missing input.
- Zero items, exactly one item, the maximum allowed, one more than the maximum.
- Concurrent access / race conditions (two actors doing the same thing at once).
- Boundary values on any numeric or time-based rule (off-by-one on limits, expiry exactly
  at the boundary).
- Repeated/duplicate actions (double-submit, double-click, retried request).

- [ ] R_: ...

## 5. Permission / authorization boundaries

- Who is allowed to trigger this action or view this data?
- What happens when someone who isn't allowed attempts it (silent no-op, explicit error,
  redirect)?
- Does the boundary change based on ownership, role, or state (e.g. only the cart's owner
  can modify it; only before checkout is finalized)?

- [ ] R_: ...

## 6. Data validation rules

- What makes an input valid, and what's the exact rejection behavior for each way it can
  be invalid (type, range, format, uniqueness, referential integrity)?
- Is validation client-side only, server-side only, or both — and does the spec (or
  common sense for the domain) require both?

- [ ] R_: ...

## 7. Non-functional requirements

Only applicable items need a checklist entry, but check all of them before deciding
"none":
- Performance (latency budget, expected volume, pagination needs).
- Accessibility (keyboard nav, screen reader labels, color contrast) for any UI change.
- Internationalization / localization (date/currency/number formatting, translatable
  strings, RTL) if the product supports multiple locales.
- Security (data exposure, injection, secrets handling) for anything touching
  user input or sensitive data.
- Observability (logging, metrics, alerting) if the spec or the surrounding codebase's
  norms expect it for this class of change.

- [ ] R_: ...

## 8. Backward-compatibility / migration concerns

- Does this change an existing API, schema, or stored data format that other code or
  data already depends on?
- Is a data migration required, and is it safe to run against existing production data
  (including partially-migrated or legacy rows)?
- Does this break any documented contract (public API, file format, CLI flag) that
  external consumers rely on?

- [ ] R_: ...

## 9. Explicit out-of-scope items

List anything the spec explicitly says NOT to do, or says is being deferred to a later
phase. These are exactly as easy to violate by accident as positive requirements are to
miss — a normal-looking refactor or "while I'm here" fix can silently cross a stated
boundary. Treat each as a negative checklist item: confirm the diff does NOT do this.

- [ ] R_ (must NOT happen): ...

## After decomposition

- Number every item continuously (R1...Rn) in one list.
- For each item, note whether it maps to a "what it does" behavior or a "how we know it's
  correct" acceptance criterion (see main SKILL.md Phase 2) — most substantial items have
  both.
- Any item you're unsure belongs in-scope: don't drop it silently and don't guess it in
  either direction — flag it per `references/handling-ambiguity.md`.
