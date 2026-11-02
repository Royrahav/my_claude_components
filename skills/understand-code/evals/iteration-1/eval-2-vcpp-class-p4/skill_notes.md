# understand-code skill notes (SendByRest, labOS VC++, Perforce)

1. Two classes in one .h/.cpp (RemoteAuthenticator + SendByRest). The inventory maps each file to exactly one module, so the second class gets no files. I made "auth" a fileless `scope` node. The skill should say how to model a file that holds several classes.
2. Resolver: `Type.Method` is split on `.`, and `Class::Method` only works as a literal substring. Header-inline methods (`IsAuthValid() { ... }`) can't be referenced as `RemoteAuthenticator::IsAuthValid`. Document `::` and say to reference the class/header line instead.
3. Snippets do pick the definition over earlier call sites (`SendByRest::DebugModeLogging` is called at line 121, defined at 316, and the excerpt starts at 316). Prefix collisions resolved correctly too (`SendFile` vs `SendFileByRest`). Worth stating so nobody adds `(` to refs.
4. The simulator assumes HTTP. A `CALL` entry still renders `curl -X CALL ...` and the result card shows "HTTP <status>", so I put the endpoint's HTTP code in `result.status`. Code mode needs a non-HTTP request/result rendering.
5. The tracer brief asks for "the repeat (caches, existing state)". A per-message object (new SendByRest each send, so no token cache) has no repeat. Say "if one exists".
6. The briefs give `{HISTORY}` for p4 as annotate+describe. `p4 filelog -s -l <file>` (every CL description in one call) was faster and gave most of the "why". Suggest it first.
7. files.json/meta.json in code mode still carry `add`/`del`/`commits:[]`. That's harmless, but it contradicts "no add/del" in SKILL.md.
8. tour.md says a header earns a piece "only when it carries design", but the coverage check counts the .h as a code file, so you need a header piece to reach 2/2. Reconcile the two.
9. The build doesn't check story/scenario `say` word counts, beat counts or spoken IDs. I wrote my own checker. The builder should warn on these.
10. The prepare.py digest counted the UT file as test (good), but the skill doesn't say whether to put a unit test that lives elsewhere into scope. I did, for the Files tab.
11. The second-brain vault has no labos-vc notes for AutocommLib (miss). The skill's "vault first" step adds a lookup with no payoff here. Fine, but say "skip if the hub doesn't cover the area".
