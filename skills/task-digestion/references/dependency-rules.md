# Dependency rules: real vs. invented

## What makes a dependency real

Task B depends on task A only when B genuinely cannot **start**, or cannot be
**verified**, until A is done. The usual shapes:

- **Shared interface**: A defines a contract (a schema, an API shape, a function
  signature) that B consumes. B can't write correct code against an interface that
  doesn't exist yet.
- **Shared data**: A creates a table/schema/config that B queries or reads.
- **Sequential contract**: A's output is literally B's input (A parses raw events, B
  aggregates parsed events).
- **Verification dependency**: B's tests can't pass, even with B's code fully written,
  until A's behavior exists to test against.

## What does NOT make a dependency

- **Topical proximity** - "both touch the database" is not a dependency. Two tasks can
  both modify the same table's different columns, or the same service's different
  endpoints, with zero actual ordering constraint.
- **Convenience ordering** - "it'll be easier to review if we do A first" is a
  scheduling preference, not a dependency. Put both at the same level; let the human
  sequence them if they want to for review-batching reasons, but don't bake that
  preference into the graph as a hard block.
- **Same milestone** - tasks in the same milestone are not automatically dependent on
  each other. Milestones are checkpoints for humans, not ordering constraints.
- **"Feels safer to be sure"** - when genuinely unsure whether a dependency exists, the
  default is **no edge** plus a note in open questions, not an edge "just in case".
  A spurious edge silently kills parallelism; a missing edge that turns out to matter
  gets caught in review, which is a much cheaper failure mode.

## Worked example

Mission: "Add CSV export to the reports page."

- T1: Add a `/reports/export` endpoint that streams CSV.
- T2: Add a "Export CSV" button to the reports page UI.
- T3: Add rate-limiting to the new endpoint.

Naive read: T2 depends on T1 (UI needs the endpoint to call). That's real - T2 needs T1's
URL and response shape settled to call it correctly, so `depends_on: ["T1"]`, level 1.

T3 looks like it should depend on T1 too ("it's rate-limiting *the* endpoint"), but it
only needs to know the endpoint's **path**, not its finished implementation - T3 can be
written and unit-tested against a stub route in parallel with T1. Unless the mission's
own wording ties them together (e.g. "rate-limit as part of the same handler"), keep T3 at
level 0 alongside T1, not blocked on it. When genuinely unsure which reading applies,
that's exactly the kind of call to put in open questions rather than default silently to
the safer-looking edge.

## Handling a detected cycle

A cycle (T1 depends on T2, T2 depends on T1, directly or through a longer chain) means the
mission itself has an unresolved design question - most often two tasks were split along
the wrong seam and actually needed to be one task, or a genuine circular contract exists
that needs a human decision (e.g. "which service owns the shared type"). Do not force an
arbitrary order to make the sort succeed. Stop, name the cycle (the exact task ids
involved and why each edge was drawn), and put it in open questions for a human to break -
usually by merging the two tasks or by choosing which side owns the interface.
