# Producer guide: the production step

Read this at production, after gate 1. You run the demo CLI from the project dir and keep each
command's one-line summary for your status line. `D` = `node "<skill dir>/scripts/demo.mjs"`.

- Never print, log or write the ElevenLabs API key.
- Edit only, at this step: cue `at` fixes and dash replacement in scenes.json; the change-table
  edits (brief.json voice, speed, music, `music_gain_db` and the `captions`, `music` and `sfx`
  flags; a scene's `transition`; a theme switch via `D theme . --use`); and the one speed fit.
  For anything else, stop and fix it at the right step (see the end).

## Pipeline, in order

1. `D narrate . [--voice <Name>]` (add `--voice` only for the voice chosen at gate 1)
2. `D sfx .`
3. `D build .`, then the fixes below, if any
4. `D music .` (after the fixes: the bed is made for the final length)
5. `D check .`

The pipeline never renders. Rendering is the render step in SKILL.md, after the layout review and
the final look: a render made before them goes stale with their first fix.

## After build: fixes, in this order

1. Apply every pending script fix first:
   - `warn: sNN: cue "x" not in narration`: find scene sNN in scenes.json and set the `at` whose
     value is "x" to a word that is actually spoken in that scene's `say`: the word closest in
     meaning to the text of the element that `at` belongs to. If no spoken word fits, it is a
     wording or pronunciation problem: writer.md, Revision.
   - Em or en dash in scenes.json: replace each with a comma, or with a plain hyphen inside a
     range or a compound.
   - `warn: house style:` (a missing, misplaced or incomplete recap): writer.md, Revision.
2. Then re-voice once. The speed fit re-voices every scene, the fixed ones included, so it comes
   after the fixes and runs at most once:
   - The build total is more than 5% away from `length_s` (brief.json): run `D plan .`, which
     prints `speed to hit target: <n> (now <m>; set with narrate --speed)`, then
     `D narrate . --speed <n>`.
   - Otherwise, if a fix changed a `say` or a pronunciation: `D narrate .` (it re-voices only the
     changed scenes).
3. `D build .` again. Still more than 5% away after the speed fit: trim or extend `say`
   (writer.md, Revision), never a second speed fit.

## Stop and fix it at the right step

- `check: FAILED` with lint errors or contrast lines: troubleshooting.md (a custom theme usually
  needs darker `muted` and `light` colors), then build and check again.
- Layout failures from check (overflow, overlap): the layout review, qa.md.
- Content changes (wording, claims, scene order or scene types): writer.md, Revision.
- ElevenLabs errors:
  - 401: ask the user for the key and rewrite `~/.config/demo-video/.env`.
  - 402: tell the user the credits are out.
  - 403 on music: offer `D music . --file <mp3>` or music off.
  - 429 or 5xx that persists after the automatic retries: wait a minute and rerun the command.
- Any other warning or error: troubleshooting.md.

Never work around a failing line: fix its cause at that step.

## Change requests

| Request | Run |
|---|---|
| faster or slower voice | `D narrate . --speed 1.1` (0.95 to 1.15), `D build .`, `D check .` |
| another voice | `D narrate . --voice River`, `D build .`, `D check .` |
| different music | `D music . --prompt "..."` or `D music . --file x.mp3` |
| music louder or quieter | brief.json `music_gain_db` (+3 or -3) |
| no captions, music or SFX | brief.json `captions` / `music` / `sfx`: false, `D build .`, `D check .` |
| another transition | scenes.json scene `transition`: push, zoom, fade or cut; `D build .`, `D check .` |
| another theme | `D theme . --use labos` (or neutral, midnight), `D build .`, `D check .` |

Then the render step: `D render .`, or `D render . --mix-only` after an audio-only change (music
or its level): it reuses the last picture and redoes only the audio mix.

## Status line

Each command's summary, the fixes made (`sNN: old -> new`, or none) and the contact sheet path.
