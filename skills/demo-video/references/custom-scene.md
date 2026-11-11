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
- **3D:** `k.iso` builds a 3D world of your own (a stage, objects at any x, y, z, labels, links, a camera that
  orbits, cranes, dollies and focuses); see the 3D signature scene recipe at the end. `k.is3d` is set once a stage exists.
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

## 3D signature scene recipe

When the content is spatial (layers a request passes through, parts joining a hub, a route, before and after), the
signature scene can be a 3D world of its own. It is built with `k.iso`, the kit behind iso-journey and iso-map without
their road, so no skill file is imported and a project template stays self-contained.

1. Say the spatial metaphor in one sentence ("a token goes through the layers and back"). Pick its **form**: a
   stack, an orbit (a hub and its parts), a grid or city, an exploded view, before and after worlds, a path.
2. Pick the **camera language** that serves the form: `orbit` (around a hub), `crane` (from the isometric tilt toward
   side-on, to separate layers), `dolly` (push in or back), `focus` (slide to a point). A follow-and-pull-back camera is
   for a route only. Each 3D scene of a video takes a different form or camera language.
3. Choose objects from the library (below) and name what each does on a spoken word: a lock opens, a layer lights, a
   token moves. Put the cue words in `data` as `at` and resolve each with `c.cue(d.<field>.at, fallback)`.
4. Build in this order: `stage = k.iso.stage()`, place objects, labels, links and pads, `stage.mount()`, then
   `camera = k.iso.camera(stage)` and the choreography (the camera must see every label, so it comes after them).
   The scene returns `{ chrome: true }`.
5. Build and check: read the contact sheet at several times (`D check . --mid` and a few snapshots). Everything must
   stay inside the 96 px margins and above y 900, names must not overlap, and nothing may sit under the top 110 px.

### `k.iso` reference

- `k.iso.stage({ tilt?, perspective?, plane?, floor?, motes? })` builds the scene's one stage (a second one stops
  the build) and marks the scene as 3D. Default tilt `{ x: 56, z: -36 }` degrees, perspective 2200, a 3600-unit plane:
  put things around `stage.center`. Units are plane pixels; z is height above the floor.
  - `stage.place(kind, { name, x, y, z?, hidden?, ...options })` returns `{ height, anchors, actions, move(to, t, opts),
    appear(t), run(action, t, args) }`. `move` takes `{ x, y, z, rotation, scale }`; `hidden` waits scaled to nothing
    until `appear(t)`. Unknown kinds and actions stop the build and name the valid ones.
  - `stage.label({ x, y, z, text, note?, name })` is a billboard pill; `show(t)` rises it. Keep names short.
  - `stage.link({ name, from, to, z?, color?, thickness? })` is a glowing line on the floor; `draw(t, { dur })` grows it.
  - `stage.pad({ name, x, y, w, d, h? })` is a slab with a lamp (`light(t)`, `dim(t)`); `stage.disc({ x, y, r, z?, dashed? })`
    a flat ring or rune; `stage.box({ x, y, w, d, h, z?, color, glow?, all? })` returns markup for `stage.add(html)`.
  - `stage.mount()` once, after everything is built.
- `k.iso.camera(stage)`, all moves seek-safe and chained (each starts where the last ended; call them in time order):
  `place({ focus, zoom, lift, dolly })` the opening view, `focus(t, { x, y }, { dur, zoom, lift })`,
  `orbit(t, { degrees, dur, ease })` (labels turn back, so they stay upright), `crane(t, { tilt, dur })`,
  `dolly(t, { z, dur })`. Do not overlap two moves of one kind. Keep an orbit under about 90 degrees when labels stand
  to one side: a label that swings behind an object is hidden by it.
- `k.iso.kinds` lists the objects. Static: `users server database queue printer document shield cloud phone container`.
  Acting (`placed.run(action, t, args)`): `lock` (`open`, `close`), `gear` (`spin` `{ turns, dur }`), `layers`
  (`light`, `dim` `{ index }`; `count` 2-6; `anchors.layerTop(i)` is the height of layer i, 0 the lowest), `scanner`
  (`sweep`: one way, then back), `crash` (`crack`, `crash`), `key` (`turn`), `token` (`pulse`; move it with `move`),
  `clock` (`advance` `{ by }` minutes). `k.iso.palette()` gives the world's colors (dark on dark themes).
- Units: about 1 px per plane unit at zoom 1, so a 440-wide slab is a quarter of the frame and `stage.center` is the
  middle. `tilt.x` is the view: 0 looks straight down, 90 is side-on (default 56). `lift` is screen pixels (the view sits
  lower), `dolly` z is plane units toward the lens (negative pulls back; clamped to -1200..900). Footprint x height:
  lock 180x90, 225 (shackle up); gear pair 330x200, 34; layers 440x300 per layer, 138 each (`anchors.size`, `layerTop`);
  scanner 380x240, 160; crash 180x160, 120 (the halves part to about 320 wide); key 230x90, 70; token 80; clock
  220x220, 30; users 300x300, 90; server 300x110, 190; database 200 round, 176; queue 360x120, 78; printer 240x170, 106;
  document 150, 180; shield 180, 190; cloud 220, 260; phone 100, 180; container 280x130, 120. Hidden objects collapse on
  every axis (`vanish(t, { z })` collapses them again). Icons on box walls turn with the wall: keep decoration symmetric.
- Rules: reveals are recorded by the kit (`appear`, `show`, `draw`, `place`); never fade a preserve-3d element (scale or
  move it; only leaf elements such as a lamp fade); no `Math.random` (seeded); transforms and opacity only.

### Worked 3D examples

Two project templates, each built with `k.iso` and each moving differently from iso-journey (no road, no packet, no
pull-back). They show the mechanics (stage, camera, cues): design your own form, objects and camera for this topic, and
never ship an example with only its data changed. Build warns when a project template equals a shipped example, and the
history catches a renamed copy of the last video's template. Start a template from one, then change what it is made of.

- `<skill>/assets/examples/signature-iso-stack.mjs`: layers stacked in space, a token descends through them in order
  (each layer lights, its name rises beside it) and rises back in reverse (each layer dims). The camera cranes toward
  side-on during the descent and orbits during the rise. Data: `layers` [{ name, note?, down?, up? }] (3-5, outermost
  first; `down` is where the token reaches the layer going in, `up` where it comes back).

```json
{ "type": "scope-stack", "chapter": "How it works", "say": "This runs on Request Scope, a new general hook at the end of every server request. Its lock participant records the locks a request takes and clears their marks. If that fails, or the request throws, the caller gets an error, not a false success, and the locks are released.",
  "data": { "layers": [{ "name": "Request Scope", "note": "the end-of-request hook", "down": "Scope", "up": "released" }, { "name": "Lock participant", "note": "records the locks", "down": "participant", "up": "throws" }, { "name": "Order locks", "note": "marks cleared", "down": "locks", "up": "clears" }] } }
```

- `<skill>/assets/examples/signature-iso-chain.mjs`: the whole development as a chain of events, 4-6 stops in a zigzag
  read left to right. On each stop's cue the link from the previous one grows, the object rises on its lit pad and its
  name shows; a stop can act on its own cue (a crate breaks, a clock runs, gears turn, a lock opens). The camera cranes
  from a flat, chart-like view into the 3D world. Made for a summary (`"summary": true`). Data: `stops` [{ title, kind,
  note?, at?, act?: { action, at?, args? } }]. Names sit at one height, so the zigzag keeps neighbours apart.

- `<skill>/assets/examples/signature-iso-orbit.mjs`: one central object on a ring with satellites around it. On each
  satellite's cue a line grows from the center, the satellite pops in on its pad and its name rises; the center can act
  once they are all joined. The camera orbits through the whole scene while it pushes in slowly. Data:
  `center` { title, kind?, note?, at?, do?: { action, at? } }, `satellites` [{ title, kind, note?, at? }] (3-5), `degrees?` (default: the turn near 140 that ends with no
  satellite directly behind or in front of the hub).

```json
{ "type": "scope-orbit", "chapter": "The idea", "say": "So the lock row, and its edit-order row, the row that marks an order as being edited, now carry a mark: the session number of the server process that wrote them. A number, not a token. Zero means no mark.",
  "data": { "center": { "title": "Lock row", "kind": "lock", "note": "holds the order", "at": "lock" }, "satellites": [{ "title": "Edit-order row", "kind": "document", "at": "edit-order" }, { "title": "Server session number", "kind": "server", "at": "session" }, { "title": "Zero: no mark", "kind": "token", "at": "Zero" }] } }
```
