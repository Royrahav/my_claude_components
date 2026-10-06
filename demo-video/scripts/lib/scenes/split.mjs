// Two-column comparison (before/after, old/new, problem/consequence) + optional footer row.
// Variant: stacked (the left side on top, the right side below, a horizontal divider between them).
const TONE_TEXT = { accent: "accent-text", good: "accent-text", navy: "accent2-text", bad: "danger-text", neutral: "muted", plain: "ink" };
const TONE_ICON = { accent: "accent", good: "accent", navy: "accent2", bad: "danger", neutral: "muted", plain: "accent" };
const FOOT_TOP = 760;
const LABEL_H = 50; // wing label row above the items

export default function split(k, d, c) {
  const { p, css, html } = k;
  const L = d.left ?? { items: [] };
  const R = d.right ?? { items: [] };
  const foot = d.footer ?? [];
  const nextAuto = autoTimes(c, L, R, foot);
  // Sparse wings scale up; labels + items are centered in the band above the footer row.
  const rows = Math.max(L.items?.length ?? 0, R.items?.length ?? 0, 1);
  const scale = rows <= 2 ? 1.3 : rows === 3 ? 1.15 : 1;
  const px = (v) => Math.round(v * scale);
  const blockH = LABEL_H + rows * px(74) + (rows - 1) * px(16);
  const top = LABEL_H + k.centeredTop(blockH, { title: Boolean(d.title), bottom: foot.length ? FOOT_TOP - 40 : undefined });

  css.push(`.${p("wl")}{position:absolute;top:${top - LABEL_H}px;font:700 22px var(--font-body);letter-spacing:.08em;text-transform:uppercase}
.${p("wing")}{position:absolute;top:${top}px;width:800px;display:flex;flex-direction:column;gap:${px(16)}px}
.${p("item")}{display:flex;align-items:center;gap:${px(18)}px;min-height:${px(74)}px;padding:${px(10)}px ${px(26)}px;box-sizing:border-box;background:var(--surface);border:2px solid var(--line);border-radius:14px;font:700 ${px(26)}px/1.25 var(--font-body);color:var(--ink)}
${itemToneCss(p)}
.${p("div")}{position:absolute;left:959px;top:${top - LABEL_H}px;width:2px;height:${blockH}px;background:var(--hair);transform-origin:top center}
${footerRowCss(p)}`);
  if (d.title) html.push(`<div id="${p("h")}" class="${p("h2")}">${k.esc(d.title)}</div>`);
  if (d.title) k.rise("h", 0.2);
  html.push(`<div id="${p("div")}" class="${p("div")}"></div>`);
  k.drawY("div", 0.3, 0.8);

  const wing = (side, W, x, dx, defTone) => {
    html.push(labelHtml(k, side, W, defTone, `left:${x}px`));
    html.push(`<div class="${p("wing")}" style="left:${x}px">${itemsHtml(k, side, W, px(40))}</div>`);
    revealWing(k, c, side, W, nextAuto, (id, t, dur) => k.slide(id, t, dx, dur));
  };
  wing("l", L, 96, -50, "neutral");
  wing("r", R, 1024, 50, "accent");
  addFooter(k, c, foot, nextAuto);
  k.ambient();
  return { chrome: true };
}

// Fallback times, handed out in reading order: left label and items, right label and items, footer.
function autoTimes(c, L, R, foot) {
  const auto = c.spread((L.items?.length ?? 0) + (R.items?.length ?? 0) + foot.length + 2);
  let next = 0;
  return () => auto[next++];
}

const itemToneCss = (p) => `.${p("bad")}{border:2px dashed var(--danger);color:var(--danger-text);background:var(--dtint)}
.${p("navy")}{border-color:var(--nline);color:var(--accent2-text)}`;

const footerRowCss = (p) => `.${p("frow")}{position:absolute;left:96px;right:96px;top:${FOOT_TOP}px;display:flex;justify-content:center;gap:44px}`;

const labelHtml = (k, side, W, defTone, position) =>
  `<div id="${k.p(`${side}l`)}" class="${k.p("wl")}" style="${position};color:var(--${TONE_TEXT[W.tone ?? defTone] ?? "muted"})">${k.esc(W.label ?? "")}</div>`;

// Items without an icon get a check (good) or a cross (bad).
function itemsHtml(k, side, W, iconSize) {
  const { p } = k;
  return (W.items ?? [])
    .map((it, i) => {
      const t = it.tone ?? "plain";
      const cls = t === "bad" ? ` ${p("bad")}` : t === "navy" ? ` ${p("navy")}` : "";
      const ic = it.icon ?? (t === "bad" ? "cross" : t === "good" ? "check" : null);
      return `<div id="${p(`${side}${i}`)}" class="${p("item")}${cls}">${ic ? k.icon(ic, { size: iconSize, color: `var(--${TONE_ICON[t]})` }) : ""}<span>${k.esc(it.text)}</span></div>`;
    })
    .join("");
}

// The label, then each item, enter on their cues; the scene's first bad item clicks.
function revealWing(k, c, side, W, nextAuto, enter) {
  enter(`${side}l`, c.cue(W.at, nextAuto()), 0.5);
  (W.items ?? []).forEach((it, i) => {
    const t = c.cue(it.at, nextAuto());
    enter(`${side}${i}`, t, 0.55);
    if ((it.tone ?? "") === "bad" && !k.sfx.some((x) => x.sound === "click")) k.sound("click", t, 0.6);
  });
}

function addFooter(k, c, foot, nextAuto) {
  if (!foot.length) return;
  const { p } = k;
  k.html.push(`<div class="${p("frow")}">${foot.map((f, i) => `<div id="${p(`f${i}`)}" class="${p("row")}">${f.icon ? k.icon(f.icon, { size: 56, color: `var(--${TONE_ICON[f.tone ?? "accent"]})` }) : ""}${k.chip(f.text, { tone: f.tone ?? "accent" })}</div>`).join("")}</div>`);
  foot.forEach((f, i) => k.rise(`f${i}`, c.cue(f.at, nextAuto()), 24));
}

// stacked ---------------------------------------------------------------------------------------------

const STACK = { labelH: 50, itemH: 104, dividerGap: 44, itemIcon: 44 };

// The left side's label and items in a row on top, the right side's below, the divider drawn between.
function stackedSplit(k, d, c) {
  const { p, css, html } = k;
  const L = d.left ?? { items: [] };
  const R = d.right ?? { items: [] };
  const foot = d.footer ?? [];
  const nextAuto = autoTimes(c, L, R, foot);
  const sectionH = STACK.labelH + STACK.itemH;
  const top = k.centeredTop(2 * (sectionH + STACK.dividerGap), { title: Boolean(d.title), bottom: foot.length ? FOOT_TOP - 40 : undefined });
  const dividerY = top + sectionH + STACK.dividerGap;

  css.push(`.${p("wl")}{position:absolute;left:96px;font:700 22px var(--font-body);letter-spacing:.08em;text-transform:uppercase}
.${p("wing")}{position:absolute;left:96px;width:1728px;display:flex;gap:24px}
.${p("item")}{flex:1 1 0;min-width:0;display:flex;align-items:center;gap:20px;height:${STACK.itemH}px;padding:0 28px;box-sizing:border-box;background:var(--surface);border:2px solid var(--line);border-radius:14px;font:700 30px/1.2 var(--font-body);color:var(--ink)}
${itemToneCss(p)}
.${p("div")}{position:absolute;left:96px;top:${dividerY - 1}px;width:1728px;height:2px;background:var(--hair);transform-origin:left center}
${footerRowCss(p)}`);
  if (d.title) {
    html.push(`<div id="${p("h")}" class="${p("h2")}">${k.esc(d.title)}</div>`);
    k.rise("h", 0.2);
  }
  html.push(`<div id="${p("div")}" class="${p("div")}"></div>`);
  k.draw("div", 0.3, 0.8);

  const section = (side, W, y, dy, defTone) => {
    html.push(labelHtml(k, side, W, defTone, `top:${y}px`));
    html.push(`<div class="${p("wing")}" style="top:${y + STACK.labelH}px">${itemsHtml(k, side, W, STACK.itemIcon)}</div>`);
    revealWing(k, c, side, W, nextAuto, (id, t, dur) => k.rise(id, t, dy, dur));
  };
  section("l", L, top, -24, "neutral");
  section("r", R, dividerY + STACK.dividerGap, 24, "accent");
  addFooter(k, c, foot, nextAuto);
  k.ambient();
  return { chrome: true };
}

export const variants = { stacked: stackedSplit };
