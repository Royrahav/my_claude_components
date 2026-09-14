# Worked Example: Cart "Save for Later" Feature

This walks one realistic spec through the full workflow: decomposition into a checklist,
mapping each item to code and tests, and calling out one implied requirement a careless
pass would miss plus one ambiguity that should have been flagged rather than silently
resolved.

## The spec (as given by a PM in a ticket)

> **Ticket: Save for Later**
>
> Shoppers should be able to move an item from their cart to a "Saved for Later" list
> without losing it, so they can buy it another time. Add a "Save for later" link next to
> each cart line item. Clicking it removes the item from the cart and adds it to a new
> "Saved for Later" section shown below the cart. Saved items should show the product
> image, name, and price, with a "Move to cart" button to bring them back. The cart total
> should update immediately when an item is saved or moved back. This should work for
> both logged-in users and guests. Saved items should persist so they're still there next
> time the shopper visits. Let's ship this for the next release.

## Step 1: Decomposition

Working through `requirement-decomposition-checklist.md` category by category.

**Explicit functional requirements**
- R1. "Save for later" link/action next to each cart line item.
- R2. Clicking it removes the item from the cart.
- R3. Clicking it adds the item to a "Saved for Later" section.
- R4. Saved section renders below the cart.
- R5. Saved items display image, name, price.
- R6. Saved items have a "Move to cart" button.
- R7. "Move to cart" moves the item back into the cart.
- R8. Cart total updates immediately on save.
- R9. Cart total updates immediately on move-back.
- R10. Works for logged-in users.
- R11. Works for guests.
- R12. Saved items persist across visits (not just the current session's DOM state).

**Implied functional requirements** (not stated, but necessary for R1–R12 to actually work)
- R13. Saving an item with quantity > 1 must decide what happens to the quantity — implied
  by "removes the item from the cart," but the spec never says whether quantity carries
  over or resets to 1. *(This is the ambiguity — see Step 4.)*
- R14. "Move to cart" must decide what happens if the item has gone out of stock, changed
  price, or been discontinued since it was saved — implied by persistence (R12) combined
  with the fact that catalog state can change between visits. *(This is the implied
  requirement most likely to be missed — see Step 3.)*
- R15. Saved items list needs its own empty state (nothing saved yet) — implied by "shown
  below the cart," since that section has to render something (or nothing) even before any
  item is ever saved.
- R16. Guest persistence (R11 + R12) implies a storage mechanism that survives without an
  account — e.g. a cart/session cookie or device-local storage — since there's no user
  record to attach saved items to.
- R17. Saving the last item in the cart implies a decision about what the (now-empty) cart
  section looks like — the general empty-cart state must still render correctly.

**Error / failure states**
- R18. What happens if the save/move-back network call fails (e.g. server error) — does
  the item visually stay put, roll back, or show an error?
- R19. What happens if a user saves an item, then that product is deleted from the catalog
  entirely before they move it back?

**Edge cases**
- R20. Saving every item in the cart (cart becomes empty, R17 above).
- R21. Saving/moving back rapidly (double-click) shouldn't duplicate the item in both
  places.
- R22. Very long saved-for-later lists — does the section paginate or scroll, or is there
  a cap?

**Permission / authorization boundaries**
- R23. A saved-for-later list must be scoped to the owning user/session only — one
  shopper must never see another's saved items. (Not stated, but a basic data-isolation
  requirement implied by any per-user persisted list.)

**Data validation rules**
- R24. None beyond product-id/quantity integrity already enforced by the existing cart
  system — no new validation surface introduced by this feature. (Explicitly noted as
  "none" rather than skipped.)

**Non-functional requirements**
- R25. Accessibility: the "Save for later" and "Move to cart" controls need accessible
  names/labels (not icon-only with no text alternative), since they're interactive
  controls added to an existing accessible cart flow.
- R26. Performance/i18n: none beyond what the existing cart list already handles — noted
  explicitly rather than skipped.

**Backward-compatibility / migration concerns**
- R27. If saved items are stored server-side per account, existing users have no prior
  saved-for-later records — this is a new empty table/field, not a migration of existing
  data, so no migration script is needed, but this was confirmed rather than assumed.

**Explicit out-of-scope items**
- None stated in this ticket. Noted explicitly as "none" — the ticket doesn't say "don't
  build X," so there's no negative checklist item here, but the category was still
  checked rather than skipped.

## Step 2: Acceptance criteria vs. feature description

For the primary items (R1–R12), the acceptance criteria layer is what turns "there's a
save link" into "it's actually done":

| Requirement | Feature description | Acceptance criterion |
|---|---|---|
| R2/R3 | Save moves item cart → saved list | Item appears in saved list with same product id/qty *decision* and disappears from cart in the same UI update, no flash of duplicate state |
| R8/R9 | Total updates on save/move | Total recalculates without a page reload, and matches sum of remaining cart lines exactly (no off-by-one from the moved item) |
| R12 | Saved items persist | Reload the page (or return next day) and the saved item is still present, for both guest and logged-in |
| R23 | Isolation | Two different sessions never see each other's saved items, verified with a test using two separate sessions/cookies |

## Step 3: The implied requirement a careless implementation would miss

**R14 — stale product state on move-back.** A spec-literal implementation reads "Move to
cart button to bring them back" and wires up a button that re-inserts the saved product
id into the cart. It's easy to ship that and call R7 done. But because R12 established
that saved items can sit for an arbitrary amount of time, the product being moved back can
have changed underneath the saved record: out of stock, price changed, or discontinued.
A "move to cart" that blindly re-adds a now-invalid product id produces a cart with a
dead or mispriced line item — a real, user-visible bug that traces directly back to a
requirement (R12, persistence) the spec did state, just not to its full logical
consequence.

**Code mapping**: in `moveToCart(savedItemId)`, re-validate the product against current
catalog state before insertion; if out of stock, keep it in the saved list and surface an
inline "no longer available" state instead of moving it; if the price changed, move it
with the current price (never the stale saved price) and surface a brief price-changed
notice.

**Test mapping**: a test that saves an item, mutates the catalog record (mark
out-of-stock), then attempts move-to-cart and asserts the item stays in the saved list
with an unavailable indicator rather than landing in the cart.

## Step 4: The ambiguity that should be flagged, not assumed

**R13 — quantity handling on save.** The spec says clicking "Save for later" "removes the
item from the cart and adds it to" the saved list. If the cart line has quantity 3, does
the saved entry carry quantity 3, or does it reset to 1 (since "saving one for later"
reads singular)? Both are plausible; they lead to materially different behavior on
move-back (does the shopper get 3 back, or 1?), and the choice isn't obvious from context
because the ticket's example scenario doesn't mention quantities at all.

This is exactly the kind of point Phase 4 says to surface rather than silently resolve —
it's not low-stakes (it changes what the customer ends up buying) and the two
interpretations diverge in visible behavior, so a wrong silent guess produces a bug
report, not just a stylistic quibble. The right move per
`references/handling-ambiguity.md` is to batch this question with any other open ones
(e.g. "should Saved for Later show an item count badge like the cart does?") in one
message to the PM before implementing R13, rather than shipping a guess.

## Step 5: Closing readout (Phase 3 in practice)

After implementation, the closing pass walks R1–R27 against the actual diff, e.g.:

- R1–R12: implemented, verified against `CartLineItem.tsx`, `SavedForLater.tsx`,
  `cartSlice.ts` move/save reducers.
- R13: **held pending PM answer** — implemented behind the assumption "carries quantity
  over," flagged explicitly in the PR description as reversible if the answer differs.
- R14: implemented per Step 3 above, with an accompanying test.
- R15, R17: implemented (empty states for saved list and empty cart).
- R16: implemented via the existing guest-cart cookie mechanism, reused rather than
  building a new one.
- R18, R19: implemented — failed save/move rolls back optimistic UI update and shows a
  toast; deleted-product case reuses the R14 "unavailable" treatment.
- R20–R22: covered by tests; R22 explicitly deferred with a one-line note in the PR
  ("no pagination added; saved lists assumed small — flag if this becomes a problem")
  rather than silently ignored.
- R23: covered by a two-session isolation test.
- R25: labels added; spot-checked with a screen reader pass.
- No unrequested scope added (no "while I'm here" refactor of the unrelated cart pricing
  logic, no extra bulk-actions UI nobody asked for) — checked explicitly against
  over-delivery, not just under-delivery.
