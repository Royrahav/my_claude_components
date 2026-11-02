// Developer beat: a code/config/command block (<= 12 short lines) that types in, with lines
// highlighted on their cues and an optional note. Keep it to what the narration explains.
export default function code(k, d, c) {
  const { p, css, html } = k;
  const lines = d.lines ?? [];
  const top = d.title ? 270 : 190;
  const hl = d.highlights ?? [];

  css.push(`.${p("cb")}{position:absolute;left:96px;top:${top}px;width:1728px;box-sizing:border-box;background:var(--surface);border:2px solid var(--nline);border-radius:14px;padding:28px 34px}
.${p("cr")}{position:relative;display:flex;gap:26px;font:400 28px/1.6 var(--font-mono);white-space:pre}
.${p("no")}{width:40px;text-align:right;color:var(--light);flex:none}
.${p("tx")}{color:var(--accent2-text);position:relative}
.${p("hlb")}{position:absolute;left:-12px;right:-12px;top:2px;bottom:2px;background:var(--tint2);border-left:4px solid var(--accent);border-radius:6px;transform-origin:left center}`);
  if (d.title) {
    html.push(`<div id="${p("h")}" class="${p("h2")}">${k.esc(d.title)}</div>`);
    k.rise("h", 0.2);
  }
  html.push(`<div id="${p("cb")}" class="${p("cb")}">${d.file ? `<div class="${p("label")}" style="margin-bottom:14px">${k.esc(d.file)}</div>` : ""}${lines
    .map((l, i) => `<div class="${p("cr")}">${hl.some((h) => h.line === i + 1) ? `<i id="${p(`hb${i}`)}" class="${p("hlb")}"></i>` : ""}<span class="${p("no")}">${i + 1}</span><span id="${p(`l${i}`)}" class="${p("tx")}">${k.esc(l)}</span></div>`)
    .join("")}</div>`);
  k.rise("cb", 0.3, 20, 0.6);
  const t0 = c.cue(d.at, 0.7);
  const per = Math.min(0.5, Math.max(0.18, (c.last - t0 - 1) / Math.max(1, lines.length)));
  lines.forEach((_, i) => k.type(`l${i}`, t0 + i * per, Math.max(0.25, per)));
  k.sound("typing", t0, 0.35);
  hl.forEach((h, j) => k.draw(`hb${h.line - 1}`, c.cue(h.at, t0 + lines.length * per + 0.4 + j * 0.8), 0.5));
  if (d.note) {
    html.push(`<div id="${p("nt")}" class="${p("foot")}" style="left:96px;top:820px">${k.esc(d.note.text ?? d.note)}</div>`);
    k.fade("nt", c.cue(d.note.at, c.last - 0.6), 0.6);
  }
  k.ambient();
  return { chrome: true };
}
