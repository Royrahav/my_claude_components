// Shared test helpers: build a real scene kit from a synthetic timeline and read back what a template emitted.
import { createScene } from "../lib/kit.mjs";
import { makeCue } from "../lib/timeline.mjs";

export const SCENE_ID = "s1";

export const THEME = {
  colors: { canvas: "#FFFFFF", ink: "#111111", accent: "#0066CC" },
  logo: null,
};

// words: [{ text, start, end }]; speechEnd defaults to the last word's end.
export function sceneTimeline({ duration = 20, words = [], speechEnd } = {}) {
  const end = speechEnd ?? (words.length ? words[words.length - 1].end : 0);
  return { id: SCENE_ID, type: "x", start: 0, duration, speechEnd: end, words };
}

export function buildScene(template, data, timeline = sceneTimeline()) {
  const warnings = [];
  const k = createScene({ id: SCENE_ID, theme: THEME, fontsCss: "", brief: {}, scene: {}, duration: timeline.duration });
  const c = makeCue(timeline, warnings);
  const result = template(k, data, c);
  return { k, c, result, warnings, html: k.html.join("\n"), css: k.css.join("\n") };
}

// Every tween the template emitted for element `name`, in emission order: { start, duration }.
export function tweensOf(k, name) {
  const needle = `"#${SCENE_ID}-${name}"`;
  return k.js
    .filter((line) => line.includes(needle))
    .map((line) => ({
      start: Number(line.match(/,(-?[\d.]+)\);$/)[1]),
      duration: Number(line.match(/duration:([\d.]+)/)[1]),
    }));
}

export const px = (css, rule, prop) => {
  const body = css.match(new RegExp(`\\.${SCENE_ID}-${rule}\\{([^}]*)\\}`))?.[1] ?? "";
  const m = body.match(new RegExp(`(?:^|;)${prop}:(-?[\\d.]+)px`));
  return m ? Number(m[1]) : undefined;
};
