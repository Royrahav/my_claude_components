# Plan: coherence, logical order and visual effects

Status: approved plan, not implemented. Lane: Standard-feature (dev-flow), RCA not required, PM
skipped (no written spec). Developer: Back End Agent.

## Why

The videos jump between ideas. The last project ran
`title > decision > steps > cards > code > page-journey > steps > states > pipeline > beat > split > recap > close`
with no chapters. Suspected cause: the variety rules (a structure that differs from past videos, no
template back to back, the 40% template cap, history warnings) sit next to or above "each scene
follows from the last", so the writer can be pushed into an order that reads as random.

## Reference

"Every time you hit send on WhatsApp..." (720x1280, 173 s). What makes it coherent and good-looking:

- One running payload (a single message) travels through every stage.
- Numbered chapters with a progress rail across the top.
- Each chapter is motivated by the previous one's limit ("so we add caching", "the catch...").
- The world builds up cumulatively, and the camera travels between zones of it.
- Neon glow, and sparks when something lands.
- The summary is a zoom-out of the whole picture.

Not ported: the 3D view, the vertical format, the narrator character.

## A. Coherence

Guides (kept short, detail in scenes.md):
- writer.md, a new "Spine" step before the structure: pick the running thread, order the chapters
  by dependency, open each scene with a bridge from the last, never use a term before it is
  introduced.
- "Each scene follows from the last" becomes a hard rule. Variety and history warnings yield to it
  in the Art freedom precedence and in Revision.
- Gate 1 summary gets a `spine:` line (thread, chapter order).
- checker.md: an adjacent-pair order pass (does B follow from A, is each term used before it is
  introduced, is every open loop paid off).

Engine:
- A build warning when a chapter reappears after a different one.
- `direction.thread` (text), the running example, accepted and shown at gate 1.

## B. Visuals (opt-in knobs, defaults unchanged)

Opt in so videos don't all look the same (see the sameness feedback). The writer picks them per
content.

- `direction.rail: on`: a chapter progress rail at the top, with the current chapter lit and the
  fill growing from the previous chapter. The summary shows it full.
- `direction.background: world`: one persistent layer behind all scenes in index.html (a depth
  grid, drifting orbs, particles), with the camera travelling to a new zone at each scene
  boundary. Scene backgrounds go transparent over it. It is theme-aware (light `labos` and dark
  `midnight`), and keeps out of the AA zones (top-right tag, bottom-center ref, captions below
  y=900). It may need to be a timed clip to pass HyperFrames lint: confirm with a real check.
- Kit helpers for signature scenes: `glow` (a pulse on a landing element), `sparks` (a seeded
  particle burst), `camera` (a pan or zoom inside a scene).
- scenes.md: a "zoom-out" summary form (the whole picture reassembled), plus the new knobs.

## Validation

- Unit tests: baseline 989 passing (`node --test test/*.test.mjs` from `scripts/`). Add tests for
  the rail, the world layer, the helpers, the chapter warning and the `thread` field.
- A real build and `D check` of a silent scratch project (empty `say` plus `duration`, so no
  ElevenLabs credits) in both `labos` and `midnight`, with the new knobs on. Read one contact sheet.

## Pipeline

Back End Agent (WRITE skills) -> Unit Test Agent -> Code Reviewer -> commit message. Human
approval before each phase and before the commit.
