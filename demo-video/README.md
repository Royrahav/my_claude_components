# demo-video

A Claude Code skill that turns a feature, bug fix or release into a finished, narrated demo
video (1920x1080 MP4). You give Claude the context; it asks a few questions, shows you the script,
then produces the video. Each video has:
- animated, on-brand scenes built with HyperFrames;
- an ElevenLabs voiceover;
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
   the render browser, and installs what's missing (with your OK). It also installs the skill's two
   helper agents (research and fact-check) into `~/.claude/agents/`. It then asks for the one thing
   it needs from you: an **ElevenLabs API key** with Text to Speech access. Music and Sound Effects
   access are optional.

The key is stored only on your machine, in `~/.config/demo-video/.env`.

## Use

Say what you want and point at the sources:

> Make a 3-minute demo video for LAB-1234. The code is in this repo, PR 56; the spec is docs/spec.md.

Claude researches the sources and asks about length, audience, look and extras, each with a
recommended answer. You approve the script and pick a voice, and it renders. Ask for changes in
plain words: "slower voice", "dark theme", "shorten the intro", "louder music", "fix how it
says labOS". Each change re-does only what it has to.

Videos go to the projects folder chosen at setup (default `~/demo-videos/<name>/renders/`).

## Look and feel

The default is the company theme (labOS). Built-in alternatives are `neutral` (light) and
`midnight` (dark). You can also match any brand: give Claude a website URL, or colors, a Google
font and a logo.

Within the theme, each video gets its own structure and style, designed from what it explains:
Claude proposes a style (calm and technical, energetic, story-driven or minimal) with the script,
and builds at least one scene designed only for that video.

## Cost

Claude: voice, timing, animation and rendering run in local scripts that print short summaries.
The session writes the script and produces the video itself; two cheap Sonnet helpers research
your sources and fact-check the script. Measured: a 75-second video cost about $3.3 at list prices
and took 26 minutes in one Opus session. The same video split across more agents cost $7.25 and
took 48 minutes, because every subagent re-pays its cache writes.

Tip: run the session on Opus. The two helpers pick Sonnet themselves.

ElevenLabs: about one credit per narrated character (a 5-minute video is about 4,500), plus one
music track.

## Development

The helper scripts have unit tests. Run them from this folder:

    node --test "scripts/test/*.test.mjs"

They run offline (no ElevenLabs or network calls) and finish in about a second.
