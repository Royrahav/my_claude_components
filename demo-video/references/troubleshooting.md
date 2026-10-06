# Troubleshooting

| Symptom | Fix |
|---|---|
| `setup`: node TOO OLD or `npx` not found | Install Node 22+ (Windows `winget install OpenJS.NodeJS.LTS`, macOS `brew install node`), open a new shell, rerun `setup`. |
| `setup`: browser setup FAILED | Run `npx --yes hyperframes@0.8.115 browser ensure` to see the full error. Behind a proxy, set `HTTPS_PROXY` first. |
| Agent type `demo-researcher` or `demo-checker` not found | Run `D setup`: it installs the two helper agents into `~/.claude/agents/`, and they load within seconds (restart Claude Code once only if the setup output says the folder was just created). Until then, spawn `general-purpose` on sonnet with the prompt "Read <skill dir>/references/research.md (or checker.md) and follow it". |
| ElevenLabs 401 invalid key | Ask the user for the key again and rewrite `~/.config/demo-video/.env`. An `ELEVENLABS_API_KEY` environment variable overrides both files, and a project `.env` overrides the machine one. |
| ElevenLabs 401 missing permission | The key is restricted. It needs Text to Speech; Music for `music`; Sound Effects for `sfx`. Voices and User read access are not needed. |
| ElevenLabs 402 / quota | Out of credits. Narration costs about one credit per character (5 min is about 4,500). Ask the user. |
| ElevenLabs 429 or 5xx | Busy or a server error: retried automatically with backoff (about 5, 15 and 30 s). If it still fails, wait a minute and rerun the same command; finished narration takes are kept. |
| `music` fails (403/402) | The plan has no Music API. Use `music --file <mp3>` with a track the user may use, or set brief `music` to false. |
| `build`: cue not in narration | Point `at` at a word that is actually spoken in that scene (display form), or use `word#2` / a number. |
| `build`: unknown scene type | Fix the spelling (the templates are listed in scenes.md), or add `<project>/scenes/<type>.mjs`. |
| `build`: `brief.json direction...` must be one of, or has an unknown field | Fix that field in brief.json `direction`; the message lists the allowed values (scenes.md, Creative direction). |
| `check: FAILED` with contrast lines (HyperFrames itself may still print "Check passed") | Custom theme: darken `muted`/`light` on light themes (lighten them on dark ones). Accent text and the text on accent fills are derived automatically. |
| `check`: layout overflow or overlap | Shorten labels (titles up to 6 words, chips up to 4), or use fewer items per scene. |
| `lint` errors in a custom template | Use the kit's motion helpers. Don't animate `left`/`top`/`width`/letter-spacing, and don't add `tl.set` at time 0. Write JS files with the Write tool, because shell heredocs eat backslashes. |
| Theme fonts fail ("Google Fonts has no X") | Pick the closest Google Fonts family and run `D theme .` again. |
| Render runs out of memory, or a V8 heap warning | `D render . --workers 3`. |
| Render is slow | Normal: about 2 to 3 times the video length. Use `--quality draft` for intermediate reviews, and `--mix-only` for audio-only changes. |
| Video is too long or short | `D plan .`, then trim or extend `say`, or `narrate --speed` between 0.95 and 1.15. Then build. |
| Mispronounced word | Respell it in pronunciations.json. Spell out acronyms letter by letter ("C U P S"), split syllables with spaces ("lab O S"). Then narrate. |
| Music too loud or quiet | brief `music_gain_db` (+3 / -3), then `render --mix-only`. |
| A caption shows two words merged (`lpoptions` for "lp options") in a project voiced before the respelling fix | `D narrate . --only <id> --force`, then build. |
| Voice takes out of sync after hand edits | `D narrate . --force` re-voices everything; then build. |
