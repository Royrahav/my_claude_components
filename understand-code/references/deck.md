# The Brief deck (deck.json)

The first tab of the page is a presentation for stakeholders (release owners, risk assessors, product): what the work
is worth, what it is for, how it works at a high level, what could go wrong. The developer speaks over it; every
slide and every revealed step has speaker notes. It is optional: without `W/deck.json` the page has no Brief tab and
is exactly what it was. The page still opens on the Map; `#brief` opens the deck.

## Writing for stakeholders

- **Business words only.** No file names, paths, extensions, function or class names, `()`, `::`, arrows, hashes,
  snake_case or camelCase. Say "the print gateway", not the package. The build lints this; a finding means rewrite
  the sentence, not hide the word. Product and company names (labOS, PostgreSQL) are fine.
- **Why before how.** Order is value, purpose, then mechanism, then risk. A stakeholder who stops after slide 3 should
  already know why the work exists.
- **No invented numbers.** A number appears only when a commit, ticket, test, config or doc states it, and then it
  carries a `source` (shown on hover, not on the slide). Otherwise phrase the value as a capability ("prints without
  a manual setup step"), never a made-up metric ("saves 40% time"). Value cards state impact only from the same sources.
- **Major use cases only.** A flow slide is a use case a stakeholder would recognise (1-3 of them, at most 3). Failure
  paths and edge cases stay in the simulator; show one only when it is the point of the work (a bug fix).
- **Risk grounded in code.** Level and mitigations come from what exists: a feature flag, a config default, tests,
  a staged rollout, the revert path. A mitigation that cites code gets a `ref` (`path → Symbol`, checked by the build,
  not shown). If nothing backs a claim, do not make it.
- **Terse.** Every limit below is a word limit the build lints; the slide is read in seconds.
- **Speaker notes** are what the presenter says: two or three plain sentences, the reason behind what the slide shows.
  Per-step notes say what just appeared and why it matters. The risk slide (5 reveals: level, areas, mitigations, rollout
  and rollback, watch) and the takeaways keep theirs in `step_notes`, one text per reveal in order; the other slides put a
  `note` on each card, block or step, and `note_after` on before_after.
- **Code mode** (understand-code): same slides, but no `before_after`. Say what the area does for the business, why it
  exists, how it works. Risk becomes "what breaks if this area is touched" and what to watch when changing it.

## Schema

```jsonc
{
  "title": "Print to any printer by its address",             // max 9 words
  "slides": [                                                   // in this order; flow 1-3 times
    { "type": "title", "title": "...", "subtitle": "max 25 words",
      "stats": [{ "value": "3", "label": "max 6 words", "source": "commit, ticket, test, config or doc" }],   // 0-4; a numeric value counts up
      "notes": "..." },
    { "type": "value", "title": "Why it matters", "notes": "...",
      "cards": [{ "icon": "time|money|risk|users|speed|quality|compliance|automation|support|scale",
                  "head": "max 6 words", "text": "max 20 words", "note": "..." }] },                      // 2-4, one per reveal
    { "type": "before_after", "title": "...", "notes": "...",       // change mode only; a bug fix: what users hit, then what they get
      "before": { "head": "Before", "points": ["max 14 words"] }, "after": { "head": "Now", "points": ["max 14 words"] },
      "note_after": "said when the after side appears" },
    { "type": "system", "title": "The big picture", "notes": "...",
      "blocks": [{ "id": "gw", "name": "Print gateway", "status": "new|changed|existing|external", "text": "max 12 words", "note": "..." }],   // 3-7, one per reveal
      "links": [{ "from": "lis", "to": "gw", "label": "max 4 words" }] },                                   // ids must be blocks
    { "type": "flow", "title": "Use case: ...", "scenario": "id in scenarios.json it summarises", "notes": "...",
      "actors": [{ "id": "lis", "name": "Lab system", "icon": "user|app|server|db|printer|cloud|device|lock|queue|mail" }],   // 2-5
      "steps": [{ "from": "lis", "to": "gw", "label": "max 6 words", "text": "max 18 words", "fail": false, "note": "..." }],  // 2-7; ids must be actors
      "result": "max 16 words" },                                   // shown as a final reveal
    { "type": "risk", "title": "Risk and release", "notes": "...",
      "level": "low|medium|high", "reason": "max 25 words",
      "areas": [{ "name": "max 5 words", "impact": 1 }],            // impact 1-3, 1-6 areas
      "mitigations": [{ "text": "max 16 words", "ref": "optional path → Symbol" }],
      "rollout": "max 20 words", "rollback": "max 20 words", "watch": ["max 12 words"],
      "step_notes": ["level", "areas", "mitigations", "rollout and rollback", "watch"] },                       // 5 notes, one per reveal
    { "type": "takeaways", "title": "...", "points": ["max 14 words"], "notes": "...", "step_notes": ["one per point"] }   // 2-4
  ]
}
```

A slide title is at most 9 words. An unknown icon draws a dot.

## What the build does with it

- **Errors (exit 3, same as other malformed input):** deck.json that is not an object, an empty `slides` list, a slide
  that is not an object, an entry of a list (cards, blocks, links, actors, steps, areas, mitigations, stats) that is not
  an object, unknown slide type, a flow step whose `from` or `to` is not in its `actors`, a system link to an unknown block.
- **Lint (warnings in `W/lint.txt`, first three printed):** word limits, missing notes, a stat without a `source`,
  missing `step_notes` (risk, takeaways), counts outside the ranges, a missing or out-of-order slide, more than 3 flows, a flow `scenario` not in
  `scenarios.json`, `before_after` in code mode, code-like words in any shown text. Fix every finding.
- **Refs:** mitigation `ref`s join the other refs; an unresolved one blocks publishing like any other.
- **Summary line**, printed only when a deck exists: `deck: N slides (F flows), S reveal steps; L lint` (L must be 0).

## How the page plays it

Next reveals the next step (a card, the after side, a block, a flow hop, a risk section, a point), then moves to the
next slide; Back reverses. Keys on the Brief tab: right arrow, space or PageDown next; left arrow or PageUp back;
Home, End; F presents (a full-page overlay, real fullscreen when the host allows it; Esc exits); N toggles the notes.
The slide is a fixed design canvas scaled to fit the stage, so nothing scrolls; presenting hides the notes from the
audience until N is pressed. Repeated work at one actor (a step from an actor to itself) shows as numbered chips under it.
Motion follows the viewer's reduced-motion setting: with it on nothing moves and every step still works.
