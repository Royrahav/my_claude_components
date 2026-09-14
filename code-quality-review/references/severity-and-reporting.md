# Severity Triage and Reporting

A review is only useful if the reader can tell, in one glance, which findings block
merging and which are optional polish. Every finding must be triaged into exactly one
tier and written up in the standard format below. If a finding can't be written in that
format — because there's no concrete file:line or no scenario that triggers it — it is
not ready to report; either dig further or drop it.

## Severity tiers

### Blocker (must-fix before this code ships)

A finding qualifies as a Blocker only if at least one of the following is true:

- It causes incorrect output, data loss/corruption, or a crash for an input/state that a
  real caller (user, upstream service, scheduled job, concurrent request) can actually
  produce — not only under a contrived or already-impossible precondition.
- It is a security-relevant defect: unsanitized input reaching a query/shell/eval, a
  secret committed in source, an authorization check that can be bypassed, or a
  timing/logic flaw that leaks data across a trust boundary.
- It causes a resource leak or unbounded growth (memory, connections, file handles,
  goroutines/threads) on a path that runs repeatedly in production (a hot path, a loop,
  a long-lived server), not a one-shot script that exits immediately after.
- It silently swallows an error such that the caller believes an operation succeeded when
  it did not, and downstream code acts on that false assumption.
- It breaks a public API contract already relied upon by other callers (signature change,
  semantic change to return value, removed guarantee) without a migration path.

### Should-fix (real defect, not urgent)

Use this tier for defects that are genuine but bounded in impact: wrong behavior confined
to a rare edge case with low real-world likelihood, a design/architecture issue that
increases future cost but doesn't threaten current correctness, a missing test for
non-critical logic, or a robustness gap on an internal-only boundary that is unlikely but
not impossible to violate.

### Nit / Suggestion (optional polish)

Use this tier for style inconsistencies, naming that could be clearer but isn't
misleading, opportunities to simplify without changing behavior, or comment improvements.
Label these explicitly as optional so they're never confused with something blocking.

### Question (not a finding)

If something is ambiguous — behavior might be intentional but looks surprising — ask
rather than asserting a defect. Phrase it as a question tied to the specific line, and do
not assign it a severity tier.

## How to triage: the deciding questions

For each candidate finding, answer these before assigning severity:

1. **Is there a concrete input or sequence of calls, reachable from a real entry point,
   that triggers the bad outcome?** If the answer requires an "impossible" precondition
   (see `common-false-positives.md`), this is not a Blocker — downgrade or drop it.
2. **What is the actual consequence if triggered?** Data loss / wrong money amount /
   security breach → Blocker. Wrong log message / suboptimal performance in a cold path /
   confusing name → Nit or Should-fix.
3. **How likely is it to be triggered in practice?** Rare-but-possible edge cases in
   low-traffic paths are Should-fix, not Blocker, unless the consequence is severe enough
   that even low probability is unacceptable (e.g., data corruption).
4. **Does fixing it cost more than leaving it?** A theoretically-cleaner design with no
   current pain point and a costly rewrite is a Suggestion at most, not a Should-fix.

## Reporting format

Report every finding using this structure. Do not compress it into a single vague
sentence — each part carries information the reader needs to act without re-deriving it.

```
[SEVERITY] path/to/file.ts:142
Defect: <one sentence, specific to this code, not a category name>
Scenario: <the concrete input/state/sequence that triggers it>
Fix (optional): <one sentence, only if the fix isn't obvious from the defect+scenario>
```

### Good vs. bad examples

Bad (vague, not actionable, not falsifiable):
> "Error handling could be improved in the payment module."

Good:
> `[Blocker] src/payments/charge.ts:88`
> Defect: `chargeCard` catches the Stripe API error and logs it, but returns `{success:
> true}` to the caller instead of propagating the failure.
> Scenario: A declined card (Stripe returns `card_declined`) causes the order to be marked
> paid and shipped, while the customer was never actually charged.

Bad (category label dressed as a finding):
> "This function violates SRP."

Good:
> `[Should-fix] src/orders/OrderService.ts:20-95`
> Defect: `OrderService.submit()` computes tax, writes to the database, and sends a
> confirmation email in one function, so a change to the email template requires
> re-testing the tax and persistence logic to be safe.
> Scenario: A copy change to the confirmation email (marketing request) touches a file
> that also owns tax calculation, forcing a full regression pass on checkout for a
> text-only change.

### Rules for every finding

- Cite `file:line` (or a line range) for every finding — never "somewhere in this file."
- State the defect in terms of what the code actually does, not a principle it violates
  in the abstract (cite the principle as supporting context if useful, not as the finding
  itself).
- Give a scenario concrete enough that someone could write a test that fails today and
  passes after the fix. If no such scenario can be constructed, the finding is not solid
  enough to report as a Blocker or Should-fix — reclassify as a Question or drop it.
- Do not stack multiple unrelated defects into one finding; one finding, one defect, so
  each can be triaged and resolved independently.
- Lead the report with Blockers, then Should-fix, then Nits, so the reader's attention
  goes where it matters first.
