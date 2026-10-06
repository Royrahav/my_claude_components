// Burned-in captions: phrase-length groups (cut at clauses, short tails merged, long clauses split
// into balanced halves, never after an article/possessive) with a seek-safe karaoke highlight.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { FADE_OUT } from "./scenes/close.mjs";
import { themeVars } from "./theme.mjs";

const MAX_WORDS = 8;
const MAX_CHARS = 46;
const SHORT = 3;
const GAP = 0.45;
const HOLD = 0.7; // seconds a group stays up after its last word, unless the next group starts first
const BREAK_BEFORE = new Set(["and", "with", "to", "through", "from", "for", "of", "into", "in", "on", "as", "against", "across", "using", "then", "or", "but", "which", "that", "so", "while", "when"]);
const NEVER_AFTER = new Set(["a", "an", "the", "and", "of", "to", "its", "their", "each", "every", "our", "your", "this", "these"]);
const r3 = (x) => Math.round(x * 1000) / 1000;
const textOf = (ws) => ws.map((w) => w.text).join(" ");
const fits = (ws) => ws.length <= MAX_WORDS && textOf(ws).length <= MAX_CHARS;
const bare = (w) => w.text.toLowerCase().replace(/[^a-z0-9]/g, "");
const numberish = (w) => /^\d/.test(w.text) || /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)/i.test(w.text);

function units(words) {
  const out = [];
  let u = [];
  for (const w of words) {
    const prev = u[u.length - 1];
    if (prev && (w.scene !== prev.scene || w.start - prev.end > GAP)) {
      out.push(u);
      u = [];
    }
    u.push(w);
    if (/[.?!,;:]$/.test(w.text)) {
      out.push(u);
      u = [];
    }
  }
  if (u.length) out.push(u);
  return out;
}

function mergeShort(us) {
  const out = [];
  for (const u of us) {
    const prev = out[out.length - 1];
    const flow = prev && prev[0].scene === u[0].scene && u[0].start - prev[prev.length - 1].end <= GAP;
    const clause = prev && /[,;:]$/.test(prev[prev.length - 1].text);
    if (flow && clause && (u.length <= SHORT || prev.length <= SHORT) && fits([...prev, ...u])) out[out.length - 1] = [...prev, ...u];
    else out.push(u);
  }
  return out;
}

function split(u) {
  if (fits(u) || u.length < 2) return [u];
  const k = Math.max(Math.ceil(u.length / MAX_WORDS), Math.ceil(textOf(u).length / MAX_CHARS));
  const total = textOf(u).length;
  const parts = [];
  let s = 0;
  for (let p = 1; p < k; p++) {
    const target = (total * p) / k;
    let best = s + 1;
    let score = Infinity;
    for (let cut = s + 1; cut < u.length; cut++) {
      let sc = Math.abs(textOf(u.slice(0, cut)).length - target);
      if (BREAK_BEFORE.has(bare(u[cut]))) sc -= 7;
      if (NEVER_AFTER.has(bare(u[cut - 1])) || (numberish(u[cut - 1]) && numberish(u[cut]))) sc += 12;
      if (sc < score) {
        score = sc;
        best = cut;
      }
    }
    parts.push(u.slice(s, best));
    s = best;
  }
  parts.push(u.slice(s));
  return parts.flatMap(split);
}

// A group ends HOLD after its last word or when the next group starts, whichever comes first. No group
// outlasts the video or runs into the close scene's fade-out; one that would start there is dropped.
export function captionGroups(tl) {
  const words = tl.scenes.flatMap((s) => s.words.map((w) => ({ scene: s.id, text: w.text, start: r3(s.start + w.start), end: r3(s.start + w.end) })));
  const groups = mergeShort(units(words)).flatMap(split);
  const endsWithClose = tl.scenes[tl.scenes.length - 1]?.type === "close";
  const cutoff = endsWithClose ? tl.total - FADE_OUT : tl.total;
  return groups
    .map((g, i) => {
      const nextStart = groups[i + 1]?.[0].start ?? Infinity;
      return {
        start: g[0].start,
        end: r3(Math.min(g[g.length - 1].end + HOLD, nextStart, cutoff)),
        words: g.map((w) => ({ text: w.text, start: w.start, end: w.end })),
      };
    })
    .filter((g) => g.end > g.start);
}

// direction.captions. `.cap-pill` is the box around a group's words in every style: a centered pill, a
// full-width band at the bottom (lower), or no box with a canvas-colored halo (minimal). Each stays in the
// caption band (y 900 to 1080), and the words are large text (44px bold), so AA needs 3:1.
const CAPTION_STYLES = {
  pill: { box: ".cap-pill{max-width:78%;padding:16px 40px 20px;background:color-mix(in srgb,var(--accent) 4%,var(--canvas));border:1.5px solid color-mix(in srgb,var(--accent) 20%,transparent);border-radius:14px}", line: "" },
  lower: {
    box: ".cap-pill{position:absolute;left:0;right:0;bottom:0;height:150px;box-sizing:border-box;padding:0 96px;display:flex;align-items:center;background:color-mix(in srgb,var(--accent) 4%,var(--canvas));border-top:3px solid var(--accent)}",
    line: ".cap-line{justify-content:flex-start}",
  },
  minimal: {
    box: ".cap-pill{max-width:78%}",
    line: ".cap-line{text-shadow:0 0 14px var(--canvas),0 0 4px var(--canvas)}\n.cap-line .is-active{text-shadow:none}",
  },
};

export function writeCaptions(root, tl, theme, fontsCss, style) {
  writeFileSync(join(root, "compositions", "captions.html"), captionsHtml(tl, theme, fontsCss, style));
  return captionGroups(tl).length;
}

// The captions sub-composition: each group shows from its start to its end, its words lit as spoken.
export function captionsHtml(tl, theme, fontsCss, style = "pill") {
  const groups = captionGroups(tl);
  const look = CAPTION_STYLES[style];
  return `<template id="captions-template" data-composition-id="captions" data-width="1920" data-height="1080">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
${fontsCss}
#root{position:absolute;inset:0;pointer-events:none;${themeVars(theme)}}
.cap-stage{position:absolute;left:0;right:0;top:900px;height:180px;display:flex;align-items:center;justify-content:center}
.cap-group{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0}
${look.box}
.cap-line{display:flex;flex-wrap:wrap;justify-content:center;gap:.08em .14em;font:700 44px/1.1 var(--font-body);letter-spacing:-.005em}${look.line ? `\n${look.line}` : ""}
.cap-word{display:inline-block;padding:0 .1em;border-radius:.28em;color:color-mix(in srgb,var(--ink) 68%,var(--canvas))}
.cap-word.is-active{color:var(--on-accent);background:var(--accent-text)}
.cap-word.is-spoken{color:var(--ink);background:transparent}
</style>
<div id="root" data-composition-id="captions" data-start="0" data-duration="${tl.total}" data-width="1920" data-height="1080">
<div id="cap-stage" class="cap-stage"></div>
</div>
<script>
(function () {
  var GROUPS = ${JSON.stringify(groups)};
  var DURATION = ${tl.total};
  var stage = document.getElementById("cap-stage");
  GROUPS.forEach(function (g, i) {
    var el = document.createElement("div");
    el.className = "cap-group";
    el.id = "cap-g" + i;
    var pill = document.createElement("div");
    pill.className = "cap-pill";
    var line = document.createElement("div");
    line.className = "cap-line";
    g.words.forEach(function (w, j) {
      var s = document.createElement("span");
      s.className = "cap-word";
      s.id = "cap-w" + i + "-" + j;
      s.textContent = w.text;
      line.appendChild(s);
    });
    pill.appendChild(line);
    el.appendChild(pill);
    stage.appendChild(el);
  });
  var tl = gsap.timeline({ paused: true });
  GROUPS.forEach(function (g, i) {
    var el = document.getElementById("cap-g" + i);
    var start = g.start;
    var end = g.end;
    tl.set(el, { opacity: 1 }, start);
    tl.set(el, { opacity: 0 }, end);
    g.words.forEach(function (w, j) {
      var we = document.getElementById("cap-w" + i + "-" + j);
      var at = Math.max(start, w.start);
      tl.set(we, { className: "cap-word" }, start);
      tl.set(we, { className: "cap-word is-active" }, at);
      if (j + 1 < g.words.length) tl.set(we, { className: "cap-word is-spoken" }, Math.max(start, g.words[j + 1].start));
      else tl.set(we, { className: "cap-word is-spoken" }, Math.min(end, w.end + 0.1));
    });
  });
  tl.to({}, { duration: DURATION }, 0);
  window.__timelines["captions"] = tl;
})();
</script>
</template>
`;
}
