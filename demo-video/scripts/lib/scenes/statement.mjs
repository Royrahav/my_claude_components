// Status/availability: one big statement card (eyebrow, big text, sub line with icon) plus a column
// of status chips (good / neutral / bad).
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

  const TONE = { good: ["accent", "check"], bad: ["bad", "cross"], neutral: ["neutral", null], navy: ["navy", null], accent: ["accent", null] };
  html.push(`<div class="${p("cs")}">${chips.map((ch, i) => {
    const [tone, icon] = TONE[ch.tone ?? "good"] ?? TONE.good;
    return k.chip(ch.text ?? ch, { tone, icon: ch.icon ?? icon, id: `c${i}`, size: 28 });
  }).join("")}</div>`);
  chips.forEach((ch, i) => k.slide(`c${i}`, c.cue(ch.at, auto[i + 1]), 40, 0.5));
  k.ambient();
  return { chrome: true };
}
