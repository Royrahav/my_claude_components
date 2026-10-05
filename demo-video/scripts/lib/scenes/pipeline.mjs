// Architecture at a glance: 2-5 stations left to right, labelled links, chips under stations,
// optional dashed helpers, and a packet that travels the whole path at the end.
export default function pipeline(k, d, c) {
  const { p, css, html } = k;
  const st = d.stations ?? [];
  const n = st.length;
  const links = d.links ?? [];
  const gap = n >= 5 ? 90 : 115;
  const w = Math.min(380, Math.floor((1728 - (n - 1) * gap) / n));
  const left0 = 96 + Math.floor((1728 - (n * w + (n - 1) * gap)) / 2);
  const top = d.title ? 300 : 250;
  const hgt = 240;
  const midY = top + hgt / 2;
  const xs = st.map((_, i) => left0 + i * (w + gap));
  const auto = c.spread(n, c.first + 0.4, c.last - 0.6);

  css.push(`.${p("st")}{position:absolute;top:${top}px;width:${w}px;height:${hgt}px;box-sizing:border-box;background:var(--tint);border:2px solid var(--line);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:0 16px;text-align:center}
.${p("st")}.${p("hero")}{background:var(--surface);border:3px solid var(--accent)}
.${p("stt")}{font:700 ${w < 330 ? 26 : 30}px/1.2 var(--font-display);color:var(--ink)}
.${p("ln")}{position:absolute;top:${midY - 2}px;height:4px;background:var(--accent);border-radius:2px;transform-origin:left center}
.${p("lk")}{position:absolute;top:${midY - 58}px;display:flex;justify-content:center}
.${p("under")}{position:absolute;top:${top + hgt + 24}px;width:${w}px;display:flex;flex-direction:column;align-items:center;gap:10px}
.${p("help")}{position:absolute;top:770px;width:400px;display:flex;justify-content:center}
.${p("hl")}{position:absolute;top:${midY + 2}px;height:${770 - midY - 2}px;border-left:3px dashed var(--light);transform-origin:top center}
.${p("pk")}{position:absolute;top:${midY - 13}px;width:26px;height:26px;border-radius:50%;background:var(--accent-text);border:4px solid var(--surface);box-sizing:border-box}`);
  if (d.title) {
    html.push(`<div id="${p("h")}" class="${p("h2")}">${k.esc(d.title)}</div>`);
    k.rise("h", 0.2);
  }

  const T = st.map((s, i) => c.cue(s.at, auto[i]));
  st.forEach((s, i) => {
    html.push(`<div id="${p(`s${i}`)}" class="${p("st")}${s.hero ? ` ${p("hero")}` : ""}" style="left:${xs[i]}px">${k.icon(s.icon ?? "layers", { size: 76 })}<div class="${p("stt")}">${k.esc(s.title)}</div></div>`);
    k.grow(`s${i}`, T[i], 0.6);
    const under = [...(s.chips ?? []).map((t) => k.chip(t, { tone: "accent" })), ...(s.code ? [`<span class="${p("code")}">${k.esc(s.code)}</span>`] : [])];
    if (under.length) {
      html.push(`<div id="${p(`u${i}`)}" class="${p("under")}" style="left:${xs[i]}px">${under.join("")}</div>`);
      k.rise(`u${i}`, T[i] + 0.45, 14, 0.45);
    }
    if (i > 0) {
      const lx = xs[i - 1] + w;
      html.push(`<div id="${p(`l${i}`)}" class="${p("ln")}" style="left:${lx}px;width:${gap}px"></div>`);
      k.draw(`l${i}`, Math.max(0.2, T[i] - 0.45), 0.45);
      const L = links[i - 1];
      if (L?.label) {
        html.push(`<div id="${p(`k${i}`)}" class="${p("lk")}" style="left:${lx - 30}px;width:${gap + 60}px">${L.mono ? `<span class="${p("code")}" style="font-size:20px;padding:4px 12px">${k.esc(L.label)}</span>` : k.chip(L.label, { size: 20 })}</div>`);
        k.pop(`k${i}`, c.cue(L.at, T[i] - 0.1), 0.4);
      }
    }
  });

  (d.helpers ?? []).forEach((hp, j) => {
    const cx = hp.link != null ? xs[hp.link] + w + gap / 2 : xs[hp.under ?? 0] + w / 2;
    const t = c.cue(hp.at, Math.max(T[n - 1] + 0.8, c.last - 1.6));
    if (hp.link != null) {
      html.push(`<div id="${p(`hl${j}`)}" class="${p("hl")}" style="left:${cx - 1}px"></div>`);
      k.drawY(`hl${j}`, t, 0.5);
    }
    html.push(`<div id="${p(`hp${j}`)}" class="${p("help")}" style="left:${Math.max(96, Math.min(1824 - 400, cx - 200))}px">${k.chip(hp.text, { tone: "neutral", dashed: true })}</div>`);
    k.fade(`hp${j}`, t + (hp.link != null ? 0.4 : 0), 0.6);
  });

  if (d.packet !== false && n > 1) {
    const t0 = Math.max(T[n - 1] + 1.0, c.duration - 3.2);
    html.push(`<div id="${p("pk")}" class="${p("pk")}" style="left:${xs[0] + w / 2 - 13}px"></div>`);
    k.pop("pk", t0, 0.3);
    const legs = n - 1;
    const per = Math.min(0.7, Math.max(0.35, (c.duration - t0 - 0.8) / legs));
    for (let i = 1; i < n; i++) k.to("pk", t0 + 0.3 + (i - 1) * per, { x: xs[i] - xs[0] }, per, "power1.inOut");
    k.sound("whoosh", t0, 0.35);
  }
  k.ambient();
  return { chrome: true };
}
