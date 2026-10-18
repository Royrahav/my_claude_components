# Plan 3: 3D where it fits

Status: approved 2026-10-18, in progress. Lane: Full (dev-flow), 2 milestones. Follows PLAN-2
(commits 3c401e1, b2b6e0e, c8e267a; reveal blueprint removed in 80b3e45).

## Why

The user rejected PLAN-2's result: the blueprint ghosts looked like placeholders (removed), and the
motion extras were too subtle to notice. They want the visual level of the reference video (a dark
isometric neon world: platforms on a glowing road, voxel users, ring-stack databases, server towers,
a flying camera, a lit packet, a pull-back to the whole map). A CSS 3D spike proved it renders through
the pipeline: scratchpad `iso-spike/scenes/iso-world.mjs` and its MP4.

The user's rule, binding: "don't go wild with 3D all the time. Make it with style where it fits and
just make the video look cool and understandable. Don't prefer visuality over coherence or video
content quality."

## Rules

- 3D is a template family the writer picks for content with a spatial or flow shape (an
  architecture, a request's journey, where things live, the zoom-out summary). Explanations, code,
  numbers, lists and decisions stay on the clear 2D templates.
- At most about a third of a video's scenes are 3D; house style warns beyond that.
- Clarity first: every 3D scene still lands each beat on its spoken word, keeps labels legible
  (upright billboards, AA contrast), and never hides the point behind effects.
- Theme-aware: a dark palette on dark themes and a matching light palette on light themes, both
  from theme vars, so a 3D scene never clashes with the 2D scenes around it.
- Deterministic and seek-safe; no opacity on preserve-3d containers (it flattens 3D); reveals go
  through recorded helpers so the empty-screen warning still works.
- Defaults unchanged: existing videos and templates build byte-identically.

## Milestone 1: the 3D kit and two templates

1. A small 3D kit module: the isometric stage (perspective, tilt, floor grid, fog, motes), boxes
   with neon edges and face content, billboards, pulse rings, a road with a light trail, a packet,
   and camera moves (focus on a point, pull back). Generalize the spike; no copy-paste per template.
2. An object library, each a small function: users (voxel cluster), server (towers with lit strips),
   database (ring stack), queue (conveyor with boxes), printer (with a sheet sliding out), document,
   shield or gate, cloud, phone, container. Unknown kinds stop the build, naming the valid ones.
3. Template `iso-journey`: 2-6 stops on a road, each `{title, kind, at, note?}`; the camera follows
   the packet stop to stop, each stop rising on its cue with its label; optional pull-back at the
   end. Optional `panel` per stop: a small floating 2D card (code line or chips) beside the stop.
4. Template `iso-map`: the whole map from above, stops lighting in turn, plus 2-4 takeaway rows
   (title + example), usable as the summary (`summary: true`), with the camera starting close and
   pulling back (the zoom-out summary form).
5. Validation: unit tests for real regression risks; silent scratch builds on labos and midnight;
   D check and --mid clean; view frames from a short draft render of each template.

## Milestone 2: when to use it, and the proof

6. Guides: writer.md gets the short rule (when 3D fits, when it doesn't, the one-third cap, clarity
   first); scenes.md documents both templates with a tested example each; visuals.md holds the
   detail. House style warns when 3D scenes exceed about a third of the scenes.
7. Re-render the print-gateway video as v4 from v2 (not v3): 3D only where it fits (the Windows
   last mile as an iso-journey, the summary as an iso-map, possibly the opening establishing shot),
   the rest unchanged; inspect MP4 frames before delivery.
