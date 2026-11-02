// Closing summary, placed right before the close scene: 2-4 takeaways as rows (number badge or icon,
// title, an "e.g." real-life example, optional "who" chip) and an optional footer chip.
// Variant: cards (the takeaways as a row of cards, each holding its example).
const DEFAULT_TITLE = "What to remember";
const FOOT_SIZE = 28;
const FOOT_HEIGHT = Math.round(FOOT_SIZE * 2.2); // the kit sizes a chip's height at 2.2x its font size
const FOOT_GAP = 28;
const BADGE_DELAY = 0.15;
const EXAMPLE_DELAY = 0.6;
const POP_VOLUME = 0.35;

// Row metrics by item count: sparse scenes scale up moderately, and four rows plus a footer still fit the band.
const SIZES = {
  2: { row: 168, gap: 24, badge: 68, title: 38, example: 26 },
  3: { row: 140, gap: 20, badge: 60, title: 36, example: 25 },
  4: { row: 118, gap: 16, badge: 54, title: 34, example: 24 },
};
const sizesFor = (count) => SIZES[Math.min(4, Math.max(2, count))];

const stackHeight = (count, size, hasFooter) =>
  count * size.row + Math.max(0, count - 1) * size.gap + (hasFooter ? FOOT_GAP + FOOT_HEIGHT : 0);

export default function recap(k, d, c) {
  const items = d.items ?? [];
  const title = d.title ?? DEFAULT_TITLE;
  const size = sizesFor(items.length);
  const top = k.centeredTop(stackHeight(items.length, size, Boolean(d.footer)), { title: Boolean(title) });

  k.css.push(stackCss(k.p, size, top));
  if (title) addHeadline(k, title);
  k.html.push(`<div class="${k.p("stack")}">${items.map((item, i) => rowHtml(k, size, item, i)).join("")}${d.footer ? footerHtml(k, d.footer) : ""}</div>`);
  animateRows(k, c, items);
  if (d.footer) k.rise("ft", c.cue(d.footer.at, c.last - 0.3), 16);
  k.ambient();
  return { chrome: true };
}

function stackCss(p, size, top) {
  return `.${p("stack")}{position:absolute;left:96px;top:${top}px;width:1728px;display:flex;flex-direction:column;gap:${size.gap}px}
.${p("rw")}{display:flex;align-items:center;gap:28px;min-height:${size.row}px;padding:12px 32px;box-sizing:border-box;background:var(--surface);border:2px solid var(--line);border-radius:14px}
${badgeCss(p, size)}
.${p("tx")}{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
${textCss(p, size)}
.${p("ft")}{display:flex;align-self:center;margin-top:${FOOT_GAP - size.gap}px}`;
}

// The digit sits on an --accent-text fill, so it takes --on-accent; an icon badge is tinted instead.
const badgeCss = (p, size) => `.${p("bd")}{flex:none;display:flex;align-items:center;justify-content:center;width:${size.badge}px;height:${size.badge}px;border-radius:50%;background:var(--accent-text);color:var(--on-accent);font:900 ${Math.round(size.badge / 2)}px/1 var(--font-body)}
.${p("ib")}{background:var(--tint2)}`;

const textCss = (p, size) => `.${p("rt")}{font:700 ${size.title}px/1.2 var(--font-display);color:var(--ink)}
.${p("ex")}{font:400 ${size.example}px/1.4 var(--font-body);color:var(--muted)}
.${p("eg")}{font-weight:700;color:var(--accent-text);margin-right:.5em}`;

function addHeadline(k, title) {
  k.html.push(`<div id="${k.p("h")}" class="${k.p("h2")}">${k.esc(title)}</div>`);
  k.rise("h", 0.2);
}

function badgeHtml(k, size, item, i) {
  const inner = item.icon ? k.icon(item.icon, { size: Math.round(size.badge * 0.62) }) : i + 1;
  return `<div id="${k.p(`b${i}`)}" class="${k.p("bd")}${item.icon ? ` ${k.p("ib")}` : ""}">${inner}</div>`;
}

const exampleHtml = (k, item, i) =>
  item.example ? `<div id="${k.p(`x${i}`)}" class="${k.p("ex")}"><span class="${k.p("eg")}">e.g.</span>${k.esc(item.example)}</div>` : "";

function rowHtml(k, size, item, i) {
  const who = item.who ? k.chip(item.who, { tone: "navy", style: "flex:none" }) : "";
  return `<div id="${k.p(`r${i}`)}" class="${k.p("rw")}">${badgeHtml(k, size, item, i)}<div class="${k.p("tx")}"><div class="${k.p("rt")}">${k.esc(item.title)}</div>${exampleHtml(k, item, i)}</div>${who}</div>`;
}

function footerHtml(k, footer) {
  return `<div id="${k.p("ft")}" class="${k.p("ft")}">${k.chip(footer.text ?? footer, { tone: "accent", size: FOOT_SIZE })}</div>`;
}

// Cues resolve in reading order (row title, then its example) so word cues search forward through the narration.
function animateRows(k, c, items) {
  const from = c.first + 0.4;
  const lastRowRoom = 1.0; // the last row must leave time for its example before the speech ends
  const autoTimes = c.spread(items.length, from, Math.max(from, c.last - lastRowRoom));
  items.forEach((item, i) => {
    const t = c.cue(item.at, autoTimes[i]);
    k.rise(`r${i}`, t, 28, 0.6);
    k.pop(`b${i}`, t + BADGE_DELAY);
    k.sound("pop", t + BADGE_DELAY, POP_VOLUME);
    if (item.example) k.fade(`x${i}`, c.cue(item.example_at, t + EXAMPLE_DELAY), 0.5);
  });
}

// cards -----------------------------------------------------------------------------------------------

// Card metrics by item count: fewer, wider cards get larger type, and four cards plus a footer still fit.
const CARD_SIZES = {
  2: { height: 380, gap: 40, badge: 72, title: 40, example: 28 },
  3: { height: 420, gap: 36, badge: 64, title: 36, example: 26 },
  4: { height: 450, gap: 28, badge: 58, title: 32, example: 24 },
};
const cardSizesFor = (count) => CARD_SIZES[Math.min(4, Math.max(2, count))];

// Cards rise in reading order like the rows; a card's who chip sits at its foot.
function recapCards(k, d, c) {
  const items = d.items ?? [];
  const title = d.title ?? DEFAULT_TITLE;
  const size = cardSizesFor(items.length);
  const count = Math.max(items.length, 1);
  const width = Math.floor((1728 - (count - 1) * size.gap) / count);
  const top = k.centeredTop(size.height + (d.footer ? FOOT_GAP + FOOT_HEIGHT : 0), { title: Boolean(title) });

  k.css.push(cardsCss(k.p, size, top, width));
  if (title) addHeadline(k, title);
  k.html.push(items.map((item, i) => cardHtml(k, size, item, i, 96 + i * (width + size.gap))).join(""));
  if (d.footer) k.html.push(footerHtml(k, d.footer));
  animateRows(k, c, items);
  if (d.footer) k.rise("ft", c.cue(d.footer.at, c.last - 0.3), 16);
  k.ambient();
  return { chrome: true };
}

function cardsCss(p, size, top, width) {
  return `.${p("cd")}{position:absolute;top:${top}px;width:${width}px;height:${size.height}px;box-sizing:border-box;background:var(--surface);border:2px solid var(--line);border-radius:14px;padding:34px 32px;display:flex;flex-direction:column;align-items:flex-start;gap:18px}
${badgeCss(p, size)}
${textCss(p, size)}
.${p("ft")}{position:absolute;left:96px;width:1728px;top:${top + size.height + FOOT_GAP}px;display:flex;justify-content:center}`;
}

function cardHtml(k, size, item, i, left) {
  const who = item.who ? k.chip(item.who, { tone: "navy", style: "margin-top:auto" }) : "";
  return `<div id="${k.p(`r${i}`)}" class="${k.p("cd")}" style="left:${left}px">${badgeHtml(k, size, item, i)}<div class="${k.p("rt")}">${k.esc(item.title)}</div>${exampleHtml(k, item, i)}${who}</div>`;
}

export const variants = { cards: recapCards };
