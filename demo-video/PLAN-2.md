# Plan 2: no empty screens, and motion that feels like video

Status: implemented 2026-10-18 (M1 3c401e1, M2 next commit); review PASS on both, lows are follow-ups. Lane: Full (dev-flow), 2 milestones, a review point at each.
RCA not required (a feature). Follows PLAN.md (coherence, rail, world), commit 2bf98a8.

## Why

The user: "more like a video and not a slideshow", and "sometimes the screen is empty - fill those
gaps with something cool". In the v2 print-gateway MP4, frames showed bare backgrounds at s01, s09, s11,
s12 and s13. Cause: every element reveals on its spoken cue, so the 1-3 s before a scene's first cue are
empty; some layouts also stay sparse when fully revealed (s13: two small stats).

## Rules for both milestones

- Opt-in knobs, defaults unchanged, except the empty-screen warning (a build warning, no visual change).
  Existing videos and golden/layout tests must build exactly as before unless a knob is set.
- Seek-safe (fromTo), deterministic (seeded, never Math.random), transforms and opacity only.
- AA contrast and the keep-out zones hold: top-right tag, bottom-center ref, captions below y=900.
- Guides stay token-lean: short rules in writer.md, detail in references/visuals.md.
- Plain hyphens only.

## Milestone 1: fill the gaps

1. Empty-screen warning (build, always on): from each scene's timeline, warn when nothing
   (beyond background and chrome) is visible for more than about 1.0 s, at the start or between
   reveals: `sNN: empty for 2.4 s at the start (first reveal at 2.6 s)`. Silent beat scenes and the
   close's fade-out are exempt. writer.md Revision gets the fix line (reveal something on the first
   word, use `reveal: blueprint`, a `backdrop`, or an earlier cue).
2. Chapter intro (`direction.chapter_intro: on`, off by default): on the first scene of each new
   chapter, the chapter name enters large in the center, holds briefly, then flies into the
   chapter-tag corner (or fades out when the chrome hides the tag), finishing before the first
   content cue. Keep it short (about 1.2-1.6 s) and skip it when the first cue leaves no room.
3. Outline-first reveal (`direction.reveal: blueprint`, default `cue`): every cued element is
   visible from the scene start as a faint outline (dashed border or low-opacity ghost), then fills
   in on its cue. Implement once in the kit's reveal helpers so all templates get it.
4. Backdrop word (scene field `backdrop`, text, optional): a huge, faint word or number behind the
   content that drifts slowly (parallax against the content), present from the scene start. Low
   contrast by design: it must not count as text for the contrast check or collide with legibility.

## Milestone 2: video, not slideshow

5. Camera per scene (`direction.camera: drift`, default `push` = today's 1.02 push): a seeded,
   per-scene varied move (slow zoom in or out of about 4-6 %, plus a small pan, direction varying
   scene to scene) so consecutive scenes never move the same way. Content stays on screen at every
   frame; at the extreme of a 4-6 % zoom, full-width content reaches about 35-50 px from the edge
   (accepted 2026-10-18: the zoom itself cannot keep a 96 px margin).
6. Flowing connectors (`direction.flows: on`): dots stream continuously along the connecting lines
   in pipeline and decision scenes (and a kit helper `flow(lineId, t)` for signature scenes),
   starting once a line has drawn.
7. Pinned running example (`direction.thread_pin: on`): a persistent layer (like the rail) showing
   a small pill with the running example (placed at the top center, accepted 2026-10-18) that does
   not collide with the rail, tag, captions or content band. A scene may set `pin` (text) to rewrite it from that scene on (for example
   `smb://printsrv/Office` after Normalize), with a short morph; it hides on the title, summary and
   close.

## Validation (each milestone)

- Unit tests pass (baseline 1036), with tests only for real regression risks.
- A silent scratch build plus `D check` on labos and midnight with the new knobs on; read the end and
  mid contact sheets.
- After milestone 2: rebuild the print-gateway video as v3 (copy of v2 with the new knobs, no new
  narration unless a `say` changes), render it, and inspect MP4 frames for empty gaps.
