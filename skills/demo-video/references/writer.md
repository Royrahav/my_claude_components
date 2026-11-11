# Writer guide: the script and the final look

Read this at the script step, with scenes.md; read its last section, Final look, after the layout
review. You design the video (its structure, look and signature scene) and write the story: the
scenes, the narration and the on-screen text.
`D` = `node "<skill dir>/scripts/demo.mjs"`. The user's constraints are binding. Plain hyphens
only, never em or en dashes.

Don't run narrate, sfx, music or render at the script step: they belong to production, after
gate 1 (sfx and music generation cost credits).

## Scope: the feature, not its development

Show what the feature is, how it works technically, and how to use, enable or configure it in the
product. Never how it was built, reviewed, tested or delivered (tests, QA, code review, CI, CL, PR,
ticket, sprint), in the narration or on screen. Status in product words: shipped, next version, off
by default and how to enable it. Ignore FACTS.md "Process (not for the video)". Build warns
`mentions "..." (development process)`: reword. A development-tool product lists the terms it needs
in brief.json `allow_terms` (`["CI"]`; a term lifts the hits that contain it as whole words).

## Sell the why first (the most important part)

Assume the viewer knows nothing: not the feature, not the code area, not its terms, not why anyone
built it. Sell the idea before you explain it. Why it exists decides whether anyone keeps watching
and whether they ever use it, so it gets the most care of any part, for a feature, a mechanism in
the code or a fix alike.

- Show the pain before naming the answer: what goes wrong, or what is hard, without it, on one
  concrete case (FACTS.md "Problem before", or the running example). A tiny before-picture or a
  three-line sketch beats a list of abstract gaps. Then name the feature as the answer to that pain.
- Say why the viewer should care right now: when they will meet the situation, and what changes for
  them ("next time you need X, you do Y instead of Z"). A promise of 2-3 benefits, paid off later
  (the recap calls back to it).
- Explain, don't state: every claim of value gets its reason or an example ("so a request that
  throws still logs its time"), never only an adjective ("robust", "simple").
- Every later chapter opens with its own small why: a use case starts with the problem it solves, a
  rule with what breaks without it.
- The test: by about the first minute, a newcomer can say in one sentence why this exists and when
  they would use it. The duck checks it (Duck review).

## Duck review

After `D script .`, the duck reads only your pitch and SCRIPT.md and replies `purpose:`, `why me:`,
`by:`, then lost, term, told, ask, flat and structure lines. Fix the script and its structure
(Revision), with only what FACTS.md supports: a wrong or late `purpose` or `why me` rewrites the why
chapter, never patches it; `ask` lines are candidates for spoken questions (Engagement); cut what it
calls flat when over length. A second round only if `purpose` or `why me` still misses. Then the
fact-check, on the final text.

## Script

1. Read `<project>/FACTS.md`, `<project>/brief.json` and `<skill dir>/references/scenes.md`.
   FACTS.md is the claim whitelist: nothing outside it is said or shown. Run `D history .` (the
   last videos and the taste notes): make this video differ from them in structure (scene-type order; variants don't
   count), close form and preset unless the content demands otherwise, and apply the taste notes.
2. Pick the spine first; order beats variety (Story order, below). A `direction.thread` (one
   running example), then `chapter`s in Story order (one unbroken run each, never revisited; dependency order inside a chapter),
   each scene opening with a bridge from the last one's limit ("so we add caching"), no term used
   before it is introduced.
3. Design the structure (scenes.md, Designing the structure). Ask what this audience needs first
   and what shape the content has: a journey, a turn, a before/after, a day in someone's work, a
   number, a question, a myth. Pick the pattern, or combine some, that fits. Never reuse one
   order by default: the last video's shape is not a template. Condense (below), drop scenes the
   facts can't fill, and pick the summary form (Summary rule).
4. Propose a direction (scenes.md, Creative direction): the preset closest to the content's feel,
   a motif (the visual idea tied to this feature), a mood, and only the knobs the content asks
   for beyond the preset (`rail` and `background: world` suit a chaptered journey: visuals.md). Tone and `notes` are already set (Tone, Art freedom). Write it to
   brief.json `direction`, and set `music_mood` (one of the five library moods, producer.md) only when the
   feel needs one; unset, the first `D music .` picks it from tone and preset and keeps it.
5. Plan the signature scene (below).
6. Write the logline and the pitch (2-4 sentences in the video's terms: what it is, why it exists,
   who should care and when; the duck gets it), then the question ladder (Story order), then
   `scenes.json` in one Write, each scene with its `question`. For each scene, pick the template and the layout variant that fit
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

## Story order

A newcomer must follow it on one watch. Write the logline (one sentence: who gets what, and how), then
the question ladder: each scene answers one question the previous scene made the viewer ask, kept
in its `question` field (scenes.md).

Outside-in order:
1. Why it matters: the pain without it, shown on a concrete case, then what it gives and when the
   viewer will use it (Sell the why first). The longest-cared-for part, not a one-scene preamble.
2. The idea in one picture.
3. Watch it work on the running example.
4. How it works: the mechanism.
5. How it is wired, or how to use it in the product.
6. Limits and status.
7. Summary, then close.

Purpose before picture, picture before mechanism, mechanism before wiring, interface before internals; no code for something
not yet said in plain words; one new term per scene, defined in plain words on first use; the running
example by scene 2-3; over 2 min, a one-line roadmap after the hook; each chapter ends on a one-line
takeaway that bridges to the next.

Two default spines, a starting order to adapt (scenes.md still decides the shape and variety):
- Engineers: the pain and why it matters to them, idea, watch it run, how it works, how to build on
  or use it, limits and status.
- Mixed audience: problem story and why it matters to them, what changes for the user (the picture),
  how it works in one picture, how to turn it on or use it, status.

## Condensing

Idea budget: about 90 s, the core message plus 2 points; 3 min, core plus 3; 5 min, core plus 3-4,
one a deep dive. Spend it on the focus answers; cut the rest or give it a line. No cramming. The
why (Sell the why first) is part of the core: give it about a sixth of the runtime, and cut detail
elsewhere before you cut it.

## Tone

`direction.tone` (unset is `balanced`). Humor adds no claim and is never at anyone's expense.
Put the speed in brief.json `voice.speed`; set `music_mood` to match.

Pace: calm enough to follow new ideas on one watch. Viewers found 1.12 slightly too fast. The speed
fit stays within 0.04 of the tone's speed below (`D plan` warns `too long for a comfortable pace`
past it): a script that only fits faster is trimmed (Condensing), or its `length_s` is raised;
never sped up.

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
- Spoken questions: ask the viewer's own question aloud at the turns where understanding needs it,
  then answer it: before the why ("so why do we need this?"), before the how-to ("OK, so how do I
  use it?"), before an edge case ("and if it fails?"), or "so who does the work?". 2-5 per video,
  in this video's words, never one per scene. As a scene's first sentence, or a `beat` with a
  one-line `say`. The duck's `ask` lines show where.
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

Viewers like topic-built 3D best: give the heart of the development (its core mechanism) one when it has a spatial,
flow or cause-and-effect shape; the summary may be a 3D chain of events (scenes.md). Explanations, code, numbers, lists
and decisions stay 2D. At most a third of the scenes. Design each for this topic (custom-scene.md, 3D recipe), never an
example with only its data changed; `iso-journey` and `iso-map` are fallbacks, once each. Vary form and camera across
3D scenes and from the last video (visuals.md). Tune zoom and lift until every label reads on the contact sheet.

## Signature scene

Every video gets at least one signature scene designed only for this demo: a visual metaphor
tied to the feature, such as a sheet reshaping from A4 to Letter or a packet traveling the architecture. At most 2 per video (3 for `auteur`).

- It is a project template built with the kit (custom-scene.md, Signature scene recipe), 8-15 s,
  with each beat cued to the narration. Start from the worked example
  `<skill dir>/assets/examples/signature-sheet.mjs` copy it
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
logline: <who gets what, and how>
why: <the pain and why the viewer cares, as the script says it> | lands by sNN
duck: <the purpose as the duck understood it> | <fixes made from its notes, or none>
spine: <thread> | <chapter, chapter, ...>
s01 title: <the narration> | on screen: <one line>   (no question on title, beat and close)
s02 split: Q "<the question this scene answers>" | <the narration> | on screen: <one line>
...
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

1. Apply it to scenes.json or brief.json. Keep the summary rule. A user change that adds, removes or
   moves a section re-plans the whole question ladder; never splice a scene in at the nearest spot.
   For a warning:
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
   - `mentions "..." (development process)`: reword the scene to the product (Scope).
   History warnings yield to the creator's notes, taste notes and `auteur` (Art freedom), and to
   the order (Script 2): never reorder scenes to look different.
2. Run `D plan .` and `D script .`.
3. Note the scenes whose `say` or pronunciation changed: after gate 1 they need `D narrate .`,
   which re-voices only those. Note the scenes whose claims or on-screen text changed: they need
   the checker again (SKILL.md, Re-check).
4. Show the user only the changed scenes, in the gate 1 format, then the new `plan:` line; after a
   reorder, the whole list.

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
