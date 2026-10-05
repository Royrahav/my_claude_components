// General fallback: headline + 2-6 cards (icon, title, short text) in a row or a 2-row grid.
export default function bullets(k, d, c) {
  const { p, css, html } = k;
  const items = d.items ?? [];
  const n = items.length;
  const cols = n <= 3 ? n : Math.ceil(n / 2);
  const rowsN = Math.ceil(n / cols);
  const scale = rowsN === 1 ? 1.25 : 1; // a single row is sparse: larger cards
  const px = (v) => Math.round(v * scale);
  const gap = 32;
  const w = Math.floor((1728 - (cols - 1) * gap) / cols);
  const h = px(rowsN === 1 ? 300 : 260);
  const top = k.centeredTop(rowsN * h + (rowsN - 1) * gap, { title: Boolean(d.title) });
  const auto = c.spread(n, c.first + 0.6, c.last - 0.3);

  css.push(`.${p("bc")}{position:absolute;width:${w}px;height:${h}px;box-sizing:border-box;background:var(--surface);border:2px solid var(--line);border-radius:14px;padding:${px(30)}px;display:flex;flex-direction:column;justify-content:center;gap:${px(14)}px}
.${p("bt")}{font:700 ${px(30)}px/1.22 var(--font-display);color:var(--ink)}
.${p("bx")}{font:400 ${px(23)}px/1.45 var(--font-body);color:var(--muted)}`);
  if (d.title) {
    html.push(`<div id="${p("h")}" class="${p("h2")}">${k.esc(d.title)}</div>`);
    k.rise("h", 0.2);
  }
  items.forEach((it, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    html.push(`<div id="${p(`b${i}`)}" class="${p("bc")}" style="left:${96 + col * (w + gap)}px;top:${top + row * (h + gap)}px">${it.icon ? k.icon(it.icon, { size: px(56) }) : ""}<div class="${p("bt")}">${k.esc(it.title)}</div>${it.text ? `<div class="${p("bx")}">${k.esc(it.text)}</div>` : ""}</div>`);
    k.rise(`b${i}`, c.cue(it.at, auto[i]), 28, 0.6);
  });
  k.ambient();
  return { chrome: true };
}
