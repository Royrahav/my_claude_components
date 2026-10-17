# Opt-in visuals: rail, world, zoom-out

Read this when a content is a chaptered journey and `direction` should set `rail` or `background:
"world"` (scenes.md, Creative direction). Both are off by default, so videos keep looking different:
pick them for the content, not for every video.

## `rail: "on"`: a chapter progress rail

A thin segmented bar across the top. One segment per run of scenes sharing a `chapter` label
(summary and close scenes are not chapters). A chapter's segment lights when it starts and its fill
grows across its scenes. The rail appears with the first chapter, stays full under the summary and
leaves with the close. Without `chapter` labels build warns and draws nothing. It holds no text.

## `background: "world"`: one persistent world

A single layer behind every scene (a depth grid, drifting orbs and motes), so the video reads as one
place. The camera glides to a new zone of it at each scene boundary, and each scene's own background
turns transparent over it. It follows the theme (light `labos`, dark `midnight`) and fades out in the
top-right corner and the bottom strip, where the chapter tag, the close ref and the captions sit.
A `custom` scene or a project template that paints a full-frame background hides it: leave the frame
transparent.

## `thread`: the running example

`direction.thread` (text, one line): the example every chapter returns to (writer.md, Script 2).
It only steers the writer and shows at gate 1 (the `spine:` line).

## Zoom-out summary

The whole picture reassembled, for a journey through chapters. A signature scene with `"summary":
true` redraws the pieces the video built, each landing on the word that recalls it (`glow`, and
`sparks` for the last piece), then pulls the `camera` back to the full picture. With `rail: on` the
rail shows full under it. Its narration still carries 2-4 takeaways. Helpers: custom-scene.md,
Effects for signature scenes.
