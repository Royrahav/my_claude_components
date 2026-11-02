// General fallback: headline + 2-6 cards (icon, title, short text) in a row or a 2-row grid.
// Variant: list (a vertical list, a big numeral or the item's icon left of each title and text).
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
  const times = itemTimes(c, items);

  css.push(`.${p("bc")}{position:absolute;width:${w}px;height:${h}px;box-sizing:border-box;background:var(--surface);border:2px solid var(--line);border-radius:14px;padding:${px(30)}px;display:flex;flex-direction:column;justify-content:center;gap:${px(14)}px}
.${p("bt")}{font:700 ${px(30)}px/1.22 var(--font-display);color:var(--ink)}
.${p("bx")}{font:400 ${px(23)}px/1.45 var(--font-body);color:var(--muted)}`);
  if (d.title) addHeadline(k, d.title);
  items.forEach((it, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    html.push(`<div id="${p(`b${i}`)}" class="${p("bc")}" style="left:${96 + col * (w + gap)}px;top:${top + row * (h + gap)}px">${it.icon ? k.icon(it.icon, { size: px(56) }) : ""}<div class="${p("bt")}">${k.esc(it.title)}</div>${it.text ? `<div class="${p("bx")}">${k.esc(it.text)}</div>` : ""}</div>`);
    k.rise(`b${i}`, times[i], 28, 0.6);
  });
  k.ambient();
  return { chrome: true };
}

// Each item lands on its cue, or spread evenly over the narration.
function itemTimes(c, items) {
  const auto = c.spread(items.length, c.first + 0.6, c.last - 0.3);
  return items.map((it, i) => c.cue(it.at, auto[i]));
}

function addHeadline(k, title) {
  k.html.push(`<div id="${k.p("h")}" class="${k.p("h2")}">${k.esc(title)}</div>`);
  k.rise("h", 0.2);
}

// list ------------------------------------------------------------------------------------------------

// Row metrics by item count: sparse lists scale up, and six rows still fit below a headline.
const LIST_SIZES = {
  2: { row: 170, gap: 26, mark: 110, title: 46, text: 30 },
  3: { row: 146, gap: 22, mark: 96, title: 42, text: 28 },
  4: { row: 124, gap: 18, mark: 84, title: 38, text: 26 },
  5: { row: 104, gap: 16, mark: 72, title: 34, text: 24 },
  6: { row: 90, gap: 14, mark: 62, title: 32, text: 23 },
};
const listSizesFor = (count) => LIST_SIZES[Math.min(6, Math.max(2, count))];

// Rows slide in on their cues, each numeral or icon popping just after its row.
function bulletList(k, d, c) {
  const { p, css, html } = k;
  const items = d.items ?? [];
  const size = listSizesFor(items.length);
  const blockH = items.length * size.row + Math.max(0, items.length - 1) * size.gap;
  const top = k.centeredTop(blockH, { title: Boolean(d.title) });
  const times = itemTimes(c, items);

  css.push(`.${p("list")}{position:absolute;left:96px;top:${top}px;width:1728px;display:flex;flex-direction:column;gap:${size.gap}px}
.${p("lr")}{display:flex;align-items:center;gap:40px;height:${size.row}px;box-sizing:border-box;border-bottom:2px solid var(--hair)}
.${p("mk")}{flex:none;width:${Math.round(size.mark * 1.5)}px;display:flex;justify-content:center;font:900 ${size.mark}px/1 var(--font-body);color:var(--accent-large)}
.${p("lt")}{display:flex;flex-direction:column;gap:6px;min-width:0}
.${p("ltt")}{font:700 ${size.title}px/1.2 var(--font-display);color:var(--ink)}
.${p("ltx")}{font:400 ${size.text}px/1.4 var(--font-body);color:var(--muted)}`);
  if (d.title) addHeadline(k, d.title);
  html.push(`<div class="${p("list")}">${items.map((it, i) => listRowHtml(k, size, it, i)).join("")}</div>`);
  items.forEach((_, i) => {
    k.slide(`r${i}`, times[i], -40, 0.55);
    k.pop(`m${i}`, times[i] + 0.15);
  });
  k.ambient();
  return { chrome: true };
}

function listRowHtml(k, size, it, i) {
  const { p } = k;
  const mark = it.icon ? k.icon(it.icon, { size: Math.round(size.mark * 0.9) }) : String(i + 1).padStart(2, "0");
  const text = it.text ? `<div class="${p("ltx")}">${k.esc(it.text)}</div>` : "";
  return `<div id="${p(`r${i}`)}" class="${p("lr")}"><div id="${p(`m${i}`)}" class="${p("mk")}">${mark}</div><div class="${p("lt")}"><div class="${p("ltt")}">${k.esc(it.title)}</div>${text}</div></div>`;
}

export const variants = { list: bulletList };
