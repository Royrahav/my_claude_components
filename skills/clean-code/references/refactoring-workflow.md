# Refactoring workflow `[REF]`

Source: *Clean Code* ch. 14 (Successive Refinement), ch. 15 (JUnit Internals), ch. 16
(Refactoring SerialDate), plus the drafting advice in ch. 3 and ch. 12. **Load when** cleaning up
or restructuring existing code, working in legacy code, planning a multi-step refactor, or
reviewing a colleague's module as a whole.

Core idea: clean code isn't written clean; it's *rewritten* clean, in small, safe, tested steps.
It isn't enough for code to work: working-but-messy code is where every future slowdown starts.

**REF-1 First make it work, then make it right** `[—]` — Write the draft, get it passing, then
refine. The unprofessional step is moving on from working code while it's still a mess.

**REF-2 Stop feature work when the structure starts to rot** `[M]` — When each new addition
(another argument type, another format) needs edits in many scattered places, stop adding
features and refactor first. The longer you wait, the more expensive the fix.

**REF-3 Incrementalism** `[M]` — Make a series of tiny changes and run the tests after each one.
Never make a large change that leaves the system broken for long; many well-meant "improvements"
have wrecked programs this way. Keep a fast suite that runs in seconds so every step is checked.
Detect in review: one commit that restructures many files *and* changes behaviour; a refactor
with no test run between steps.

**REF-4 Secure the tests before touching legacy code** `[M]` — Before refactoring code you don't
own, measure coverage, add tests for the behaviour you're about to touch, and expect them to
uncover existing bugs. Fix those first, test-first, then refactor.

**REF-5 Boy Scout Rule, scoped** `[L]` — Check in every module a little cleaner than you found it:
rename one variable, split one function, remove one duplication, clarify one conditional. Keep
it within the code you're already touching; sweeping unrelated cleanup belongs in its own change.

**REF-6 The typical small moves** `[—]` — The case studies apply a recurring toolkit. Reach for
these first:
- remove encodings and noise prefixes from names (NAM-6);
- encapsulate and positively phrase conditionals (FUN-18, FUN-19);
- rename functions to state their real behaviour and side effects (NAM-18);
- expose hidden temporal coupling by passing results between steps (FUN-16);
- extract functions until each does one thing, and extract classes where fields cluster (FUN-3,
  CLS-5);
- move functions to the class whose data they use (OBJ-7, CLS-11);
- replace integer or string constants with enums or types (NAM-2);
- replace repeated type switches with polymorphism behind one factory (FUN-6);
- decouple from concrete implementations with interfaces and factories (CLS-7);
- delete dead code and commented-out code (FUN-24, CMT-18).

**REF-7 Undoing is part of the process** `[—]` — A later refactor often makes an earlier one
pointless. Inlining or reverting it is normal. Refactoring is iterative trial and error that
converges on a professional result.

**REF-8 Understand before you polish** `[M]` — When a fix works only after fiddling, keep going
until you know *why* it works (FUN-23). Test-driven changes turn guesses into knowledge.

**REF-9 Review other people's code professionally** `[—]` — A critique of code is not an attack
on its author. Say what's good as well as what isn't. Make each point specific, explained and
actionable (what, why it matters, what to do instead). Hold your own code to the same bar. Choose
readability and maintainability as the yardstick, not personal taste.

## Don't over-apply
- Don't refactor code the task doesn't touch just because it's there. Record it as a follow-up.
- A large rewrite, even a well-intended one, is exactly what REF-3 warns against. Prefer many
  small, green steps.
