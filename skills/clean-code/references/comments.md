# Comments `[CMT]`

Source: *Clean Code* ch. 4 + ch. 17 comment heuristics. **Load when** adding, editing or
reviewing comments, docstrings, TODOs, file headers or commented-out code.

Core idea: a comment usually marks a place where the code failed to express itself. Comments rot
because code moves and changes while comments stay put, so the code is the only reliably true
source. Before writing a comment, try in order: a better name, an extracted function, an
explanatory variable. Comment only what is still left unexplained, and that is usually *why*.

## Comments that earn their place
**CMT-1 Legal** — Required copyright or licence headers. Keep them short and point to the
licence file rather than pasting it.

**CMT-2 Informative** — Brief facts the code can't carry, such as the format a regex matches.
Prefer moving that knowledge into a name or a small class when you can.

**CMT-3 Intent** — Why this decision was made: the constraint, trade-off or business rule
behind a non-obvious choice.

**CMT-4 Clarification** — Translating an obscure argument or return value from code you can't
change (a standard library, a vendor API). Verify it: a wrong clarification is worse than none.

**CMT-5 Warning of consequences** — "Not thread-safe; create one per call", "Takes minutes".
For tests, prefer the framework's skip-with-reason annotation to a comment.

**CMT-6 TODO** — Acceptable for work that can't be done yet, but never an excuse for leaving bad
code. Scan and clear TODOs regularly, and move lasting ones to the issue tracker.

**CMT-7 Amplification** — Stressing that something which looks trivial really matters ("the
trim is required: leading spaces make the parser treat this as a nested list").

**CMT-8 Public API docs** — Docstrings and Javadoc on public APIs are valuable, but only while
they're accurate. Treat them as code that must be maintained.

## Comments to remove or rewrite
**CMT-9 Mumbling** `[L]` — Written out of obligation and meaningful only to the author; the
reader has to open other code to decode it.

**CMT-10 Redundant** `[L]` — Restates the code and takes longer to read than the code itself
(`// increment i`, a docstring that repeats the signature).

**CMT-11 Misleading or obsolete** `[M→H]` — Subtly inaccurate or out of date (says "returns
when X" but returns when Y). Fix or delete it immediately. Raise to [H] when it can lead a caller
to misuse the API.

**CMT-12 Mandated** `[L]` — A rule that every function or field must have a comment produces
clutter and lies. Exempt obvious members.

**CMT-13 Journal and metadata** `[L]` — Changelogs, author names, dates and ticket numbers at
the top of files or on lines belong in version control and the issue tracker.

**CMT-14 Noise** `[L]` — `/** Default constructor. */`, `/** The name. */`, and copy-pasted
doc blocks whose text doesn't match the member they sit on. Readers learn to skip comments, then
miss the one that matters.

**CMT-15 Comment instead of code** `[L→M]` — A comment explaining a messy expression or block.
Fix: extract a named variable or function so the comment becomes unnecessary (FUN-3, FUN-20).

**CMT-16 Position markers and banners** `[L]` — `// ===== Actions =====`. Use them rarely, if
at all; a long file that needs signposts wants splitting.

**CMT-17 Closing-brace comments** `[L]` — `} // end while`. Shorten the function instead.

**CMT-18 Commented-out code** `[L→M]` — Delete it. Nobody dares remove it later, it rots, and
version control keeps the history. Temporary use during a debugging session must not reach a
commit.

**CMT-19 Markup in source comments** `[L]` — HTML or other presentation markup inside comments.
Let the documentation tool handle formatting and keep the source readable.

**CMT-20 Nonlocal information** `[M]` — A comment describing something defined elsewhere, such as
a default configured in another module. It goes stale silently. Describe only the code next to it.

**CMT-21 Too much information** `[L]` — History, RFC digressions and design debates. Link to
them instead.

**CMT-22 Inobvious connection** `[L]` — The link between a comment and its code must be obvious;
a comment that itself needs explaining has failed.

**CMT-23 Headers on small or private functions** `[L]` — A good name beats a header. Doc comments
on non-public code are usually unnecessary formality.

**CMT-24 Poorly written** `[L]` — If a comment is worth writing, write it well: brief, precise,
correct grammar, no restating the obvious.

## Don't over-apply
- "Minimise comments" does not mean "delete all comments". Keep *why* comments on non-obvious
  algorithms, regexes, performance hacks, workarounds and business rules.
- Team or regulatory standards may require headers or public-API docs. Follow them and review
  them for accuracy rather than presence.
- Generated code, and docs consumed by tooling (OpenAPI annotations, type stubs), follow their
  own rules.
