// Proof: optional badge, 2-4 count-up stat cards (one hero), 1-2 bar comparison groups with labelled
// rows on one scale, chips (optionally with a count-up {n}), and a footnote that appears with the
// first bar (numbers never appear without their caveat).
export default function metrics(k, d, c) {
  const { p, css, html } = k;
  const S = d.stats ?? [];
  const G = d.bars ?? [];
  const chips = d.chips ?? [];
  const auto = c.spread(S.length + G.length + chips.length + 1, c.first + 0.4, c.last - 0.4);
  let ti = 0;
  const statTop = d.badge ? 230 : 170;
  const sgap = 23;
  const sw = Math.floor((1728 - (S.length - 1) * sgap) / Math.max(1, S.length));
  const barTop = statTop + 190 + 50;

  css.push(`.${p("bd")}{position:absolute;left:96px;top:150px}
.${p("m")}{position:absolute;top:${statTop}px;width:${sw}px;height:190px;box-sizing:border-box;background:var(--surface);border:2px solid var(--line);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:30px}
.${p("m")}.${p("hero")}{border:3px solid var(--accent)}
.${p("n")}{font:900 72px/1 var(--font-body);color:var(--ink);font-variant-numeric:tabular-nums}
.${p("hero")} .${p("n")}{font-size:86px;margin-top:-8px;color:var(--accent-large)}
.${p("ml")}{margin-top:12px;font:700 22px/1.2 var(--font-body);color:var(--muted);text-align:center;padding:0 12px}
.${p("ms")}{margin-top:4px;font:700 19px/1.2 var(--font-body);color:var(--muted)}
.${p("gl")}{position:absolute;top:${barTop}px}
.${p("br")}{position:absolute;display:flex;flex-direction:column;gap:6px}
.${p("bn")}{font:700 20px/1.2 var(--font-body);color:var(--muted);white-space:nowrap}
.${p("bl")}{display:flex;align-items:center;gap:14px}
.${p("bar")}{height:34px;border-radius:8px;flex:none}
.${p("bv")}{font:700 24px/1 var(--font-body);color:var(--ink);white-space:nowrap}
.${p("chips")}{position:absolute;left:96px;display:flex;gap:14px;flex-wrap:wrap}`);

  if (d.badge) {
    html.push(`<div id="${p("bd")}" class="${p("bd")}">${k.chip(d.badge.text ?? d.badge, { icon: d.badge.icon ?? "check" })}</div>`);
    k.slide("bd", c.cue(d.badge.at, 0.5), -24, 0.5);
  }
  S.forEach((s, i) => {
    const dec = s.decimals ?? 0;
    const label = `${s.prefix ?? ""}<span id="${p(`v${i}`)}">${s.count === false ? k.esc(s.value) : (0).toFixed(dec)}</span>${s.suffix ?? ""}`;
    html.push(`<div id="${p(`m${i}`)}" class="${p("m")}${s.hero ? ` ${p("hero")}` : ""}" style="left:${96 + i * (sw + sgap)}px"><div class="${p("n")}">${label}</div><div class="${p("ml")}">${k.esc(s.label)}</div>${s.sub ? `<div class="${p("ms")}">${k.esc(s.sub)}</div>` : ""}</div>`);
    const t = c.cue(s.at, auto[ti++]);
    if (s.hero) {
      k.grow(`m${i}`, t, 0.6);
      k.sound("pop", t + 0.1, 0.65);
    } else k.rise(`m${i}`, t, 24, 0.6);
    if (s.count !== false && typeof s.value === "number" && s.value !== 0) k.count(`v${i}`, s.value, t, s.hero ? 0.6 : 1.0, dec, s.value >= 10000);
  });

  let firstBar = null;
  const gw = G.length > 1 ? 820 : 1728;
  G.forEach((g, gi) => {
    const x = 96 + gi * (gw + 84);
    const max = Math.max(...g.rows.map((r) => r.value));
    const room = gw - 230;
    const t = c.cue(g.at, auto[ti++]);
    if (firstBar === null) firstBar = t;
    html.push(`<div id="${p(`gl${gi}`)}" class="${p("gl")} ${p("label")}" style="left:${x}px">${k.esc(g.title)}</div>`);
    k.rise(`gl${gi}`, t - 0.3, 12, 0.45);
    g.rows.forEach((r, ri) => {
      const wpx = Math.max(12, Math.round((r.value / max) * room));
      const tone = r.tone ?? (ri === 0 ? "accent" : "navy");
      const color = tone === "navy" ? "var(--accent2)" : tone === "bad" ? "var(--danger)" : "var(--accent)";
      html.push(`<div id="${p(`r${gi}_${ri}`)}" class="${p("br")}" style="left:${x}px;top:${barTop + 40 + ri * 74}px"><div class="${p("bn")}">${k.esc(r.label)}</div><div class="${p("bl")}"><div id="${p(`b${gi}_${ri}`)}" class="${p("bar")}" style="width:${wpx}px;background:${color}"></div><div class="${p("bv")}">${k.esc(r.display ?? r.value)}</div></div></div>`);
      const tr = t + ri * 0.7;
      k.fade(`r${gi}_${ri}`, tr, 0.3);
      k.js.push(`tl.fromTo("#${p(`b${gi}_${ri}`)}",{width:0},{width:${wpx},duration:0.9,ease:"power2.out"},${tr});`);
    });
  });

  const chipsTop = G.length ? barTop + 40 + Math.max(...G.map((g) => g.rows.length)) * 74 + 30 : statTop + 240;
  if (chips.length) {
    html.push(`<div class="${p("chips")}" style="top:${Math.min(chipsTop, 760)}px">${chips.map((ch, i) => {
      const text = k.esc(ch.text ?? ch).replace("{n}", `<span id="${p(`cn${i}`)}">0</span>`);
      return `<span id="${p(`ch${i}`)}" class="${p("chip")} ${p("t-accent")}" style="height:52px;font-size:24px">${text}</span>`;
    }).join("")}</div>`);
    chips.forEach((ch, i) => {
      const t = c.cue(ch.at, auto[ti++]);
      k.pop(`ch${i}`, t);
      if (typeof ch.count === "number") k.count(`cn${i}`, ch.count, t, 1.2, 0, ch.count >= 1000);
    });
  }
  if (d.footnote) {
    html.push(`<div id="${p("fn")}" class="${p("foot")}" style="left:96px;top:820px">${k.esc(d.footnote.text ?? d.footnote)}</div>`);
    k.fade("fn", c.cue(d.footnote.at, (firstBar ?? auto[0]) + 0.2), 0.6);
  }
  k.ambient();
  return { chrome: true };
}
