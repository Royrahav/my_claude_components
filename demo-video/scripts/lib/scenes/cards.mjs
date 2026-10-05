// 2-4 cards in a row (setup steps, features, enablement): number or icon, title, optional toggle
// that flips on, code lines that type in, tags and text; optional footer chip.
export default function cards(k, d, c) {
  const { p, css, html } = k;
  const C = d.cards ?? [];
  const n = C.length;
  const gap = 36;
  const w = Math.floor((1728 - (n - 1) * gap) / n);
  const top = d.title ? 290 : 220;
  const auto = c.spread(n + (d.footer ? 1 : 0), c.first + 0.8, c.last - 0.3);

  css.push(`.${p("cd")}{position:absolute;top:${top}px;width:${w}px;min-height:420px;box-sizing:border-box;background:var(--surface);border:2px solid var(--line);border-radius:14px;padding:30px 30px;display:flex;flex-direction:column;gap:16px}
.${p("num")}{font:900 54px/1 var(--font-body);color:var(--accent-large)}
.${p("cdt")}{font:700 30px/1.22 var(--font-display);color:var(--ink)}
.${p("ln2")}{font:400 22px/1.4 var(--font-mono);color:var(--accent2-text);background:var(--surface);border:2px solid var(--nline);border-radius:10px;padding:6px 14px;white-space:nowrap;align-self:flex-start;max-width:100%;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box}
.${p("tags")}{display:flex;flex-wrap:wrap;gap:10px}
.${p("txt")}{font:400 24px/1.45 var(--font-body);color:var(--muted)}
.${p("ft")}{position:absolute;left:96px;top:${top + 470}px}`);
  if (d.title) {
    html.push(`<div id="${p("h")}" class="${p("h2")}">${k.esc(d.title)}</div>`);
    k.rise("h", 0.2);
  }
  C.forEach((cd, i) => {
    const t = c.cue(cd.at, auto[i]);
    const head = cd.num != null ? `<div class="${p("num")}">${k.esc(cd.num)}</div>` : cd.icon ? k.icon(cd.icon, { size: 64 }) : "";
    const parts = [head, `<div class="${p("cdt")}">${k.esc(cd.title)}</div>`];
    if (cd.toggle) parts.push(`<div class="${p("row")}">${k.toggle(false, { id: `tg${i}` })}${cd.toggle_label ? `<span class="${p("txt")}">${k.esc(cd.toggle_label)}</span>` : ""}</div>`);
    (cd.code ?? []).forEach((l, j) => parts.push(`<div id="${p(`c${i}_${j}`)}" class="${p("ln2")}">${k.esc(l)}</div>`));
    if (cd.tags?.length) parts.push(`<div class="${p("tags")}">${cd.tags.map((g, j) => k.chip(g, { tone: "navy", size: 20, id: `g${i}_${j}` })).join("")}</div>`);
    if (cd.text) parts.push(`<div class="${p("txt")}">${k.esc(cd.text)}</div>`);
    html.push(`<div id="${p(`cd${i}`)}" class="${p("cd")}" style="left:${96 + i * (w + gap)}px">${parts.join("")}</div>`);
    k.rise(`cd${i}`, t, 30, 0.6);
    if (cd.toggle) {
      k.flip(`tg${i}`, t + 0.7);
      k.sound("click", t + 0.7, 0.7);
    }
    (cd.code ?? []).forEach((_, j) => k.type(`c${i}_${j}`, t + 0.5 + j * 0.6, 0.6));
    (cd.tags ?? []).forEach((_, j) => k.pop(`g${i}_${j}`, t + 0.9 + j * 0.3));
  });
  if (d.footer) {
    html.push(`<div id="${p("ft")}" class="${p("ft")}">${k.chip(d.footer.text ?? d.footer, { tone: "accent", icon: "check" })}</div>`);
    k.rise("ft", c.cue(d.footer.at, auto[n]), 16);
  }
  k.ambient();
  return { chrome: true };
}
