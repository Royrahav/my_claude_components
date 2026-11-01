---
name: understand-code
description: Explain existing code - a class, a library, a few libraries, a service or an area of a codebase - as an interactive, narrated code map, so a developer who now owns or must work in it really understands it - what each module and file does, how they connect, who calls in and what it calls out to, a simulator that runs real calls through the real components, and a narrated walkthrough whose line marker follows the voice through the real code, explaining what each piece does and why it is built that way, ending in a maintenance checklist. Use whenever someone says "explain this class/library/module", "how does X work" about code, "walk me through this code", "help me understand this codebase/area", "onboard me to X", "I'm taking over / inheriting X", "map this library", or names a class, folder or library they need to learn, in any language and any repo, git or Perforce (including labOS VC++ classes). For a diff, PR, branch or CL use understand-change instead; for a course for non-technical readers use codebase-to-course; for a quick one-fact lookup just answer.
---

# Understand existing code

A developer inherits a library, has to change a class they have never opened, or joins a team. They need what
the sibling skill `understand-change` gives the owner of a change, without a diff: see the parts, why each piece
is built the way it is, how it all connects, and what they must keep working. Same page, same method:

| Tab | Gives the reader |
|---|---|
| **Brief** | Optional, first tab, for stakeholders (the page still opens on Map; `#brief` opens it): an animated, presenter-driven deck of what the area does for the business, why it exists, how it works and what to watch when changing it, with speaker notes (`references/deck.md`) |
| **Map** | The modules in scope, the code around them (callers, callees) and the world outside the repo, each with its job, entry point and files |
| **Walkthrough** | The code told as the jobs it does, then the pieces that do each one. Per piece: the real code excerpt; what it does; why it is built that way; its place in the bigger picture; what the owner must keep true. Narrated, with a line marker that follows the voice. Ends in a maintenance checklist. |
| **Simulator** | 4-8 real calls traveling the map step by step, narrated, with each component's input, output and decision. Both Simulator and Walkthrough have a playback speed control (0.5x to 2x), changeable while playing and remembered per viewer |
| **Files** | Every file in scope, each linked to the walkthrough pieces that explain it |

## The engine

This skill carries its own copy of the engine it shares with `understand-change` and runs it in code mode
(`meta.mode = "code"`), so the two pages look and behave the same, yet each skill folder installs and works alone.
`S` is this skill's folder, `W` is a scratch folder (scratchpad or temp, never the repo).

Maintainers: the engine files (`scripts/` except `selftest.py`, `assets/prmap.html`, `references/story.md`,
`narration.md`, `prmap-schema.md`, `deck.md`) are a copy. Edit them in `understand-change`, then run
`tools/sync_understand_engine.py` at the skills repo root and both skills' `scripts/selftest.py`.

## Pipeline

Same steps and order as understand-change, so two runs on the same scope give the same page.

1. **Scope** (from the repo root): turn what the user named into paths. A class is its files (`.h` + `.cpp`,
   or the one file that defines it); a library or area is its folder(s). Look the names up in the
   `second-brain` vault first when it covers the repo (its notes are good `{DOCS}`), then grep. Run
   `python S/scripts/prepare.py W --code <path> [<path> ...] --kind Class|Library|"Code area" --title "<name>"`.
   It writes `files.json` and `meta.json` and prints the digest (size, areas, languages, largest files, tests).
   It refuses a scope above LARGE: ask the user which part matters instead of forcing it, because a huge
   map is unreadable and its narration runs for hours.
2. **Decide the frame** yourself, from the digest, the docs and a quick read of the entry points: the node ids
   for the map (the modules in scope, the in-repo code around them that calls in or is called, and everything
   outside the repo a call touches) and 4-8 topics, each a job the code does, named the way its user would,
   ordered the way a new owner should learn them (`references/tour.md`). Write `layout.json` (nodes with
   positions, `problem_order`, a one-sentence `summary`); schema in `references/prmap-schema.md`, with the
   code-mode differences below.
3. **Inventory + tracer** in parallel, with briefs 1 and 2 from `references/briefs.md`: `inventory.json` and
   `scenarios.json`.
4. **Story writers** with brief 3: `story_<part>.json` per writer, and the **deck writer** with brief 4 (`deck.json`). Writers print each excerpt with
   `S/scripts/show_snippet.py`, so beats anchor to lines the reader will actually see.
5. **Build to verify**: `python S/scripts/build_prmap.py --dir W W/out.html --repo <root>`. It checks every ref
   and beat anchor and reports how many in-scope code files and modules the walkthrough explains. Fix every
   error and warning, and every finding in `W/lint.txt` (code no beat explains, long excerpts needing `span`,
   simulator jumps; `beats: N items leave code unexplained` must reach 0; with a deck, `deck: ... L lint` must reach 0 too) (send a correction to the agent that wrote the file if it is more than a few lines). Never
   pass `--allow-unresolved`.
6. **Voice it** (free, local, CPU; in the background): `python S/scripts/narrate.py --dir W`. It lints the
   script, then Kokoro records each line at about real time (clips are cached, so a rerun records only changed
   lines). Setup once: `pip install --user kokoro-onnx`, the two model files named in the script header in
   `~/.cache/kokoro`, and ffmpeg on PATH. Keep the voice `af_heart`: users chose it over the alternatives.
7. **Build and publish**: rerun step 5, then publish `W/out.html` with the Artifact tool, `root` = `W` and
   `files` = the audio paths it prints. Without the tool, rebuild with `--standalone` and give the path. In chat:
   open the Walkthrough first, and one line on what's there; with a deck, say that `#brief` on the page link opens the Brief to present.

## Code-mode inputs (differences from `references/prmap-schema.md`)

- `files.json` (from prepare): `{path, status: "scope", lines}` for every text file in scope; no add/del.
- Module `status`: `scope` (explained here), `context` (in-repo code around it: callers and callees, no files
  listed), or `external` (outside the repo, declared in `layout.json`). Files have no `change` field.
- `meta.json`: `mode: "code"`, `kind`, `version` (git sha or synced CL), no `diff_base`, no commits.

## What keeps it good (and why)

- **Grounded, not remembered.** Every claim points at `path → Symbol` and is grepped; every excerpt is cut from
  the real file. A reason ("why it's built this way") comes from a comment, test, doc, commit message or
  history (`git log -L`, `p4 annotate`); otherwise the text says "probably".
- **Every piece gets a reason.** The coverage line should reach (nearly) all in-scope code files and every
  module; the rest is plumbing you consciously skipped.
- **Explain, don't read.** The narrator is a senior developer walking a new teammate through code they know
  well (`references/narration.md`): plain words, the why, connected steps, never IDs, paths or code aloud.
- **Lean context.** Don't read the agents' JSON or the page into your own context; the scripts' summaries are
  enough. Don't paste code into JSON; the builder extracts it.

## References

- `references/briefs.md`: the four subagent briefs and the sizing table. Read before step 3.
- `references/tour.md`: how to pick topics and pieces and write what/why/picture/maintain for existing code.
- `references/prmap-schema.md`: every input file, with examples. Read before step 2.
- `references/deck.md`: the Brief deck's schema and how to write for stakeholders. Read before launching the deck writer.
- `references/narration.md`: the spoken style, and beats.
- `references/story.md`: the walkthrough JSON schema that `tour.md` builds on.
