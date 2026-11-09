// SCRIPT.md: the narration plus each scene's on-screen text, so a reader of the file (the user at gate 1,
// the duck, the checker) sees what a viewer hears and reads.
import { clock } from "./util.mjs";

// Keys that hold cues, styling or structure, never words a viewer reads.
const NOT_TEXT = new Set(["at", "icon", "tone", "key", "variant", "line", "num", "who", "mono", "hero", "logo", "chosen", "lock", "toggle", "on", "count", "packet"]);
const MAX_SCREEN_CHARS = 400;

// Every string a scene's data puts on screen, in data order, once each, joined with " | ".
export function onScreenText(data) {
  const seen = new Set();
  const walk = (value, key) => {
    if (key && (NOT_TEXT.has(key) || key.endsWith("_at"))) return;
    if (typeof value === "string") {
      const text = value.trim();
      if (text && !seen.has(text)) seen.add(text);
    } else if (Array.isArray(value)) value.forEach((v) => walk(v));
    else if (value && typeof value === "object") Object.entries(value).forEach(([k, v]) => walk(v, k));
  };
  walk(data ?? {});
  const text = [...seen].join(" | ");
  return text.length > MAX_SCREEN_CHARS ? `${text.slice(0, MAX_SCREEN_CHARS - 3)}...` : text;
}

const wordCount = (scenes) => scenes.reduce((n, s) => n + (s.say ?? "").split(/\s+/).filter(Boolean).length, 0);

export function scriptMarkdown(brief, scenes, rate) {
  const words = wordCount(scenes);
  const head = [`# ${brief.product} - narration`, "", `${scenes.length} scenes, ${words} words, about ${clock(words / rate)} of speech.`, ""];
  const body = scenes.flatMap((s, i) => {
    const screen = onScreenText(s.data);
    return [
      `## ${i + 1}. ${s.chapter ?? s.type} (${s.id}, ${s.type})`,
      "",
      ...(s.question ? [`Question: ${s.question}`, ""] : []),
      s.say ?? "(silent)",
      "",
      ...(screen ? [`On screen: ${screen}`, ""] : []),
    ];
  });
  return { md: [...head, ...body].join("\n"), words };
}
