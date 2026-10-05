# Custom scenes

Use this only when no template can show the idea. Try first to reshape the content for a
template, because templates are already tested for layout, contrast and timing.

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
- **Sound and ambience:** `k.sound("whoosh" | "click" | "pop" | "chime" | "typing", t, volume?)`.
  End with `k.ambient()` (the background drift every scene has). It also pushes the camera from
  scale 1 to 1.02, so the contact sheet shows edge content about 17 px further out than placed:
  lay out against the unscaled margins.
- **Context:** `k.theme` (colors, derived text colors), `k.brief`, `k.duration`, `k.hasLogo`.

**`c`, the cues:** `c.cue(at, fallback)` gives seconds; `c.first` and `c.last` are the first and
last spoken word; `c.spread(n, from?, to?)` gives n evenly spaced times; `c.duration`.

**Layout rules:**
- The canvas is 1920x1080, with 96px side margins.
- Keep everything above y=900: the caption band sits below that.
- The chrome takes the top 110px.
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
- inline elements that transform need `display: inline-block`.

## After either option

Run `D build . --only <id>`, then `D check .`, and read the contact sheet. Lint errors name the
offending selector; fix them before rendering.
