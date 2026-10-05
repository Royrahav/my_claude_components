---
name: demo-video
description: Make a finished, narrated demo video (MP4) that explains a feature, bug fix, release or architecture to developers, PMs and customer-facing teams. It researches the sources (repo, tickets, PRs/CLs, docs), asks a few questions with recommended defaults, writes the script, voices it with ElevenLabs, animates on-brand scenes with HyperFrames (company theme by default, any theme on request), burns in captions, adds music and sound effects, then renders and loudness-normalizes. Use this skill whenever the user asks for a demo video, product or feature video, explainer, walkthrough, release or sprint demo, "a video about this ticket/PR/CL", or a narrated presentation of a development, even if they don't mention HyperFrames or ElevenLabs. Also use it to change, re-voice, re-theme or re-render a video made with it, or to set the skill up on a new machine.
---

# Demo video

Turns a development into a narrated 1920x1080 MP4: animated on-brand scenes, ElevenLabs voice,
burned-in captions, ducked music, light SFX, -14 LUFS, and a closing recap of the key takeaways
with real-life examples. You run the flow yourself: the interview, the script, production, the
layout review, the two gates and delivery. Two cheap helper agents research and fact-check.

`D` below means `node "<this skill's base directory>/scripts/demo.mjs"`. Commands take the
project dir as their first argument (`.` when you are in it).

## Model

Run the session on Opus for best results. A measured 75 s video cost about $3.3 at list prices
and took 26 min in one Opus session, against $7.25 and 48 min for a multi-agent split, because
subagents re-pay cache writes. Don't delegate the writing or production.

## Roles and guides

| Who | Model / effort | Job |
|---|---|---|
| you (the main session) | Opus recommended | interview, script, production, layout review, final look, gates, delivery |
| `demo-researcher` | sonnet / high | in the background during the interview: reads the sources (read-only), writes FACTS.md |
| `demo-checker` | sonnet / high | fact-checks scenes.json against FACTS.md: after the first draft, then the changed scenes after any revision that changes a claim or on-screen text |

Read each guide lazily, once, at its step:

| Step | Guide |
|---|---|
| 3. Script | `references/writer.md` and `references/scenes.md` |
| 4.1 Production | `references/producer.md` |
| 4.2 Layout review | `references/qa.md` |
| 4.3 Final look | the "Final look" section of `references/writer.md` |
| anything not covered | `references/troubleshooting.md` |

At the final look, re-read only writer.md's Final look section, and only if it has left your
context since step 3.

## Keep it cheap

- Never open generated files (`compositions/`, `index.html`, `.demo/`, `assets/voice/raw/`), the
  skill's template and script source, or frame-by-frame images: read one contact sheet per check.
  The only exceptions are the ones custom-scene.md names when you build a custom scene.
- The CLI prints compact summaries. Read them; don't open files to see what a command did.

## Helpers and questions

- Spawn the helpers by type, with no `model` or `effort` override: the agent file sets both. Start
  every prompt with "Skill dir: <this skill's base directory>. Project dir: <dir>." Spawn a fresh
  checker for every check: it is cheap and stays independent.
- If a `demo-*` type is unavailable, run `D setup` (it installs the agents) and retry. If it is
  still unavailable, spawn `general-purpose` on sonnet with the prompt "Read <skill
  dir>/references/<brief>.md and follow it" (brief: research or checker), plus the usual inputs.
- Ask in one AskUserQuestion batch with a recommended option first, and skip anything the context
  answers. Without AskUserQuestion, take the recommended option for each question and list the
  choices in your final reply.
- Keep messages to the user short: one status line per step, then the script and the result.

## Workflow

### 1. Setup (first use on a machine)

If `~/.config/demo-video/config.json` is missing, run `D setup`. Add `--projects-dir <path>` if
the user keeps projects somewhere other than `~/demo-videos`. It checks Node 22+, ffmpeg, the
HyperFrames render browser and the ElevenLabs key, prints the fix for anything missing, and
installs the two helper agents into `~/.claude/agents/`, overwriting older copies. It also deletes
the three role agents earlier versions shipped, and never touches any other file there, including
a user's own `demo-*.md`. The agents load within seconds; restart Claude Code only if the output
says the folder was just created.

- ffmpeg missing: offer to run the install command it prints.
- Key missing: ask the user for an ElevenLabs API key. Text to Speech access is required and
  Music access is optional. Write `ELEVENLABS_API_KEY=<key>` to `~/.config/demo-video/.env`.
  Never print, log or commit the key.

### 2. Start: project, research and interview in parallel

1. `D init <projects_dir>/<slug> --product "<Feature name>"`. The theme defaults to the company
   theme (`labos`) and can be changed at any point.
2. Spawn `demo-researcher` in the background. Prompt: "Skill dir: <dir>. Project dir: <dir>.
   Sources: <everything the user gave: ticket keys, PR/CL numbers, repo paths, docs, URLs,
   notes>. Audience: <audience>. Target length: <length>. Constraints: <the user's rules, for
   example read-only repos, no dashes, never print secrets>." It replies with one line: the
   FACTS.md path and the counts of facts and open questions. If it says sources were
   unreachable, ask the user.
3. While it runs, ask one AskUserQuestion batch:
   - Length: "~3 min overview (Recommended)", "~90 s teaser", "~5 min deep dive".
   - Audience: "Mixed: devs, PMs, customer-facing (Recommended)", "Engineers", "Customers / execs".
   - Look: "Company theme (Recommended)", "Neutral light", "Midnight dark". Other: a website URL,
     or brand colors, a Google font and a logo.
   - Extras (multiSelect): "Burned-in captions", "Background music", "Light sound effects".
     Recommend all three.

   If the request already gives a length or an audience, use it as given, even when it is not one
   of the options ("~75 s", "developers and support engineers"), and skip that question.
4. Apply the answers: set `length_s`, `audience`, `captions`, `music` and `sfx` in brief.json.
   Switch themes with `D theme . --use neutral|midnight`; for a custom brand, see Themes.

### 3. Script, then gate 1

When the researcher is done, read `references/writer.md` and `references/scenes.md` and write the
script as writer.md says: scenes.json, pronunciations, plan and SCRIPT.md.

Fact-check, for every video: spawn `demo-checker` with "Scenes: all." It replies `no issues` or up
to 20 lines of problems. Fix them (one round).

Show the user the script (writer.md, Gate 1 summary), then ask in one AskUserQuestion (at most 4
questions):

- Each open question, 2-3 options, the recommended one first.
- Script: "Approve (Recommended)", "Change something".
- Voice: "Matilda, professional female (Recommended)", "River, relaxed and neutral",
  "Brian, deep male", "Play samples first". For samples, `D samples .` writes four short mp3s the
  user can play; then ask again. `D voices` lists the other stock voices.

If the answers change the story, revise (writer.md, Revision) and show only the changed scenes.

**Re-check.** After any later revision that changes a claim or on-screen text (a user change, a
fix or template switch at the final look), spawn `demo-checker` again with "Scenes: <the changed
ids>", and fix what it finds. Label edits from the layout review keep their meaning; the final
look checks them instead.

### 4. Produce

1. Production: read `references/producer.md` and run its pipeline (narrate, sfx, build, music,
   check). It never renders. Apply its fixes in its order: script fixes before the speed fit, and
   the speed fit at most once.
2. Layout review: read `references/qa.md` and review the contact sheet (at most 2 rounds).
3. Final look: read the "Final look" section of `references/writer.md`. After any template or
   layout change there, run `D check .` again and look at the new contact sheet once.
4. If issues remain, give the user the contact sheet path and ask: "Render as is (Recommended)" or
   "Change something".

### 5. Render, then gate 2

Only now, after the layout review and the final look, run `D render .` in the background and wait
(about 2 to 3 times the video length; add `--quality high` for an extra-crisp master). It prints
the MP4 path, duration, loudness and true peak. Give the user the MP4 path and ask: "Looks good
(Recommended)" or "Change something".

Deliver the MP4 path, SCRIPT.md and FACTS.md.

## Changes

Rebuild after any voice change: timing follows the voice. Do each change yourself, with the guide
that owns it:

| User asks for | Do it yourself, with | Then |
|---|---|---|
| faster or slower voice, another voice, different music, music louder or quieter, no captions, music or SFX, another transition, another built-in theme | producer.md, Change requests | build, check, render (`render --mix-only` for audio-only changes) |
| narration wording, a story change, scenes added, removed or reordered, a claim, a pronunciation fix, a layout no template offers | writer.md, Revision | Re-check if a claim or on-screen text changed; narrate what changed, build, check, render |
| on-screen text or layout, a visual that lands too early or late | qa.md, Allowed fixes | Re-check if a claim's wording changed; build, check, render |
| custom colors, fonts or logo | Themes below: edit theme/theme.json and run `D theme .` | build, check, render |

To resume a project in a new session, `D status <dir>` prints what exists and the next step.

## Project files

- `brief.json`: name (output file name), product, eyebrow (the small label on every scene),
  audience, length_s, voice {id, name, speed}, captions, music, sfx, music_gain_db,
  quality (draft, standard or high), music_prompt.
- `scenes.json`: the script and the scenes. The format is in references/scenes.md.
- `FACTS.md`: the claim whitelist. `pronunciations.json`: display/spoken pairs.
- `theme/`: theme.json, the logo, fonts. Output goes to `renders/<name>.mp4`.

## Themes

Built in: `labos` (company default: light, teal, Comfortaa + Montserrat), `neutral` (light, blue),
`midnight` (dark). For a custom brand, `D theme-from-site <url>` prints a guess at colors and
fonts. Write `theme/theme.json`: name, mode (light or dark), colors {canvas, surface, ink, muted,
light, accent, accent2, danger; each hex `#RGB` or `#RRGGBB`}, fonts {display, body, mono} (Google Fonts families), logo (a file
in theme/, SVG preferred; omit it for a text-only lockup), music_prompt. Copy the logo into
`theme/` and run `D theme .`. Text colors are darkened automatically to pass WCAG AA, so brand
colors can be used as given.

## Quality bar

- Every narrated or on-screen claim is in FACTS.md. Numbers keep their caveat. Status words are
  exact: optional vs required, shipped vs planned, measured on what.
- One idea per scene, and visuals land on the spoken word.
- The second-to-last scene is a recap of 2-4 takeaways, each with a title and a real-life example
  that adds no capability beyond FACTS.md; then close. Build warns when a video does not end that
  way, or when the recap is incomplete.
- Done means zero cue warnings, no house-style warning, lint with 0 errors, check passed, the
  checker clean on the final text, the contact sheet reviewed (layout review, then the final
  look), and loudness near -14 LUFS.

When something is not covered above, read `references/troubleshooting.md`.
