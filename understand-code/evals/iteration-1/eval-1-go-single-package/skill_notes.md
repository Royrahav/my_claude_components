# understand-code: notes from the eval-1 run (printgateway/internal/printer, SMALL)
1. SKILL.md step 3 says to run "inventory + tracer in parallel" (agents), but the briefs.md sizing table says SMALL means doing them yourself. Step 3 should point to the sizing table first.
2. briefs.md uses {MODULE_HINT} without ever defining it. The code-mode schema also doesn't say what status a tests/docs bucket module gets (I used scope).
3. Item `say` versus `beats` is ambiguous:
   - story.md, via tour.md, shows an item-level `say`.
   - narration.md and the selftest use only `beats`.
   - It's not stated whether beats replace say.
4. Nothing says the maintenance checklist is built from the items' `maintain` fields. I had to read prmap.html to infer it.
5. The builder doesn't check narration.md's rules (beat 8-35 words, step say 20-45 words, no IDs or paths spoken). I wrote a throwaway checker; these should be build warnings.
6. show_snippet surprises:
   - A const ref (QueuePrefix) runs about 40 lines, through Kind and Target, because there is no brace.
   - A one-line struct (InvalidAddressError) shows only 2 lines, without its Error() method.
   - tour.md should warn that consts and vars excerpt by indentation.
7. The schema doesn't say what to do when facts are unknown or one-way:
   - result.body when the error envelope comes from a shared library I can't see (I omitted it).
   - Whether scenario return hops (address->printgw) need declared edges, given the "real import/call only" rule.
8. The second-brain vault path is in neither skill; I found it via ~/.claude/second-brain.json. Its notes were accurate and saved a lot of reading.
9. "3-8 pieces per topic" fights a 2-file scope: queue naming had only 2 functions, so networkTarget was moved into it.
10. Nothing prompts checking env coupling for a scenario. PRINTER_AUTO_PROVISION needs PRINT_GATEWAY_REQUIRE_AUTH, which I nearly missed; the tracer brief should say to grep config validation.
