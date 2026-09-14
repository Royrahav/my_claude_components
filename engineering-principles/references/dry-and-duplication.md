# DRY and the Wrong Abstraction Problem

DRY says every piece of *knowledge* should have one authoritative representation. The
common misreading is "every piece of *text* that looks similar should be merged" — and
that misreading is responsible for a large share of bad abstractions in real codebases.
Two blocks of code can be textually near-identical today and still represent completely
different concerns that happen to coincide by accident, not by shared meaning. Merging
those is a trap: it looks like a DRY win on day one, then costs far more than the
duplication would have, over the following months.

## The wrong abstraction problem

The trap unfolds in a predictable sequence:

1. Two pieces of code look similar. Someone extracts a shared function/class to avoid
   "duplication."
2. A new requirement arrives that applies to only one of the two original call sites. The
   shared function grows a parameter or a conditional branch to accommodate it
   (`if (variant === 'A') { ... }`).
3. This repeats. The shared function accumulates more flags and branches, each one only
   relevant to a subset of callers, until the function is a maze of conditionals that is
   harder to understand than the two original, separate, simple versions would have been.
4. Nobody wants to be the one to "un-DRY" it, because the shared function now has many
   callers and looks load-bearing, so the tangle persists and grows.

The fix, when this is recognized, is to *inline the abstraction back out* — copy the
shared function's logic back into each call site and let them diverge — rather than
adding another flag. This is often uncomfortable because it looks like "giving up" on
DRY, but it isn't: the two call sites were never really duplicating the same knowledge,
so there was nothing to keep unified in the first place.

## Example: duplication that should be tolerated

Two `validateEmail` checks — one in a checkout form, one in a marketing newsletter
signup — look identical today:

```ts
// checkout-form.ts
function validateCheckoutEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// newsletter-signup.ts
function validateNewsletterEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

These look like an obvious DRY violation. But they represent different *concerns* that
are reasonably likely to diverge: checkout email validation might soon need to reject
known-disposable-email domains (to reduce fraud) or require the email to match a billing
record, while newsletter signup might soon need to be more lenient (accept `+` aliases
freely, never reject based on fraud heuristics) to maximize sign-ups. If these are merged
into one `validateEmail` shared utility now, the first time one of these business rules
diverges, the shared function needs a flag — the first step into the wrong-abstraction
trap above.

**Verdict: tolerate the duplication.** A short regex duplicated in two files costs
almost nothing to keep in sync manually (it's simple, stable, and rarely changes), and
keeping them separate means each can evolve independently without touching the other or
threading a flag through a shared function. If, later, a third, fourth, and fifth
identical validator shows up with no sign of divergence, that's the "rule of three"
signal to reconsider — but two similar-looking, independently-owned call sites is not
yet enough evidence to merge.

## Example: duplication that should be unified

Contrast that with tax calculation logic duplicated between the checkout flow and the
invoice-generation flow:

```ts
// checkout.ts
function calculateCheckoutTax(subtotal: number, state: string): number {
  const rate = TAX_RATES[state] ?? 0;
  return Math.round(subtotal * rate * 100) / 100;
}

// invoice.ts
function calculateInvoiceTax(subtotal: number, state: string): number {
  const rate = TAX_RATES[state] ?? 0;
  return Math.round(subtotal * rate * 100) / 100;
}
```

This is the *same knowledge* — "how much tax does this jurisdiction charge on this
amount" — expressed twice. It is not two coincidentally similar rules with different
owners; it is one rule (a legal/financial requirement, not a design choice either team
can unilaterally change) that both call sites must always agree on. If the tax rate table
or rounding rule changes, both must change together, and a duplicated implementation
means someone can update one and forget the other — producing checkout and invoice
totals that silently disagree, which is a real correctness bug, not just an aesthetic
issue.

```ts
// tax.ts — single authoritative source of the rule
export function calculateTax(subtotal: number, state: string): number {
  const rate = TAX_RATES[state] ?? 0;
  return Math.round(subtotal * rate * 100) / 100;
}

// checkout.ts and invoice.ts both call calculateTax(subtotal, state)
```

**Verdict: unify.** There is exactly one rule here, owned by one concern (tax law
compliance), used identically by both callers, with no plausible reason the two callers
would ever need different tax logic. This is the case DRY is meant for.

## Rule of thumb — telling the two cases apart

Before merging two similar-looking pieces of code, ask:

- **Same knowledge, or same shape?** Would a domain expert say "these are the same rule"
  (tax calculation) or "these coincidentally look alike right now" (two different forms'
  email format checks)? Only the former is a DRY violation.
- **Same owner/reason to change?** If the two call sites are likely to be changed by
  different people for different reasons in the future, they are not really duplicating
  knowledge — they're independent facts that happen to match today.
- **Rule of three:** two similar occurrences are a coincidence until proven otherwise; a
  third occurrence, still identical, is real evidence of shared knowledge worth
  extracting.
- **Watch for flags creeping into a "shared" function.** The moment a shared
  abstraction needs a parameter whose only job is to select different behavior for
  different callers, that's a signal the abstraction was wrong (or has stopped being
  right) — prefer splitting it back apart over adding the flag.

When reviewing code, do not flag textually similar code as a DRY violation without first
checking whether it represents the same knowledge with the same reason to change. Flagging
coincidental similarity as "duplication" and merging it is how the wrong-abstraction trap
gets started.
