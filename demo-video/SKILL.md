---
name: demo-video
description: Make a finished, narrated demo video (MP4) that explains a feature, bug fix, release or architecture to developers, PMs and customer-facing teams. It researches the sources (repo, tickets, PRs/CLs, docs), asks a few questions with recommended defaults, writes the script, voices it with ElevenLabs, animates on-brand scenes with HyperFrames (company theme by default, any theme on request), burns in captions, adds music and sound effects, then renders and loudness-normalizes. Use this skill whenever the user asks for a demo video, product or feature video, explainer, walkthrough, release or sprint demo, "a video about this ticket/PR/CL", or a narrated presentation of a development, even if they don't mention HyperFrames or ElevenLabs. Also use it to change, re-voice, re-theme or re-render a video made with it, or to set the skill up on a new machine. Works in Claude Code and Cursor.
---

# Demo video

Turns a development into a narrated 1920x1080 MP4: animated on-brand scenes, ElevenLabs voice,
burned-in captions, ducked music, light SFX, -14 LUFS, and a closing summary of the key takeaways
with real-life examples. Each video's structure, look and signature scene are designed from its
content. You run the flow yourself (interview, script, production, layout review, two gates,
delivery); two cheap helper agents research and fact-check.

`D` below means `node "<skill dir>/scripts/demo.mjs"`; the skill dir is this skill's base directory.
Commands take the project dir first (`.` in it).

Host: Claude Code runs as written. In Cursor, or any host without the Agent and AskUserQuestion
tools, read `references/hosts.md` once first.

## Model

Run the session on Opus: a 75 s video cost about $3.3 in one session, against $7.25 for a
multi-agent split (subagents re-pay cache writes). Don't delegate the writing or production.

## Roles and guides

| Who | Model / effort | Job |
|---|---|---|
| you (the main session) | Opus recommended | interview, script, production, reviews, gates, delivery |
| `demo-researcher` | sonnet / high | in the background: reads sources (read-only), writes FACTS.md |
| `demo-checker` | sonnet / high | fact-checks scenes.json against FACTS.md |

Read each guide lazily, once, at its step:

| Step | Guide |
|---|---|
| 3. Script | `references/writer.md` and `references/scenes.md` |
| 3. Signature scene, after gate 1 | `references/custom-scene.md` |
| 4.1 Production | `references/producer.md` |
| 4.2 Layout review | `references/qa.md` |
| 4.3 Final look | the "Final look" section of `references/writer.md` (only if it left your context) |
| anything not covered | `references/troubleshooting.md` |

## Keep it cheap

- Never open generated files (`compositions/`, `index.html`, `.demo/`, `assets/voice/raw/`), the
  skill's template and script source, or frame-by-frame images: read one contact sheet per check.
  Exception: what custom-scene.md names.
- The CLI prints compact summaries: read them, don't open files.

## Helpers and questions

- Spawn the helpers by type, with no `model` or `effort` override: the agent file sets both. Start
  every prompt with "Skill dir: <skill dir>. Project dir: <dir>." Spawn a fresh checker for every
  check: it is cheap and stays independent.
- If a `demo-*` type is unavailable, run `D setup` and retry, else spawn `general-purpose` on
  sonnet with "Read <skill dir>/references/<brief>.md and follow it" (research or checker), plus
  the usual inputs.
- Ask with the host's question tool (AskUserQuestion): at most 4 questions per batch, the
  recommended option first, skipping what the context answers. Without one, ask in chat as a
  numbered list and WAIT; take defaults only if the user said not to ask.
- Keep messages short: a status line per step, then the script and the result.

## Workflow

### 1. Setup (first use on a machine)

If `~/.config/demo-video/config.json` is missing, run `D setup`. Add `--projects-dir <path>` if
the user keeps projects somewhere other than `~/demo-videos`. It checks Node 22+, ffmpeg, the
HyperFrames render browser and the ElevenLabs key, prints the fix for anything missing, and
installs the two helper agents into `~/.claude/agents/` (and `~/.cursor/agents/` when `~/.cursor`
exists), overwriting older copies. It deletes the three role agents earlier versions shipped and
never touches other files there, including a user's own `demo-*.md`. Restart Claude Code only if
the output says the folder was just created.

- ffmpeg missing: offer to run the install command it prints.
- Key missing: ask the user for an ElevenLabs API key. Text to Speech access is required and
  Music access is optional. Write `ELEVENLABS_API_KEY=<key>` to `~/.config/demo-video/.env`.
  Never print, log or commit the key.

### 2. Start: project, research and interview in parallel

1. `D init <projects_dir>/<slug> --product "<Feature name>"`. The theme defaults to the company
   theme (`labos`) and can be changed at any point.
2. Spawn `demo-researcher` in the background. Prompt: "Skill dir: <dir>. Project dir: <dir>.
   Sources: <everything the user gave: ticket keys, PR/CL numbers, repo paths, docs, URLs,
   notes>. Audience: <request, else mixed (assumed)>. Target length: <request, else ~3 min
   (assumed)>. Constraints: <the user's rules, for example read-only repos, no dashes,
   never print secrets>." It replies with one line: the FACTS.md path and the counts. If sources were unreachable, ask the user.
3. While it runs, ask one AskUserQuestion batch:
   - Length: "~3 min overview (Recommended)", "~90 s teaser", "~5 min deep dive".
   - Audience: "Mixed: devs, PMs, customer-facing (Recommended)", "Engineers", "Customers / execs".
   - Tone: "Balanced: clear, with a light touch (Recommended)", "Light and friendly", "Playful and
     funny", "Serious and important". For an incident, security fix, outage or compliance change,
     recommend "Serious" and offer "Critical: urgent, must act" in place of "Playful".
   - Look: "Company theme (Recommended)", "Neutral light", "Midnight dark". Other: a website URL,
     brand colors, a Google font and a logo, or the creator's own art direction in words ("retro
     terminal"), recorded verbatim in `direction.notes`.

   Captions, music and SFX default on: say so in the status line.

   If the request already gives a length or an audience, use it as given ("~75 s", "developers and
   support engineers") and skip that question.
4. Apply the answers: `length_s`, `audience`, `direction.tone` (and `notes`), and `captions`,
   `music`, `sfx` on unless the request says otherwise, in brief.json. Switch themes with
   `D theme . --use neutral|midnight`; for a custom brand, see Themes.

### 3. Script, then gate 1

When the researcher is done, read `references/writer.md` and `references/scenes.md`.

Focus interview, one batch of at most 4, options taken from FACTS.md, skipping what the request
already answers:
- Core message: "What must viewers walk away with?", 2-3 angles from `Angles`, recommended first
  (re-rank if batch 1 changed the audience).
- Cut (multiSelect), only when `Scope`'s "<N> distinct ideas found" exceeds what the final length
  from batch 1 fits: "What can be cut or only mentioned?" (`Scope`).
- Next step: "What should viewers do after watching?", 3 options fitted to the content (know it
  exists, turn it on, tell customers, give feedback). It feeds the summary and the close.
- The one open question that changes the story, if any; a second goes to gate 1.

Then write the script as writer.md says (structure, direction, scenes.json, pronunciations, plan, SCRIPT.md).

Fact-check, for every video: spawn `demo-checker` with "Scenes: all." It replies `no issues` or up
to 20 lines of problems. Fix them (one round).

Show the user the script (writer.md, Gate 1 summary), then ask (at most 4 questions):

- The open question still pending, if any: 2-3 options, the recommended one first.
- Script: "Approve (Recommended)", "Change something".
- Style: "<the proposed preset and motif> (Recommended)", "Calmer" (calm-technical), "Livelier"
  (energetic-launch), "Artist's cut: Claude takes more creative license" (sets
  `direction.freedom: auteur`). Calmer and Livelier keep the motif; when the proposal is one of
  them, offer minimal-documentary in its place. Story-driven and `guided` go through "Other".
  Write the answer to brief.json `direction`.
- Voice: "Matilda, professional female (Recommended)", "River, relaxed and neutral",
  "Brian, deep male", "Play samples first". For samples, `D samples .` writes four short mp3s the
  user can play; then ask again. `D voices` lists the other stock voices.

If the answers change the story, revise (writer.md, Revision) and show the changed scenes only.

Once the script is approved, write each signature scene's project template (writer.md, Signature
scene; custom-scene.md, Signature scene recipe). Production builds and checks it with the rest.

**Taste.** On a lasting preference ("never underline", "always more humor"), append one line to
`~/.config/demo-video/taste.md` (at most 20: when full, or when it contradicts a line, replace the
oldest or the contradicted line) and say so in one line.

**Re-check.** After any later revision that changes a claim or on-screen text (a user change, a
fix or template switch at the final look), spawn `demo-checker` again with "Scenes: <the changed
ids>", and fix what it finds. Label edits from the layout review keep their meaning; the final
look checks them instead.

### 4. Produce

1. Production: read `references/producer.md` and run its pipeline (narrate, sfx, build, music,
   check; it never renders). Apply its fixes in its order: script fixes before the speed fit, which
   runs at most once.
2. Layout review: read `references/qa.md` and review the contact sheet (at most 2 rounds).
3. Final look: read the "Final look" section of `references/writer.md`. After any template or
   layout change there, run `D check .` again and look at the new contact sheet once.
4. If issues remain, give the user the contact sheet path and ask: "Render as is (Recommended)" or
   "Change something".

### 5. Render, then gate 2

Run `D render .` in the background and wait (about 2 to 3 times the video length;
`--quality high` for an extra-crisp master). It prints the MP4 path, duration, loudness and true
peak. Give the MP4 path and ask: "Looks good (Recommended)" or "Change something".

Deliver the MP4 path, SCRIPT.md and FACTS.md.

## Changes

Rebuild after any voice change: timing follows the voice. When editing an existing video, the
house-style warnings are advisory: don't restructure unless asked. Do each change yourself, with its guide:

| User asks for | Do it yourself, with | Then |
|---|---|---|
| faster or slower voice, another voice, different music, music louder or quieter, no captions, music or SFX, another transition, another built-in theme | producer.md, Change requests | build, check, render (`render --mix-only` for audio-only changes) |
| another style: calmer or livelier, other captions, background or chrome, slower or faster pacing | brief.json `direction` (scenes.md, Creative direction) | build, check, render; after a pacing change, `D music .` before the render (the length changed) |
| narration wording, a story change, scenes added, removed or reordered, a claim, a pronunciation fix, a layout no template offers | writer.md, Revision | Re-check if a claim or on-screen text changed; narrate what changed, build, check, render |
| on-screen text or layout, a visual that lands too early or late | qa.md, Allowed fixes | Re-check if a claim's wording changed; build, check, render |
| another tone | `direction.tone`, `voice.speed`, `music_prompt` (writer.md, Tone); `say` only if asked. Re-voices ALL scenes (credit cost; ask first) | narrate, build, `D music .`, check, render |
| art notes, or more or less freedom | `direction` `notes` / `freedom`; writer.md, Revision | Re-check if a claim or on-screen text changed; narrate what changed, build, check, render |
| `check` FAILED on the ending rule (no summary before the close, or no close last) | new video: fix it (writer.md, Summary rule). Existing: ask first; if declined, render as is and say check fails only on that rule | narrate, build, check, render |
| custom colors, fonts or logo | Themes below: edit theme/theme.json and run `D theme .` | build, check, render |

To resume a project in a new session, `D status <dir>` prints what exists and the next step.

## Project files

- `brief.json`: name (output file name), product, eyebrow,
  audience, length_s, voice {id, name, speed}, captions, music, sfx, music_gain_db,
  quality (draft, standard or high), music_prompt, direction (preset and
  knobs, tone, freedom, notes; scenes.md). In `~/.config/demo-video/`: taste.md and history.jsonl (written by render).
- `scenes.json`: the script and the scenes. The format is in references/scenes.md.
- `FACTS.md`: the claim whitelist. `pronunciations.json`: display/spoken pairs.
- `theme/`: theme.json, the logo, fonts. Output goes to `renders/<name>.mp4`.

## Themes

Built in: `labos` (company default: light, teal, Comfortaa + Montserrat), `neutral` (light, blue),
`midnight` (dark). A custom brand (colors, fonts, logo): producer.md, Change requests.

## Quality bar

- Every narrated or on-screen claim is in FACTS.md. Numbers keep their caveat. Status words are
  exact: optional vs required, shipped vs planned, measured on what.
- One idea per scene, each following from the last, and visuals land on the spoken word.
- A structure and a look chosen for this content, at least one signature scene designed only for
  this video, engagement devices picked from the writer.md menu, and an ending that differs from
  the last videos (`D history .`; unless overridden, see writer.md, Art freedom).
- The second-to-last scene is the visible summary (a recap, or a scene marked `summary: true`) of
  2-4 takeaways with real-life examples that add no capability beyond FACTS.md; then close. `D
  check` fails without it. Build warns on an incomplete recap, no signature scene, and repeated
  templates, transitions, endings or rhythm.
- Done means zero cue warnings, no house-style warning (advisory when editing, or overridden per writer.md, Art freedom), lint
  with 0 errors, check passed, the checker clean on the final text, the contact sheet reviewed
  twice (layout review, final look), and loudness near -14 LUFS.
