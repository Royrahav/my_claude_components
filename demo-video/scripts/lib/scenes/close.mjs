// Closing lockup: logo + product + tagline phrases (last one in accent with an underline sweep) +
// optional small ref line. Holds still, then fades to the canvas (it is the final scene).

// Seconds of the final fade to the canvas; captions end before it starts.
export const FADE_OUT = 0.8;

export default function close(k, d, c) {
  const { p, css, html } = k;
  const phrases = d.tagline ?? [];
  const auto = c.spread(Math.max(phrases.length, 1), Math.max(c.first, 1.2), Math.max(c.first + 1, c.last - 0.4));
  const pT = phrases.map((ph, i) => c.cue(typeof ph === "string" ? undefined : ph.at, auto[i]));

  css.push(`.${p("lock")}{position:absolute;left:0;right:0;top:0;height:900px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.${p("logo")}{width:520px;max-height:180px;object-fit:contain}
.${p("t1")}{font:700 88px/1.08 var(--font-display);color:var(--ink);margin-top:24px;max-width:1500px}
.${p("tagl")}{display:flex;gap:22px;margin-top:34px;font:700 38px/1.2 var(--font-display);color:var(--ink)}
.${p("tagl")}>span{display:inline-block}
.${p("last")}{color:var(--accent-text);position:relative}
.${p("ul")}{position:absolute;left:0;right:0;bottom:-8px;height:4px;border-radius:2px;background:var(--accent);transform-origin:left center}
.${p("ref")}{position:absolute;left:0;right:0;top:790px;text-align:center;font:400 20px var(--font-body);color:var(--light)}`);

  const logo = k.hasLogo && d.logo !== false ? `<img id="${p("logo")}" class="${p("logo")}" src="theme/${k.theme.logo}" alt="">` : "";
  const spans = phrases
    .map((ph, i) => {
      const text = typeof ph === "string" ? ph : ph.text;
      const last = i === phrases.length - 1;
      return `<span id="${p(`ph${i}`)}"${last ? ` class="${p("last")}"` : ""}>${k.esc(text)}${last ? `<i id="${p("ul")}" class="${p("ul")}"></i>` : ""}</span>`;
    })
    .join("");
  html.push(`<div class="${p("lock")}">${logo}<div id="${p("t1")}" class="${p("t1")}">${k.esc(d.title)}</div><div class="${p("tagl")}">${spans}</div></div>`);
  if (d.ref) html.push(`<div id="${p("ref")}" class="${p("ref")}">${k.esc(d.ref)}</div>`);

  if (logo) k.grow("logo", 0.3, 0.8);
  k.rise("t1", 0.7, 24, 0.7);
  phrases.forEach((_, i) => k.rise(`ph${i}`, pT[i], 16, 0.5));
  if (phrases.length) k.draw("ul", pT[phrases.length - 1] + 0.5, 0.6);
  if (d.ref) k.fade("ref", (pT[pT.length - 1] ?? 1.5) + 0.8, 0.6);

  const still = Math.min(c.duration - 1, (pT[pT.length - 1] ?? 1.5) + 1.2);
  k.ambient(still);
  k.to("cam", c.duration - FADE_OUT, { opacity: 0 }, FADE_OUT, "power2.in");
  k.sound("chime", pT[0] ?? 0.8, 0.55);
  return { chrome: false };
}
