# Writer guide: the script and the final look

Read this at the script step, with scenes.md; read its last section, Final look, after the layout
review. You write the story: the scenes, the narration and the on-screen text.
`D` = `node "<skill dir>/scripts/demo.mjs"`. The user's constraints are binding. Plain hyphens
only, never em or en dashes.

Don't run narrate, sfx, music or render at the script step: they cost ElevenLabs credits, and
they belong to production, after gate 1.

## Script

1. Read `<project>/FACTS.md`, `<project>/brief.json` and `<skill dir>/references/scenes.md`.
   FACTS.md is the claim whitelist: nothing outside it is said or shown.
2. Pick the story spine in scenes.md that fits the audience and length. Drop scenes the facts
   cannot fill.
3. Write `scenes.json` in one Write.
4. Add `pronunciations.json` entries for names the voice may get wrong: product names,
   acronyms, versions, config keys.
5. Run `D plan .` and fit the plan within about 10% of `length_s`: trim or extend `say`, or drop
   or add a scene. It is an estimate until narrate measures the real voice.
6. Run `D script .` (writes SCRIPT.md).

Open questions from FACTS.md: use the user's answers so far. For each one still open, assume its
recommended option. Bring at most 2 to gate 1, only what changes the story.

A layout no template offers: read `<skill dir>/references/custom-scene.md`.

## Recap rule (mandatory)

The second-to-last scene is a `recap` (template in scenes.md); `close` is last.

- It covers the 2-4 most important takeaways for this audience, each with one concrete
  real-life example from the audience's own work. Take the examples from FACTS.md "Real-life use".
- Strategy. Default: takeaways plus examples. Alternatives when they fit better: for a bug fix,
  before/after plus what to do now; for a mixed audience, one takeaway per role (developers,
  PMs, support), using the `who` chips. Name the strategy in the gate 1 summary.
- Examples add no capability, number or claim beyond FACTS.md. Phrase a scenario marked
  "(illustrative)", and any hypothetical, as an example: "For example, ...".
- Narration is about 25 to 45 words, and the examples are spoken. On screen: titles up to 6
  words, examples as short phrases (up to 12 words), never the narration itself.

## Gate 1 summary

Show the user this, nothing else:

```
s01 title: <the narration> | on screen: <one line>
s02 split: <the narration> | on screen: <one line>
...
plan: <total> vs target <length> (<+/-N%>)
recap: <strategy>
pronunciations: <names added, or none>
open questions: <none, or per question: the question | A (recommended) / B / C>
```

One line per scene. `sNN` is the scene's position: s01, s02, and so on.

## Revision

For a user change, the checker's problems, a layout problem that needs new wording, or a
`house style:` build warning (for example a recap with fewer than 2 or more than 4 items, or an
item without a title or an example):

1. Apply it to scenes.json. Keep the recap rule.
2. Run `D plan .` and `D script .`.
3. Note the scenes whose `say` or pronunciation changed: after gate 1 they need `D narrate .`,
   which re-voices only those. Note the scenes whose claims or on-screen text changed: they need
   the checker again (SKILL.md, Re-check).
4. Show the user only the changed scenes, in the gate 1 format, then the new `plan:` line.

## Final look

After the layout review (qa.md), with its list of text changes:

1. Read the contact sheet image once. For each scene judge whether it makes its point, whether
   the hierarchy is clear and the text legible. Judge whether the recap is clear.
2. Check that the layout review's text changes kept their meaning. Revert any that did not.
3. Fix meaning-level problems in scenes.json.
4. Fix layout problems with data first: shorter labels, fewer items, or another built-in
   template. A project template (`<project>/scenes/<type>.mjs`) is allowed only when no data
   change or existing template can fix the layout. It must follow custom-scene.md, must be built
   and checked, and must be listed in the summary.
5. Rebuild what changed: `D narrate .` first if a `say` or pronunciation changed, then
   `D build . --only <ids>`. After any template or layout change, run `D check .` and look at the
   new contact sheet once. Changed claims or on-screen text: the checker again (SKILL.md,
   Re-check).
6. Summary, at most 10 lines: `approved`, or `sNN: <problem> -> <fix>` per fix; one line per
   project template added (`project template: scenes/<type>.mjs for sNN`); then
   `renarrated: <ids or none>`.
