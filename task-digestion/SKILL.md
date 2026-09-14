---
name: task-digestion
description: Use when a mission (Jira/legacy-Jira ticket, spec/PRD/HLD, or free-text ask) needs to be turned into an actionable, dependency-ordered work plan before anyone starts implementing - "break this ticket into tasks", "what can we parallelize here", "give me a work breakdown with dependencies", or any pre-implementation planning pass on a multi-part feature. Defines the decomposition workflow (mission -> milestones -> tasks -> dependencies -> priority -> topological levels) and the DAG output format other agents and humans read the plan from. Primary skill for the Task Digester agent; also usable standalone by any agent that needs to produce a dependency-ordered plan without spawning that agent.
---

# Task Digestion

Turn one mission into a plan other agents (and the human) can execute against without
re-deriving the ordering themselves. This skill governs the WHAT and HOW of that
decomposition: how to find milestones and tasks, how to tell a real dependency from a
coincidental one, and the exact DAG structure the plan is emitted as. It does not govern
implementation, review, or testing - see "Relationship to sibling skills" below.

If the mission is trivial (one task, no real dependency question), say so plainly and
produce a one-node plan. Manufacturing milestones or dependencies to look thorough is a
failure of this skill, not evidence of thoroughness.

## Phase 1 — Decompose the mission into atomic requirements

Before grouping anything into milestones or tasks, decompose the mission the same way
`spec-compliance` Phase 1 does: a numbered checklist of atomic, individually verifiable
requirements, split from compound asks ("add X and make Y configurable" is two items).
Load `spec-compliance` for this pass rather than reinventing it - this skill picks up
where that checklist leaves off.

Requirement sources:
- Ticket key/URL on `labos-lis.atlassian.net` / bare `LAB-*` -> load `fetch-jira`.
- Ticket key/URL on `jira.softov.co.il` / legacy keys (e.g. `WH-*`) -> load
  `fetch-legacy-jira`.
- A spec/PRD/HLD file or already-fetched text -> read it directly.
- Free text -> treat the asker's own words as the mission text.

Never guess mission content from a bare ticket key. If there is no mission source at all,
say so in one line and ask for one.

## Phase 2 — Group into milestones, only when needed

A milestone is a checkpoint representing a coherent, independently-meaningful slice (e.g.
"data layer", "API layer", "UI layer", or a phased rollout). A mission small enough to
ship as one unit of work gets **zero** milestones - don't manufacture structure the
mission doesn't have. When the codebase is the labOS VC++ stack, load `planning` for its
risk-classification and architecture-boundary guidance on where milestone seams naturally
fall.

## Phase 3 — Break into tasks

A task is small enough that one agent/engineer can own it start to finish. Prefer more
small tasks over fewer vague ones - vague tasks are where the dependency analysis in
Phase 4 goes wrong, because it's hard to tell what a vague task actually needs finished
first.

## Phase 4 — Identify real dependencies

A dependency exists when task B genuinely cannot start (or cannot be verified) until task
A is done - a shared interface A defines and B consumes, a schema A creates and B queries,
a contract A's output and B's input. Do **not** invent a dependency from mere topical
proximity ("both touch the database") or from convenience ordering - if two tasks don't
actually block each other, they belong at the same level so they can run in parallel.

When a dependency is genuinely ambiguous, put it in the plan's open-questions list rather
than silently picking one reading. See `references/dependency-rules.md` for worked
examples of real vs. invented dependencies and how to handle a detected cycle (a cycle
means the mission itself has a design problem - surface it, don't force an order).

## Phase 5 — Assign priority

`P0`-`P3` per task (`P0` = blocks everything downstream / highest business value),
assigned independent of dependency level. Priority answers "how important"; level (Phase
6) answers "how soon it's unblocked". A `P0` task can still sit at level 2 if it's
genuinely blocked - don't let priority pressure you into inventing a shortcut dependency
edge to move it earlier.

## Phase 6 — Topologically sort into levels

Level 0 = tasks with no unfinished dependencies (safe to start immediately, in parallel
with each other). Level N = tasks whose dependencies are all in levels < N. Two tasks in
the same level have no dependency relationship between them either way - that's what
makes them parallel-safe.

`level` is derived, never hand-picked: it must equal the longest dependency-chain length
ending at that task, and must be recomputed if `depends_on` changes.

## Output: the DAG

Emit one machine-readable JSON file (`task-plan.json`) as the source of truth, plus a
human-readable markdown companion (`TASK_PLAN.md`) rendering the same data grouped by
level. Default location: the current project root, unless the user names a different path
or the repo already has a planning convention. See `references/dag-schema.md` for the
exact JSON shape (fields, id conventions, a worked example) and the markdown table format
- do not improvise either format, since other agents parse the JSON by field name.

State explicitly, wherever the plan is handed off: tasks in the same level have no
ordering constraint between them and can be assigned to separate agents/engineers
concurrently; a task must not start until every id in its `depends_on` is done. This skill
does not assign tasks to specific other agents or start any implementation - producing the
graph is the whole job; handing tasks out is the orchestrator's or human's call.

## Relationship to sibling skills

- **`spec-compliance`** feeds Phase 1 - use its decomposition, don't duplicate it. This
  skill picks up after the checklist exists and turns it into milestones/tasks/dependencies.
- **`planning`** (labOS VC++) contributes risk classification and architecture-boundary
  awareness for where milestone seams fall in that codebase; this skill's DAG structure is
  still mandatory regardless of codebase.
- **`domain-glossary`** - load when naming tasks/milestones in the labOS domain, so they
  read the way the team actually talks about the product.
- This skill does not govern code quality (`code-quality-review`), test mechanics
  (`unit-testing`), or requirement-vs-diff auditing after the fact (`spec-compliance`
  Phase 3) - it only covers turning a mission into a plan before any code exists.

## References

- `references/dag-schema.md` - the exact `task-plan.json` schema, a worked example, and
  the `TASK_PLAN.md` table format.
- `references/dependency-rules.md` - real vs. invented dependencies, worked examples, and
  how to handle a detected cycle.
