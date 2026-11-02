# The Brief deck (deck.json)

The first tab of the page is a presentation for stakeholders (release owners, risk assessors, product): what the work
is worth, what it is for, how it works at a high level, what could go wrong. The developer speaks over it; every
slide and every revealed step has speaker notes. It is optional: without `W/deck.json` the page has no Brief tab and
is exactly what it was. The page still opens on the Map; `#brief` opens the deck.

## Writing for stakeholders

- **Product terms, never stand-ins.** Name every component, actor and block by the name the product team and the
  stakeholders use: the map's node names (`layout.json`, `inventory.json`), the ticket and, in a labOS codebase, the
  `domain-glossary` skill (LaaSServer, CleanStation, the caller, the app). Never a generic stand-in ("integration
  server", "cleanup service", "server A"). List each product name a stakeholder might not know in `terms`.
- **Full scope, then the example.** When the mechanism is generic (any entity, any process, any caller), say so in the
  title, subtitle, system slide and takeaways, and present the concrete case as "our example". Check the scope in the
  code (what it keys on) and never narrow it to the example ("any locked entity, by LaaSServer or any other process",
  not "orders only").
- **High level, not one integration.** Use cases describe the mechanism with a generic actor ("API caller", "a labOS
  process"), not one partner's or customer's specific flow. A specific partner may appear only as "for example" in a note.
- **The core concept gets its own explanation.** When the change revolves around an internal concept (a "mark", say),
  explain it visibly: its own flow slide or system block that shows what it is, where it is stored (table and column,
  new or existing) and what its values mean. A hover term alone is not enough.
- **What is left out gets its why and its how.** When the change deliberately leaves a case out or treats it
  differently (a lock kept on purpose across calls, one request type, one entity), give that case its own use case and
  say: why it is out (the business reason), how the code tells the cases apart (the rule it keys on, in plain words:
  "still held when the answer goes out", not "a special check"), what keeps it safe when something fails, and what
  covers that case instead. Stakeholders ask this first; a hover or one speaker note is not enough.
- **Separate parts, separate roles.** When a component has parts that act separately or at different times (a creator
  or scheduler and a worker, producer and consumer, client and server), show them as separate system blocks and
  separate flow actors, each step saying which part does what and when. Never merge them under the parent's name.
- **Business words only.** No file names, paths, extensions, function or class names, `()`, `::`, arrows, hashes,
  snake_case or camelCase. The build lints this; a finding means rewrite the sentence, not hide the word. Product and
  company names (labOS, PostgreSQL) and the listed `terms` are fine.
- **Every area says why.** An area's `why` grounds its level in what the code touches ("new column on a table every
  lock writes"), not in a feeling. It shows from a "Why" button next to the level, on hover, focus or tap.
- **Database, always named.** Whenever the change reads or writes the database, name the tables: in the system block's
  text and in the risk slide's `database` list (table names are shown verbatim and are never linted as code). Every new
  or changed column or table is listed with its name, called out as a risk area (it gets a danger badge), and its
  `detail` says how it reaches site databases: a script in the change, or "no script in this change". Never guess.
- **Every database step names its table.** A flow step that touches the database says which table in its label or text
  ("Lock and mark (lck)"). The lint flags a step to or from a database actor that names none of the risk slide's
  `database` tables.
- **Clear use cases.** A flow slide says who does what and why (`when`, the trigger) before the steps. Each step names
  a real actor doing a concrete thing ("The lab app asks CleanStation to wash the tray"), never an abstract label
  ("processing", "handling"). The `result` states the outcome for the user or the business. When a caller's API calls
  are involved, name each call as the caller sees it ("Lock call", "Release call") and keep what happens inside one
  call apart from what happens across calls. Explain any internal concept a slide relies on (a "mark", say) in plain
  words and add it to `terms`.
- **Updating a deck: re-check against the code.** Never copy facts from the previous deck.json; verify each one again.
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
  "terms": [{ "term": "CleanStation", "means": "max 15 words" }],   // optional, 0-8: product names, marked in the shown text, meaning on hover or focus
  "brand": { "name": "labOS", "logo": "labos" },              // optional: logo "labos" (built in) or a .svg/.png/.jpg/.webp path, relative to the work folder or absolute
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
      "when": "max 20 words: who does what and why (the trigger)",     // required, shown under the title
      "actors": [{ "id": "lis", "name": "Lab system", "icon": "user|app|server|db|printer|cloud|device|lock|queue|mail" }],   // 2-5
      "steps": [{ "from": "lis", "to": "gw", "label": "max 6 words", "text": "max 18 words", "fail": false, "note": "..." }],  // 2-7; ids must be actors
      "result": "max 16 words: the outcome for the user or business" },   // shown as a final reveal
    { "type": "risk", "title": "Risk and release", "notes": "...",
      "level": "low|medium|high", "reason": "max 25 words",
      "areas": [{ "name": "max 5 words", "impact": 1, "why": "max 20 words" }],   // impact 1-3, 1-6 areas; why: what the code touches that earns this level
      "database": [{ "table": "lck", "use": "new column|new table|changed column|reads|writes", "detail": "max 12 words" }],   // optional, 0-8; shown with the areas reveal (no extra step)
      "mitigations": [{ "text": "max 16 words", "ref": "optional path → Symbol" }],
      "rollout": "max 20 words", "rollback": "max 20 words", "watch": ["max 12 words"],
      "step_notes": ["level", "areas", "mitigations", "rollout and rollback", "watch"] },                       // 5 notes, one per reveal
    { "type": "takeaways", "title": "...", "points": ["max 14 words"], "notes": "...", "step_notes": ["one per point"] }   // 2-4
  ]
}
```

A slide title is at most 9 words. An unknown icon draws a dot.

**Terms.** A listed term is a product name: it is exempt from the code-like lint (CamelCase names such as CleanStation
or LaaSServer) and, wherever it appears in shown text (not case-sensitive, whole word), it gets a dotted underline and
its meaning as a hover or keyboard-focus tooltip, in present mode too.

**Database.** A risk slide's `database` rows show in the Affected areas card (the same reveal): table, use, detail. A
new column, new table or changed column gets a danger badge. The lint flags an unknown `use`, a detail over 12 words, a
schema change with no detail, and a new or changed system block that mentions the database, SQL, schema, migration or a table (or a flow
actor with the database icon) while no risk slide has a `database` list.

**Brand.** With a `brand`, the build embeds the logo in the page (the built-in `labos` is `assets/brands/labos.svg`):
large on the title slide, small in the corner of every other slide, the brand name as its alt text; on the dark theme
it sits on a light plate. Without a brand there is no logo and the page is unchanged.

## What the build does with it

- **Errors (exit 3, same as other malformed input):** deck.json that is not an object, an empty `slides` list, a slide
  that is not an object, an entry of a list (cards, blocks, links, actors, steps, areas, mitigations, stats) that is not
  an object, unknown slide type, a flow step whose `from` or `to` is not in its `actors`, a system link to an unknown block,
  `terms` or `brand` of the wrong shape, a brand without a `name`, a brand `logo` that is neither built in nor an existing
  .svg/.png/.jpg/.webp file.
- **Lint (warnings in `W/lint.txt`, first three printed):** word limits, missing notes, a stat without a `source`,
  missing `step_notes` (risk, takeaways), a flow without `when` or with one over 20 words, a term without `means`, with a
  `means` over 15 words or never used in the shown text, counts outside the ranges, a missing or out-of-order slide, more than 3 flows, a flow `scenario` not in
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
