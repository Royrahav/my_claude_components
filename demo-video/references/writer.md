# Writer guide: the script and the final look

Read this at the script step, with scenes.md; read its last section, Final look, after the layout
review. You design the video (its structure, look and signature scene) and write the story: the
scenes, the narration and the on-screen text.
`D` = `node "<skill dir>/scripts/demo.mjs"`. The user's constraints are binding. Plain hyphens
only, never em or en dashes.

Don't run narrate, sfx, music or render at the script step: they cost ElevenLabs credits, and
they belong to production, after gate 1.

## Script

1. Read `<project>/FACTS.md`, `<project>/brief.json` and `<skill dir>/references/scenes.md`.
   FACTS.md is the claim whitelist: nothing outside it is said or shown.
2. Design the structure (scenes.md, Designing the structure). Ask what this audience needs first
   and what shape the content has: a journey, a turn, a before/after, a day in someone's work, a
   number, a question, a myth. Pick the pattern, or combine some, that fits. Never reuse one
   order by default: the last video's shape is not a template. Drop scenes the facts can't fill,
   and pick the summary form (Summary rule).
3. Propose a direction (scenes.md, Creative direction): the preset closest to the content's feel,
   a motif (the visual idea tied to this feature), a mood, and only the knobs the content asks
   for beyond the preset. Write it to brief.json `direction`, and rewrite `music_prompt` from the
   mood: instrumental, no vocals, even enough to sit under a voiceover.
4. Plan the signature scene (below).
5. Write `scenes.json` in one Write. For each scene, pick the template and the layout variant that fit
   its content (scenes.md, Templates), and vary them: no template and variant back to back, and
   not one look for every scene.
6. Add `pronunciations.json` entries for names the voice may get wrong: product names,
   acronyms, versions, config keys.
7. Run `D plan .` and fit the plan within about 10% of `length_s`: trim or extend `say`, or drop
   or add a scene. It is an estimate until narrate measures the real voice.
8. Run `D script .` (writes SCRIPT.md).

Open questions from FACTS.md: use the user's answers so far, and assume the recommended option
for the rest. Bring to the user only what changes the story, at most 2: one goes to gate 1; with
two, SKILL.md asks both in their own batch before you write.

A layout no template offers: read `<skill dir>/references/custom-scene.md`.

## Signature scene

Every video gets at least one signature scene designed only for this demo: a visual metaphor
tied to the feature, such as a sheet reshaping from A4 to Letter, or a request packet traveling
the real architecture. Build it from the direction's motif. At most 2 per video, for cost.

- It is a project template built with the kit (custom-scene.md, Signature scene recipe), 8-15 s,
  with each beat cued to the narration. Start from the worked example
  `<skill dir>/assets/examples/signature-sheet.mjs` (a sheet reshaping from A4 to Letter): copy it
  and adapt it to this video's motif.
- Plan it in scenes.json at the script step. Write its template after gate 1 approves the script,
  before production; it must pass build and check like any scene.
- Build warns `house style: no signature scene` until a scene uses a project template with a new
  type name, or `custom`. A project copy of a built-in under the built-in's name is a layout fix
  and does not count.

## Summary rule (mandatory)

The second-to-last scene is the summary; `close` is last. Pick the form that fits the structure
(scenes.md, Summary forms): a `recap` by default, or a callback to the opening scenario, a final
before/after, a checklist or a "what to do now" card, on any template with `"summary": true`.

- It covers the 2-4 most important takeaways for this audience, each tied to one concrete
  real-life example from the audience's own work. Take the examples from FACTS.md "Real-life use".
- In a `recap`, every item has a title and an example. Strategy. Default: takeaways plus examples.
  Alternatives when they fit better: for a bug fix, before/after plus what to do now; for a mixed
  audience, one takeaway per role (developers, PMs, support), using the `who` chips.
- Examples add no capability, number or claim beyond FACTS.md. Phrase a scenario marked
  "(illustrative)", and any hypothetical, as an example: "For example, ...".
- Narration is about 25 to 45 words, and the examples are spoken. On screen: titles up to 6
  words, examples as short phrases (up to 12 words), never the narration itself.

## Gate 1 summary

Show the user this, nothing else:

```
structure: <pattern, or patterns combined> | <why it fits, a few words>
s01 title: <the narration> | on screen: <one line>
s02 split: <the narration> | on screen: <one line>
...
style: <preset>, <knobs changed, or none> | motif: <the visual idea> | mood: <the feel>
signature: sNN <the metaphor, a few words>
summary: sNN <form>, <strategy>
plan: <total> vs target <length> (<+/-N%>)
pronunciations: <names added, or none>
open questions: <none, or the one for gate 1: the question | A (recommended) / B / C>
```

One line per scene. `sNN` is the scene's position: s01, s02, and so on.

## Revision

For a user change (a style change is an edit to brief.json `direction`), the checker's problems,
a layout problem that needs new wording, or a `house style:` build warning:

1. Apply it to scenes.json or brief.json. Keep the summary rule. For a warning:
   - the ending, or a recap's items: fix the summary scene;
   - no signature scene: plan one (Signature scene);
   - one template and variant back to back, or one template in over 40% of the scenes: change a
     template or a variant, or restructure;
   - every scene entering the same way: give `direction.transitions` a mix, or set a scene's
     `transition`.
2. Run `D plan .` and `D script .`.
3. Note the scenes whose `say` or pronunciation changed: after gate 1 they need `D narrate .`,
   which re-voices only those. Note the scenes whose claims or on-screen text changed: they need
   the checker again (SKILL.md, Re-check).
4. Show the user only the changed scenes, in the gate 1 format, then the new `plan:` line.

## Final look

After the layout review (qa.md), with its list of text changes:

1. Read the contact sheet image once. For each scene judge whether it makes its point, whether
   the hierarchy is clear and the text legible. Judge whether the summary is clear.
2. Does any scene feel generic or repetitive? Would a viewer predict the structure? If so, vary
   the pattern, a template's variant or the signature scene.
3. Check that the layout review's text changes kept their meaning. Revert any that did not.
4. Fix meaning-level problems in scenes.json.
5. Fix layout problems with data first: shorter labels, fewer items, or another built-in
   template. A project template beyond the signature scenes is allowed only when no data change
   or existing template can fix the layout. It must follow custom-scene.md, must be built and
   checked, and must be listed in the summary.
6. Rebuild what changed: `D narrate .` first if a `say` or pronunciation changed, then
   `D build . --only <ids>`. After any template or layout change, run `D check .` and look at the
   new contact sheet once. Changed claims or on-screen text: the checker again (SKILL.md,
   Re-check).
7. Summary, at most 10 lines: `approved`, or `sNN: <problem> -> <fix>` per fix; one line per
   project template added (`project template: scenes/<type>.mjs for sNN`); then
   `renarrated: <ids or none>`.
