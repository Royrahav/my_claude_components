// Closing scene. Default: logo + title + 1-3 tagline phrases (last one in accent with an underline sweep,
// `underline: false` drops the sweep) + optional small ref line. Variants: punchline (one huge line),
// cta (the next action), callback (the opening line answered) and sting (the logo, 2-3 s). Each holds
// still, then fades to the canvas (it is the final scene).

// Seconds of the final fade to the canvas; captions end before it starts.
export const FADE_OUT = 0.8;

const MAX_TAGLINES = 3;

// The tagline phrases: a list of up to three (none is allowed); anything else stops the build.
function taglineOf(d, id) {
  const phrases = d.tagline ?? [];
  if (!Array.isArray(phrases) || phrases.length > MAX_TAGLINES) throw new Error(`${id}: close needs data.tagline to be a list of at most ${MAX_TAGLINES} phrases`);
  return phrases;
}

export default function close(k, d, c) {
  const { p, css, html } = k;
  const phrases = taglineOf(d, k.id);
  const sweep = d.underline !== false;
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
      return `<span id="${p(`ph${i}`)}"${last ? ` class="${p("last")}"` : ""}>${k.esc(text)}${last && sweep ? `<i id="${p("ul")}" class="${p("ul")}"></i>` : ""}</span>`;
    })
    .join("");
  html.push(`<div class="${p("lock")}">${logo}<div id="${p("t1")}" class="${p("t1")}">${k.esc(d.title)}</div><div class="${p("tagl")}">${spans}</div></div>`);
  if (d.ref) html.push(refHtml(k, d, DEFAULT_REF_TOP));

  if (logo) k.grow("logo", 0.3, 0.8);
  k.rise("t1", 0.7, 24, 0.7);
  phrases.forEach((_, i) => k.rise(`ph${i}`, pT[i], 16, 0.5, SPOKEN));
  if (phrases.length && sweep) k.draw("ul", pT[phrases.length - 1] + 0.5, 0.6);
  if (d.ref) k.fade("ref", (pT[pT.length - 1] ?? 1.5) + 0.8, 0.6);

  const still = Math.min(c.duration - 1, (pT[pT.length - 1] ?? 1.5) + 1.2);
  k.ambient(still);
  k.to("cam", c.duration - FADE_OUT, { opacity: 0 }, FADE_OUT, "power2.in");
  k.sound("chime", pT[0] ?? 0.8, 0.55);
  return { chrome: false };
}

// variants ----------------------------------------------------------------------------------------------

const MAX_STEPS = 3;
const REVEAL_MARGIN = 1.2; // the last reveal lands this long before the fade-out starts
const STING_MARGIN = 0.5; // the sting is only seconds long
const LINE_SIZES = [[20, 150], [40, 120], [70, 96]]; // [longest line in characters, font size]
const LINE_MIN = 80;
const WORD_STEP = { min: 0.12, max: 0.4 };
const CALLBACK_GAP = 1.4; // the answer lands at least this long after the hook
const DIMMED_HOOK = 0.4;
// The close's tagline, punchline and answer are said before they are shown, so under reveal blueprint they stay hidden
// until their cue instead of showing as ghosts.
const SPOKEN = { ghost: false };

const DEFAULT_REF_TOP = 790; // the default variant's ref line; the other variants share SHARED_REF_TOP
const SHARED_REF_TOP = 810;
const REF_PATCH = { charPx: 12, minWidth: 320, height: 110, boxHeight: 28, textShare: 0.6, opaquePercent: 70 };

// What every variant shares: a small logo top left, an optional ref line near the bottom, the ambient
// drift, the fade to the canvas and the close's chime.
const smallLogoCss = (p) => `.${p("slogo")}{position:absolute;left:96px;top:56px;height:56px;max-width:260px;object-fit:contain;object-position:left center}
.${p("ref")}{position:absolute;left:0;right:0;top:810px;text-align:center;font:400 20px var(--font-body);color:var(--light)}`;

const smallLogo = (k, d) => (k.hasLogo && d.logo !== false ? `<img id="${k.p("slogo")}" class="${k.p("slogo")}" src="theme/${k.theme.logo}" alt="">` : "");

const refHtml = (k, d, top = SHARED_REF_TOP) => (d.ref ? `${refPatch(k, d, top)}<div id="${k.p("ref")}" class="${k.p("ref")}">${k.esc(d.ref)}</div>` : "");

// The ref is small light text whose contrast has no room to spare. On the persistent world (background "world") its
// orbs can tint the canvas behind it, so the ref gets its own patch of plain canvas, feathered at the edge, and its box
// shrinks to the text so the checker samples only that patch (the box is otherwise the full width). The world stays
// visible everywhere else. Nothing changes for other backgrounds.
function refPatch(k, d, top) {
  if (k.direction.background !== "world") return "";
  const box = Math.ceil(d.ref.length * REF_PATCH.charPx);
  const width = Math.max(REF_PATCH.minWidth, Math.ceil(box / REF_PATCH.textShare));
  k.css.push(`#${k.p("ref")}{left:${960 - box / 2}px;right:auto;width:${box}px;white-space:nowrap}`);
  k.css.push(`.${k.p("refbg")}{position:absolute;left:${960 - width / 2}px;top:${top + REF_PATCH.boxHeight / 2 - REF_PATCH.height / 2}px;width:${width}px;height:${REF_PATCH.height}px;background:radial-gradient(closest-side,var(--canvas) ${REF_PATCH.opaquePercent}%,transparent)}`);
  return `<div class="${k.p("refbg")}"></div>`;
}

// A reveal time, moved earlier when it would land too close to the fade-out.
const settler = (c, margin = REVEAL_MARGIN) => (t) => Math.min(t, Math.max(0.2, c.duration - FADE_OUT - margin));

function finishClose(k, c, d, { logo, chimeAt, refAt }) {
  if (logo) k.grow("slogo", 0.2, 0.6);
  if (d.ref) k.fade("ref", refAt, 0.6);
  k.ambient();
  k.to("cam", c.duration - FADE_OUT, { opacity: 0 }, FADE_OUT, "power2.in");
  k.sound("chime", chimeAt, 0.55);
  return { chrome: false };
}

// punchline: one huge sentence, revealed word by word, then an optional sub line.
function punchlineClose(k, d, c) {
  const { p, css, html } = k;
  const line = k.need(d, "line", "close punchline");
  const words = line.trim().split(/\s+/);
  const settle = settler(c);
  const t0 = c.cue(d.at, Math.max(c.first, 0.5));
  const step = Math.min(WORD_STEP.max, Math.max(WORD_STEP.min, (c.last - t0) / words.length));
  const size = (LINE_SIZES.find(([chars]) => line.length <= chars) ?? [0, LINE_MIN])[1];

  css.push(`.${p("pl")}{position:absolute;left:160px;width:1600px;top:170px;height:520px;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;column-gap:.28em;text-align:center;font:900 ${size}px/1.08 var(--font-display);color:var(--ink)}
.${p("pw")}{display:inline-block}
.${p("pw")}:last-child{color:var(--accent-large)}
.${p("psub")}{position:absolute;left:160px;width:1600px;top:716px;text-align:center;font:700 40px/1.25 var(--font-display);color:var(--muted)}
${smallLogoCss(p)}`);
  const logo = smallLogo(k, d);
  html.push(`${logo}<div class="${p("pl")}">${words.map((w, i) => `<span id="${p(`w${i}`)}" class="${p("pw")}">${k.esc(w)}</span>`).join("")}</div>`);
  if (d.sub) html.push(`<div id="${p("psub")}" class="${p("psub")}">${k.esc(d.sub)}</div>`);
  html.push(refHtml(k, d));

  const times = words.map((_, i) => settle(t0 + i * step));
  times.forEach((t, i) => k.rise(`w${i}`, t, 28, 0.4, SPOKEN));
  const lastT = times[times.length - 1];
  if (d.sub) k.fade("psub", settle(lastT + 0.5), 0.6, SPOKEN);
  k.sound("whoosh", t0, 0.3);
  return finishClose(k, c, d, { logo, chimeAt: lastT, refAt: settle(lastT + 1) });
}

// cta: the action huge, up to three numbered steps, one command or setting line, and where to find it.
function ctaClose(k, d, c) {
  const { p, css, html } = k;
  const action = k.need(d, "action", "close cta");
  const steps = stepsOf(d, k.id);
  const settle = settler(c);
  const auto = c.spread(Math.max(steps.length, 1), Math.max(c.first + 0.5, 1), Math.max(c.first + 1.5, c.last - 0.3));
  const stepT = steps.map((s, i) => settle(c.cue(s.at, auto[i])));
  const tail = stepT[stepT.length - 1] ?? 1;

  css.push(`.${p("cta")}{position:absolute;left:96px;width:1728px;top:150px;height:640px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;text-align:center}
.${p("act")}{font:900 ${action.length > 18 ? 96 : 130}px/1.05 var(--font-display);color:var(--accent-large)}
.${p("stp")}{display:flex;flex-direction:column;align-items:flex-start;gap:18px}
.${p("st")}{display:flex;align-items:center;gap:22px;font:700 40px/1.2 var(--font-display);color:var(--ink)}
.${p("num")}{flex:none;display:flex;align-items:center;justify-content:center;width:54px;height:54px;border-radius:50%;background:var(--accent-text);color:var(--on-accent);font:900 28px/1 var(--font-body)}
.${p("where")}{font:400 30px/1.3 var(--font-body);color:var(--muted)}
${smallLogoCss(p)}`);
  const logo = smallLogo(k, d);
  const rows = steps.map((s, i) => `<div id="${p(`st${i}`)}" class="${p("st")}"><span class="${p("num")}">${i + 1}</span><span>${k.esc(s.text)}</span></div>`).join("");
  const code = d.code ? `<div id="${p("cd")}" class="${p("code")}">${k.esc(d.code)}</div>` : "";
  const where = d.where ? `<div id="${p("where")}" class="${p("where")}">${k.esc(d.where)}</div>` : "";
  html.push(`${logo}<div class="${p("cta")}"><div id="${p("act")}" class="${p("act")}">${k.esc(action)}</div>${steps.length ? `<div class="${p("stp")}">${rows}</div>` : ""}${code}${where}</div>${refHtml(k, d)}`);

  k.pop("act", settle(Math.max(c.first, 0.5)), 0.6);
  steps.forEach((_, i) => k.slide(`st${i}`, stepT[i], -40, 0.5));
  if (d.code) k.rise("cd", settle(tail + 0.5), 16);
  if (d.where) k.fade("where", settle(tail + 1), 0.6);
  k.sound("whoosh", 0.4, 0.3);
  return finishClose(k, c, d, { logo, chimeAt: tail, refAt: settle(tail + 1.4) });
}

// Steps are up to three entries, each a text or { text, at }.
function stepsOf(d, id) {
  const raw = d.steps ?? [];
  const message = `${id}: close cta needs data.steps to be a list of at most ${MAX_STEPS} texts or { text, at }`;
  if (!Array.isArray(raw) || raw.length > MAX_STEPS) throw new Error(message);
  const steps = raw.map((s) => (typeof s === "string" ? { text: s } : s));
  if (!steps.every((s) => String(s?.text ?? "").trim() !== "")) throw new Error(message);
  return steps;
}

// callback: the opening line appears, is struck through, and the answer lands in its place.
function callbackClose(k, d, c) {
  const { p, css, html } = k;
  const hook = k.need(d, "hook", "close callback");
  const answer = k.need(d, "answer", "close callback");
  const settle = settler(c);
  const hookT = settle(c.cue(d.hook_at, 0.6));
  const answerT = settle(Math.max(c.cue(d.answer_at, c.last * 0.55), hookT + CALLBACK_GAP));

  css.push(`.${p("cb")}{position:absolute;left:160px;width:1600px;top:150px;height:640px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:48px;text-align:center}
.${p("hk")}{position:relative;display:inline-block;font:700 ${hook.length > 40 ? 52 : 66}px/1.2 var(--font-display);color:var(--ink)}
.${p("hs")}{position:absolute;left:-8px;right:-8px;top:54%;height:6px;border-radius:3px;background:var(--accent);transform-origin:left center}
.${p("an")}{font:900 ${answer.length > 24 ? 88 : 128}px/1.06 var(--font-display);color:var(--accent-large);max-width:1600px}
${smallLogoCss(p)}`);
  const logo = smallLogo(k, d);
  html.push(`${logo}<div class="${p("cb")}"><div id="${p("hk")}" class="${p("hk")}">${k.esc(hook)}<i id="${p("hs")}" class="${p("hs")}"></i></div><div id="${p("an")}" class="${p("an")}">${k.esc(answer)}</div></div>${refHtml(k, d)}`);

  k.rise("hk", hookT, 20, 0.5);
  k.draw("hs", answerT, 0.4);
  k.to("hk", answerT + 0.1, { opacity: DIMMED_HOOK }, 0.5);
  k.punch("an", answerT + 0.3, 0.5, SPOKEN);
  k.sound("whoosh", answerT, 0.35);
  return finishClose(k, c, d, { logo, chimeAt: answerT + 0.3, refAt: settle(answerT + 1.2) });
}

// sting: the logo (the product name without one) and a quick reveal; made for 2-3 s, so silent works.
function stingClose(k, d, c) {
  const { p, css, html } = k;
  const settle = settler(c, STING_MARGIN);
  const showLogo = k.hasLogo && d.logo !== false;
  const name = showLogo ? "" : String(k.brief.product ?? d.title ?? "").trim();
  if (!showLogo && !name) throw new Error(`${k.id}: close sting needs a theme logo, brief.product or data.title`);

  css.push(`.${p("sg")}{position:absolute;left:0;right:0;top:0;height:900px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;text-align:center}
.${p("big")}{width:560px;max-height:200px;object-fit:contain}
.${p("nm")}{font:900 130px/1.05 var(--font-display);color:var(--ink)}
.${p("tt")}{font:700 36px/1.2 var(--font-display);color:var(--muted)}
${smallLogoCss(p)}`);
  const mark = showLogo ? `<img id="${p("big")}" class="${p("big")}" src="theme/${k.theme.logo}" alt="">` : `<div id="${p("big")}" class="${p("nm")}">${k.esc(name)}</div>`;
  const title = d.title ? `<div id="${p("tt")}" class="${p("tt")}">${k.esc(d.title)}</div>` : "";
  html.push(`<div class="${p("sg")}">${mark}${title}</div>${refHtml(k, d)}`);

  k.grow("big", settle(0.15), 0.5);
  if (d.title) k.fade("tt", settle(0.6), 0.4);
  return finishClose(k, c, d, { logo: "", chimeAt: settle(0.2), refAt: settle(0.9) });
}

export const variants = { punchline: punchlineClose, cta: ctaClose, callback: callbackClose, sting: stingClose };
