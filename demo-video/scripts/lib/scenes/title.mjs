// Opening: optional kicker words punch in one by one, clear out, then the logo lockup reveals and holds.
const KICK_IN = 0.55;
const KICK_CLEAR = 0.45; // kickers start clearing (a 0.4 s fade) this long before the lockup
const KICK_LEAD = KICK_IN + 0.3 + KICK_CLEAR; // latest kicker start before the lockup: in, a beat, out
const KICK_STEP = 0.3; // minimum stagger between kickers pulled earlier

export default function title(k, d, c) {
  const { p, css, html } = k;
  const kick = (d.kicker ?? []).map((w) => (typeof w === "string" ? { text: w } : w));
  const n = kick.length;
  const auto = c.spread(Math.max(n, 1), c.first, Math.max(c.first + 0.6, c.last * 0.45));
  const cues = kick.map((w, i) => c.cue(w.at, auto[i]));
  const lockCue = c.cue(d.lockup_at, n ? Math.max(cues[n - 1] + KICK_LEAD, c.last * 0.62) : 0.5);
  const lockT = n ? Math.max(lockCue, c.first + KICK_LEAD + (n - 1) * KICK_STEP) : lockCue;
  // A kicker cued too close to the lockup is pulled earlier, so it is fully in before all kickers clear.
  const kT = cues.map((t, i) => Math.min(t, lockT - KICK_LEAD - (n - 1 - i) * KICK_STEP));

  css.push(`.${p("kick")}{position:absolute;left:220px;display:flex;align-items:center;gap:26px;font:700 84px/1 var(--font-display);color:var(--ink)}
.${p("kbar")}{width:10px;height:72px;border-radius:5px;background:var(--accent)}
.${p("lock")}{position:absolute;left:0;right:0;top:0;height:900px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.${p("logo")}{width:560px;max-height:190px;object-fit:contain}
.${p("t1")}{font:700 88px/1.08 var(--font-display);color:var(--ink);margin-top:26px;max-width:1500px}
.${p("acc")}{width:64px;height:5px;border-radius:3px;background:var(--accent);margin:28px 0 22px;transform-origin:center}
.${p("sub")}{font:400 30px/1.4 var(--font-body);color:var(--muted);max-width:1300px}`);

  const top0 = 450 - (n * 120) / 2;
  kick.forEach((w, i) => {
    html.push(`<div id="${p(`k${i}`)}" class="${p("kick")}" style="top:${top0 + i * 120}px"><span class="${p("kbar")}"></span>${k.esc(w.text)}</div>`);
    k.slide(`k${i}`, kT[i], -60, KICK_IN);
    k.to(`k${i}`, lockT - KICK_CLEAR, { opacity: 0, x: -30 }, 0.4, "power2.in");
  });

  const logo = k.hasLogo && d.logo !== false ? `<img id="${p("logo")}" class="${p("logo")}" src="theme/${k.theme.logo}" alt="">` : "";
  html.push(`<div class="${p("lock")}">${logo}<div id="${p("t1")}" class="${p("t1")}">${k.esc(d.title)}</div><div id="${p("acc")}" class="${p("acc")}"></div>${d.subtitle ? `<div id="${p("sub")}" class="${p("sub")}">${k.esc(d.subtitle)}</div>` : ""}</div>`);
  if (logo) k.grow("logo", lockT, 0.8);
  k.rise("t1", lockT + (logo ? 0.3 : 0), 24, 0.7);
  k.draw("acc", lockT + 0.7, 0.5);
  if (d.subtitle) k.fade("sub", lockT + 1.0, 0.6);

  k.ambient(Math.min(c.duration, lockT + 2));
  if (n) k.sound("whoosh", lockT - 0.3, 0.5);
  k.sound("chime", lockT + 0.3, 0.55);
  return { chrome: false };
}
