// Two states of one setting side by side (today vs when enabled/enforced, before vs after a flag):
// left card shows the current state, an arrow, then the right card flips its toggle on.
export default function states(k, d, c) {
  const { p, css, html } = k;
  const A = d.from ?? {};
  const B = d.to ?? {};
  const chips = d.chips ?? [];
  const top = d.title ? 280 : 220;
  const auto = c.spread(2 + chips.length, c.first + 0.4, c.last - 0.4);
  const tA = c.cue(A.at, auto[0]);
  const tB = c.cue(B.at, auto[1]);

  css.push(`.${p("sc")}{position:absolute;top:${top}px;width:760px;height:400px;box-sizing:border-box;border-radius:14px;padding:36px 40px;display:flex;flex-direction:column;gap:20px}
.${p("sa")}{left:96px;background:var(--ntint);border:2px solid var(--nline)}
.${p("sb")}{left:1064px;background:var(--surface);border:3px solid var(--accent)}
.${p("sl")}{font:700 22px var(--font-body);letter-spacing:.08em;text-transform:uppercase}
.${p("subj")}{font:700 28px/1.2 var(--font-body);color:var(--ink)}
.${p("stx")}{font:700 30px/1.3 var(--font-display);color:var(--ink)}
.${p("snote")}{font:400 22px/1.4 var(--font-body);color:var(--muted);text-wrap:balance}
.${p("arr")}{position:absolute;left:888px;top:${top + 175}px}
.${p("cr")}{position:absolute;left:96px;top:${top + 440}px;display:flex;gap:14px;flex-wrap:wrap}`);
  if (d.title) {
    html.push(`<div id="${p("h")}" class="${p("h2")}">${k.esc(d.title)}</div>`);
    k.rise("h", 0.2);
  }
  const subject = d.subject ? `<span class="${p("subj")}">${k.esc(d.subject)}</span>` : "";
  html.push(`<div id="${p("a")}" class="${p("sc")} ${p("sa")}"><div class="${p("sl")}" style="color:var(--accent2-text)">${k.esc(A.label ?? "Today")}</div><div class="${p("row")}">${k.toggle(Boolean(A.on), { id: "ta" })}${subject}</div>${A.tag ? `<div id="${p("atg")}">${k.chip(A.tag, { tone: "navy" })}</div>` : ""}${A.text ? `<div class="${p("stx")}">${k.esc(A.text)}</div>` : ""}</div>`);
  html.push(`<div id="${p("arr")}" class="${p("arr")}">${k.icon("arrow", { size: 150 })}</div>`);
  html.push(`<div id="${p("b")}" class="${p("sc")} ${p("sb")}"><div class="${p("sl")}" style="color:var(--accent-text)">${k.esc(B.label ?? "Later")}</div><div class="${p("row")}">${k.toggle(false, { id: "tb" })}${subject}${B.lock ? k.icon("lock", { size: 40, id: "lk" }) : ""}</div>${B.text ? `<div id="${p("btx")}" class="${p("stx")}">${k.esc(B.text)}</div>` : ""}${B.note ? `<div id="${p("bn")}" class="${p("snote")}">${k.esc(B.note)}</div>` : ""}</div>`);

  k.rise("a", tA, 26, 0.6);
  if (A.tag) k.pop("atg", tA + 0.8);
  k.slide("arr", tB - 0.5, -30, 0.5);
  k.rise("b", tB, 26, 0.6);
  k.flip("tb", tB + 0.8);
  k.sound("click", tB + 0.8, 0.7);
  if (B.lock) k.pop("lk", tB + 1.2);
  if (B.text) k.rise("btx", c.cue(B.text_at, tB + 1.4), 14, 0.5);
  if (B.note) k.fade("bn", tB + 2.0, 0.6);
  if (chips.length) {
    html.push(`<div class="${p("cr")}">${chips.map((ch, i) => k.chip(ch.text ?? ch, { tone: "neutral", icon: "check", id: `c${i}` })).join("")}</div>`);
    chips.forEach((ch, i) => k.rise(`c${i}`, c.cue(ch.at, auto[2 + i]), 14, 0.45));
  }
  k.ambient();
  return { chrome: true };
}
