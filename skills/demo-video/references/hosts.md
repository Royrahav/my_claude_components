# Running in Cursor

Read once at the start, only in Cursor (or another host without the Agent and AskUserQuestion
tools). Everything in SKILL.md applies; this file only changes how.

- Skill dir: the folder holding SKILL.md (`~/.claude/skills/demo-video` or `~/.cursor/skills/demo-video`).
  Use it for `D` and in helper prompts.
- Questions: use Cursor's ask-question tool, at most 4 per batch. Without one, ask in chat as a
  numbered list, recommended option first, and WAIT for the answer.
- Helpers: `D setup` installs `demo-researcher` and `demo-checker` into `~/.cursor/agents` (the
  researcher in the background, the checker read-only). Start them by name, with the same prompts.
  They inherit the parent model; for a cheaper one, run `D setup --cursor-model <id>` (a Cursor
  model id). If they are unavailable, do the research yourself from research.md, and run the
  check as a separate pass that reads only FACTS.md and scenes.json, following checker.md (this replaces SKILL.md's general-purpose fallback).
- Model: pick a Claude model, Opus recommended.
- Render: start `D render .` as a background terminal command; it is done when it prints the
  `loudness ... LUFS` line. If the terminal times out, give the user the exact command and ask them
  to paste its last 2 lines.
- Contact sheet: view the image if you can. If image files cannot be viewed, give the user the
  sheet path and ask one question ("Does anything look wrong? Which scene?"); if the user cannot look
  either, rely on `D check` and lint.
