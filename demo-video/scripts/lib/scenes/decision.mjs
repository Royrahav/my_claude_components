// Code-path decision: a source component asks one question (diamond) under conditions; the "yes"
// path runs through 1-3 nodes (documents or boxes) into a detail card (request/contract), the "no"
// path keeps the existing behavior.
const CANVAS_H = 1080;
const BAND_TOP = 150;
const ARROW_SIZE = 72;
// The no box's icon by tone; other tones show none.
const NO_ICONS = { bad: { name: "cross", color: "var(--danger)" }, good: { name: "check", color: "var(--accent)" } };

export default function decision(k, d, c) {
  const { p, css, html } = k;
  const conds = d.conditions ?? [];
  const yes = d.yes ?? [];
  const det = d.detail;
  const rows = (det?.sections ?? []).flatMap((s) => s.rows ?? []);
  const auto = c.spread(3 + conds.length + yes.length + rows.length, c.first + 0.3, c.last - 0.3);
  let ti = 0;
  const dcx = 250;
  const dcy = 410;

  css.push(`.${p("src")}{position:absolute;left:96px;top:150px;display:flex;align-items:center;gap:12px;background:var(--surface);border:2px solid var(--line);border-radius:12px;padding:12px 18px}
.${p("srct")}{font:400 26px var(--font-mono);color:var(--accent2-text)}
.${p("dia")}{position:absolute;left:${dcx - 98}px;top:${dcy - 98}px;width:196px;height:196px;box-sizing:border-box;transform:rotate(45deg);border:3px solid var(--accent);background:var(--surface);border-radius:14px}
.${p("q")}{position:absolute;left:${dcx - 110}px;top:${dcy - 40}px;width:220px;height:80px;display:flex;align-items:center;justify-content:center;text-align:center;font:700 23px/1.2 var(--font-body);color:var(--ink)}
.${p("conds")}{position:absolute;left:96px;top:${dcy + 150}px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;max-width:860px}
.${p("plus")}{font:700 26px var(--font-body);color:var(--accent-text)}
.${p("yl")}{position:absolute;left:${dcx + 140}px;top:${dcy - 2}px;height:4px}
.${p("lbl")}{position:absolute;font:700 18px var(--font-body);color:var(--accent-text)}
.${p("box")}{position:absolute;width:220px;min-height:110px;box-sizing:border-box;background:var(--surface);border:2px solid var(--line);border-radius:12px;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px;font:700 21px/1.25 var(--font-body);color:var(--ink)}
.${p("bdg")}{position:absolute}
.${p("detw")}{position:absolute;left:1094px;top:${BAND_TOP}px;width:730px;min-height:${2 * (dcy - BAND_TOP)}px;display:flex;flex-direction:column;justify-content:center}
.${p("det")}{box-sizing:border-box;background:var(--surface);border:2px solid var(--line);border-radius:14px;padding:30px 34px;display:flex;flex-direction:column;gap:12px}
.${p("dt")}{font:700 30px var(--font-mono);color:var(--accent-text);background:var(--tint2);border-radius:10px;padding:6px 16px;align-self:flex-start}
.${p("chips")}{display:flex;flex-wrap:wrap;gap:10px}
.${p("rw")}{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.${p("nl")}{position:absolute;left:${dcx - 2}px;top:${dcy + 214}px;width:4px;height:70px;background:var(--hair);transform-origin:top center}
.${p("no")}{position:absolute;left:96px;top:${dcy + 300}px;display:flex;align-items:center;gap:14px;background:var(--tint);border:2px solid var(--line);border-radius:12px;padding:14px 20px}
.${p("not")}{font:700 26px var(--font-display);color:var(--ink)}
.${p("up")}{position:absolute;left:1000px;bottom:${CANVAS_H - dcy - ARROW_SIZE / 2}px;display:flex;flex-direction:column;align-items:center}`);

  if (d.source) {
    html.push(`<div id="${p("src")}" class="${p("src")}">${k.icon(d.source.icon ?? "doc", { size: 34 })}<span class="${p("srct")}">${k.esc(d.source.title)}</span></div>`);
    k.rise("src", c.cue(d.source.at, auto[ti++]), 16);
  }
  html.push(`<div id="${p("dia")}" class="${p("dia")}"></div><div id="${p("q")}" class="${p("q")}">${k.esc(d.question)}</div>`);
  const tq = c.cue(d.at, auto[ti++]);
  k.fade("dia", tq, 0.6);
  k.rise("q", tq + 0.2, 12);

  if (conds.length) {
    html.push(`<div class="${p("conds")}">${conds.map((x, i) => `${i ? `<span id="${p(`pl${i}`)}" class="${p("plus")}">+</span>` : ""}${k.chip(x.text ?? x, { id: `cd${i}` })}`).join("")}</div>`);
    conds.forEach((x, i) => {
      const t = c.cue(x.at, auto[ti++]);
      k.pop(`cd${i}`, t);
      if (i) k.fade(`pl${i}`, t - 0.1, 0.3);
    });
  }

  // yes path: nodes spaced between the diamond and the detail card
  const span0 = dcx + 150;
  const span1 = det ? 960 : 1700;
  const nodeW = (y) => (y.doc ? 88 : 220);
  const total = yes.reduce((s, y) => s + nodeW(y), 0);
  const gap = Math.max(40, (span1 - span0 - total) / (yes.length + 1));
  let x = span0 + gap;
  const ty0 = c.cue(d.yes_at, auto[ti]);
  html.push(`<div id="${p("yl")}" class="${p("line")} ${p("yl")}" style="width:${span1 - span0 + 40}px"></div><div id="${p("yt")}" class="${p("lbl")}" style="left:${span0 + 10}px;top:${dcy - 34}px">${k.esc(d.yes_label ?? "Yes")}</div>`);
  k.draw("yl", ty0, 0.8);
  k.fade("yt", ty0 + 0.2, 0.4);
  yes.forEach((y, i) => {
    const t = c.cue(y.at, auto[ti++]);
    if (y.doc) {
      html.push(k.doc(y.text, { id: `y${i}`, style: `left:${Math.round(x)}px;top:${dcy - 58}px` }));
      k.pop(`y${i}`, t, 0.5);
    } else {
      html.push(`<div id="${p(`y${i}`)}" class="${p("box")}" style="left:${Math.round(x)}px;top:${dcy - 55}px">${k.esc(y.text)}</div>`);
      k.grow(`y${i}`, t, 0.6);
    }
    if (y.badge) {
      html.push(`<div id="${p(`yb${i}`)}" class="${p("bdg")}" style="left:${Math.round(x - 20)}px;top:${dcy + 76}px">${k.chip(y.badge, { size: 18 })}</div>`);
      k.pop(`yb${i}`, t + 0.6);
      k.sound("pop", t + 0.6, 0.6);
    }
    if (y.note) {
      html.push(`<div id="${p(`yn${i}`)}" class="${p("bdg")}" style="left:${Math.round(x - 40)}px;top:${dcy + 130}px">${k.chip(y.note, { tone: "navy", size: 18 })}</div>`);
      k.fade(`yn${i}`, t + 0.8, 0.5);
    }
    x += nodeW(y) + gap;
  });

  if (det) {
    const td = c.cue(det.at, auto[ti] ?? c.last - 2);
    const secs = (det.sections ?? []).map((s) => {
      const body = s.chips
        ? `<div class="${p("chips")}">${s.chips.map((t) => `<span class="${p("code")}" style="font-size:22px;padding:4px 12px">${k.esc(t)}</span>`).join("")}</div>`
        : (s.rows ?? [])
            .map((r) => `<div id="${p(`rw${rows.indexOf(r)}`)}" class="${p("rw")}"><span class="${p("code")}" style="font-size:22px;padding:4px 12px">${k.esc(r.code)}</span>${r.note ? `<span class="${p("body")}" style="font-size:20px">${k.esc(r.note)}</span>` : ""}${r.tag ? k.chip(r.tag, { tone: "navy", size: 18 }) : ""}</div>`)
            .join("");
      return `${s.label ? `<div class="${p("label")}" style="margin-top:8px">${k.esc(s.label)}</div>` : ""}${body}`;
    });
    const arrowLabel = det.arrow_label ? `<span class="${p("lbl")}" style="position:static">${k.esc(det.arrow_label)}</span>` : "";
    // Bottom-anchored arrow and a card band centered on the yes line: the arrow aims at the card's middle.
    html.push(`<div id="${p("up")}" class="${p("up")}">${arrowLabel}${k.icon("arrow", { size: ARROW_SIZE, id: "upi" })}</div>`);
    html.push(`<div class="${p("detw")}"><div id="${p("det")}" class="${p("det")}"><div class="${p("dt")}">${k.esc(det.title)}</div>${secs.join("")}</div></div>`);
    k.slide("up", td - 0.3, -30, 0.5);
    k.slide("det", td, 110, 0.9);
    rows.forEach((r, i) => k.fade(`rw${i}`, c.cue(r.at, td + 0.9 + i * 0.5), 0.4));
  }

  if (d.no) {
    const tn = c.cue(d.no.at, c.last - 1.2);
    const icon = NO_ICONS[d.no.tone];
    const noIcon = icon ? k.icon(icon.name, { size: 34, color: icon.color }) : "";
    html.push(`<div id="${p("nl")}" class="${p("nl")}"></div><div id="${p("nt")}" class="${p("lbl")}" style="left:${dcx + 14}px;top:${dcy + 230}px;color:var(--muted)">${k.esc(d.no.label ?? "No")}</div><div id="${p("no")}" class="${p("no")}">${noIcon}<span class="${p("not")}">${k.esc(d.no.text)}</span>${d.no.tag ? k.chip(d.no.tag, { tone: "neutral", size: 18 }) : ""}</div>`);
    k.drawY("nl", tn, 0.5);
    k.fade("nt", tn + 0.1, 0.4);
    k.rise("no", tn + 0.3, 16, 0.5);
  }
  k.ambient();
  return { chrome: true };
}
