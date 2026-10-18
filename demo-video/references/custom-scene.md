# Custom scenes

Use this for the signature scenes every video gets (writer.md; recipe at the end), and when no
template can show an idea. For anything else, try first to reshape the content for a template,
because templates are already tested for layout, contrast and timing.

## Option A (preferred): a project template

Copy the closest built-in template into the project and edit it:
`<skill>/scripts/lib/scenes/<similar>.mjs` -> `<project>/scenes/<newtype>.mjs`, then set
`"type": "<newtype>"` in scenes.json. A project template overrides a built-in one of the same name.
A project `close` template must keep the built-in 0.8 s fade-out (`FADE_OUT` in `close.mjs`): captions
end just before it, so a longer fade would show the last caption inside the fade.

A template is `export default function (k, d, c) { ...; return { chrome: true }; }`, where `d`
is the scene's `data`.

**`k`, the scene kit:**
- **Ids and markup:**
  - `k.p(name)` gives a scene-unique id or class.
  - Push markup to `k.html` and CSS to `k.css`.
  - Ids passed to helpers are bare names: `k.rise("t1", 1.2)` animates `#<scene>-t1`.
- **Shared classes** (use as `k.p("card")` etc.):
  - Layout: `h2` (headline at the top left), `card`, `tinted`, `hero`, `row`, `col`, `line` (accent rule), `foot`.
  - Text: `title`, `body`, `label`, `code`.
- **Markup builders:**
  - `k.icon(name, {size, color, id})`, `k.chip(text, {tone, icon, id, strike, dashed, size})`, `k.doc(label, {id})`.
  - `k.toggle(on, {id})`: a toggle that will later `flip` must start off.
  - `k.esc(text)`.
- **Layout:** `k.centeredTop(h, {title, bottom})` gives the top y that centers an `h`-tall block below
  the headline (`title: true`) or chrome and above `bottom` (default 860). Use it for the main content block.
- **Motion** (seek-safe `fromTo`; `t` is in seconds from the scene start):
  - Reveals: `rise(id, t, dy?, dur?)`, `pop`, `slide(id, t, dx?)`, `fade`, `grow`, `type` (clip reveal).
  - Elements that take each other's place in one slot (labels, words, values) pass `{ ghost: false }` as the
    last argument, `rise(id, t, dy, dur, opts)`, `pop|punch|grow(id, t, dur, opts)`, `slide(id, t, dx, dur, opts)`,
    `fade(id, t, dur, opts)`; otherwise `reveal: blueprint` shows every one of them stacked as a ghost.
  - Lines: `draw` (scaleX), `drawY`.
  - Other: `to(id, t, props, dur?, ease?)`, `count(id, value, t, dur?, decimals?, comma?)`, `flip(toggleId, t)`.
  - `direction.motion: "lively"` shortens the reveals and gives them livelier eases on its own;
    `to` keeps your duration and any ease you pass.
- **Effects for signature scenes** (seek-safe; call them on a cue):
  - `glow(id, t, {color?, size?, dur?})`: a neon pulse on an element as it lands. Leave room for the
    shadow: do not clip it with `overflow:hidden`.
  - `sparks({x, y}, t, {count?, spread?, color?, dur?})`: a seeded particle burst from a point of the
    1920x1080 frame. The same call draws the same burst on every build; never use `Math.random`.
  - `camera(stageId, t, {focus: {x, y}, zoom?, dur?})`: pans and zooms your own full-frame stage
    element (`position:absolute;inset:0`) so `focus` lands at the frame center; call it with no
    `focus` to pull back to the full picture. Put the content to move inside that stage.
- **Sound and ambience:** `k.sound("whoosh" | "click" | "pop" | "chime" | "typing", t, volume?)`.
  End with `k.ambient()`: it drifts the direction's background layer (none on `plain`) and pushes
  the camera from scale 1 to 1.02, so the contact sheet shows edge content about 17 px further
  out than placed: lay out against the unscaled margins.
- **Context:** `k.theme` (colors, derived text colors), `k.brief`, `k.direction` (the resolved
  knobs, scenes.md Creative direction), `k.duration`, `k.hasLogo`.

**`c`, the cues:** `c.cue(at, fallback)` gives seconds; `c.first` and `c.last` are the first and
last spoken word; `c.spread(n, from?, to?)` gives n evenly spaced times; `c.duration`.

**Layout rules:**
- The canvas is 1920x1080, with 96px side margins.
- Keep everything above y=900: the caption band sits below that.
- The chrome takes the top 110px. Keep clear of it even when the direction hides the chrome, so
  the scene works under every direction.
- Use CSS vars only (`var(--ink)`, `--muted`, `--accent-text` for accent-colored text,
  `--accent` for fills and lines, `--surface`, `--tint`, `--line`, `--font-display`, `--font-body`, `--font-mono`).
  Raw hex would break other themes and the contrast checks.
- For text on an `--accent-text` fill, use `var(--on-accent)`: the theme picks it to stay readable
  (4.5:1 or better on every built-in theme).

## Option B: hand-written HTML (`"type": "custom"`)

Write `compositions/<id>.html` yourself. `build` keeps it and only syncs its duration. Copy the
structure of a built scene (`compositions/s02.html` is fine to read for this one purpose) and
keep the HyperFrames contract:
- a single `<template>` root;
- one paused GSAP timeline registered as `window.__timelines["<id>"]`;
- `fromTo` reveals only (no `tl.set` at time 0);
- animate transforms and opacity only, never `left`, `top`, `width` or letter-spacing;
- inline elements that transform need `display: inline-block`;
- no eyebrow or tag of its own unless it handles the fade itself: a custom scene gets no automatic
  chrome handover in fade transitions, so its chrome would overlap the neighbor's.

## After either option

Run `D build . --only <id>`, then `D check .`, and read the contact sheet. Lint errors name the
offending selector; fix them before rendering.

## Signature scene recipe

A signature scene is one visual metaphor designed only for this video: a sheet reshaping from A4
to Letter, a request packet traveling the real architecture. Build it with Option A:

1. Say the metaphor in one sentence (the direction's `motif`) and pick the 2-4 spoken words its
   beats land on. One scene, 8-15 s.
2. Copy the worked example below, or the closest built-in template, to
   `<project>/scenes/<newtype>.mjs` and keep only what the metaphor needs. Name the type after the
   metaphor (`sheet-reshape`, not `custom2`).
3. Draw it with kit pieces and CSS shapes in theme vars: cards, lines, docs, chips, icons. Move it
   with the kit's motion helpers, transforms and opacity only.
4. Put the words and beats in `data` with `at` cues, and resolve each with `c.cue(d.<field>.at,
   fallback)`, so the scene stays editable from scenes.json and lands on the narration.
5. Build and check it as above: lint 0 errors, check passed, and the contact sheet reads at a
   glance.

### Worked example: a sheet that reshapes

`<skill>/assets/examples/signature-sheet.mjs` draws a sheet of paper at its first size, with
dimension lines and labels, and counts the first size's numbers up. On each next size's cue the
sheet reshapes (scaleX and scaleY, never width or height), the dimension lines follow its edges, a
dashed ghost keeps the first outline, and the labels swap. Copy it to
`<project>/scenes/sheet-reshape.mjs` and set `"type": "sheet-reshape"`:

```json
{ "type": "sheet-reshape", "chapter": "Paper size", "say": "Every label printed on A4. Now each printer can switch to Letter, set per queue.",
  "data": { "title": "One setting per printer", "unit": "mm",
            "sizes": [{ "name": "A4", "width": 210, "height": 297, "at": "A4" }, { "name": "Letter", "width": 216, "height": 279, "at": "Letter" }],
            "note": { "text": "Set per queue", "at": "queue" } } }
```

Its data: `sizes` [{name, width, height, at?}] (2-3, in order; `width` and `height` in `unit`,
decimals allowed, such as 8.5 by 11 `in`), `unit?` (default `mm`), `title?`, `note?` {text, at?} (a
chip under the sheet). To adapt it, keep its shape: the layout computed in one place
(`sheetLayout`), the markup, then one function per beat (`revealFirstSize`, `reshapeTo`), each beat
on a cue from `data`.
