---
name: understand-change
description: Turn any code change (a GitHub PR, a git branch or range, a Perforce CL or shelf, a ticket, or "what we just built") into an interactive, narrated change map so the developer who now owns it can really understand it - what was added and changed, why every change exists and which problem it solves, what each module and file does, how it all connects, a simulator that runs mock requests through the real components, and a narrated walkthrough whose line marker follows the voice through the real diff. Use whenever someone says "explain this change", "help me understand this PR/CL", "I need to 100% understand this diff", "what did the agent change", "I'll be maintaining this change", "onboard me to this PR", "walk me through this diff", pastes a PR, diff or CL link, or right after an AI agent finished a large development that a person will own, even if they never ask for a page. Works in any language and any repo, git or Perforce. For existing code with no change to explain (a class, a library, an area) use understand-code instead.
---

# Understand a change

AI agents now write changes of thousands of lines. The developer who owns them afterwards needs to
reconnect with the code: see what changed, why each piece exists, how it fits together, and what they must
keep working. This skill builds one page for that, with no course, quiz or wall of text:

| Tab | Gives the reader |
|---|---|
| **Brief** | Optional, first tab, for stakeholders (the page still opens on Map; `#brief` opens it): an animated, presenter-driven deck of the business value, the purpose, how it works at a high level and the risk and release plan, with speaker notes (`references/deck.md`) |
| **Map** | Modules (new / changed / outside the repo), how they connect, each one's job, entry point and files |
| **Walkthrough** | The change told as problems, then the code that solves each one. Per change: the real diff excerpt; why it exists; what it does; its place in the bigger picture; what the owner now maintains; links to where it runs. Narrated, with a line marker that follows the voice. Ends in a maintenance checklist. |
| **Simulator** | 5-8 mock requests traveling the map step by step, narrated, with each component's input, output and decision. Both Simulator and Walkthrough have a playback speed control (0.5x to 2x), changeable while playing and remembered per viewer |
| **Files / Commits** | Every changed file and commit, each linked to the walkthrough items that explain it |

## Pipeline

The steps and their order are fixed so two runs on the same change give the same page. Scripts do every
mechanical step and print a few summary lines; the judgment work (what each change is for) goes to subagents
with fixed briefs. `S` is this skill's folder; `W` is a scratch folder (scratchpad or temp, never the repo).

1. **Prepare** (from the repo root): `python S/scripts/prepare.py W --pr <url>` (or `--git A..B`, or
   `--p4 <CL> [--shelved]`). Writes `files.json` and `meta.json` with the exact diff range. Run
   `python S/scripts/collect_change.py --git <diff_base>..<sha>` for the digest (size, areas, hot files, tests,
   commits). The digest's size (SMALL / MEDIUM / LARGE) picks the staffing in `references/briefs.md`.
2. **Decide the frame** yourself, from the digest, the commit messages and the docs: the node ids for the map
   (code modules plus everything outside the repo that a request touches) and 5-9 problems the change solves,
   named the way a user or operator would, ordered core → extensions → hardening → tooling. Write `layout.json`
   (outside nodes, `problem_order`, a one-sentence `summary`); see `references/prmap-schema.md`.
3. **Inventory + tracer** in parallel, with briefs 1 and 2 from `references/briefs.md`: `inventory.json` (every
   file's job and change, modules, real import edges) and `scenarios.json` (the simulator plus its narration).
4. **Story writers** with brief 3: `story_<part>.json` per writer, and the **deck writer** with brief 4 (`deck.json`). Brand: a change in a labOS codebase (Perforce tree under `C:\P4SPACE`, or a labOS repo) gets `"brand": {"name": "labOS", "logo": "labos"}` with no question; for any other codebase ask the user once (AskUserQuestion, batched with other questions) for the company or product name and a logo file, or none. Writers print each item's excerpt with
   `S/scripts/show_snippet.py`, so beats anchor to lines the reader will actually see.
5. **Build to verify**: `python S/scripts/build_prmap.py --dir W W/out.html --repo <root>`. It merges the story
   parts, extracts every excerpt from the real diff, checks every ref and beat anchor, places unplaced nodes,
   and reports how many changed code files the walkthrough explains. Fix every error and warning it prints, and
   every finding in `W/lint.txt` (code no beat explains, long excerpts needing `span`, simulator jumps; the
   summary line `beats: N items leave code unexplained` must reach 0; with a deck, `deck: ... L lint` must reach 0 too) (send a correction to the agent that wrote the file if it is more than a few lines). Never pass
   `--allow-unresolved` to ship a guess.
6. **Voice it** (free, local, CPU; run in the background): `python S/scripts/narrate.py --dir W`. It lints the
   script, then Kokoro records the lines in parallel processes (`--jobs`, default up to 4, about 500 MB each; one
   process keeps only one or two cores busy). A 500-line map takes about 25 minutes on a 12-core machine; clips are
   cached, so a rerun records only changed lines. Run nothing else heavy alongside it. `--manifest-only` indexes what is recorded so far, for a preview.
   Setup once: `pip install --user kokoro-onnx`, the two model files named in the script header in
   `~/.cache/kokoro`, and ffmpeg on PATH. Keep the voice `af_heart`: users chose it over the alternatives.
7. **Build and publish**: rerun step 5 (it bundles all clips into one or two MP3s under `W/audio/` and prints
   their paths). With the Artifact tool, publish `W/out.html` with `root` = `W` and `files` = those paths;
   when only the page changed, republish the page alone. Without it, rebuild with `--standalone` (one file,
   audio embedded) and give the path. In chat: what to open first (Walkthrough), and one line on what's there; with a deck, say that `#brief` on the page link opens the Brief to present.

## What keeps it good (and why)

- **Grounded, not remembered.** Every claim points at `path → Symbol` and is grepped; every excerpt is cut from
  the real diff; session memory holds plans that did not ship. If a reason is not written in a commit,
  comment, test or doc, the text says "probably".
- **Every change gets a reason.** The walkthrough exists so nothing the agent wrote stays unexplained: the
  coverage line in the build output should reach (nearly) all changed code files, and the rest should be
  plumbing you consciously skipped.
- **Explain, don't read.** The narrator is a senior developer walking a teammate through it: plain technical
  words, the why, connected steps, never reading IDs, hashes, paths or code aloud (`references/narration.md`).
- **Teach the mechanism, not the lines.** A tiny diff in a config or comment can point at a whole mechanism;
  map that mechanism and say in the summary how the small change connects to it.
- **Lean context.** Don't read the agents' JSON or the page into your own context; the scripts' summaries are
  enough. Don't paste code into JSON; the builder extracts it.

## The engine (maintainers)

The scripts (except `selftest.py`), `assets/prmap.html`, `assets/brands/` and `references/{story,narration,prmap-schema,deck}.md` are
the engine; they also handle code mode (`prepare.py --code`, `meta.mode = "code"`). The sibling skill
`understand-code` carries an identical copy, so each skill folder installs alone. This folder is the source: edit
the engine here, then run `tools/sync_understand_engine.py` at the skills repo root and both skills'
`scripts/selftest.py`.

## References

- `references/briefs.md`: the four subagent briefs and the sizing table. Read before step 3.
- `references/deck.md`: the Brief deck's schema and how to write for stakeholders. Read before launching the deck writer.
- `references/prmap-schema.md`: every input file, with examples. Read before step 2.
- `references/story.md`: how to pick problems and items and write why/what/picture/maintain.
- `references/narration.md`: the spoken style, and beats (narration anchored to code lines).
