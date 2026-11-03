# Opt-in visuals: rail, world, fillers, motion, zoom-out

Read this when a content is a chaptered journey and `direction` should set `rail`, `background: "world"`
or the screen fillers below (scenes.md, Creative direction). All are off by default, so videos keep looking different:
pick them for the content, not for every video.

## `rail: "on"`: a chapter progress rail

A thin segmented bar across the top. One segment per run of scenes sharing a `chapter` label
(summary and close scenes are not chapters). A chapter's segment lights when it starts and its fill
grows across its scenes. The rail appears with the first chapter, stays full under the summary and
leaves with the close. Without `chapter` labels build warns and draws nothing. It holds no text.

## `background: "world"`: one persistent world

A single layer behind every scene (a depth grid, drifting orbs and motes), so the video reads as one
place. The camera glides to a new zone of it at each scene boundary, and each scene's own background
turns transparent over it. It follows the theme (light `labos`, dark `labos-dark` or `midnight`) and fades out in the
top-right corner and the bottom strip, where the chapter tag, the close ref and the captions sit.
A `custom` scene or a project template that paints a full-frame background hides it: leave the frame
transparent.

## `thread`: the running example

`direction.thread` (text, one line): the example every chapter returns to (writer.md, Script 2).
It only steers the writer and shows at gate 1 (the `spine:` line).

## Empty screens: the warning and the fillers

Every element reveals on its spoken cue, so the seconds before a scene's first cue can show only the
background. `build` warns, for each scene, of any stretch over 1.0 s with nothing but background and
chrome visible (`s05: empty for 3.4 s at the start (first reveal at 3.4 s)`, or `from 4.0 s` after
elements fade out). The headline's fixed 0.2 s rise counts as content; beats and a close's final
fade-out are exempt; hand-written `custom` scenes are not checked. Fix it by revealing the first element on the first spoken word or an earlier cue, or with a filler:

- `chapter_intro: "on"` (default `off`): on a chapter's first scene (summary and close are not chapters) the
  chapter name enters large in the center, holds, then flies into the chapter tag, which appears as it
  lands (where the chrome hides the tag, it fades out instead). It takes up to 1.45 s and must end before the
  first content cue (the headline does not count), so a scene whose first cue comes sooner skips it, and
  build says so.
- scene field `backdrop` (1-16 characters, a word or number): a huge faint word behind the content that
  drifts sideways, present from the first frame. It is decorative: the checker ignores it (contrast and layout)
  and it stays out of the reading order. Use it on sparse scenes, where it sits in empty space, not under dense rows (it competes with them).

## Moving like video: camera, flows, pinned example

- `camera: "drift"` (default `push`, a 2 % push): each scene gets its own slow zoom (about 4-5.5 %, in or out
  alternately) and a pan of under 10 px, dealt from the scene's position so consecutive scenes never move the same
  way. The content edge can move about 50 px outward at the extreme frame, so keep the 96 px margins. A scene that
  drives its own stage with `k.camera` keeps the push (call `ambient` after it), so the moves never stack.
- `flows: "on"`: dots stream along the connecting lines of `pipeline` (both layouts) and the `decision` yes path
  once each line has drawn, until the scene ends. For a signature scene, `k.flow(lineId, t, { axis })` does the
  same for an empty line element (`axis: "y"` for a line that draws downward); without the knob it does nothing.
- `thread_pin: "on"`: a small pill with `direction.thread` at the top center, between the eyebrow and the chapter
  tag, from the first scene after the title. A scene's `pin` (text, 1-48 characters) replaces it from that scene on
  (the old pill leaves as the new one arrives). It leaves for the summary and the close. Without `thread`, build
  warns and draws nothing.

## Zoom-out summary

The whole picture reassembled, for a journey through chapters. A signature scene with `"summary":
true` redraws the pieces the video built, each landing on the word that recalls it (`glow`, and
`sparks` for the last piece), then pulls the `camera` back to the full picture. With `rail: on` the
rail shows full under it. Its narration still carries 2-4 takeaways. Helpers: custom-scene.md,
Effects for signature scenes.

## 3D where it fits

A 3D scene draws a world in CSS 3D. Use 3D only where the content is spatial or a flow; everything else stays 2D.
Any scene that builds a 3D stage counts as 3D, whatever its template. Build warns when 3D scenes pass about a third of
the counted scenes (close, summary and beats aside).

**Design the 3D for the topic.** When the content is spatial, at least one 3D scene is a project template built with
`k.iso` for this topic and idea (custom-scene.md, 3D signature scene recipe), not a built-in. The built-ins are
fallbacks, each at most once per video: `iso-journey` (a request travelling stop to stop) and `iso-map` (the whole
map as the summary). Each 3D scene of a video uses a different form and camera language, and the video varies from the
last one (the history records the 3D templates).
- Forms: a stack of layers, an orbit (a hub and its parts), a path, a grid or city, an exploded view, before and after.
- Camera: orbit (around a hub), crane (flat to side-on, for layers), dolly (push in or back), focus (slide to a point),
  follow-and-pull-back (a route; the iso-journey grammar).
- Objects that act on a word: a lock opening, gears turning, a layer lighting, a beam sweeping, a crate breaking, a key
  turning, a token travelling, a clock advancing. Pick what the feature is about.
- Worked examples show the mechanics; design your own form, objects and camera, never an example with only its data
  changed: `assets/examples/signature-iso-stack.mjs` (a token through layers and back, crane and orbit) and
  `signature-iso-orbit.mjs` (a hub with satellites, an orbiting camera).
- Build warns when every 3D scene is a built-in or an unchanged example, when one built-in is used twice, when a project
  template equals a shipped example, and when the last video used the same 3D template (a renamed copy is caught by source).
- Colors follow the theme: a dark world on dark themes, a light one on light themes.
- Cues: each stop rises on its cue with its label. The first stop of a journey, and every stop of a map, stands from
  the start, so the first frame is never empty; their labels and lamps land on the cues. Uncued map stops light 1.2 s
  apart; the takeaway rows wait until the map has moved aside (a row held back over 0.5 s warns).
- iso-journey: a stop needs 1.6 s after the one before it; one that slips over 0.5 s past its cue warns, naming it. In both,
  a stop that cannot show its label before the scene ends stops the build (fewer stops, earlier cues or a longer `hold`).
  iso-map spaces uncued stops 1.2 s (cued: 1.0 s minimum) and moves a late stop without a warning.
  The scene's own motion (a printed sheet sliding out) may be cut by the scene end; it is decoration.
- A `panel` shows from its stop's arrival and stays at least 0.8 s before the camera leaves; a stop followed by a stop
  less than about 2.3 s later cannot carry one (build error: cue the next stop later or drop the panel).
- The pull-back at the end of a journey is shortened to the time left, and skipped with a warning under 1 s.
- A 3D scene that opens a chapter skips the chapter intro: it has its own establishing shot (intended).
- Keep stop titles short; an iso-map reads best with 2-4 stops.
