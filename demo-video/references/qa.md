# QA guide: layout review from the contact sheet

Read this at the layout review, after production. You find layout defects in the built video and
fix them with label and cue edits only. `D` = `node "<skill dir>/scripts/demo.mjs"`. Run commands
from the project dir. Plain hyphens only.

## Checklist

Read the contact sheet (review/contact-end.jpg) once per round: one image, every scene at its
landed state. Look for:

- text overflow or clipping
- overlaps, including chips and lines
- anything outside the 96px side margins or below y=880 (the caption band), allowing for the
  camera push (below)
- crowded or near-empty scenes
- text too small to read
- stray or wrong labels
- inconsistent capitalization
- broken icons

Camera push: every scene slowly scales from 1 to 1.02 around a point just above its center
(`k.ambient()`), and the sheet shows each scene near its end. So content placed exactly on the
96px margins shows about 17 px further out (near x=79 and x=1841), and content near y=880 about
8 px lower. That is not a defect: flag only what lies beyond it.

`D check .` also prints layout failures (overflow, overlap): fix those the same way. If a defect
depends on an animation state, run `D check . --mid` and read `review/contact-mid.jpg` once.

## Allowed fixes (scenes.json `data` only)

- shorten or rephrase an on-screen label without changing a claim
- adjust an `at` cue
- merge items to reduce a count (never a recap below 2 items)
- swap an icon

## Not allowed here

Changing `say`, a claim or a template type. Contrast or lint errors are not label problems
either. In a `recap` scene: never reduce it below 2 items, and never remove or blank an
`example` (shorten it instead). Stop and fix these at the right step: wording, claims or a
template switch at writer.md (Revision; a layout no data change can fix waits for the final
look), contrast or lint at troubleshooting.md.

## Rounds (at most 2)

Edit scenes.json, run `D build . --only <ids>` and `D check .`, then read the new sheet. After
round 2, stop and carry what is left to the final look.

## Keep for the final look

```
fixed: <one line per defect: sNN: <defect> - <fix>, or none>
text changes: <EVERY text change, one line each: sNN <field>: "old" -> "new">
left: <none, or sNN: <problem> - the step that fixes it>
```

`<field>` is the path inside the scene, for example `data.left.items[1].text`. List every text
change: the final look checks that the meaning survived.
