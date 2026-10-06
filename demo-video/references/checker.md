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
   - `wrong`: contradicts FACTS.md, or is on its "Must not claim" list.
4. Summary examples (the `recap` scene, or the scene marked `"summary": true`) may illustrate,
   but must add no capability, number, customer, version or behavior beyond FACTS.md. A hypothetical phrased as an example ("For
   example, ...") that only applies facts from FACTS.md passes. Flag one that states an invented
   scenario as something that happened, or that implies a capability FACTS.md does not have.

## Report

Problems only, at most 20 lines, one per line:
`sNN: "<text>" - unsupported | overstated | wrong: <why> [source]`

If there are none, reply `no issues`. Nothing else.
