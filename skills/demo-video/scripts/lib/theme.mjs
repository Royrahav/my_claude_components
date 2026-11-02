// Theme: brand colors + fonts + logo. Derives WCAG-safe text colors automatically (a bright brand
// accent usually fails AA as text on a light canvas, and `hyperframes check` rejects that), and
// downloads the Google fonts as local woff2 files so renders are deterministic and offline.

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE_DIR, ensureDir, readJson } from "./util.mjs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const hex = (h) => {
  const s = h.replace("#", "");
  const v = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
};
const toHex = (rgb) => "#" + rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("").toUpperCase();
const lin = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
export const contrast = (a, b) => {
  const [x, y] = [lum(hex(a)), lum(hex(b))].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
export const mix = (a, b, t) => toHex(hex(a).map((c, i) => c + (hex(b)[i] - c) * t));
export const rgba = (h, a) => `rgba(${hex(h).join(", ")}, ${a})`;

// The candidate with the highest contrast against `fill`; the first wins ties.
export function mostReadableOn(fill, candidates) {
  return candidates.reduce((best, candidate) => (contrast(candidate, fill) > contrast(best, fill) ? candidate : best));
}

// Moves `fg` toward `target` until it reaches `ratio` against `bg`.
function ensure(fg, bg, ratio, target) {
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const c = mix(fg, target, t);
    if (contrast(c, bg) >= ratio) return c;
  }
  return target;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

// The contrast math and ffmpeg read every theme color as hex.
function assertHexColors(colors) {
  for (const [key, value] of Object.entries(colors ?? {}))
    if (!HEX_COLOR.test(String(value))) throw new Error(`theme.json colors.${key} must be #RGB or #RRGGBB, got ${JSON.stringify(value)}`);
}

export function loadTheme(themeFile) {
  const t = readJson(themeFile);
  assertHexColors(t.colors);
  const c = t.colors;
  const dark = t.mode === "dark";
  const toward = dark ? "#FFFFFF" : "#000000";
  const chipBg = mix(c.canvas, c.accent, 0.1);
  const chipBg2 = mix(c.canvas, c.accent2, 0.1);
  const derived = {
    accentText: ensure(c.accent, chipBg, 4.6, toward),
    accentLarge: ensure(c.accent, c.canvas, 3.2, toward),
    accent2Text: ensure(c.accent2, chipBg2, 4.6, toward),
    dangerText: ensure(c.danger, mix(c.canvas, c.danger, 0.08), 4.6, toward),
    mutedText: ensure(c.muted, c.canvas, 4.6, toward),
    lightText: ensure(c.light ?? c.muted, c.canvas, 4.6, toward),
  };
  // Text on --accent-text fills (caption active word, options check, recap badge).
  const onAccentFill = mostReadableOn(derived.accentText, ["#FFFFFF", c.canvas, c.ink]);
  return { ...t, dark, derived: { ...derived, onAccentFill } };
}

// CSS custom properties every scene and the captions use.
export function themeVars(th) {
  const c = th.colors;
  const d = th.derived;
  const f = th.fonts;
  return [
    `--canvas:${c.canvas}`, `--surface:${c.surface}`, `--ink:${c.ink}`, `--muted:${d.mutedText}`, `--light:${d.lightText}`,
    `--accent:${c.accent}`, `--accent-text:${d.accentText}`, `--accent-large:${d.accentLarge}`, `--on-accent:${d.onAccentFill}`,
    `--accent2:${c.accent2}`, `--accent2-text:${d.accent2Text}`, `--danger:${c.danger}`, `--danger-text:${d.dangerText}`,
    `--tint:${rgba(c.accent, 0.05)}`, `--tint2:${rgba(c.accent, 0.1)}`, `--line:${rgba(c.accent, 0.28)}`,
    `--ntint:${rgba(c.accent2, 0.08)}`, `--nline:${rgba(c.accent2, 0.28)}`, `--dtint:${rgba(c.danger, 0.07)}`,
    `--grid:${rgba(c.accent, th.dark ? 0.16 : 0.22)}`, `--hair:${rgba(c.ink, 0.12)}`,
    `--font-display:"${f.display}", sans-serif`, `--font-body:"${f.body}", sans-serif`, `--font-mono:"${f.mono}", monospace`,
  ].join(";");
}

async function download(url) {
  const key = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const cached = join(ensureDir(join(CACHE_DIR, "fonts")), `${key}.woff2`);
  if (!existsSync(cached)) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`font download failed ${res.status}: ${url}`);
    writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
  }
  return { cached, key };
}

// Fetches each family from Google Fonts (all subsets, requested weights) into <project>/theme/fonts
// and writes <project>/theme/fonts.css with project-relative @font-face rules.
export async function installFonts(projectRoot, th) {
  const out = ensureDir(join(projectRoot, "theme", "fonts"));
  const weights = th.weights ?? { display: [700], body: [400, 700, 900], mono: [400, 700] };
  const rules = [];
  const seen = new Set();
  for (const role of ["display", "body", "mono"]) {
    const family = th.fonts[role];
    if (!family || seen.has(family)) continue;
    seen.add(family);
    const w = [...new Set(Object.entries(weights).filter(([r]) => th.fonts[r] === family).flatMap(([, ws]) => ws))].sort((a, b) => a - b);
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${w.join(";")}&display=block`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`Google Fonts has no "${family}" (${res.status}). Pick another family or add the files manually.`);
    const css = await res.text();
    for (const m of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
      const body = m[1];
      const src = body.match(/url\((https:[^)]+)\)/)?.[1];
      const weight = body.match(/font-weight:\s*(\d+)/)?.[1];
      const range = body.match(/unicode-range:\s*([^;]+);/)?.[1];
      if (!src) continue;
      const { cached, key } = await download(src);
      const file = `${family.replace(/\s+/g, "")}-${key}.woff2`;
      copyFileSync(cached, join(out, file));
      rules.push(
        `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;font-display:block;src:url("theme/fonts/${file}") format("woff2");${range ? `unicode-range:${range};` : ""}}`,
      );
    }
  }
  writeFileSync(join(projectRoot, "theme", "fonts.css"), rules.join("\n") + "\n");
  return rules.length;
}

export function fontCss(projectRoot) {
  const f = join(projectRoot, "theme", "fonts.css");
  return existsSync(f) ? readFileSync(f, "utf8") : "";
}

// Best-effort brand extraction from a public website: Google font families + most used colors.
export async function brandFromSite(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const html = await res.text();
  const fonts = [...new Set([...html.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&:>]+)/g)].map((m) => decodeURIComponent(m[1]).replace(/\+/g, " ")))];
  const families = [...new Set([...html.matchAll(/font-family:\s*['"]?([A-Za-z][\w ]+?)['"]?\s*[,;}]/g)].map((m) => m[1].trim()))].slice(0, 6);
  const counts = {};
  for (const m of html.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const h = `#${m[1].toUpperCase()}`;
    counts[h] = (counts[h] ?? 0) + 1;
  }
  const colors = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([h, n]) => `${h} x${n}`);
  return { google_fonts: fonts, font_families: families, top_colors: colors };
}
