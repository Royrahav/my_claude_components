# DAG schema

## `task-plan.json`

```json
{
  "mission": "LAB-1234: Build the ingestion pipeline",
  "source": "labOS Jira Cloud LAB-1234",
  "milestones": [
    {
      "id": "M1",
      "name": "Data layer",
      "tasks": ["T1", "T2"]
    },
    {
      "id": "M2",
      "name": "API layer",
      "tasks": ["T3"]
    }
  ],
  "tasks": [
    {
      "id": "T1",
      "title": "Define ingestion schema",
      "description": "One or two sentences, concrete enough to hand to an engineer.",
      "milestone": "M1",
      "priority": "P0",
      "depends_on": [],
      "level": 0
    },
    {
      "id": "T2",
      "title": "Write raw-event parser",
      "milestone": "M1",
      "priority": "P1",
      "depends_on": [],
      "level": 0
    },
    {
      "id": "T3",
      "title": "Expose ingestion REST endpoint",
      "milestone": "M2",
      "priority": "P0",
      "depends_on": ["T1", "T2"],
      "level": 1
    }
  ]
}
```

Rules:
- `id`s are stable short tokens (`T1`, `T2`, ...) - other agents reference tasks by this
  id, so never reuse or renumber one once it's been handed off.
- `depends_on` is a flat list of task ids, not milestone ids - dependencies are always
  task-to-task, even across milestones.
- `level` is derived, never hand-picked - it must equal the longest dependency-chain
  length ending at that task. Recompute it if `depends_on` changes.
- `milestones` is an empty list (or the key omitted) when the mission didn't warrant any -
  do not backfill a single fake milestone just to fill the field.
- No milestone/task exists in the JSON without a matching row in the markdown companion -
  the two must stay in sync; regenerate both together, never patch one by hand.

## `TASK_PLAN.md`

Render the same data as a table grouped by level, so a reader sees "what can start today"
at a glance:

```
## Level 0 (start now, in parallel)
| Task | Milestone | Priority | Description |
|---|---|---|---|
| T1 | M1 | P0 | Define ingestion schema |
| T2 | M1 | P1 | Write raw-event parser |

## Level 1 (blocked until Level 0 done)
| Task | Milestone | Priority | Depends on | Description |
|---|---|---|---|---|
| T3 | M2 | P0 | T1, T2 | Expose ingestion REST endpoint |
```

One section per level, in ascending order. Omit the Milestone column entirely when the
plan has no milestones.
