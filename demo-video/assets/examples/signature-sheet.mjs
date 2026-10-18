// Signature scene example: a sheet of paper reshapes from one paper size to the next (A4 to Letter); its
// dimension lines follow it, the first size's numbers count up and each next size's labels swap in.
// Copy to <project>/scenes/<name>.mjs and adapt (references/custom-scene.md, Signature scene recipe).
//
// data: { title?, unit? (default "mm"), sizes: [{ name, width, height, at? }] (2-3, in order), note?: { text, at? } }
// Each size lands on its `at` cue. Only kit helpers move things, and the sheet reshapes by scaleX/scaleY.

const SHEET_MAX = { width: 560, height: 440 }; // the largest size fills at most this box
const LINE_GAP = 26; // sheet edge to dimension line
const LINE_W = 16; // a dimension line with its end ticks
const LABEL_GAP = 14; // dimension line to its label
const LABEL_H = 44;
const LABEL_W = 260; // room for the height label right of the sheet
const NOTE_GAP = 24;
const NOTE_H = 48;
const RESHAPE = 0.9;
const STEP = 1.6; // closest two sizes can follow each other: a reshape, then the labels settle
const NAME_EM = 0.62; // average glyph width of the display face, in em

export default function signatureSheet(k, d, c) {
  const sizes = d.sizes ?? [];
  const layout = sheetLayout(k, d, sizes);
  k.css.push(sheetCss(k.p, layout));
  if (d.title) {
    k.html.push(`<div id="${k.p("h")}" class="${k.p("h2")}">${k.esc(d.title)}</div>`);
    k.rise("h", 0.2);
  }
  if (sizes.length > 0) {
    const times = sizeTimes(c, sizes);
    k.html.push(sheetHtml(k, layout, sizes), ...sizes.map((size, i) => labelsHtml(k, layout, size, i, d.unit ?? "mm")));
    revealFirstSize(k, sizes[0], times[0]);
    for (let i = 1; i < sizes.length; i++) reshapeTo(k, sizes, i, times[i], layout.scale);
    if (d.note) addNote(k, c, d.note, layout, times[times.length - 1] + RESHAPE + 0.4);
  }
  k.ambient();
  return { chrome: true };
}

// Where everything goes: the sheet's center and scale (px per unit), with its dimension labels and the
// note, centered in the band below the headline.
function sheetLayout(k, d, sizes) {
  const maxW = Math.max(1, ...sizes.map((size) => size.width));
  const maxH = Math.max(1, ...sizes.map((size) => size.height));
  const scale = Math.min(SHEET_MAX.width / maxW, SHEET_MAX.height / maxH);
  const groupW = maxW * scale + LINE_GAP + LINE_W + LABEL_GAP + LABEL_W;
  const groupH = maxH * scale + LINE_GAP + LINE_W + LABEL_GAP + LABEL_H + (d.note ? NOTE_GAP + NOTE_H : 0);
  const top = k.centeredTop(groupH, { title: Boolean(d.title) });
  const narrowest = Math.min(...sizes.map((size) => size.width * scale));
  const longestName = Math.max(1, ...sizes.map((size) => String(size.name ?? "").length));
  const nameWidth = narrowest * 0.84;
  return {
    scale,
    cx: Math.round(960 - groupW / 2 + (maxW * scale) / 2),
    cy: Math.round(top + (maxH * scale) / 2),
    noteTop: top + groupH - NOTE_H,
    name: { width: nameWidth, size: Math.min(96, Math.floor(nameWidth / (longestName * NAME_EM))) },
    box: (size) => ({ w: size.width * scale, h: size.height * scale }),
  };
}

function sheetCss(p, layout) {
  return `.${p("sheet")}{position:absolute;box-sizing:border-box;background:var(--surface);border:3px solid var(--line);border-radius:8px;display:flex;flex-direction:column;justify-content:space-between;transform-origin:center}
.${p("sheet")}::after{content:"";position:absolute;right:-3px;top:-3px;width:44px;height:44px;background:linear-gradient(225deg,var(--canvas) 50%,var(--tint2) 50%);border-bottom-left-radius:8px}
.${p("txl")}{display:block;height:12px;border-radius:6px;background:var(--hair);margin-bottom:14px}
.${p("ghost")}{position:absolute;box-sizing:border-box;border:3px dashed var(--accent);border-radius:8px}
.${p("nm")}{position:absolute;display:flex;align-items:center;justify-content:center;font:700 ${layout.name.size}px/1 var(--font-display);color:var(--accent-large)}
.${p("dw")}{position:absolute;height:${LINE_W}px;box-sizing:border-box;border-left:3px solid var(--light);border-right:3px solid var(--light);transform-origin:center}
.${p("dw")}::after{content:"";position:absolute;left:0;right:0;top:${LINE_W / 2 - 1.5}px;height:3px;background:var(--light)}
.${p("dh")}{position:absolute;width:${LINE_W}px;box-sizing:border-box;border-top:3px solid var(--light);border-bottom:3px solid var(--light);transform-origin:center}
.${p("dh")}::after{content:"";position:absolute;top:0;bottom:0;left:${LINE_W / 2 - 1.5}px;width:3px;background:var(--light)}
.${p("dl")}{position:absolute;height:${LABEL_H}px;display:flex;align-items:center;font:700 34px/1 var(--font-mono);color:var(--ink);white-space:nowrap}
.${p("un")}{font:400 26px/1 var(--font-body);color:var(--muted);margin-left:10px}
.${p("note")}{position:absolute;left:96px;width:1728px;display:flex;justify-content:center}`;
}

// Each size lands on its cue, or spread over the narration, and never sooner than STEP after the last.
function sizeTimes(c, sizes) {
  const auto = c.spread(sizes.length, c.first + 0.3, Math.max(c.first + 0.3, c.last - 1.2));
  return spacedOut(sizes.map((size, i) => c.cue(size.at, auto[i])), STEP);
}

// The sheet at the first size (decorative text lines leave its middle free for the name), the dashed ghost
// that keeps the first size's outline once the sheet reshapes, and the two dimension lines.
function sheetHtml(k, { box, cx, cy }, sizes) {
  const { p } = k;
  const first = box(sizes[0]);
  const at = `left:${r1(cx - first.w / 2)}px;top:${r1(cy - first.h / 2)}px;width:${r1(first.w)}px;height:${r1(first.h)}px`;
  const lines = (widths) => widths.map((w) => `<i class="${p("txl")}" style="width:${w}%"></i>`).join("");
  const ghost = sizes.length > 1 ? `<div id="${p("ghost")}" class="${p("ghost")}" style="${at}"></div>` : "";
  // Padding in px from the sheet's own size: a percentage would resolve against the whole canvas.
  const padding = `padding:${r1(first.h * 0.08)}px ${r1(first.w * 0.11)}px`;
  return `<div id="${p("sheet")}" class="${p("sheet")}" style="${at};${padding}"><div>${lines([46, 78, 64])}</div><div>${lines([82, 58])}</div></div>${ghost}
<div id="${p("dw")}" class="${p("dw")}" style="left:${r1(cx - first.w / 2)}px;top:${r1(cy + first.h / 2 + LINE_GAP)}px;width:${r1(first.w)}px"></div>
<div id="${p("dh")}" class="${p("dh")}" style="left:${r1(cx + first.w / 2 + LINE_GAP)}px;top:${r1(cy - first.h / 2)}px;height:${r1(first.h)}px"></div>`;
}

// Size i's name on the sheet and its width and height labels, placed beside that size's outline. The first
// size's numbers start at 0 and count up.
function labelsHtml(k, { box, cx, cy, name }, size, i, unit) {
  const { p } = k;
  const b = box(size);
  const number = (id, value) => (i === 0 ? `<span id="${p(id)}">0</span>` : k.esc(value));
  const unitHtml = `<span class="${p("un")}">${k.esc(unit)}</span>`;
  const widthTop = r1(cy + b.h / 2 + LINE_GAP + LINE_W + LABEL_GAP);
  const heightLeft = r1(cx + b.w / 2 + LINE_GAP + LINE_W + LABEL_GAP);
  return `<div id="${p(`n${i}`)}" class="${p("nm")}" style="left:${r1(cx - name.width / 2)}px;top:${r1(cy - name.size / 2)}px;width:${r1(name.width)}px;height:${name.size}px">${k.esc(size.name)}</div>
<div id="${p(`wl${i}`)}" class="${p("dl")}" style="left:${r1(cx - LABEL_W / 2)}px;width:${LABEL_W}px;justify-content:center;top:${widthTop}px">${number(`wv${i}`, size.width)}${unitHtml}</div>
<div id="${p(`hl${i}`)}" class="${p("dl")}" style="left:${heightLeft}px;top:${r1(cy - LABEL_H / 2)}px">${number(`hv${i}`, size.height)}${unitHtml}</div>`;
}

// The sheet grows in, its name rises, the dimension lines draw out and the numbers count up.
function revealFirstSize(k, size, t) {
  k.grow("sheet", t, 0.7);
  k.rise("n0", t + 0.3, 16, 0.5);
  k.draw("dw", t + 0.4, 0.5);
  k.drawY("dh", t + 0.4, 0.5);
  k.fade("wl0", t + 0.5, 0.4);
  k.fade("hl0", t + 0.5, 0.4);
  k.count("wv0", size.width, t + 0.5, 1.0, decimalsOf(size.width));
  k.count("hv0", size.height, t + 0.5, 1.0, decimalsOf(size.height));
  k.sound("pop", t, 0.4);
}

// The labels of size i take the place of size i - 1, so they wait unseen (under reveal blueprint they would stack as ghosts).
const REPLACES_PREVIOUS = { ghost: false };

// The sheet and its dimension lines take size i, scaled against the first size around their centers, while
// the previous labels leave and the new ones arrive. The ghost shows the first size from the first reshape on.
function reshapeTo(k, sizes, i, t, scale) {
  const base = sizes[0];
  const size = sizes[i];
  const sx = r4(size.width / base.width);
  const sy = r4(size.height / base.height);
  if (i === 1) k.fade("ghost", t, 0.4);
  k.to("sheet", t, { scaleX: sx, scaleY: sy }, RESHAPE, "power2.inOut");
  k.to("dw", t, { scaleX: sx, y: r1(((size.height - base.height) * scale) / 2) }, RESHAPE, "power2.inOut");
  k.to("dh", t, { scaleY: sy, x: r1(((size.width - base.width) * scale) / 2) }, RESHAPE, "power2.inOut");
  for (const label of ["n", "wl", "hl"]) k.to(`${label}${i - 1}`, t, { opacity: 0, y: -12 }, 0.3, "power2.in");
  k.rise(`n${i}`, t + 0.45, 16, 0.5, REPLACES_PREVIOUS);
  k.fade(`wl${i}`, t + RESHAPE - 0.2, 0.4, REPLACES_PREVIOUS);
  k.fade(`hl${i}`, t + RESHAPE - 0.2, 0.4, REPLACES_PREVIOUS);
  k.sound("whoosh", t, 0.35);
}

function addNote(k, c, note, layout, fallback) {
  k.html.push(`<div id="${k.p("note")}" class="${k.p("note")}" style="top:${r1(layout.noteTop)}px">${k.chip(note.text ?? note, { tone: "accent", icon: "check" })}</div>`);
  k.rise("note", c.cue(note.at, fallback), 16);
}

const decimalsOf = (value) => (String(value).split(".")[1] ?? "").length;
const r1 = (x) => Math.round(x * 10) / 10;
const r4 = (x) => Math.round(x * 10000) / 10000;

// Each time kept, or moved later so it stands at least `step` after the one before.
const spacedOut = (times, step) => times.reduce((out, t, i) => [...out, i ? Math.max(t, out[i - 1] + step) : t], []);
