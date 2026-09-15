# Handling Ambiguity

Decide, for each open question surfaced during decomposition, whether it needs to go back
to the user or whether it's safe to default and move on. Then batch whichever questions
do need asking into a single round-trip.

## The decision rule

Ask the user when a question meets ANY of these:

- **Hard to reverse.** Changing the answer later requires a migration, a breaking API
  change, touching data already written, or redoing significant implementation work.
- **High-stakes.** The wrong guess causes data loss, a security gap, a financial/billing
  discrepancy, or a customer-visible bug that erodes trust (silently charging the wrong
  amount, showing one user another's data).
- **Materially different implementations.** The two readings don't just tweak a detail —
  they lead to different architectures, different data models, or different scope
  entirely (e.g. "does this need to work offline?" changes the whole design, not a
  parameter).
- **No reasonable default exists.** Every plausible interpretation is roughly equally
  likely and there's no convention in the existing codebase or product to lean on.

Default (pick the most reasonable interpretation, implement it, and say what was
defaulted) when ALL of these hold instead:

- **Cheap to reverse.** Changing it later is a small, localized diff.
- **Low-stakes.** Getting it "wrong" produces, at worst, a minor UX inconsistency, not
  data loss or a security issue.
- **The codebase already has a convention.** An existing pattern in the same product
  answers the question by precedent (e.g. every other "delete" flow in this app already
  shows a confirmation modal — default to doing the same here without asking).
- **The spec's own intent points one way**, even if it isn't stated explicitly — pick the
  reading that best matches everything else the spec says, not an arbitrary coin flip.

When defaulting, always say so, even briefly — silent defaults are exactly the failure
mode this skill exists to prevent. A one-line note ("assumed X because Y; easy to change
if wrong") is enough; it just has to be visible to the user, not buried only in a code
comment nobody reads.

## Batch, don't drip

Collect every question that clears the "ask" bar during the Phase 1/2 decomposition pass,
then send them together in one message before starting implementation (or before
finishing it, if they surfaced late). Do not interrupt the user once per question as they
come up — that fragments their attention and slows the round-trip more than it needs to.

Exceptions where asking immediately (not batched) is reasonable:
- A single blocking question discovered mid-implementation where nothing further can
  proceed without the answer, and no other open questions exist yet to batch it with.
- A question whose answer changes whether the whole task is even worth doing (e.g. "this
  ticket assumes an API that doesn't exist yet — should I build a mock, or is this
  blocked?").

## Phrasing: batched question example

Weak (unbatched, vague, forces the user to reconstruct context):

> Quick question about the ticket before I start.

Better — specific, batched, each question shows the two readings and what's at stake:

> Two things in the Save for Later ticket are ambiguous enough that I'd rather confirm
> than guess:
>
> 1. **Quantity on save**: if a cart line has quantity 3, should the saved entry keep
>    quantity 3, or reset to 1 (single item saved for later)? This changes what the
>    shopper gets back on "Move to cart," so I don't want to guess wrong.
> 2. **Saved list size**: should the Saved for Later section paginate/cap, or is an
>    unbounded list fine for now? Everything else in the ticket assumes a short list, so
>    I'll default to unbounded (matching the existing "recently viewed" section's
>    behavior) unless you'd rather I cap it.
>
> Everything else in the ticket reads unambiguously to me — starting on the rest now and
> will hold R13 (quantity) for your answer.

Note the shape: each item states the question, the two readings, why it matters enough to
ask (or, for item 2, states the default being taken and why, framed as "stop me if wrong"
rather than a blocking question) — and the message makes clear that non-blocking work is
proceeding in parallel rather than the whole task stalling on the answer.

## Phrasing: documented default example

For something that clears the "default" bar instead:

> The ticket doesn't say what the "Save for later" link's error state looks like if the
> save request fails. Defaulting to the same inline error-toast pattern the cart already
> uses for failed remove-item requests, since it's the existing convention and cheap to
> change if you want something different.

This is a statement, not a question — it doesn't block on a reply, but it puts the
assumption in front of the user so they can correct it before it's load-bearing.

## Anti-patterns to avoid

- **Silent guessing**: implementing an ambiguous point with no mention of it anywhere —
  the exact failure this skill exists to prevent.
- **Over-asking**: sending a clarifying question for something the codebase's existing
  conventions already answer, or something genuinely inconsequential — this trains the
  user to stop trusting that a question is actually important.
- **One-at-a-time drip**: sending five separate messages for five separate ambiguities
  discovered across a single decomposition pass instead of one batched message.
- **Vague questions**: asking "how should errors be handled?" instead of naming the
  specific decision point and the concrete readings under consideration.
