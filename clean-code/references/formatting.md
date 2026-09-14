# Formatting `[FMT]`

Source: *Clean Code* ch. 5 + ch. 17 heuristics on separation, consistency and conventions.
**Load when** creating a new file, reorganising a file, ordering members, or setting team style.

Core idea: formatting is communication. The style you set outlives the code it was written for,
and consistency matters more than any particular rule.

**FMT-1 Team rules, automated** `[L]` — The team agrees on one style (indentation, braces, line
length, naming case, import order) in a short session, then encodes it in a formatter, linter or
pre-commit hook. Individual preference yields to the team, and new code matches its neighbours.
Detect: style differs from sibling files; mixed conventions inside one file.

**FMT-2 Small files** `[L]` — Most files in well-kept systems stay around a couple of hundred
lines and rarely pass ~500. Large files are harder to understand, and are often a class with too
many responsibilities (CLS-3).

**FMT-3 Newspaper order** `[L]` — The file name tells you whether you're in the right place. The
top gives the high-level concepts and algorithms, and detail increases as you read down.

**FMT-4 Vertical openness** `[L]` — Blank lines separate concepts: between functions, after
imports, between logical groups. Code without them reads like a paragraph without punctuation.

**FMT-5 Vertical density** `[L]` — Lines that belong together stay together. Don't break a tight
group (for example related fields) with comments or blank lines.

**FMT-6 Vertical distance** `[L]` — Related concepts stay close, which avoids hopping around the
file (or across files, one reason protected fields are suspect):
- local variables are declared just before their first use; loop variables in the loop;
- instance variables sit in one well-known place (the top, in most languages);
- a caller sits just above the function it calls;
- conceptually similar functions (overloads, variations on a theme) are grouped together.

**FMT-7 Vertical ordering** `[L]` — Call dependencies point downward: high-level functions come
first and helpers below, so the file reads top-down (FUN-5).

**FMT-8 Short lines** `[L]` — Keep lines short. Most lines in real code are well under 80
characters; treat ~100–120 as a hard upper bound, and never force horizontal scrolling.

**FMT-9 Horizontal openness** `[L]` — Use whitespace to show relationships: spaces around
assignment and low-precedence operators, none between a function name and its parenthesis.
Let the formatter decide where it can.

**FMT-10 No horizontal alignment** `[L]` — Don't column-align declarations or assignments. The
eye reads down the aligned column and skips the types. A long list that seems to need alignment
usually means the class should be split.

**FMT-11 Honest indentation** `[L]` — Indentation shows the scope hierarchy, so don't collapse
scopes onto one line to save space. Make empty loop bodies visible (`{}` or `;` on its own
indented line) so nobody misses them.

**FMT-12 One language per file** `[M]` — Minimise mixing languages in one source file (logic
plus embedded SQL, HTML and shell strings). Extract templates, queries and scripts into files of
their own type.

**FMT-13 Follow standard conventions** `[L]` — Use the language community's conventions and the
project's existing idioms. Code should read as if one person wrote it.

## Don't over-apply
- If a formatter or linter runs in CI, formatting is its job. In reviews, report only what tools
  can't catch: ordering, grouping, file size, mixed languages, misleading layout.
- Generated files, vendored code and data files are out of scope.
