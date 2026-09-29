# Engine notes - PostgreSQL, SQL Server, MySQL (InnoDB)

Version-sensitive behaviour is marked. Check the project's engine version before relying on a
version-specific safe form.

## PostgreSQL

**Plans**
- `EXPLAIN (FORMAT JSON) <stmt>` - estimated plan, does not execute.
- `EXPLAIN (ANALYZE, BUFFERS) <stmt>` - executes. `SELECT` on non-production only. For DML, wrap in
  `BEGIN; ... ROLLBACK;` only on a disposable database - the rows are still locked and written.
- Red flags: `Seq Scan` on a large table with a selective predicate; `Rows Removed by Filter` far
  above rows returned; `Sort Method: external merge`; `Nested Loop` with a large outer side and
  no index on the inner; estimates off by orders of magnitude (stale statistics).

**Isolation and locking**
- Default `READ COMMITTED`. `REPEATABLE READ` is snapshot isolation (no phantoms, but write skew is
  possible). `SERIALIZABLE` is SSI - the application must retry on serialization failures
  (SQLSTATE `40001`).
- Row locks: `SELECT ... FOR UPDATE` / `FOR NO KEY UPDATE` / `FOR SHARE`; `SKIP LOCKED` for
  queues. No lock escalation.
- FK columns on the referencing side are **not** indexed automatically. Deleting or updating a
  referenced key scans the child table once per parent row.
- Long transactions (including `idle in transaction`) hold back the xmin horizon: vacuum cannot
  remove dead tuples anywhere, so tables and indexes bloat. Also block DDL that needs strong locks.

**Implicit casts that break index use**
- Comparing a column to a parameter of a different type the planner must cast on the column side
  (e.g. `text` column vs `numeric` parameter via an explicit `::` in the query, `timestamp` vs
  `timestamptz` with functions applied to the column). Functions on columns need expression
  indexes. `LIKE 'abc%'` uses a B-tree index only with `C` collation or a `text_pattern_ops` index.

**Migrations - lock taken / safe form**
- `CREATE INDEX` - `SHARE` lock, blocks writes for the whole build. Safe: `CREATE INDEX
  CONCURRENTLY` (not inside a transaction block; check for an `INVALID` index on failure).
- `ADD COLUMN` with a non-volatile default - metadata only (PG 11+). A volatile default (e.g.
  `random()`, `clock_timestamp()`) rewrites the table.
- `ALTER COLUMN TYPE` - usually a full rewrite under `ACCESS EXCLUSIVE`.
- `ADD FOREIGN KEY` - validates by scanning. Safe: `ADD CONSTRAINT ... NOT VALID`, then
  `VALIDATE CONSTRAINT` separately (weaker lock).
- `SET NOT NULL` - full scan under `ACCESS EXCLUSIVE`. PG 12+ skips the scan if a validated
  `CHECK (col IS NOT NULL)` constraint exists.
- Any `ACCESS EXCLUSIVE` request queues behind long readers and blocks every later query while it
  waits: set `lock_timeout` in migrations.

## SQL Server

**Plans**
- `SET SHOWPLAN_XML ON` - estimated plan, does not execute. `SET STATISTICS XML ON` / actual
  execution plan - executes.
- Red flags: `Clustered Index Scan` / `Table Scan` with a selective predicate; `Key Lookup` in a
  loop over many rows (non-covering index - add `INCLUDE` columns); `CONVERT_IMPLICIT` on a column
  in a predicate; sort or hash warnings (spills to tempdb); big gaps between estimated and actual
  rows (parameter sniffing, stale statistics).

**Isolation and locking**
- Default `READ COMMITTED` with locking reads, unless the database has `READ_COMMITTED_SNAPSHOT
  ON` (Azure SQL Database defaults to it on). Check which, because it changes reader/writer
  blocking.
- Read-modify-write needs `WITH (UPDLOCK, HOLDLOCK)` (or `SERIALIZABLE`) to be safe;
  check-then-insert needs a unique constraint or `UPDLOCK, HOLDLOCK` on the existence check.
- Lock escalation: a single statement acquiring roughly 5,000 locks on one object escalates to a
  table lock (the threshold is approximate). Batch large `UPDATE`/`DELETE`.
- FK columns are **not** indexed automatically. Parent deletes or updates scan the child table
  and hold locks for the duration.
- Long transactions grow the log and, with snapshot isolation, the tempdb version store.

**Implicit casts that break index use**
- `varchar` column compared with an `nvarchar` parameter (the default string type in many
  drivers and ORMs, e.g. ADO.NET and EF strings): `CONVERT_IMPLICIT` on the column. With SQL
  collations this forces a scan; with Windows collations it may still seek via a range, at extra
  cost. Fix: match the parameter type to the column (`DbType.AnsiString`, `varchar` mapping).
- Functions on columns, `ISNULL(col, ...) = ?`, date functions on the column.

**Migrations**
- Index create/rebuild with `ONLINE = ON` is Enterprise edition (and Azure SQL) only. Otherwise
  the build blocks writes (or reads, for clustered indexes).
- Adding a `NOT NULL` column with a runtime-constant default is metadata-only from SQL Server 2012
  (Enterprise); otherwise a size-of-data operation.
- Altering column types is usually size-of-data under a schema-modification lock.

## MySQL (InnoDB)

**Plans**
- `EXPLAIN FORMAT=JSON <stmt>` - estimated, works for `SELECT`/`UPDATE`/`DELETE`/`INSERT`.
  `EXPLAIN ANALYZE` (8.0.18+) executes the statement.
- Red flags: `type: ALL` (full scan); `rows` far above rows returned; `Using filesort` or
  `Using temporary` on large sets; `key: NULL` where an index was expected.

**Isolation and locking**
- Default `REPEATABLE READ`. Consistent (non-locking) reads use a snapshot; locking reads
  (`SELECT ... FOR UPDATE` / `FOR SHARE`) and `UPDATE`/`DELETE` take next-key (record + gap)
  locks. A range update without a usable index locks every scanned row and the gaps - effectively
  the table. Gap locks are a common source of insert deadlocks.
- `SELECT` then `UPDATE` in the app is a lost update unless the `SELECT` is `FOR UPDATE`.
- InnoDB **requires** an index on FK columns and creates one if missing, so unindexed-FK scans are
  not a MySQL hazard. Check that the auto-created index is not silently dropped or duplicated.
- Long transactions grow the undo history (purge lag, rising `History list length`), slowing
  every read.

**Implicit casts that break index use**
- String column compared with a number (`WHERE varchar_col = 123`) casts every row: no index.
- Joins between columns of different character sets or collations can prevent index use.
- Functions on columns; leading-wildcard `LIKE`.

**Migrations**
- 8.0+: many `ADD COLUMN` operations are `ALGORITHM=INSTANT`; index creation is usually
  `ALGORITHM=INPLACE, LOCK=NONE`. Specify `ALGORITHM` and `LOCK` explicitly so an unsupported
  online change fails instead of silently copying the table.
- Changing column types is usually `ALGORITHM=COPY` with writes blocked - use an online
  schema-change tool (gh-ost, pt-online-schema-change) for large tables.
- A DDL statement waits for a metadata lock behind open transactions and blocks every later query
  on the table while it waits: set `lock_wait_timeout` low in migrations.
