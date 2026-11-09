# demo-video

A Claude Code and Cursor skill that turns a feature, bug fix or release into a finished, narrated demo
video (1920x1080 MP4). You give Claude the context; it asks a few questions, shows you the script,
then produces the video. Each video has:
- animated, on-brand scenes built with HyperFrames;
- a Kokoro voiceover (free, local; ElevenLabs optional);
- burned-in captions;
- background music and light sound effects;
- broadcast-level loudness;
- a summary of the key takeaways, with real-life examples.

Each video is shaped by its demo's own content: a structure chosen from what it explains, a
creative direction (calm, energetic, story-driven or documentary), layout variants, and one
bespoke signature scene.

## Install (about 2 minutes)

1. Put this `demo-video` folder in your Claude skills folder:
   - Windows: `%USERPROFILE%\.claude\skills\demo-video`
   - macOS / Linux: `~/.claude/skills/demo-video`
2. Open Claude Code and say: **"set up the demo-video skill"**. Claude checks Node 22+, ffmpeg and
   the render browser, and installs what's missing (with your OK). It also installs the skill's three
   helper agents (research, a rubber-duck clarity review, and fact-check) into `~/.claude/agents/`. The voice is Kokoro, free and
   local: it needs `python -m pip install --user kokoro-onnx` and two model files in `~/.cache/kokoro` (setup
   prints the exact steps). An **ElevenLabs API key** is optional: only for generating music and sound
   effects, or for ElevenLabs voices (`narrate --engine elevenlabs`).

An ElevenLabs key, if you add one, is stored only on your machine, in `~/.config/demo-video/.env`.

Cursor: it reads skills from `~/.claude/skills`, so the folder above works as is; or put it in
`~/.cursor/skills/demo-video`. `D setup` also installs the three helpers into `~/.cursor/agents/`
when `~/.cursor` exists (`--host claude|cursor|both` overrides, `--cursor-model <id>` picks their
model). Cursor-specific notes are in `references/hosts.md`.

## Use

Say what you want and point at the sources:

> Make a 3-minute demo video for LAB-1234. The code is in this repo, PR 56; the spec is docs/spec.md.

Claude researches the sources and asks about length, audience, tone and look, each with a
recommended answer. You approve the script and pick a voice, and it renders. Ask for changes in
plain words: "slower voice", "dark theme", "shorten the intro", "louder music", "fix how it
says labOS". Each change re-does only what it has to.

Videos go to the projects folder chosen at setup (default `~/demo-videos/<name>/renders/`).

## Look and feel

The default is the company theme (labOS). Built-in alternatives are `labos-dark` (the
same brand on a dark canvas), `neutral` (light) and `midnight` (dark, unbranded). You can also match any brand: give Claude a website URL, or colors, a Google
font and a logo.

Every video sells the why first: it assumes the viewer knows nothing, shows the problem on a
concrete case before naming the feature, says when the viewer will use it, and asks the viewer's
own questions aloud where they help ("so why do we need this?"). Before the fact-check, a rubber-duck
helper hears the idea and reads the script cold, and reports where a newcomer gets lost; the script
is fixed from its notes. The narration keeps a calm pace: a script too long for its length is
trimmed, never sped up.

Within the theme, each video gets its own structure and style, designed from what it explains:
Claude proposes a style (calm and technical, energetic, story-driven or minimal) with the script,
and builds at least one scene designed only for that video.

Your say: pick a tone (from playful to critical; it also sets how the voice delivers), and after
the research Claude asks a few focus questions (the core message, what to cut, what viewers should
do next) so a big topic condenses well. Give your own art direction in words ("retro terminal")
and it outranks the presets; choose "Artist's cut" for more creative license. Lasting preferences
("never underline") are kept in `~/.config/demo-video/taste.md`, and recent videos in
`history.jsonl` there, so the next video differs from the last. Every video ends with a labeled
Summary, then a closing scene whose form varies.

Each video follows one running example through ordered chapters, with a chapter progress rail and
one persistent background behind the scenes. Where the content has a spatial or flow shape (an
architecture, layers a request passes through, a hub and its parts, a journey), Claude can use 3D scenes: an
isometric world with glowing objects and a camera that orbits, cranes, dollies or follows. At least one 3D scene is
designed for the topic (layers with a token going through them, a hub with satellites, ...); the built-in journey and
map are fallbacks. 3D stays the exception (about a third of the scenes at most) and looks best on `labos-dark` or `midnight`.
3D videos render about 2-3 times slower; render them with nothing else heavy running.

## Cost

Claude: voice, timing, animation and rendering run in local scripts that print short summaries.
The session writes the script and produces the video itself; three cheap Sonnet helpers research
your sources, review the script as a newcomer, and fact-check it. Measured: a 75-second video cost about $3.3 at list prices
and took 26 minutes in one Opus session. The same video split across more agents cost $7.25 and
took 48 minutes, because every subagent re-pays its cache writes.

Tip: run the session on Opus. The three helpers pick Sonnet themselves.

Narration with Kokoro is free. ElevenLabs voices (optional): about one credit per narrated character (a 5-minute
video is about 4,500). Music costs credits only the first time a mood is used: the 5 mood tracks are made once per machine and reused by every video.

## Development

The helper scripts have unit tests. Run them from this folder:

    node --test "scripts/test/*.test.mjs"

They run offline (no ElevenLabs or network calls) and finish in about a second.
