# Producer guide: the production step

Read this at production, after gate 1. You run the demo CLI from the project dir and keep each
command's one-line summary for your status line. `D` = `node "<skill dir>/scripts/demo.mjs"`.

- Never print, log or write the ElevenLabs API key.
- Edit only, at this step: cue `at` fixes and dash replacement in scenes.json; the change-table
  edits (brief.json voice, speed, music, `music_gain_db`, `direction` and the `captions`, `music`
  and `sfx` flags; a scene's `transition`; a theme switch via `D theme . --use`); and the one
  speed fit. For anything else, stop and fix it at the right step (see the end).

## Pipeline, in order

1. `D narrate . [--voice <Name>]` (add `--voice` only for the voice chosen at gate 1). Kokoro voices locally and free. A brief with no `voice.engine` (made before Kokoro) follows the machine default: it is switched to Kokoro Heart, written to the brief, and narrate prints a note (re-voices every scene). ElevenLabs only with `--engine elevenlabs` (paid: ask first)
2. `D sfx .`
3. `D build .`, then the fixes below, if any
4. `D music .` (copies the mood's track from the library; only an empty slot is generated, the one credit spend; a custom bed is kept)
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
   - `warn: house style:` (any of them): writer.md, Revision lists each fix.
2. Then re-voice once. The speed fit re-voices every scene, the fixed ones included, so it comes
   after the fixes and runs at most once:
   - The build total is more than 5% away from `length_s` (brief.json): run `D plan .`, which
     prints `speed to hit target: <n> (now <m>; set with narrate --speed)`, then
     `D narrate . --speed <n>`. The fit never goes past the tone's comfortable pace (writer.md,
     Tone, Pace): when plan warns `too long for a comfortable pace`, trim the words it names
     (writer.md, Revision) or raise `length_s` to the length it prints; never speed up past it.
   - Otherwise, if a fix changed a `say` or a pronunciation: `D narrate .` (it re-voices only the
     changed scenes).
3. `D build .` again. Still more than 5% away after the speed fit: trim or extend `say`
   (writer.md, Revision), never a second speed fit.

## Stop and fix it at the right step

- `check: FAILED` with lint errors or contrast lines: troubleshooting.md (a custom theme usually
  needs darker `muted` and `light` colors), then build and check again.
- `check: FAILED` on the ending rule: SKILL.md, Changes (a new video: fix it; an existing one: ask
  first, and if the user declines, render as is and say check fails only on that rule).
- Layout failures from check (overflow, overlap): the layout review, qa.md.
- Content changes (wording, claims, scene order or scene types): writer.md, Revision.
- Kokoro errors: `D setup` prints what is missing (python package, model files). A failed run saves nothing: rerun the same command (free).
- ElevenLabs errors (only for music, SFX, or `--engine elevenlabs`):
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
| another voice | `D narrate . --voice Michael` (names: `D voices`), `D build .`, `D check .` |
| ElevenLabs instead of Kokoro (paid: ask first), or back | `D narrate . --engine elevenlabs` / `--engine kokoro` (re-voices all scenes), `D build .`, `D check .` |
| different music | `D music . --mood <slot>`: `calm-tech` (balanced, calm-technical), `story-warm` (light, story-driven), `launch-bright` (playful, energetic-launch), `focus-serious` (serious, critical, minimal-documentary), `minimal-ambient` (the alternate); `D music-library` lists them. The first `D music .` picks one from tone and preset and keeps it in brief `music_mood`; later a tone or preset change does not move it, only `--mood` does. One-off: `--prompt "..."` or `--file x.mp3`, kept by later plain runs (brief `music_custom`) until `--mood`; a bare `--prompt` uses brief `music_prompt` (the theme's, which does not loop cleanly). `--adopt <slot>` seeds an empty slot from the project's bed, warns if it is under 360 s, and leaves the brief alone. A slot you dislike: delete `~/.cache/demo-video/music/<slot>.mp3` and run `D music .` to regenerate it (the one credit spend). The render loops a bed shorter than the video with a crossfade |
| music louder or quieter | brief.json `music_gain_db` (+3 or -3) |
| no captions, music or SFX | brief.json `captions` / `music` / `sfx`: false, `D build .`, `D check .` |
| another transition | scenes.json scene `transition`: push, zoom, fade or cut; `D build .`, `D check .` |
| another style: calmer, livelier, captions, background, chrome, pacing | brief.json `direction` (scenes.md, Creative direction); `D build .`, `D check .` |
| another theme | `D theme . --use labos` (or labos-dark, neutral, midnight), `D build .`, `D check .` |
| a custom brand | `D theme-from-site <url>` prints a guess at colors and fonts. Write `theme/theme.json`: name, mode (light or dark), colors {canvas, surface, ink, muted, light, accent, accent2, danger; each hex `#RGB` or `#RRGGBB`}, fonts {display, body, mono} (Google Fonts families), logo (a file in theme/, SVG preferred; omit it for a text-only lockup), music_prompt (used only by a bare `--prompt`). Copy the logo into `theme/`, run `D theme .`, then `D build .`, `D check .`. Text colors are darkened to pass WCAG AA, so brand colors work as given. |

Then the render step: `D render .`, or `D render . --mix-only` after an audio-only change (music
or its level): it reuses the last picture and redoes only the audio mix.

## Status line

Each command's summary, the fixes made (`sNN: old -> new`, or none) and the contact sheet path.
