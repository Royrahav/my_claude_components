// A beat: one to four words, or a number, punched in huge at the center. Punctuation between longer
// scenes: silent, or with one short spoken line. Variant: invert (solid accent background, inverted text).
const MAX_WORDS = 4;
const SIZES = [[6, 320], [12, 250], [20, 190], [32, 150]]; // [longest text in characters, font size]
const SIZE_MIN = 120;
const PUNCH_AT = 0.15;
const SUB_DELAY = 0.5;
const SUB_FADE = 0.5;
const PUNCH_IN = 0.45;
const TAIL = 0.1; // the sub finishes fading this long before the scene ends
const POP_VOLUME = 0.4;

export default function beat(k, d, c) {
  return drawBeat(k, d, c, { fill: false });
}

// invert ----------------------------------------------------------------------------------------------

// The accent fills the frame and the text takes its readable inverse, as the full-bleed statement does.
function invertBeat(k, d, c) {
  return drawBeat(k, d, c, { fill: true });
}

function drawBeat(k, d, c, { fill }) {
  const { p, css, html } = k;
  const text = beatText(k, d);
  const { t0, scale } = timing(c, d);
  const size = (SIZES.find(([chars]) => text.length <= chars) ?? [0, SIZE_MIN])[1];
  const ink = fill ? "var(--on-accent)" : "var(--ink)";

  css.push(`.${p("fill")}{position:absolute;inset:-60px;background:var(--accent-text)}
.${p("bt")}{position:absolute;left:96px;width:1728px;top:150px;height:${d.sub ? 520 : 710}px;display:flex;align-items:center;justify-content:center;text-align:center;font:900 ${size}px/1.02 var(--font-display);color:${ink}}
.${p("bs")}{position:absolute;left:96px;width:1728px;top:690px;text-align:center;font:700 44px/1.25 var(--font-display);color:${fill ? "var(--on-accent)" : "var(--muted)"}}`);
  if (fill) html.push(`<div id="${p("fill")}" class="${p("fill")}"></div>`);
  html.push(`<div id="${p("bt")}" class="${p("bt")}">${k.esc(text)}</div>`);
  if (d.sub) html.push(`<div id="${p("bs")}" class="${p("bs")}">${k.esc(d.sub)}</div>`);

  if (fill) k.fade("fill", 0, 0.15);
  k.punch("bt", t0, PUNCH_IN * scale);
  if (d.sub) k.fade("bs", t0 + SUB_DELAY * scale, SUB_FADE * scale);
  k.sound("pop", t0, POP_VOLUME);
  k.ambient();
  return { chrome: false };
}

// When the punch starts, and the factor that squeezes the punch and the sub fade (1 = as designed) so
// they finish before the scene ends: a late `at` is pulled back, a scene too short for the design is compressed.
function timing(c, d) {
  const need = d.sub ? SUB_DELAY + SUB_FADE : PUNCH_IN;
  const t0 = Math.min(c.cue(d.at, PUNCH_AT), Math.max(0.05, c.duration - TAIL - need));
  return { t0, scale: Math.min(1, Math.max(0.1, c.duration - TAIL - t0) / need) };
}

// The text, one to four words (a number counts as one); anything else stops the build.
function beatText(k, d) {
  const text = k.need(d, "text", "beat").trim();
  if (text.split(/\s+/).length > MAX_WORDS) throw new Error(`${k.id}: beat data.text must be at most ${MAX_WORDS} words, got ${JSON.stringify(text)}`);
  return text;
}

export const variants = { invert: invertBeat };
