# Clean Code — dry run (demonstration)

Use this when a user wants to *see* what the skill does before trusting it with their own code.
Triggers include "dry run", "demo", "show me what this skill can do", and "clean-code dry run".
A dry run generates a random program that has plenty of features and some planted mess, reviews
and refactors it by this skill's own rules, and then shows the differences.

A dry run is a demonstration, not a work item. It never touches the user's project, never enters
a review cycle or ledger, and never spawns agents. This file is not a knowledge file, so it does
**not** count toward the ≤ 3-reference loading budget.

## Arguments (all optional)
The user can pin any dimension. Anything not pinned is rolled.
- **Language:** `dry run go`
- **Domain:** `dry run payroll`
- **Both:** `dry run ts hotel`
- **Families:** `dry run focus error-handling classes` pins one or more smell families (see
  step 1). Randomly rolled families fill any remaining slots.

## 1. Roll the scenario, using real randomness
Don't pick the values yourself. Model "random" choices keep landing on the same few options,
which defeats the purpose. Get the numbers from whichever shell the host offers:

```bash
echo "lang=$((RANDOM % 8)) domain=$((RANDOM % 12)) families=$(shuf -i 1-9 -n 3 | paste -sd' ') stamp=$(date +%Y%m%d-%H%M%S)"
```
```powershell
"lang=$(Get-Random -Maximum 8) domain=$(Get-Random -Maximum 12) families=$((1..9 | Get-Random -Count 3) -join ' ') stamp=$(Get-Date -Format yyyyMMdd-HHmmss)"
```
```bash
python -c "import random as r,time;print('lang=%d domain=%d families=%s stamp=%s'%(r.randrange(8),r.randrange(12),' '.join(map(str,r.sample(range(1,10),3))),time.strftime('%Y%m%d-%H%M%S')))"
```
If no shell is available, use the digits of the current time and say so in the report.

**Languages** (`lang`): 0 Python · 1 TypeScript · 2 JavaScript (Node) · 3 Java · 4 C# · 5 Go ·
6 Kotlin · 7 Ruby

**Domains** (`domain`). Each comes with the features the program must implement.

| # | Domain | Features |
|---|---|---|
| 0 | Library loans | members, checkout/return, due dates, tiered late fees, holds queue, overdue report |
| 1 | Warehouse inventory | receive stock, reserve for orders, reorder points, supplier lead times, FIFO valuation, low-stock report |
| 2 | Payroll | hourly vs salaried staff, overtime rules, tax brackets, deductions, payslips, department totals |
| 3 | Invoicing | line items, tiered discounts, regional tax, credit notes, payment allocation, aging report |
| 4 | Hotel reservations | room types, date-range availability, seasonal pricing, cancellation penalties, loyalty upgrades, occupancy report |
| 5 | Parking garage | entry/exit tickets, rates by vehicle type, lost-ticket fee, monthly passes, per-level capacity, daily revenue |
| 6 | Gym membership | plans, freeze/unfreeze, class booking with capacity, waitlist promotion, proration, attendance stats |
| 7 | E-commerce cart | cart operations, coupons (percent/fixed/BOGO), shipping by weight and zone, stock check, order placement, receipt |
| 8 | Event ticketing | venue sections, seat holds with expiry, price tiers, promo codes, refunds, sales report |
| 9 | Loyalty points | earn rules by category, tier thresholds, point expiry, redemption catalogue, member transfers, statement |
| 10 | Fleet maintenance | vehicles, mileage logs, service intervals by type, parts stock, work orders, due-soon report |
| 11 | Course enrollment | prerequisites, capacity and waitlists, weighted grading, GPA, transcript, academic standing |

**Smell families** (`families`). **naming** and **functions** are always planted (the baseline).
The three rolled numbers add three more families, for five in total:

| # | Family (reference file) | Plant from these rules |
|---|---|---|
| — | naming (baseline) | NAM-1, NAM-2, NAM-3, NAM-6, NAM-11, NAM-18 |
| — | functions (baseline) | FUN-1/2/3 god function, FUN-4, FUN-8, FUN-10, FUN-12, FUN-13, FUN-16, FUN-17, FUN-18/19 |
| 1 | comments | CMT-10, CMT-11, CMT-13, CMT-15, CMT-18 |
| 2 | formatting | FMT-6, FMT-7, FMT-12 |
| 3 | objects-and-data | OBJ-1, OBJ-3/4, OBJ-5, OBJ-7 |
| 4 | error-handling | ERR-1, ERR-4, ERR-7, ERR-9, FUN-14 |
| 5 | boundaries | BND-1, BND-5 (a raw map or SDK-shaped payload passed through the domain) |
| 6 | classes | CLS-3/4 `…Manager` god class, CLS-5, CLS-6 + CLS-13 repeated type switch, CLS-7 |
| 7 | systems | SYS-1, SYS-4, SYS-6 (logging inside business rules), SYS-12 |
| 8 | emergence | EMG-3 near-duplicate blocks, EMG-5 needless abstraction (the fix removes it) |
| 9 | concurrency | CON-3, CON-8, CON-12 (in JS/TS: shared state that interleaves across `await`) |

The scenario name is `<lang>-<domain>`, e.g. `go-parking`. Print it so the user can ask for the
same scenario again. The program and the planted smells will differ on each run.

## 2. Set up the workspace
Use the session's scratchpad directory if the host provides one. Otherwise use the OS temp
directory. Never write into the user's project.

```
<tmp>/clean-code-dry-run/<scenario>-<stamp>/
  before/<main file>   generated code (never edited after step 3)
  after/<main file>    the refactored copy (same file name, so the diff lines up)
  planted.md           answer key: planted smells and decoys
  before.out  after.out  changes.diff
```

Check once whether the language's runtime is installed (see *Run commands* below). Don't re-roll
the language to find one that is. If the runtime is missing, the behaviour check in step 6 is
reported as not executed.

## 3. Generate the "before" program
Write it the way a capable developer under deadline pressure would. It should work, have plenty
of features, and be messy in the planted ways. It should not look like a cartoon.

- **Size:** 150–250 lines in one file, using the standard library only.
- **Functionality:** implement **all six** of the domain's features, plus a deterministic
  `main` or demo entry point. The entry point runs every feature on fixed sample data, uses a
  fixed "today" (no clock, no randomness), and includes at least one invalid-input or error path.
  It prints stable, sorted output.
- **Planted smells:** plant **9–12** across the five families, at least two from each baseline
  family. At least two must be `[H]` or `[M→H]` rules (for example FUN-12, FUN-17, ERR-9, ERR-7,
  CON-8). Express each one in the language's idiom (see *Language adaptation* in `SKILL.md`).
  Go signals errors with ignored `err` values, not exceptions.
- **Decoys:** plant **two** decoys, drawn from the loaded families' *Don't over-apply* sections.
  A decoy looks suspicious but is fine by the rules. Examples: `i` in a three-line loop, a comment
  explaining *why* a regulatory rounding rule exists, a small public-field record used purely as
  data, or a four-line function that already does one thing. A correct refactor leaves decoys
  alone.
- **No hints.** Don't add comments that point at the smells (except where a planted smell *is* a
  comment), and don't use suspicious names like `badFunction`.
- **Must run.** Smells are allowed; syntax errors and crashes are not. Latent defects are allowed
  when the rule is about one (float money, a swallowed exception).

Write the answer key to `planted.md`. For each smell record `line — rule ID — one-line
description`, and do the same for each decoy. Then run `before/` and save its stdout to
`before.out`.

## 4. Review: the skill in REVIEW mode
Now switch roles. Treat `before/` as a colleague's code and **do not consult `planted.md`** until
step 7. Follow `SKILL.md` exactly, because showing the protocol working is the point:

1. Scan the whole file with the **Symptom map** without loading anything (in a dry run, the
   whole file is in scope). Write down which signals you saw.
2. **Pass 1:** load the ≤ 3 reference files that cover the most flagged lines.
   **Pass 2 (if needed):** load up to 3 more for the remaining signals. Never load a file you
   already have in context, and never load one "just in case".
3. For `[M]` and `[H]` findings, read the rule's *Detect* line and the file's **Don't
   over-apply** section before citing it. Drop anything the restraint rules say not to raise.
4. Record each finding as `before/<file>:<line> — [clean-code RULE-ID] <defect> — <fix>`, with
   the severity mapped as in *REVIEW mode*.

Keep a **router trace** as you go: for each pass, list the symptoms you saw, the files you loaded,
and the reason for each file.

## 5. Fix: the skill in WRITE mode
Copy `before/` to `after/` and refactor `after/` only.

- Follow the **Context map**. Load `refactoring-workflow.md` now if it isn't in context, plus
  any file a fix needs that the review didn't load. The same budget applies.
- Fix **every** finding, MINOR included, because this is a demo. The exception is a fix that
  would itself break a rule (EMG-5 over-abstraction, a pattern with a single use). List any
  finding you skip, with the reason.
- **Small steps (REF-3):** apply the fixes in groups (names → functions → errors → structure …).
  After each group, run `after/` and compare its output with `before.out` if the runtime exists.
- **Preserve behaviour.** The only allowed changes are real defect fixes that a finding calls for
  (money moved off floats, an error no longer swallowed). Label each one **intentional
  behaviour change**.
- Keep the result in **one file** so the diff stays readable. If a real codebase would split it
  into modules, add a note saying so instead of splitting it.
- Leave decoys alone. Write idiomatic code for the language, not the book's Java style.

## 6. Verify
Run `after/`, save its stdout to `after.out`, and diff it against `before.out`. Every differing
line must trace to an intentional behaviour change. Any line that doesn't is a regression: fix it
and re-run before presenting. If the runtime is missing, say **"behaviour check not executed"**.
Never claim equivalence you didn't observe.

Produce the code diff. `git diff --no-index` works outside a repository and exits with 1 when
files differ, which is expected:
```
git diff --no-index --no-color before/<file> after/<file> > changes.diff
git diff --no-index --stat before/<file> after/<file>
```
If git isn't available, use `diff -u`. If neither is, skip the full diff and show the excerpts
from section 4 of the report.

### Run commands
| Language | Check | Run |
|---|---|---|
| Python | `python --version` | `python main.py` |
| TypeScript | `node --version` (≥ 22.6) or `npx tsx --version` | `node --experimental-strip-types main.ts` or `npx tsx main.ts` |
| JavaScript | `node --version` | `node main.js` |
| Java | `java --version` (≥ 11) | `java Main.java` |
| C# | `dotnet --version` (≥ 10) | `dotnet run main.cs` |
| Go | `go version` | `go run main.go` |
| Kotlin | `kotlinc -version` | `kotlinc -script main.kts` |
| Ruby | `ruby --version` | `ruby main.rb` |

## 7. Present the results
Use this layout, in this order. Keep excerpts short: the point is to *see* each change.

````markdown
## Clean-code dry run: <Language> · <Domain>
`<scenario>` · <N> features · <before> → <after> lines · <k> findings fixed · behaviour: <identical | identical except <m> intentional changes | not executed>

### 1. The program
<2–3 sentences on what it does, then the six features as one line.>

### 2. How the skill routed
| Pass | Mode | Symptoms spotted | Files loaded (why) |
|---|---|---|---|

### 3. Findings
| # | Line (before) | Rule | Severity | Defect | Fix |
|---|---|---|---|---|---|

### 4. Before → after, finding by finding
#### F1 · [clean-code FUN-12] <one-line defect>
```diff
- <before lines, ≤ 12>
+ <after lines, ≤ 12>
```
<one sentence: why this is better, citing the rule. For a sweeping change such as a rename
used in many places, show one representative hunk and say "+ n more sites".>

### 5. Metrics
| | Before | After |
|---|---|---|
| Lines | | |
| Functions / methods | | |
| Longest function (lines) | | |
| Deepest nesting | | |
| Most parameters | | |
| Unnamed domain literals | | |
Line counts are measured. The other metrics are counted by inspection; say so.

### 6. Behaviour check
<command, then "outputs identical", or each differing line mapped to its intentional change, or "not executed: <runtime> not installed">

### 7. Scorecard: planted vs caught
| Planted smell | Rule | Caught by |
|---|---|---|
Decoys: <each decoy: left alone ✅ / changed ❌, and which *Don't over-apply* rule protects it>
Extra findings (not planted): <list, or "none">
Missed: <list, or "none">. Report misses honestly; they are part of the demo.

### 8. Full diff
<the whole diff in a ```diff block if it is ≤ 250 lines; otherwise the `--stat` summary plus the path to changes.diff>
````

End with the workspace path and a single line of options: *"Try `dry run` again for a new
scenario, `dry run <language> <domain>` to pin one, or point me at your own code."* If the host
can publish an HTML page, you may offer a side-by-side view, but don't publish one unless the
user asks.

## Don't over-apply
- Don't rig the demo. Don't write the review from `planted.md`, and don't quietly drop a missed
  smell from the scorecard.
- Don't let the "after" version become a showcase of patterns. Clean means simpler, and a
  refactor that adds interfaces, factories or layers the program doesn't need breaks EMG-5.
- Don't add tests or extra files to the workspace unless the user asked for them (for example,
  `dry run with tests`). If they do, also plant one or two `unit-tests` smells in a companion
  test file.
