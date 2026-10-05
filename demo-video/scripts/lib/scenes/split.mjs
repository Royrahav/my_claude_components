// Two-column comparison (before/after, old/new, problem/consequence) + optional footer row.
const TONE_TEXT = { accent: "accent-text", good: "accent-text", navy: "accent2-text", bad: "danger-text", neutral: "muted", plain: "ink" };
const TONE_ICON = { accent: "accent", good: "accent", navy: "accent2", bad: "danger", neutral: "muted", plain: "accent" };
const FOOT_TOP = 760;
const LABEL_H = 50; // wing label row above the items

export default function split(k, d, c) {
  const { p, css, html } = k;
  const L = d.left ?? { items: [] };
  const R = d.right ?? { items: [] };
  const foot = d.footer ?? [];
  const n = (L.items?.length ?? 0) + (R.items?.length ?? 0) + foot.length + 2;
  const auto = c.spread(n);
  let ti = 0;
  // Sparse wings scale up; labels + items are centered in the band above the footer row.
  const rows = Math.max(L.items?.length ?? 0, R.items?.length ?? 0, 1);
  const scale = rows <= 2 ? 1.3 : rows === 3 ? 1.15 : 1;
  const px = (v) => Math.round(v * scale);
  const blockH = LABEL_H + rows * px(74) + (rows - 1) * px(16);
  const top = LABEL_H + k.centeredTop(blockH, { title: Boolean(d.title), bottom: foot.length ? FOOT_TOP - 40 : undefined });

  css.push(`.${p("wl")}{position:absolute;top:${top - LABEL_H}px;font:700 22px var(--font-body);letter-spacing:.08em;text-transform:uppercase}
.${p("wing")}{position:absolute;top:${top}px;width:800px;display:flex;flex-direction:column;gap:${px(16)}px}
.${p("item")}{display:flex;align-items:center;gap:${px(18)}px;min-height:${px(74)}px;padding:${px(10)}px ${px(26)}px;box-sizing:border-box;background:var(--surface);border:2px solid var(--line);border-radius:14px;font:700 ${px(26)}px/1.25 var(--font-body);color:var(--ink)}
.${p("bad")}{border:2px dashed var(--danger);color:var(--danger-text);background:var(--dtint)}
.${p("navy")}{border-color:var(--nline);color:var(--accent2-text)}
.${p("div")}{position:absolute;left:959px;top:${top - LABEL_H}px;width:2px;height:${blockH}px;background:var(--hair);transform-origin:top center}
.${p("frow")}{position:absolute;left:96px;right:96px;top:${FOOT_TOP}px;display:flex;justify-content:center;gap:44px}`);
  if (d.title) html.push(`<div id="${p("h")}" class="${p("h2")}">${k.esc(d.title)}</div>`);
  if (d.title) k.rise("h", 0.2);
  html.push(`<div id="${p("div")}" class="${p("div")}"></div>`);
  k.drawY("div", 0.3, 0.8);

  const wing = (side, W, x, dx, defTone) => {
    const tone = W.tone ?? defTone;
    html.push(`<div id="${p(`${side}l`)}" class="${p("wl")}" style="left:${x}px;color:var(--${TONE_TEXT[tone] ?? "muted"})">${k.esc(W.label ?? "")}</div>`);
    const items = (W.items ?? []).map((it, i) => {
      const t = it.tone ?? "plain";
      const cls = t === "bad" ? ` ${p("bad")}` : t === "navy" ? ` ${p("navy")}` : "";
      const ic = it.icon ?? (t === "bad" ? "cross" : t === "good" ? "check" : null);
      return `<div id="${p(`${side}${i}`)}" class="${p("item")}${cls}">${ic ? k.icon(ic, { size: px(40), color: `var(--${TONE_ICON[t]})` }) : ""}<span>${k.esc(it.text)}</span></div>`;
    });
    html.push(`<div class="${p("wing")}" style="left:${x}px">${items.join("")}</div>`);
    k.slide(`${side}l`, c.cue(W.at, auto[ti++]), dx, 0.5);
    (W.items ?? []).forEach((it, i) => {
      const t = c.cue(it.at, auto[ti++]);
      k.slide(`${side}${i}`, t, dx, 0.55);
      if ((it.tone ?? "") === "bad" && !k.badSound) {
        k.badSound = true;
        k.sound("click", t, 0.6);
      }
    });
  };
  wing("l", L, 96, -50, "neutral");
  wing("r", R, 1024, 50, "accent");

  if (foot.length) {
    html.push(`<div class="${p("frow")}">${foot.map((f, i) => `<div id="${p(`f${i}`)}" class="${p("row")}">${f.icon ? k.icon(f.icon, { size: 56, color: `var(--${TONE_ICON[f.tone ?? "accent"]})` }) : ""}${k.chip(f.text, { tone: f.tone ?? "accent" })}</div>`).join("")}</div>`);
    foot.forEach((f, i) => k.rise(`f${i}`, c.cue(f.at, auto[ti++]), 24));
  }
  k.ambient();
  return { chrome: true };
}
