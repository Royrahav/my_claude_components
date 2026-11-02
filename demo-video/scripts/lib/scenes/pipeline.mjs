// Architecture at a glance: 2-5 stations left to right, labelled links, chips under stations,
// optional dashed helpers, and a packet that travels the whole path at the end.
// Variant: vertical (stations top to bottom, best for 2-4).
export default function pipeline(k, d, c) {
  const { p, css, html } = k;
  const st = d.stations ?? [];
  const n = st.length;
  const links = d.links ?? [];
  const gap = n >= 5 ? 90 : 115;
  const w = Math.min(380, Math.floor((1728 - (n - 1) * gap) / n));
  const left0 = 96 + Math.floor((1728 - (n * w + (n - 1) * gap)) / 2);
  const top = d.title ? 300 : 250;
  const hgt = 240;
  const midY = top + hgt / 2;
  const xs = st.map((_, i) => left0 + i * (w + gap));

  css.push(`.${p("st")}{position:absolute;top:${top}px;width:${w}px;height:${hgt}px;box-sizing:border-box;background:var(--tint);border:2px solid var(--line);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:0 16px;text-align:center}
.${p("st")}.${p("hero")}{background:var(--surface);border:3px solid var(--accent)}
.${p("stt")}{font:700 ${w < 330 ? 26 : 30}px/1.2 var(--font-display);color:var(--ink)}
.${p("ln")}{position:absolute;top:${midY - 2}px;height:4px;background:var(--accent);border-radius:2px;transform-origin:left center}
.${p("lk")}{position:absolute;top:${midY - 58}px;display:flex;justify-content:center}
.${p("under")}{position:absolute;top:${top + hgt + 24}px;width:${w}px;display:flex;flex-direction:column;align-items:center;gap:10px}
.${p("help")}{position:absolute;top:770px;width:400px;display:flex;justify-content:center}
.${p("hl")}{position:absolute;top:${midY + 2}px;height:${770 - midY - 2}px;border-left:3px dashed var(--light);transform-origin:top center}
.${p("pk")}{position:absolute;top:${midY - 13}px;width:26px;height:26px;border-radius:50%;background:var(--accent-text);border:4px solid var(--surface);box-sizing:border-box}`);
  if (d.title) {
    html.push(`<div id="${p("h")}" class="${p("h2")}">${k.esc(d.title)}</div>`);
    k.rise("h", 0.2);
  }

  const T = stationTimes(c, st);
  st.forEach((s, i) => {
    html.push(`<div id="${p(`s${i}`)}" class="${p("st")}${s.hero ? ` ${p("hero")}` : ""}" style="left:${xs[i]}px">${k.icon(s.icon ?? "layers", { size: 76 })}<div class="${p("stt")}">${k.esc(s.title)}</div></div>`);
    k.grow(`s${i}`, T[i], 0.6);
    const under = underHtml(k, s);
    if (under.length) {
      html.push(`<div id="${p(`u${i}`)}" class="${p("under")}" style="left:${xs[i]}px">${under.join("")}</div>`);
      k.rise(`u${i}`, T[i] + 0.45, 14, 0.45);
    }
    if (i > 0) {
      const lx = xs[i - 1] + w;
      html.push(`<div id="${p(`l${i}`)}" class="${p("ln")}" style="left:${lx}px;width:${gap}px"></div>`);
      k.draw(`l${i}`, linkDrawTime(T[i]), LINK_DRAW);
      k.flow(`l${i}`, linkDrawTime(T[i]) + LINK_DRAW);
      const L = links[i - 1];
      if (L?.label) {
        html.push(`<div id="${p(`k${i}`)}" class="${p("lk")}" style="left:${lx - 30}px;width:${gap + 60}px">${linkLabelHtml(k, L)}</div>`);
        k.pop(`k${i}`, c.cue(L.at, T[i] - 0.1), 0.4);
      }
    }
  });

  (d.helpers ?? []).forEach((hp, j) => {
    const cx = hp.link != null ? xs[hp.link] + w + gap / 2 : xs[hp.under ?? 0] + w / 2;
    const t = helperTime(c, hp, T);
    if (hp.link != null) {
      html.push(`<div id="${p(`hl${j}`)}" class="${p("hl")}" style="left:${cx - 1}px"></div>`);
      k.drawY(`hl${j}`, t, 0.5);
    }
    html.push(`<div id="${p(`hp${j}`)}" class="${p("help")}" style="left:${Math.max(96, Math.min(1824 - 400, cx - 200))}px">${k.chip(hp.text, { tone: "neutral", dashed: true })}</div>`);
    k.fade(`hp${j}`, t + (hp.link != null ? 0.4 : 0), 0.6);
  });

  if (d.packet !== false && n > 1) sendPacket(k, c, T, { axis: "x", stops: xs, start: `left:${xs[0] + w / 2 - 13}px` });
  k.ambient();
  return { chrome: true };
}

// Stations land on their cues, or spread over the narration with time left for the packet.
function stationTimes(c, stations) {
  const auto = c.spread(stations.length, c.first + 0.4, c.last - 0.6);
  return stations.map((s, i) => c.cue(s.at, auto[i]));
}

// A link draws in just before the station it leads to.
const LINK_DRAW = 0.45;
const linkDrawTime = (stationT) => Math.max(0.2, stationT - LINK_DRAW);

const helperTime = (c, hp, T) => c.cue(hp.at, Math.max(T[T.length - 1] + 0.8, c.last - 1.6));

const underHtml = (k, s) => [...(s.chips ?? []).map((t) => k.chip(t, { tone: "accent" })), ...(s.code ? [`<span class="${k.p("code")}">${k.esc(s.code)}</span>`] : [])];

const linkLabelHtml = (k, L) => (L.mono ? `<span class="${k.p("code")}" style="font-size:20px;padding:4px 12px">${k.esc(L.label)}</span>` : k.chip(L.label, { size: 20 }));

// After the last station, a packet travels the whole path, one leg per link: it starts where the `start`
// style puts it and moves along `axis` through the station positions in `stops`.
function sendPacket(k, c, T, { axis, stops, start }) {
  const n = stops.length;
  const t0 = Math.max(T[n - 1] + 1.0, c.duration - 3.2);
  k.html.push(`<div id="${k.p("pk")}" class="${k.p("pk")}" style="${start}"></div>`);
  k.pop("pk", t0, 0.3);
  const per = Math.min(0.7, Math.max(0.35, (c.duration - t0 - 0.8) / (n - 1)));
  for (let i = 1; i < n; i++) k.to("pk", t0 + 0.3 + (i - 1) * per, { [axis]: stops[i] - stops[0] }, per, "power1.inOut");
  k.sound("whoosh", t0, 0.35);
}

// vertical --------------------------------------------------------------------------------------------

// Station height and link length by station count: five stations still fit below a headline.
const V_SIZES = { 2: { h: 150, gap: 150 }, 3: { h: 130, gap: 100 }, 4: { h: 110, gap: 60 }, 5: { h: 88, gap: 45 } };
const vSizesFor = (count) => V_SIZES[Math.min(5, Math.max(2, count))];
const V_BOX_W = 560;
const V_PAD = 26;
const V_BOX_X = { withHelpers: 456, alone: 680 };
const HELPER_X = 1424; // a 400px helper column that ends at the right margin
const LABEL_GAP = 22; // between a link and its label, left of it

// The links and the packet run down a lane through the station icons, clear of every text. Link labels sit
// left of the lane, chips and code right of each station, helpers in a column on the right.
function verticalPipeline(k, d, c) {
  const { p, css, html } = k;
  const st = d.stations ?? [];
  const n = st.length;
  const links = d.links ?? [];
  const helpers = d.helpers ?? [];
  const { h, gap } = vSizesFor(n);
  const icon = h >= 110 ? 56 : 46;
  const boxX = helpers.length ? V_BOX_X.withHelpers : V_BOX_X.alone;
  const laneX = boxX + V_PAD + icon / 2;
  const top = k.centeredTop(n * h + Math.max(0, n - 1) * gap, { title: Boolean(d.title) });
  const ys = st.map((_, i) => top + i * (h + gap));
  const gapTop = (i) => ys[i] + h; // the link below station i

  css.push(verticalCss(p, { boxX, laneX, h, gap }));
  if (d.title) {
    html.push(`<div id="${p("h")}" class="${p("h2")}">${k.esc(d.title)}</div>`);
    k.rise("h", 0.2);
  }

  const T = stationTimes(c, st);
  st.forEach((s, i) => {
    html.push(`<div id="${p(`s${i}`)}" class="${p("vs")}${s.hero ? ` ${p("hero")}` : ""}" style="top:${ys[i]}px">${k.icon(s.icon ?? "layers", { size: icon })}<div class="${p("stt")}">${k.esc(s.title)}</div></div>`);
    k.grow(`s${i}`, T[i], 0.6);
    const under = underHtml(k, s);
    if (under.length) {
      html.push(`<div id="${p(`u${i}`)}" class="${p("vun")}" style="top:${ys[i]}px">${under.join("")}</div>`);
      k.rise(`u${i}`, T[i] + 0.45, 14, 0.45);
    }
    if (i > 0) {
      html.push(`<div id="${p(`l${i}`)}" class="${p("vln")}" style="top:${gapTop(i - 1)}px"></div>`);
      k.drawY(`l${i}`, linkDrawTime(T[i]), LINK_DRAW);
      k.flow(`l${i}`, linkDrawTime(T[i]) + LINK_DRAW, { axis: "y" });
      const L = links[i - 1];
      if (L?.label) {
        html.push(`<div id="${p(`k${i}`)}" class="${p("vlk")}" style="top:${gapTop(i - 1)}px">${linkLabelHtml(k, L)}</div>`);
        k.pop(`k${i}`, c.cue(L.at, T[i] - 0.1), 0.4);
      }
    }
  });

  helpers.forEach((hp, j) => {
    const t = helperTime(c, hp, T);
    const onLink = hp.link != null;
    const row = onLink ? { top: gapTop(hp.link), height: gap } : { top: ys[hp.under ?? 0], height: h };
    if (onLink) {
      html.push(`<div id="${p(`hl${j}`)}" class="${p("vhl")}" style="top:${row.top + gap / 2 - 1}px"></div>`);
      k.draw(`hl${j}`, t, 0.5);
    }
    html.push(`<div id="${p(`hp${j}`)}" class="${p("vhp")}" style="top:${row.top}px;height:${row.height}px">${k.chip(hp.text, { tone: "neutral", dashed: true })}</div>`);
    k.fade(`hp${j}`, t + (onLink ? 0.4 : 0), 0.6);
  });

  if (d.packet !== false && n > 1) sendPacket(k, c, T, { axis: "y", stops: ys, start: `left:${laneX - 13}px;top:${ys[0] + h / 2 - 13}px` });
  k.ambient();
  return { chrome: true };
}

function verticalCss(p, { boxX, laneX, h, gap }) {
  return `.${p("vs")}{position:absolute;left:${boxX}px;width:${V_BOX_W}px;height:${h}px;box-sizing:border-box;background:var(--tint);border:2px solid var(--line);border-radius:14px;display:flex;align-items:center;gap:20px;padding:0 ${V_PAD}px}
.${p("vs")}.${p("hero")}{background:var(--surface);border:3px solid var(--accent)}
.${p("stt")}{font:700 ${h >= 110 ? 30 : 26}px/1.2 var(--font-display);color:var(--ink)}
.${p("vln")}{position:absolute;left:${laneX - 2}px;width:4px;height:${gap}px;background:var(--accent);border-radius:2px;transform-origin:top center}
.${p("vlk")}{position:absolute;right:${1920 - (laneX - LABEL_GAP)}px;height:${gap}px;display:flex;align-items:center}
.${p("vun")}{position:absolute;left:${boxX + V_BOX_W + 24}px;height:${h}px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:10px}
.${p("vhl")}{position:absolute;left:${laneX + 2}px;width:${HELPER_X - laneX - 2}px;height:0;border-top:3px dashed var(--light);transform-origin:left center}
.${p("vhp")}{position:absolute;left:${HELPER_X}px;width:400px;display:flex;align-items:center}
.${p("pk")}{position:absolute;width:26px;height:26px;border-radius:50%;background:var(--accent-text);border:4px solid var(--surface);box-sizing:border-box}`;
}

export const variants = { vertical: verticalPipeline };
