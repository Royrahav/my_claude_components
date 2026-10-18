// Opening: optional kicker words punch in one by one, clear out, then the logo lockup reveals and holds.
// Variants: kinetic (each kicker fills the screen in turn, then collapses into the lockup) and split
// (the lockup on the left; the kickers or the subtitle on a tinted panel on the right).
const KICK_IN = 0.55;
const KICK_CLEAR = 0.45; // kickers start clearing (a 0.4 s fade) this long before the lockup
const KICK_LEAD = KICK_IN + 0.3 + KICK_CLEAR; // latest kicker start before the lockup: in, a beat, out
const KICK_STEP = 0.3; // minimum stagger between kickers pulled earlier

export default function title(k, d, c) {
  const { p, css, html } = k;
  const kick = kickersOf(d);
  const n = kick.length;
  const cues = kickerCues(c, kick);
  const lockCue = c.cue(d.lockup_at, n ? Math.max(cues[n - 1] + KICK_LEAD, c.last * 0.62) : 0.5);
  const lockT = n ? Math.max(lockCue, c.first + KICK_LEAD + (n - 1) * KICK_STEP) : lockCue;
  // A kicker cued too close to the lockup is pulled earlier, so it is fully in before all kickers clear.
  const kT = cues.map((t, i) => Math.min(t, lockT - KICK_LEAD - (n - 1 - i) * KICK_STEP));

  css.push(`.${p("kick")}{position:absolute;left:220px;display:flex;align-items:center;gap:26px;font:700 84px/1 var(--font-display);color:var(--ink)}
.${p("kbar")}{width:10px;height:72px;border-radius:5px;background:var(--accent)}
${lockupCss(p)}`);

  const top0 = 450 - (n * 120) / 2;
  kick.forEach((w, i) => {
    html.push(`<div id="${p(`k${i}`)}" class="${p("kick")}" style="top:${top0 + i * 120}px"><span class="${p("kbar")}"></span>${k.esc(w.text)}</div>`);
    k.slide(`k${i}`, kT[i], -60, KICK_IN, { ghost: false });
    k.to(`k${i}`, lockT - KICK_CLEAR, { opacity: 0, x: -30 }, 0.4, "power2.in");
  });

  const logo = logoHtml(k, d);
  html.push(lockupHtml(k, d, logo));
  const lockup = { ghost: n === 0 }; // kickers take the lockup's place, so while they exist it waits unseen
  if (logo) k.grow("logo", lockT, 0.8, lockup);
  k.rise("t1", lockT + (logo ? 0.3 : 0), 24, 0.7, lockup);
  k.draw("acc", lockT + 0.7, 0.5);
  if (d.subtitle) k.fade("sub", lockT + 1.0, 0.6, lockup);

  k.ambient(Math.min(c.duration, lockT + 2));
  if (n) k.sound("whoosh", lockT - 0.3, 0.5);
  k.sound("chime", lockT + 0.3, 0.55);
  return { chrome: false };
}

const kickersOf = (d) => (d.kicker ?? []).map((w) => (typeof w === "string" ? { text: w } : w));

// Kickers land on their cues, or spread over the first part of the narration.
function kickerCues(c, kick) {
  const auto = c.spread(Math.max(kick.length, 1), c.first, Math.max(c.first + 0.6, c.last * 0.45));
  return kick.map((w, i) => c.cue(w.at, auto[i]));
}

const logoHtml = (k, d) => (k.hasLogo && d.logo !== false ? `<img id="${k.p("logo")}" class="${k.p("logo")}" src="theme/${k.theme.logo}" alt="">` : "");

// The centered lockup column: logo, title, accent rule and subtitle.
const lockupCss = (p) => `.${p("lock")}{position:absolute;left:0;right:0;top:0;height:900px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.${p("logo")}{width:560px;max-height:190px;object-fit:contain}
.${p("t1")}{font:700 88px/1.08 var(--font-display);color:var(--ink);margin-top:26px;max-width:1500px}
.${p("acc")}{width:64px;height:5px;border-radius:3px;background:var(--accent);margin:28px 0 22px;transform-origin:center}
.${p("sub")}{font:400 30px/1.4 var(--font-body);color:var(--muted);max-width:1300px}`;

function lockupHtml(k, d, logo) {
  const { p } = k;
  const subtitle = d.subtitle ? `<div id="${p("sub")}" class="${p("sub")}">${k.esc(d.subtitle)}</div>` : "";
  return `<div class="${p("lock")}">${logo}<div id="${p("t1")}" class="${p("t1")}">${k.esc(d.title)}</div><div id="${p("acc")}" class="${p("acc")}"></div>${subtitle}</div>`;
}

// kinetic ---------------------------------------------------------------------------------------------

const WORD_IN = 0.4;
const WORD_BEAT = 0.15; // shortest time a word holds fully in
const WORD_OUT = 0.25; // a word shrinks away and is gone as the next one lands
const WORD_STEP = WORD_IN + WORD_BEAT + WORD_OUT;
const COLLAPSE = 0.4; // the last word collapses into the lockup as it appears
const COLLAPSE_LEAD = WORD_IN + WORD_BEAT + COLLAPSE; // latest last-word start before the lockup
const HAND_OFF = { scale: 0.7, duration: WORD_OUT, ease: "power2.in" };
const INTO_LOCKUP = { scale: 0.15, duration: COLLAPSE, ease: "power3.in" };
const LOCKUP_CENTER_Y = 450; // middle of the lockup column
const WORD_BOX = 1728; // the width between the side margins
const WORD_EM = 0.72; // generous average glyph width of a bold display face, in em
const WORD_SIZE = { min: 110, max: 260 };
const WORD_LINE = 1.05;

// One kicker at a time fills the screen, sized to fit its length, then the last one collapses into the lockup.
function kineticTitle(k, d, c) {
  const { p, css, html } = k;
  const kick = kickersOf(d);
  const n = kick.length;
  const kT = spacedOut(kickerCues(c, kick), WORD_STEP);
  const lockCue = c.cue(d.lockup_at, n ? Math.max(kT[n - 1] + COLLAPSE_LEAD, c.last * 0.62) : 0.5);
  const lockT = n ? Math.max(lockCue, kT[n - 1] + COLLAPSE_LEAD) : lockCue;
  const exitOf = (i) => (i < n - 1 ? { t: kT[i + 1] - WORD_OUT, ...HAND_OFF } : { t: lockT - COLLAPSE, ...INTO_LOCKUP });

  css.push(`.${p("word")}{position:absolute;left:96px;width:${WORD_BOX}px;display:flex;justify-content:center;text-align:center;font-family:var(--font-display);font-weight:700;line-height:${WORD_LINE};color:var(--ink)}
.${p("wt")}{position:relative;display:inline-block}
.${p("wu")}{position:absolute;left:0;right:0;bottom:-4px;height:10px;border-radius:5px;background:var(--accent);transform-origin:left center}
${lockupCss(p)}`);

  kick.forEach((w, i) => {
    const size = wordSize(w.text);
    const top = Math.round(LOCKUP_CENTER_Y - (size * WORD_LINE) / 2);
    html.push(`<div id="${p(`w${i}`)}" class="${p("word")}" style="top:${top}px;font-size:${size}px"><span class="${p("wt")}">${k.esc(w.text)}<i id="${p(`u${i}`)}" class="${p("wu")}"></i></span></div>`);
    const exit = exitOf(i);
    k.pop(`w${i}`, kT[i], WORD_IN, { ghost: false });
    k.draw(`u${i}`, kT[i] + 0.15, 0.35);
    k.to(`w${i}`, exit.t, { opacity: 0, scale: exit.scale }, exit.duration, exit.ease);
    k.sound("pop", kT[i], 0.3);
  });

  const logo = logoHtml(k, d);
  html.push(lockupHtml(k, d, logo));
  const lockup = { ghost: n === 0 };
  if (logo) k.grow("logo", lockT, 0.8, lockup);
  k.pop("t1", lockT + (logo ? 0.2 : 0), 0.6, lockup);
  k.draw("acc", lockT + 0.7, 0.5);
  if (d.subtitle) k.fade("sub", lockT + 1.0, 0.6, lockup);

  k.ambient(Math.min(c.duration, lockT + 2));
  if (n) k.sound("whoosh", lockT - COLLAPSE, 0.45);
  k.sound("chime", lockT + 0.3, 0.55);
  return { chrome: false };
}

// Each time kept, or moved later so it stands at least `step` after the one before.
const spacedOut = (times, step) => times.reduce((out, t, i) => [...out, i ? Math.max(t, out[i - 1] + step) : t], []);

const wordSize = (text) => Math.max(WORD_SIZE.min, Math.min(WORD_SIZE.max, Math.floor(WORD_BOX / (text.length * WORD_EM))));

// split -----------------------------------------------------------------------------------------------

const PANEL = { left: 1000, width: 824, height: 640 };
const PANEL_LEAD = 0.4; // the panel is in before its first line arrives

// The lockup on the left from the start; the kickers, then the subtitle, fill a tinted panel on the right.
function splitTitle(k, d, c) {
  const { p, css, html } = k;
  const kick = kickersOf(d);
  const n = kick.length;
  const auto = c.spread(n, c.first + 0.6, Math.max(c.first + 1.2, c.last * 0.6));
  const kT = kick.map((w, i) => c.cue(w.at, auto[i]));
  const lockT = c.cue(d.lockup_at, 0.5);
  const subT = n ? kT[n - 1] + 0.7 : lockT + 1.0;
  const hasPanel = n > 0 || Boolean(d.subtitle);
  const panelT = Math.max(0.1, Math.min(lockT + PANEL_LEAD, (n ? kT[0] : subT) - PANEL_LEAD));
  const panelTop = k.centeredTop(PANEL.height);
  const box = `left:${PANEL.left}px;top:${panelTop}px;width:${PANEL.width}px;height:${PANEL.height}px;box-sizing:border-box`;

  css.push(`.${p("side")}{position:absolute;left:96px;top:150px;width:780px;height:710px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.${p("logo")}{width:420px;max-height:150px;object-fit:contain;object-position:left center;margin-bottom:30px}
.${p("t1")}{font:700 84px/1.08 var(--font-display);color:var(--ink);max-width:780px}
.${p("acc")}{width:64px;height:5px;border-radius:3px;background:var(--accent);margin-top:30px;transform-origin:left center}
.${p("pn")}{position:absolute;${box};background:var(--tint2);border:2px solid var(--line);border-radius:14px}
.${p("pc")}{position:absolute;${box};padding:56px 64px;display:flex;flex-direction:column;justify-content:center;gap:28px}
.${p("pk")}{display:flex;align-items:center;gap:22px;font:700 60px/1.1 var(--font-display);color:var(--ink)}
.${p("kbar")}{flex:none;width:9px;height:56px;border-radius:5px;background:var(--accent)}
.${p("sub")}{font:400 ${n ? 32 : 44}px/1.4 var(--font-body);color:var(--muted)}`);

  const logo = logoHtml(k, d);
  html.push(`<div class="${p("side")}">${logo}<div id="${p("t1")}" class="${p("t1")}">${k.esc(d.title)}</div><div id="${p("acc")}" class="${p("acc")}"></div></div>`);
  if (logo) k.grow("logo", lockT, 0.8);
  k.rise("t1", lockT + (logo ? 0.3 : 0), 24, 0.7);
  k.draw("acc", lockT + 0.7, 0.5);
  k.sound("chime", lockT + 0.3, 0.55);

  if (hasPanel) {
    const rows = kick.map((w, i) => `<div id="${p(`k${i}`)}" class="${p("pk")}"><span class="${p("kbar")}"></span>${k.esc(w.text)}</div>`).join("");
    const subtitle = d.subtitle ? `<div id="${p("sub")}" class="${p("sub")}">${k.esc(d.subtitle)}</div>` : "";
    html.push(`<div id="${p("pn")}" class="${p("pn")}"></div><div class="${p("pc")}">${rows}${subtitle}</div>`);
    k.grow("pn", panelT, 0.6);
    kick.forEach((_, i) => k.slide(`k${i}`, kT[i], 40, 0.5));
    if (d.subtitle) k.fade("sub", subT, 0.6);
    k.sound("whoosh", panelT, 0.35);
  }
  k.ambient(Math.min(c.duration, Math.max(lockT, hasPanel ? subT : 0) + 2));
  return { chrome: false };
}

export const variants = { kinetic: kineticTitle, split: splitTitle };
