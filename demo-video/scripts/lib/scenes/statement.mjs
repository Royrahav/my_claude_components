// Status/availability: one big statement card (eyebrow, big text, sub line with icon) plus a column
// of status chips (good / neutral / bad).
// Variant: full-bleed (the statement, huge, on a band of solid accent across the frame).
const CHIP_TONES = { good: ["accent", "check"], bad: ["bad", "cross"], neutral: ["neutral", null], navy: ["navy", null], accent: ["accent", null] };

export default function statement(k, d, c) {
  const { p, css, html } = k;
  const chips = d.chips ?? [];
  const auto = c.spread(chips.length + 1, c.first + 0.4, c.last - 0.3);
  const t0 = c.cue(d.at, 0.3);

  css.push(`.${p("big")}{position:absolute;left:96px;top:210px;width:880px;min-height:420px;box-sizing:border-box;background:var(--surface);border:3px solid var(--accent);border-radius:14px;padding:44px 48px;display:flex;flex-direction:column;justify-content:center;gap:18px}
.${p("bt")}{font:900 ${String(d.big ?? "").length > 12 ? 92 : 116}px/1.02 var(--font-body);color:var(--accent-large)}
.${p("bs")}{display:flex;align-items:center;gap:16px;font:700 36px/1.2 var(--font-display);color:var(--ink)}
.${p("cs")}{position:absolute;left:1040px;top:250px;display:flex;flex-direction:column;align-items:flex-start;gap:26px}`);
  html.push(`<div id="${p("big")}" class="${p("big")}">${d.eyebrow ? `<div class="${p("label")}">${k.esc(d.eyebrow)}</div>` : ""}<div id="${p("bt")}" class="${p("bt")}">${k.esc(d.big)}</div>${d.sub ? `<div id="${p("bs")}" class="${p("bs")}">${d.icon ? k.icon(d.icon, { size: 44 }) : ""}<span>${k.esc(d.sub)}</span></div>` : ""}</div>`);
  k.grow("big", t0, 0.8);
  k.rise("bt", t0 + 0.3, 24, 0.6);
  if (d.sub) k.fade("bs", t0 + 1.0, 0.6);
  k.sound("chime", t0 + 0.3, 0.5);

  html.push(`<div class="${p("cs")}">${chips.map((ch, i) => statusChip(k, ch, { id: `c${i}` })).join("")}</div>`);
  chips.forEach((ch, i) => k.slide(`c${i}`, c.cue(ch.at, auto[i + 1]), 40, 0.5));
  k.ambient();
  return { chrome: true };
}

// A chip's tone defaults to good; good and bad chips get a check or a cross unless they name an icon.
function statusChip(k, ch, options = {}) {
  const [tone, icon] = CHIP_TONES[ch.tone ?? "good"] ?? CHIP_TONES.good;
  return k.chip(ch.text ?? ch, { tone, icon: ch.icon ?? icon, size: 28, ...options });
}

// full-bleed ------------------------------------------------------------------------------------------

const BAND = { top: 150, height: 710 }; // below the chrome, above the captions
const BAND_IN = 0.7;
const BIG_SIZES = [[8, 220], [14, 170], [22, 128]]; // [longest text in characters, font size]
const BIG_MIN = 100;

// The band wipes in, then the statement in the accent's readable text color; each chip sits on a
// surface pill so its own colors stay readable on the accent.
function fullBleedStatement(k, d, c) {
  const { p, css, html } = k;
  const chips = d.chips ?? [];
  const auto = c.spread(chips.length + 1, c.first + 0.4, c.last - 0.3);
  const t0 = c.cue(d.at, 0.3);
  const big = String(d.big ?? "");
  const size = BIG_SIZES.find(([chars]) => big.length <= chars)?.[1] ?? BIG_MIN;
  const box = `top:${BAND.top}px;height:${BAND.height}px`;

  css.push(`.${p("band")}{position:absolute;left:0;width:1920px;${box};background:var(--accent-text);transform-origin:left center}
.${p("fb")}{position:absolute;left:96px;width:1728px;${box};box-sizing:border-box;padding:48px 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;text-align:center}
.${p("fe")}{font:700 24px/1.2 var(--font-body);letter-spacing:.1em;text-transform:uppercase;color:var(--on-accent)}
.${p("bt")}{font:900 ${size}px/1.02 var(--font-body);color:var(--on-accent);max-width:1728px}
.${p("bs")}{display:flex;align-items:center;gap:18px;font:700 44px/1.2 var(--font-display);color:var(--on-accent)}
.${p("cs")}{display:flex;flex-wrap:wrap;justify-content:center;gap:22px;margin-top:20px}
.${p("cb")}{display:inline-flex;border-radius:100px;background:var(--surface)}`);
  const eyebrow = d.eyebrow ? `<div id="${p("fe")}" class="${p("fe")}">${k.esc(d.eyebrow)}</div>` : "";
  const sub = d.sub ? `<div id="${p("bs")}" class="${p("bs")}">${d.icon ? k.icon(d.icon, { size: 52, color: "var(--on-accent)" }) : ""}<span>${k.esc(d.sub)}</span></div>` : "";
  const chipRow = chips.length ? `<div class="${p("cs")}">${chips.map((ch, i) => `<span id="${p(`c${i}`)}" class="${p("cb")}">${statusChip(k, ch)}</span>`).join("")}</div>` : "";
  html.push(`<div id="${p("band")}" class="${p("band")}"></div><div class="${p("fb")}">${eyebrow}<div id="${p("bt")}" class="${p("bt")}">${k.esc(big)}</div>${sub}${chipRow}</div>`);

  k.draw("band", t0, BAND_IN);
  if (d.eyebrow) k.fade("fe", t0 + 0.3, 0.5);
  k.rise("bt", t0 + 0.35, 30, 0.6);
  if (d.sub) k.fade("bs", t0 + 1.0, 0.6);
  // A chip never lands before the band is in behind it.
  chips.forEach((ch, i) => k.rise(`c${i}`, Math.max(c.cue(ch.at, auto[i + 1]), t0 + BAND_IN), 20, 0.5));
  k.sound("whoosh", t0, 0.35);
  k.sound("chime", t0 + 0.3, 0.5);
  k.ambient();
  return { chrome: true };
}

export const variants = { "full-bleed": fullBleedStatement };
