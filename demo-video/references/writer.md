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
   FACTS.md is the claim whitelist: nothing outside it is said or shown. Run `D history .` (the
   last videos and the taste notes): make this video differ from them in structure (scene-type order; variants don't
   count), close form and preset unless the content demands otherwise, and apply the taste notes.
2. Pick the spine first; order beats variety. A `direction.thread` (one running example), then
   `chapter`s in dependency order (one unbroken run each, never revisited), each scene opening
   with a bridge from the last one's limit ("so we add caching"), no term used before it is
   introduced.
3. Design the structure (scenes.md, Designing the structure). Ask what this audience needs first
   and what shape the content has: a journey, a turn, a before/after, a day in someone's work, a
   number, a question, a myth. Pick the pattern, or combine some, that fits. Never reuse one
   order by default: the last video's shape is not a template. Condense (below), drop scenes the
   facts can't fill, and pick the summary form (Summary rule).
4. Propose a direction (scenes.md, Creative direction): the preset closest to the content's feel,
   a motif (the visual idea tied to this feature), a mood, and only the knobs the content asks
   for beyond the preset (`rail` and `background: world` suit a chaptered journey: visuals.md). Tone and `notes` are already set (Tone, Art freedom). Write it to
   brief.json `direction`, and rewrite `music_prompt` from the mood: instrumental, no vocals, even
   enough to sit under a voiceover.
5. Plan the signature scene (below).
6. Write `scenes.json` in one Write. For each scene, pick the template and the layout variant that fit
   its content (scenes.md, Templates), and vary them: no template and variant back to back, and
   not one look for every scene.
7. Add `pronunciations.json` entries for names the voice may get wrong: product names,
   acronyms, versions, config keys.
8. Run `D plan .` and fit the plan within about 10% of `length_s`: trim or extend `say`, or drop
   or add a scene. It is an estimate until narrate measures the real voice.
9. Run `D script .` (writes SCRIPT.md).

Open questions from FACTS.md: use the user's answers so far (the focus interview), and assume the
recommended option for the rest. Only one that changes the story goes to gate 1.

A layout no template offers: read `<skill dir>/references/custom-scene.md`.

## Condensing

Idea budget: about 90 s, the core message plus 2 points; 3 min, core plus 3; 5 min, core plus 3-4,
one a deep dive. Spend it on the focus answers; cut the rest or give it a line. No cramming.

## Tone

`direction.tone` (unset is `balanced`). Humor adds no claim and is never at anyone's expense.
Put the speed in brief.json `voice.speed` (the speed fit may change it); write the music mood to
match.

| Tone | Writing and humor | Speed, music | Presets | Close forms |
|---|---|---|---|---|
| playful | wordplay, understatement, absurd contrast; a running gag ok | 1.05, bouncy | energetic-launch | punchline, callback |
| light | friendly, one wry aside at most | 1.0, warm | story-driven, energetic-launch | cta, callback, punchline |
| balanced | clear, a light touch, no jokes needed | 1.0, steady | calm-technical, story-driven | any |
| serious | plain, precise, no humor, stakes and numbers | 0.95, calm | calm-technical, minimal-documentary | cta, sting |
| critical | urgent, short, risk and action first, no humor | 1.0, tense | minimal-documentary | cta, sting |

On a repeat-look warning take the nearest other preset.

## Engagement

A menu, not a checklist: pick 3-5 that fit this content, varying from the last videos.
- Hook: start from FACTS.md `Hooks`: a question the viewer has asked, a striking number, a 2-line
  story, a what-if, a myth.
- An open loop paid off later; stakes and contrast; a recurring person or job.
- A pattern interrupt every 30-45 s: a `beat` scene, a full-bleed statement, a silent second.
- Show, don't list. Rhythm: 3-6 s beats among 15-20 s showcases.
- A callback ending (close `callback`).

## Art freedom

Precedence, highest first: hard rules (FACTS.md, summary, legibility, captions, length, the
user's constraints, and each scene following from the last: Script 2); the creator's `notes` and
taste notes; `freedom`; the preset; house-style warnings. Variety (a new structure, no repeated
template, history warnings) never overrides the order.
`direction.freedom`:
- `guided`: built-in templates, one signature scene, cheapest.
- `creative` (default): designed per content, 1-2 signature scenes.
- `auteur`: invent the visual language: up to 3 signature scenes, an unusual structure, and you may
  override a house-style warning when it serves the idea; say which at gate 1. Costs more.
  Picked at gate 1: keep the approved script, allow a third signature scene, and propose any
  restructure as a Revision (changed scenes only).

## 3D where it fits

`iso-journey` and `iso-map` only for spatial or flow content: an architecture, a request's journey, where things
live, the zoom-out summary. Explanations, code, numbers, lists and decisions stay 2D. At most about a third of the
scenes; clarity and story order beat visuals (visuals.md).

## Signature scene

Every video gets at least one signature scene designed only for this demo: a visual metaphor
tied to the feature, such as a sheet reshaping from A4 to Letter, or a request packet traveling
the real architecture. Build it from the direction's motif. At most 2 per video (3 for `auteur`).

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
- The narration opens with a signpost that fits the tone ("So, in short", "Quick recap", "Bottom line").

## Close forms

The default close is the tagline lockup (logo, title, 1-3 phrases): use it sparingly. Else pick a
variant (scenes.md, close) by tone, differing from the last videos:
- `punchline`: one sentence that lands the message.
- `cta`: the focus answer "next step" as an action.
- `callback`: answers the hook.
- `sting`: the logo only, 2-3 s.
Repeat the title only as a brand beat.

## Gate 1 summary

Show the user this, nothing else:

```
structure: <pattern, or patterns combined> | <why it fits, a few words>
s01 title: <the narration> | on screen: <one line>
s02 split: <the narration> | on screen: <one line>
...
spine: <thread> | <chapter, chapter, ...>
style: <preset>, <knobs changed, or none> | motif: <the visual idea> | mood: <the feel>
tone: <level> | freedom: <level> | notes: <yes/none>
engagement: <devices picked>
signature: sNN <the metaphor, a few words>
summary: sNN <form>, <strategy>
close: sNN <variant>
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
     `transition`;
   - close variant as the last video's: another variant (Close forms); scene sequence as a recent
     video's: restructure (Script 3); preset and tone as the last video's: another preset;
     monotone rhythm: add a `beat` or lengthen a showcase.
   - a chapter reappearing after another: reorder so each chapter is one run, or rename it;
   - `empty for N s`: reveal the first element on the first spoken word or an earlier cue, or add a `backdrop` or `chapter_intro` (visuals.md).
   History warnings yield to the creator's notes, taste notes and `auteur` (Art freedom), and to
   the order (Script 2): never reorder scenes to look different.
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
   the pattern, a template's variant or the signature scene. Boredom check: where would a viewer
   reach for their phone? Any stretch over about 40 s with no change of rhythm or visual? Does the
   end land?
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
