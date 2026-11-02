// Decision among options: cards appear in a row; on the decision cue the chosen one glides left
// and grows, the others dim into a right-hand column; optional headline, struck "No X" chips and an
// arrow to a target icon.
export default function options(k, d, c) {
  const { p, css, html } = k;
  const opts = d.options ?? [];
  const n = opts.length;
  const chosenIdx = Math.max(0, opts.findIndex((o) => o.chosen));
  const drops = d.drops ?? [];
  const auto = c.spread(n + 2 + drops.length);
  const gap = 28;
  const w = Math.min(380, Math.floor((1728 - (n - 1) * gap) / n));
  const h = 250;
  const rowLeft = 96 + Math.floor((1728 - (n * w + (n - 1) * gap)) / 2);
  const top = 330;

  css.push(`.${p("opt")}{position:absolute;top:${top}px;width:${w}px;height:${h}px;transform-origin:0 0}
.${p("sh")}{position:absolute;inset:0;background:var(--tint);border:2px solid var(--line);border-radius:14px}
.${p("in")}{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:0 20px;text-align:center}
.${p("ot")}{font:700 30px/1.2 var(--font-display);color:var(--ink)}
.${p("on")}{font:400 20px/1.3 var(--font-body);color:var(--muted)}
.${p("ck")}{position:absolute;right:16px;top:16px;width:46px;height:46px;border-radius:50%;background:var(--accent-text);display:flex;align-items:center;justify-content:center}
.${p("hl")}{position:absolute;left:${96 + Math.round(w * 1.12) + 64}px;top:200px;max-width:${1440 - (96 + Math.round(w * 1.12) + 64) - 40}px;font:700 56px/1.12 var(--font-display);color:var(--ink)}
.${p("drops")}{position:absolute;left:96px;top:${180 + Math.round(h * 1.12) + 44}px;display:flex;gap:14px;flex-wrap:wrap;max-width:1300px}
.${p("arr")}{position:absolute;left:${96 + Math.round(w * 1.12) + 64}px;top:400px;width:520px;height:4px}
.${p("al")}{position:absolute;left:${96 + Math.round(w * 1.12) + 64 + 200}px;top:350px}
.${p("ai")}{position:absolute;left:${96 + Math.round(w * 1.12) + 64 + 540}px;top:368px}`);

  opts.forEach((o, i) => {
    const chosen = i === chosenIdx;
    html.push(`<div id="${p(`o${i}`)}" class="${p("opt")}" style="left:${rowLeft + i * (w + gap)}px"><div id="${p(`sh${i}`)}" class="${p("sh")}"></div><div class="${p("in")}">${o.icon ? k.icon(o.icon, { size: 64, id: `ic${i}` }) : ""}<div id="${p(`t${i}`)}" class="${p("ot")}">${k.esc(o.title)}</div>${o.note ? `<div class="${p("on")}">${k.esc(o.note)}</div>` : ""}</div>${chosen ? `<div id="${p("ck")}" class="${p("ck")}">${k.icon("check", { size: 30, color: "var(--on-accent)" })}</div>` : ""}</div>`);
    k.pop(`o${i}`, c.cue(o.at, auto[i]), 0.5);
  });

  const Td = c.cue(d.decide_at, auto[n]);
  // chosen glides to the left slot and grows; the rest dim into a right column
  const cx = 96 - (rowLeft + chosenIdx * (w + gap));
  k.to(`o${chosenIdx}`, Td, { x: cx, y: 180 - top, scale: 1.12 }, 1.0, "power3.inOut");
  k.to(`sh${chosenIdx}`, Td, { backgroundColor: k.theme.colors.surface, borderColor: k.theme.colors.accent }, 0.4);
  k.pop("ck", Td + 0.7);
  k.sound("pop", Td + 0.7, 0.6);
  const others = opts.map((_, i) => i).filter((i) => i !== chosenIdx);
  const sc = others.length >= 4 ? 0.62 : 0.7;
  const step = others.length >= 4 ? 175 : 190;
  others.forEach((i, j) => {
    const fx = 1824 - Math.round(w * sc) - (rowLeft + i * (w + gap));
    k.to(`sh${i}`, Td - 0.2, { opacity: 0.6 }, 0.5);
    if (opts[i].icon) k.to(`ic${i}`, Td - 0.2, { opacity: 0.6 }, 0.5);
    k.to(`t${i}`, Td - 0.2, { color: k.theme.derived.lightText }, 0.5);
    k.to(`o${i}`, Td + 0.1 + j * 0.06, { x: fx, y: 180 + j * step - top, scale: sc }, 1.0, "power3.inOut");
  });

  if (d.headline) {
    html.push(`<div id="${p("hl")}" class="${p("hl")}">${k.esc(d.headline)}</div>`);
    k.rise("hl", c.cue(d.headline_at, Td + 1.2), 26, 0.6);
  }
  if (drops.length) {
    html.push(`<div class="${p("drops")}">${drops.map((x, i) => k.chip(`No ${x.text}`, { id: `d${i}`, strike: false })).join("")}</div>`);
    drops.forEach((x, i) => k.pop(`d${i}`, c.cue(x.at, auto[n + 2 + i]), 0.45));
  }
  if (d.arrow) {
    const t = c.cue(d.arrow.at, Td + 2.4);
    html.push(`<div id="${p("arr")}" class="${p("arr")} ${p("line")}" style="position:absolute"></div>${d.arrow.label ? `<div id="${p("al")}" class="${p("al")}">${k.chip(d.arrow.label)}</div>` : ""}<div id="${p("ai")}" class="${p("ai")}">${k.icon(d.arrow.icon ?? "arrow", { size: 72 })}</div>`);
    k.draw("arr", t, 0.7);
    if (d.arrow.label) k.pop("al", t + 0.3);
    k.pop("ai", t + 0.6);
  }
  k.ambient();
  return { chrome: true };
}
