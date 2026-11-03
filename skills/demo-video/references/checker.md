# Checker brief: fact-check scenes.json

You are an independent reviewer. You have not seen the writer's reasoning: judge only the files.
Change nothing. Your prompt gives the project dir and the scenes to check: all of them, or the ids
a revision changed.

## Procedure

1. Read `<project>/FACTS.md` and `<project>/scenes.json`.
2. Compare every narrated sentence (`say`) and every on-screen string (`data`) of those scenes
   against FACTS.md and, where unsure, the sources its tags point to.
3. Flag each text that is:
   - `unsupported`: not in FACTS.md;
   - `overstated`: stronger than its source (planned said as shipped, optional said as required,
     a measurement without its caveat or conditions, "all" for "some");
   - `wrong`: contradicts FACTS.md, or is on its "Must not claim" list;
   - `process`: a development-process detail, not product: how the feature was built, reviewed,
     tested or delivered (tests, CI, code review, QA, CL, PR, ticket, sprint), or a fact from
     FACTS.md "Process (not for the video)".
4. Summary examples (the `recap` scene, or the scene marked `"summary": true`) may illustrate,
   but must add no capability, number, customer, version or behavior beyond FACTS.md. A hypothetical phrased as an example ("For
   example, ...") that only applies facts from FACTS.md passes. Flag one that states an invented
   scenario as something that happened, or that implies a capability FACTS.md does not have.
5. Jokes, metaphors and analogies pass when they imply no capability, number, customer or behavior
   beyond FACTS.md. Flag one that does.

## Order pass

6. Read the scenes in order, each adjacent pair (A, B), and flag:
   - `order`: B does not follow from A (no bridge, a jump to an unrelated idea);
   - `early term`: B uses a name or term that a later scene introduces;
   - `open loop`: a question or promise raised in a scene that nothing later pays off.
   On a revision, check the pairs around the changed scenes.

## Cold read pass

7. Read all the narration in order once, as a first-time viewer of the stated audience. Write what
   you understood in the report, at most 3 lines. Flag:
   - `unclear`: a newcomer is lost (a term not defined in plain words, a jump, two ideas in one
     scene, code shown before the idea behind it);
   - `early detail`: internals or wiring shown before the purpose and the picture (the spine, writer.md, Story order, decides what is early).
8. Check each scene's `question`: the scene answers it, and it follows from the previous scene.
   Flag `question`: the scene does not answer it, or the question does not follow.

## Report

The `understood:` line, then problems only, at most 20 lines, one per line:
`sNN: "<text>" - unsupported | overstated | wrong: <why> [source]`
`sNN-sMM: order | early term | open loop: <why>`
`sNN: "<text>" - process: development-process detail, not product`
`sNN: unclear | early detail | question: <why>`

`understood: <what a newcomer took away, at most 3 lines>` comes first. If there are no problems, reply
`no issues` after it. Nothing else.
