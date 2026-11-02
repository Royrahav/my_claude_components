// Inside one component: the component card stays pinned left while a step rail lights up on cues
// (ok / off / pending states), an optional code card types in with argument labels, then a result
// chip slides back toward the component.
export default function steps(k, d, c) {
  const { p, css, html } = k;
  const S = d.steps ?? [];
  const code = d.code;
  const auto = c.spread(S.length + (code ? 2 : 0) + (d.result ? 1 : 0), c.first + 0.6, c.last - 0.3);
  let ti = 0;
  const railX = 520;
  const rowH = 74;

  css.push(`.${p("cmp")}{position:absolute;left:96px;top:190px;width:380px;height:440px;box-sizing:border-box;background:var(--surface);border:3px solid var(--accent);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;padding:0 24px}
.${p("ct2")}{font:700 34px/1.2 var(--font-display);color:var(--ink)}
.${p("rail")}{position:absolute;left:${railX + 9}px;top:${214}px;width:4px;height:${Math.max(0, (S.length - 1) * rowH)}px;background:var(--hair);border-radius:2px}
.${p("prog")}{position:absolute;left:${railX + 9}px;top:${214}px;width:4px;height:${Math.max(0, (S.length - 1) * rowH)}px;background:var(--accent);border-radius:2px;transform-origin:top center}
.${p("dot")}{position:absolute;left:${railX}px;width:22px;height:22px;border-radius:50%;box-sizing:border-box;border:3px solid var(--line);background:var(--surface)}
.${p("stp")}{position:absolute;left:${railX + 44}px;display:flex;align-items:center;gap:12px}
.${p("cc")}{position:absolute;left:1000px;top:190px;width:824px;box-sizing:border-box;background:var(--surface);border:2px solid var(--nline);border-radius:14px;padding:26px 30px;display:flex;flex-direction:column;gap:14px}
.${p("cl")}{font:400 30px/1.45 var(--font-mono);color:var(--accent2-text);white-space:pre}
.${p("args")}{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
.${p("res")}{position:absolute;left:1000px;display:flex;align-items:center;gap:16px}`);

  html.push(`<div id="${p("cmp")}" class="${p("cmp")}">${k.icon(d.component?.icon ?? "gate", { size: 104 })}<div class="${p("ct2")}">${k.esc(d.component?.title ?? "")}</div></div>`);
  k.grow("cmp", 0.2, 0.7);
  if (d.input) {
    html.push(k.doc(d.input.label ?? "PDF", { id: "in", style: `left:242px;top:560px` }));
    k.slide("in", c.cue(d.input.at, 0.7), -180, 0.7);
  }

  html.push(`<div class="${p("rail")}"></div><div id="${p("prog")}" class="${p("prog")}"></div>`);
  const stepT = [];
  S.forEach((s, i) => {
    const y = 200 + i * rowH;
    const state = s.state ?? "ok";
    const chip =
      state === "off"
        ? k.chip(s.text, { tone: "navy", dashed: true }) + (s.note ? k.chip(s.note, { tone: "navy" }) : "")
        : state === "pending"
          ? k.chip(s.text, { tone: "neutral" })
          : k.chip(s.text, { tone: "accent", icon: "check" });
    html.push(`<div id="${p(`d${i}`)}" class="${p("dot")}" style="top:${y + 3}px"></div><div id="${p(`s${i}`)}" class="${p("stp")}" style="top:${y - 10}px">${chip}</div>`);
    const t = c.cue(s.at, auto[ti++]);
    stepT.push(t);
    k.slide(`s${i}`, t, -24, 0.45);
    const fill = state === "off" ? k.theme.colors.accent2 : state === "pending" ? k.theme.colors.surface : k.theme.colors.accent;
    k.to(`d${i}`, t, { backgroundColor: fill, borderColor: fill }, 0.3);
  });
  if (S.length > 1) k.drawY("prog", stepT[0], Math.max(0.5, stepT[stepT.length - 1] - stepT[0]));

  let resTop = 560;
  if (code) {
    const lines = code.lines ?? [];
    const args = code.args ?? [];
    html.push(`<div id="${p("cc")}" class="${p("cc")}">${code.label ? `<div class="${p("label")}">${k.esc(code.label)}</div>` : ""}${lines.map((l, i) => `<div id="${p(`cl${i}`)}" class="${p("cl")}">${k.esc(l)}</div>`).join("")}${args.length ? `<div class="${p("args")}">${args.map((a, i) => k.chip(a.text ?? a, { tone: "neutral", id: `a${i}`, size: 20 })).join("")}</div>` : ""}</div>`);
    const tc = c.cue(code.at, auto[ti++]);
    k.slide("cc", tc, 60, 0.7);
    lines.forEach((_, i) => k.type(`cl${i}`, tc + 0.4 + i * 0.9, 0.85));
    k.sound("typing", tc + 0.4, 0.35);
    const ta = auto[ti++];
    args.forEach((a, i) => k.rise(`a${i}`, c.cue(a.at, ta + i * 0.35), 10, 0.4));
    resTop = 190 + 52 + (code.label ? 34 : 0) + lines.length * 46 + (args.length ? 70 * Math.ceil(args.length / 4) : 0) + 50;
  }
  if (d.result) {
    html.push(`<div id="${p("res")}" class="${p("res")}" style="top:${Math.min(resTop, 760)}px">${k.icon("arrow", { size: 46, style: "transform:scaleX(-1)" })}<span class="${p("code")}" style="color:var(--accent-text);font-weight:700">${k.esc(d.result.text)}</span></div>`);
    const tr = c.cue(d.result.at, auto[ti++]);
    k.slide("res", tr, 60, 0.5);
    k.sound("pop", tr + 0.2, 0.6);
  }
  if (d.footnote) {
    html.push(`<div id="${p("fn")}" class="${p("foot")}" style="left:${railX}px;top:820px">${k.esc(d.footnote.text ?? d.footnote)}</div>`);
    k.fade("fn", c.cue(d.footnote.at, c.last - 0.5), 0.6);
  }
  k.ambient();
  return { chrome: true };
}
