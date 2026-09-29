---
name: query-plan-and-index-analyzer
description: Use when auditing SQL, ORM data access, or schema migrations for execution hazards on PostgreSQL, SQL Server or MySQL - full table scans, non-SARGable predicates and implicit casts, missing or non-covering indexes, N+1 queries, unpaginated or unbounded result sets, Cartesian joins, in-memory sorts, lost updates and phantom-read races, unindexed foreign keys, lock escalation, deadlock-prone update ordering, long transactions, migrations that take blocking locks, and connection-pool starvation. Evaluates each query against its schema to extract (or derive) the plan, index use and locks taken. Inspection skill of the System Reliability Agent; usable standalone for "is this query efficient", "will this migration lock the table", "can these transactions deadlock".
---

# Query Plan and Index Analyzer

Decide, for each query or migration, what the engine will actually do - which access path, how
many rows touched versus returned, which locks, for how long - and whether that holds at
production size and concurrency.

## Inputs

| Input | Meaning |
|---|---|
| `query` | The SQL text, or the ORM call site (translate it to the SQL it generates). Include the call context: inside a loop? per request? batch job? |
| `schema_context` | DDL, migrations or ORM models for every table touched: columns and types, indexes, FKs, constraints, and the table's growth class. |
| `engine_type` | `postgres` \| `mssql` \| `mysql`. Engine-specific rules are in `references/engine-notes.md`. |

## Procedure

### 1. Collect the query and its context

- Literal SQL, stored procedures, views, and ORM calls. For ORMs, write down the SQL it emits,
  including lazy loads triggered later by property access.
- Call context: the calling function, how often it runs (per request, per row of an outer
  result, per batch item, startup), and whether it runs inside a transaction opened elsewhere.

### 2. Collect the schema and size it

- Column types (for implicit-cast checks), every index with its column order and included
  columns, FK definitions and whether the referencing columns are indexed, unique constraints.
- **Size class** per table: bounded reference data (tens to low thousands of rows), grows with
  entities (users, orders), or grows without bound over time (events, logs, audit, results). Take
  it from docs, fixtures, retention jobs, or naming. If you have to assume, say so in the finding.

### 3. Get the plan

- If a development database is reachable and it is safe: run `EXPLAIN` for the engine (see
  engine notes) **without executing DML**. `EXPLAIN ANALYZE` / actual-plan modes execute the
  statement - use them only for `SELECT`, only on a non-production database.
- Otherwise derive the plan by reasoning: for each table, which index can serve the predicates
  (leftmost-prefix rule), whether the sort can be served by index order, what the join order
  and join type will be. Mark the plan `derived`, not `measured`, in your output.

### 4. Check access-path efficiency

- **SARGability**: a function or expression on the indexed column (`WHERE YEAR(created) = 2025`,
  `LOWER(email) = ?` without a matching expression index), an implicit cast of the column (type
  mismatch between column and parameter - see engine notes), leading-wildcard `LIKE '%x'`, `OR`
  across different columns, negations (`<>`, `NOT IN`) on the leading index column.
- **Index coverage**: leftmost prefix matches the equality predicates, then range, then sort
  columns; covering (included) columns for hot read paths to avoid lookups; `ORDER BY ... LIMIT`
  served by an index or forcing a full sort.
- **Result size**: no `LIMIT`/`TOP`/pagination on a growing table; deep `OFFSET` pagination (cost
  grows with page number - use keyset pagination); `SELECT *` pulling wide or LOB columns the
  caller ignores.
- **Joins**: missing join predicate (Cartesian product); join on mismatched types; fan-out joins
  multiplied by aggregation (`COUNT` over a join that duplicates rows).
- **Sorts and aggregation**: unbounded sort or hash spilling to disk; `DISTINCT` masking a
  fan-out join.

### 5. Check access patterns in the calling code

- **N+1**: a query inside a loop over the results of another query, including ORM lazy loading
  of a relation inside a loop. Prove it: name the outer query, the loop and the inner query, and
  N's size class.
- Row-by-row writes where a set-based statement or batch would do.
- Fetching everything and filtering, sorting or paging in application code.
- The same query repeated within one request with identical parameters.

### 6. Check concurrency and locking

- **Isolation level** actually in effect (engine default, connection setting, ORM setting,
  explicit `SET TRANSACTION`). Defaults differ per engine - see engine notes.
- **Lost update**: read-modify-write (`SELECT` then `UPDATE` computed in the app) without
  `SELECT ... FOR UPDATE` / `UPDLOCK`, an optimistic version column, or an atomic
  `UPDATE ... SET x = x + 1`.
- **Check-then-insert race**: `SELECT` to test existence then `INSERT`, without a unique
  constraint to catch the loser. Duplicates or constraint errors under concurrency.
- **Phantoms**: a range read followed by a write whose correctness depends on the range not
  changing, below `SERIALIZABLE` (or without gap/range locks where the engine uses them).
- **Deadlock-prone ordering**: two code paths update the same set of rows or tables in different
  orders; batch updates without a deterministic `ORDER BY` on the key. Fix: one global order.
- **Unindexed foreign keys**: deleting or updating a parent key scans the child table (and, per
  engine, takes broader locks). Check every FK the diff adds or whose parent rows the diff
  deletes.
- **Lock escalation**: large single-statement updates or deletes (see engine notes for
  thresholds) - batch them.
- **Long transactions**: a transaction held open across network calls, user input, file I/O, or
  a long loop. It holds locks, blocks DDL, and holds back cleanup (vacuum, purge, version store).
- **Connections**: a connection held across `await`/remote calls; pool size below the number of
  concurrent holders; a connection not returned on an error path (hand to
  `taint-and-lifecycle-tracker`).

### 7. Check migrations

For every DDL statement, name the lock it takes, whether it rewrites or scans the table, and the
table's size class. Blocking DDL on a large, hot table is a HIGH hazard even when the statement is
"correct". Engine-specific safe forms are in the engine notes (e.g. `CREATE INDEX CONCURRENTLY`,
`NOT VALID` + `VALIDATE CONSTRAINT`, `ALGORITHM=INSTANT`, `ONLINE = ON`). Also check that the
migration and the application code deployed with it are compatible in both deploy orders.

## Output

```json
{
  "query_ref": "OrderRepo.cs:58 GetOpenOrders",
  "engine": "postgres",
  "plan_source": "derived | measured",
  "plan_summary": [{"table": "orders", "access": "Seq Scan", "reason": "lower(status) not indexed"}],
  "rows_touched_vs_returned": "~all orders (unbounded) vs <= 50",
  "locks": "none (read committed SELECT)",
  "hazards": [{"type": "SQL_INEFFICIENCY", "summary": "...", "fix": "CREATE INDEX CONCURRENTLY ix_orders_status_created ON orders (status, created_at DESC)"}]
}
```

Recommended DDL uses the engine's online form and states its write-amplification cost.

## Restraint - do not report

- Full scans of bounded reference tables (a few thousand rows or fewer) - the planner is right.
- One-off admin scripts and migrations on tables known to be small.
- A missing index on a write-heavy table where the query is rare - unless you weigh the write
  cost in the finding and the read path is hot.
- A derived plan stated as fact. If `plan_source` is `derived` and the hazard depends on a
  planner choice you cannot pin down (statistics, parameter sniffing), say so, or drop it.
- Isolation anomalies the business logic tolerates by design (documented eventual consistency).
