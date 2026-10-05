// Scene kit: every template builds HTML/CSS/timeline through these helpers so all scenes share one
// look (theme vars, dot-grid canvas, chrome, chips, cards, icons, motion vocabulary) and one
// lint-clean HyperFrames sub-composition shape. Ids/classes are prefixed with the scene id.

import { rgba, themeVars } from "./theme.mjs";

export const ICONS = {
  printer: '<path d="M18 24V8h28v16"/><rect x="7" y="24" width="50" height="22" rx="6"/><path d="M18 39h28v17H18z"/><path d="M47 31h2"/>',
  container: '<rect x="7" y="14" width="50" height="36" rx="6"/><path d="M19 20v24M29 20v24M39 20v24M49 20v24"/>',
  server: '<rect x="9" y="8" width="46" height="20" rx="5"/><rect x="9" y="36" width="46" height="20" rx="5"/><path d="M17 18h3M17 46h3"/>',
  gate: '<path d="M10 56V28a22 22 0 0 1 44 0v28"/><path d="M22 56V31a10 10 0 0 1 20 0v25"/><path d="M6 56h52"/>',
  queue: '<rect x="9" y="9" width="46" height="11" rx="4"/><rect x="9" y="27" width="46" height="11" rx="4"/><rect x="9" y="45" width="46" height="11" rx="4"/>',
  cloud: '<path d="M17 49h31a12 12 0 0 0 1-24 17 17 0 0 0-32-3A13 13 0 0 0 17 49z"/>',
  check: '<path d="M13 34l12 12 26-28"/>',
  cross: '<path d="M18 18l28 28M46 18L18 46"/>',
  lock: '<rect x="13" y="28" width="38" height="28" rx="6"/><path d="M22 28v-7a10 10 0 0 1 20 0v7"/>',
  unlock: '<rect x="13" y="28" width="38" height="28" rx="6"/><path d="M22 28v-7a10 10 0 0 1 19-4"/>',
  search: '<circle cx="27" cy="27" r="16"/><path d="M39 39l15 15"/>',
  arrow: '<path d="M8 32h46M40 18l14 14-14 14"/>',
  gear: '<circle cx="32" cy="32" r="9"/><path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M15 49l6-6M43 21l6-6"/>',
  doc: '<path d="M16 6h22l10 10v42H16z"/><path d="M38 6v10h10M24 32h16M24 42h16"/>',
  user: '<circle cx="32" cy="22" r="11"/><path d="M12 56c2-11 10-17 20-17s18 6 20 17"/>',
  users: '<circle cx="24" cy="24" r="9"/><circle cx="44" cy="26" r="7"/><path d="M6 54c2-10 9-15 18-15s16 5 18 15M44 39c7 0 12 4 14 13"/>',
  database: '<ellipse cx="32" cy="14" rx="20" ry="7"/><path d="M12 14v36c0 4 9 7 20 7s20-3 20-7V14M12 32c0 4 9 7 20 7s20-3 20-7"/>',
  shield: '<path d="M32 6l22 8v16c0 14-10 24-22 28C20 54 10 44 10 30V14z"/><path d="M22 32l7 7 13-14"/>',
  bolt: '<path d="M36 6L14 36h16l-4 22 24-32H34z"/>',
  chart: '<path d="M8 56h48"/><rect x="14" y="34" width="8" height="18"/><rect x="28" y="22" width="8" height="30"/><rect x="42" y="12" width="8" height="40"/>',
  code: '<path d="M22 18L8 32l14 14M42 18l14 14-14 14M36 12l-8 40"/>',
  globe: '<circle cx="32" cy="32" r="24"/><path d="M8 32h48M32 8c8 8 8 40 0 48M32 8c-8 8-8 40 0 48"/>',
  mail: '<rect x="8" y="14" width="48" height="36" rx="5"/><path d="M8 18l24 18 24-18"/>',
  clock: '<circle cx="32" cy="32" r="24"/><path d="M32 18v15l10 6"/>',
  warning: '<path d="M32 8l26 46H6z"/><path d="M32 26v14M32 47v2"/>',
  plug: '<path d="M24 8v14M40 8v14M16 22h32v10a16 16 0 0 1-32 0zM32 48v10"/>',
  key: '<circle cx="20" cy="40" r="11"/><path d="M28 32l24-24M44 16l6 6M38 22l5 5"/>',
  cpu: '<rect x="16" y="16" width="32" height="32" rx="4"/><path d="M24 8v8M40 8v8M24 48v8M40 48v8M8 24h8M8 40h8M48 24h8M48 40h8"/>',
  layers: '<path d="M32 8l24 12-24 12L8 20z"/><path d="M8 32l24 12 24-12M8 44l24 12 24-12"/>',
  flag: '<path d="M14 58V8M14 10h32l-6 10 6 10H14"/>',
  rocket: '<path d="M32 6c10 8 14 20 12 34H20C18 26 22 14 32 6z"/><circle cx="32" cy="26" r="5"/><path d="M20 40l-8 10h10M44 40l8 10H42M28 48h8v8h-8z"/>',
  refresh: '<path d="M50 24A20 20 0 0 0 14 22M14 40a20 20 0 0 0 36 2"/><path d="M50 10v14H36M14 54V40h14"/>',
  phone: '<rect x="18" y="6" width="28" height="52" rx="5"/><path d="M28 50h8"/>',
  monitor: '<rect x="6" y="10" width="52" height="34" rx="4"/><path d="M24 56h16M32 44v12"/>',
  star: '<path d="M32 8l7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z"/>',
};

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f2 = (x) => Math.round(x * 1000) / 1000;
// Free vertical band for content: below the chrome (or the h2 headline), above the captions at y=900.
const BAND = { top: 150, titleTop: 240, bottom: 860 };

export function createScene({ id, theme, fontsCss, brief, scene, duration }) {
  const p = (n) => `${id}-${n}`;
  const css = [];
  const html = [];
  const js = [];
  const sfx = [];
  const sel = (s) => (s.startsWith("#") ? s : `#${p(s)}`);
  const tw = (line) => js.push(line);

  const k = {
    id, p, css, html, js, sfx, duration, theme, brief, scene,
    esc,
    hasLogo: Boolean(theme.logo),
    // Top y that vertically centers a block of height h in the free band (ending at `bottom`).
    centeredTop(h, { title = false, bottom = BAND.bottom } = {}) {
      const top = title ? BAND.titleTop : BAND.top;
      return Math.round(top + Math.max(0, bottom - top - h) / 2);
    },

    icon(name, { size = 48, color = "var(--accent)", id: eid, style = "" } = {}) {
      const path = ICONS[name] ?? ICONS.check;
      return `<svg ${eid ? `id="${p(eid)}" ` : ""}class="${p("ico")}" viewBox="0 0 64 64" stroke-width="4.5" style="width:${size}px;height:${size}px;stroke:${color};${style}">${path}</svg>`;
    },
    chip(text, { tone = "accent", icon, id: eid, style = "", strike = false, dashed = false, size } = {}) {
      const ic = icon ? k.icon(icon, { size: 26, color: `var(--${toneVar(tone)})` }) : "";
      const st = strike ? `<i ${eid ? `id="${p(eid)}-s" ` : ""}class="${p("strike")}"></i>` : "";
      const sz = size ? `font-size:${size}px;height:${Math.round(size * 2.2)}px;` : "";
      return `<span ${eid ? `id="${p(eid)}" ` : ""}class="${p("chip")} ${p(`t-${tone}`)}${dashed ? ` ${p("dashed")}` : ""}" style="${sz}${style}">${ic}<span class="${p("ct")}">${esc(text)}${st}</span></span>`;
    },
    doc(label, { id: eid, style = "" } = {}) {
      return `<div ${eid ? `id="${p(eid)}" ` : ""}class="${p("doc")}" style="${style}">${esc(label)}</div>`;
    },
    // on = static "on"; a toggle that will flip() must start off
    toggle(on, { id: eid } = {}) {
      return `<span id="${p(eid)}" class="${p("toggle")}" style="background:${on ? "var(--accent)" : "var(--hair)"}"><i id="${p(eid)}-k" class="${p("knob")}" style="left:${on ? 39 : 5}px"></i></span>`;
    },

    // motion vocabulary (fromTo everywhere: seek-safe, hidden before the reveal)
    rise: (s, t, dy = 22, dur = 0.55) => tw(`tl.fromTo("${sel(s)}",{opacity:0,y:${dy}},{opacity:1,y:0,duration:${dur},ease:"power3.out"},${f2(t)});`),
    pop: (s, t, dur = 0.45) => tw(`tl.fromTo("${sel(s)}",{opacity:0,scale:0.7},{opacity:1,scale:1,duration:${dur},ease:"back.out(1.6)"},${f2(t)});`),
    slide: (s, t, dx = -40, dur = 0.55) => tw(`tl.fromTo("${sel(s)}",{opacity:0,x:${dx}},{opacity:1,x:0,duration:${dur},ease:"power3.out"},${f2(t)});`),
    fade: (s, t, dur = 0.5) => tw(`tl.fromTo("${sel(s)}",{opacity:0},{opacity:1,duration:${dur},ease:"power2.out"},${f2(t)});`),
    grow: (s, t, dur = 0.7) => tw(`tl.fromTo("${sel(s)}",{opacity:0,scale:0.92},{opacity:1,scale:1,duration:${dur},ease:"power3.out"},${f2(t)});`),
    draw: (s, t, dur = 0.6) => tw(`tl.fromTo("${sel(s)}",{scaleX:0},{scaleX:1,duration:${dur},ease:"power2.inOut"},${f2(t)});`),
    drawY: (s, t, dur = 0.6) => tw(`tl.fromTo("${sel(s)}",{scaleY:0},{scaleY:1,duration:${dur},ease:"power2.inOut"},${f2(t)});`),
    type: (s, t, dur = 0.9) => tw(`tl.fromTo("${sel(s)}",{clipPath:"inset(0 100% 0 0)"},{clipPath:"inset(0 0% 0 0)",duration:${dur},ease:"steps(24)"},${f2(t)});`),
    to: (s, t, props, dur = 0.5, ease = "power2.out") => tw(`tl.to("${sel(s)}",Object.assign(${JSON.stringify(props)},{duration:${dur},ease:"${ease}"}),${f2(t)});`),
    // No immediateRender: the HTML already shows 0, and the linter files all proxy counters as one target.
    count(eid, to, t, dur = 1.0, decimals = 0, comma = false) {
      tw(`(function(){var o={v:0},el=document.getElementById("${p(eid)}");tl.fromTo(o,{v:0},{v:${to},duration:${dur},ease:"power2.out",immediateRender:false,onUpdate:function(){var s=o.v.toFixed(${decimals});${comma ? 's=s.replace(/\\B(?=(\\d{3})+(?!\\d))/g,",");' : ""}el.textContent=s;}},${f2(t)});})();`);
    },
    // off -> on: knob slides by transform (layout-property tweens stutter in frame capture)
    flip(eid, t) {
      tw(`tl.fromTo("#${p(eid)}-k",{x:0},{x:34,duration:0.35,ease:"power2.inOut"},${f2(t)});`);
      tw(`tl.fromTo("#${p(eid)}",{backgroundColor:"${rgba(theme.colors.ink, 0.12)}"},{backgroundColor:"${theme.colors.accent}",duration:0.35,ease:"power2.inOut"},${f2(t)});`);
    },
    sound: (name, t, volume) => sfx.push({ sound: name, t: f2(Math.max(0, t)), volume }),
    ambient(until = duration) {
      tw(`tl.fromTo("#${p("grid")}",{x:0,y:0},{x:-40,y:-20,duration:${f2(until)},ease:"none"},0);`);
      tw(`tl.fromTo("#${p("cam")}",{scale:1},{scale:1.02,duration:${f2(until)},ease:"none"},0);`);
    },
  };
  return k;
}

const toneVar = (tone) =>
  ({ accent: "accent-text", good: "accent-text", navy: "accent2-text", bad: "danger-text", neutral: "muted", plain: "ink" })[tone] ?? "accent-text";

export function baseCss(k) {
  const p = k.p;
  return `#root{position:absolute;inset:0;overflow:hidden;font-family:var(--font-body);color:var(--ink);${themeVars(k.theme)}}
.${p("bg")}{position:absolute;inset:0;background:var(--canvas);overflow:hidden}
.${p("grid")}{position:absolute;inset:-60px;background-image:radial-gradient(circle,var(--grid) 2px,transparent 2.5px);background-size:46px 46px}
.${p("cam")}{position:absolute;inset:0;transform-origin:50% 45%}
.${p("eyebrow")}{position:absolute;left:96px;top:63px;font:700 19px var(--font-body);letter-spacing:.08em;color:var(--accent-text);text-transform:uppercase}
.${p("tag")}{position:absolute;right:96px;top:54px;font:700 18px var(--font-body);letter-spacing:.06em;color:var(--accent-text);background:var(--tint2);border-radius:100px;padding:9px 21px;text-transform:uppercase}
.${p("h2")}{position:absolute;left:96px;top:128px;font:700 58px/1.12 var(--font-display);letter-spacing:-.01em;color:var(--ink);max-width:1600px}
.${p("ico")}{fill:none;stroke-linecap:round;stroke-linejoin:round;flex:none;display:block}
.${p("chip")}{display:inline-flex;align-items:center;gap:10px;height:48px;padding:0 22px;border-radius:100px;font:700 22px/1 var(--font-body);white-space:nowrap;box-sizing:border-box;position:relative}
.${p("ct")}{position:relative;display:inline-block}
.${p("t-accent")},.${p("t-good")}{color:var(--accent-text);background:var(--tint2)}
.${p("t-navy")}{color:var(--accent2-text);background:var(--ntint)}
.${p("t-bad")}{color:var(--danger-text);background:var(--dtint)}
.${p("t-neutral")}{color:var(--muted);background:var(--surface);border:2px solid var(--hair)}
.${p("t-plain")}{color:var(--ink);background:var(--surface);border:2px solid var(--line)}
.${p("dashed")}{background:transparent;border:2px dashed currentColor}
.${p("strike")}{position:absolute;left:-4px;right:-4px;top:50%;height:3px;margin-top:-1px;background:currentColor;border-radius:2px;transform-origin:left center}
.${p("card")}{position:absolute;box-sizing:border-box;background:var(--surface);border:2px solid var(--line);border-radius:14px}
.${p("tinted")}{background:var(--tint)}
.${p("hero")}{border:3px solid var(--accent)}
.${p("title")}{font:700 31px/1.22 var(--font-display);color:var(--ink)}
.${p("body")}{font:400 26px/1.45 var(--font-body);color:var(--muted)}
.${p("label")}{font:700 19px/1.2 var(--font-body);letter-spacing:.08em;text-transform:uppercase;color:var(--light)}
.${p("code")}{font:400 26px/1.5 var(--font-mono);color:var(--accent2-text);background:var(--surface);border:2px solid var(--nline);border-radius:10px;padding:8px 16px;white-space:nowrap;box-sizing:border-box}
.${p("doc")}{position:absolute;width:88px;height:115px;box-sizing:border-box;background:var(--surface);border:3px solid var(--line);border-radius:8px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:10px;font:700 21px var(--font-body);color:var(--accent-text)}
.${p("doc")}::after{content:"";position:absolute;right:-3px;top:-3px;width:25px;height:25px;background:linear-gradient(225deg,var(--canvas) 50%,var(--accent) 50%);border-bottom-left-radius:5px}
.${p("line")}{position:absolute;height:4px;background:var(--accent);border-radius:2px;transform-origin:left center}
.${p("toggle")}{position:relative;display:inline-block;width:76px;height:42px;border-radius:21px;flex:none}
.${p("knob")}{position:absolute;top:5px;width:32px;height:32px;border-radius:50%;background:#FFFFFF;border:2px solid rgba(0,0,0,.08);box-sizing:border-box}
.${p("foot")}{position:absolute;font:400 21px/1.35 var(--font-body);color:var(--muted);max-width:1728px}
.${p("row")}{display:flex;align-items:center;gap:14px}
.${p("col")}{display:flex;flex-direction:column;gap:14px}`;
}

// Wraps a built scene into the HyperFrames sub-composition fragment.
export function wrap(k, { fontsCss, chrome = true, eyebrow }) {
  const p = k.p;
  const D = f2(k.duration);
  const chromeHtml = chrome
    ? `<div id="${p("eyebrow")}" class="${p("eyebrow")}">${esc(eyebrow)}</div>${k.scene.chapter ? `<div id="${p("tag")}" class="${p("tag")}">${esc(k.scene.chapter)}</div>` : ""}`
    : "";
  if (chrome) {
    k.js.unshift(`tl.fromTo(["#${p("eyebrow")}"${k.scene.chapter ? `,"#${p("tag")}"` : ""}],{opacity:0,y:8},{opacity:1,y:0,duration:0.4,ease:"power3.out"},0);`);
  }
  return `<template id="${k.id}-template">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
${fontsCss}
${baseCss(k)}
${k.css.join("\n")}
</style>
<div id="root" data-composition-id="${k.id}" data-start="0" data-duration="${D}" data-width="1920" data-height="1080">
<div id="${p("bg")}" class="clip ${p("bg")}" data-start="0" data-duration="${D}" data-track-index="0"><div id="${p("grid")}" class="${p("grid")}"></div></div>
<div id="${p("cam")}" class="${p("cam")}">
${k.html.join("\n")}
</div>
${chromeHtml}
</div>
<script>
(function () {
  var tl = gsap.timeline({ paused: true });
  ${k.js.join("\n  ")}
  window.__timelines["${k.id}"] = tl;
})();
</script>
</template>
`;
}
