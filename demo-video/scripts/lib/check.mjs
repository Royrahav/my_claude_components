// Quality gates with compact output: lint + check (errors, lint warnings) and one contact-sheet image.
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadTheme } from "./theme.mjs";
import { ensureDir, ffmpeg, hf, projectFiles, r3 } from "./util.mjs";

// Reads `hyperframes lint` output: "N error(s), N warning(s)", or "0 errors, 0 warnings" when clean.
export function summarizeLint(out) {
  const sum = out.match(/(\d+) errors?(?:\(s\))?, (\d+) warnings?(?:\(s\))?/);
  const marked = (mark) => out.split("\n").filter((l) => l.includes(mark)).map((l) => l.trim());
  return {
    summary: sum?.[0] ?? "?",
    errors: Number(sum?.[1] ?? 0),
    warnings: Number(sum?.[2] ?? 0),
    errorLines: marked("✗").slice(0, 15),
    warningLines: marked("⚠").slice(0, 10).map((l) => l.slice(0, 200)),
  };
}

// Reads `hyperframes check` output. HyperFrames lists contrast misses as ✗ warnings and still ends with
// "Check passed", and prints its "N/M text checks pass" count only when nothing missed. So any ✗ line,
// or a printed count below 100%, fails the check here.
export function summarizeCheck(out) {
  const failureLines = out.split("\n").filter((line) => line.includes("✗")).map((line) => line.trim().slice(0, 220));
  const counted = out.match(/(\d+)\/(\d+) text checks pass WCAG AA/);
  const contrast = counted && { passed: Number(counted[1]), checked: Number(counted[2]) };
  const contrastMissed = Boolean(contrast) && contrast.passed < contrast.checked;
  const passed = /Check passed/.test(out) && failureLines.length === 0 && !contrastMissed;
  return {
    summary: `check: ${passed ? "passed" : "FAILED"}${contrast ? `, contrast ${contrast.passed}/${contrast.checked} AA` : ""}`,
    passed,
    failureLines: failureLines.slice(0, 25),
  };
}

export function lintAndCheck(root) {
  const lint = hf(["lint"], root);
  const lintSum = summarizeLint(lint.out + lint.err);
  const chk = hf(["check", "--samples", "24"], root);
  const checkSum = summarizeCheck(chk.out + chk.err);
  const lines = [`lint: ${lintSum.summary}`, ...lintSum.errorLines, ...lintSum.warningLines, checkSum.summary, ...checkSum.failureLines];
  return { ok: checkSum.passed && lintSum.errors === 0, text: lines.join("\n") };
}

// ffmpeg wants 0xRRGGBB; theme colors are #RRGGBB or #RGB (loadTheme enforces it).
export const ffColor = (hex) => `0x${hex.replace("#", "").replace(/^(.)(.)(.)$/, "$1$1$2$2$3$3")}`;

// Contact-sheet grid: 2 columns up to 4 scenes, 3 up to 9, else 4; 16:9 tiles spanning 1920 px.
export function sheetGeometry(sceneCount) {
  const cols = sceneCount <= 4 ? 2 : sceneCount <= 9 ? 3 : 4;
  const tileW = 1920 / cols;
  return { cols, tileW, tileH: (tileW * 9) / 16 };
}

// One grid image of every scene at its landed state (default) or mid-point; empty cells take the canvas color.
export function contactSheet(root, tl, which = "end") {
  const times = tl.scenes.map((s) => r3(which === "mid" ? s.start + s.duration * 0.55 : s.start + s.duration - 0.35));
  const snapDir = join(root, "snapshots");
  if (existsSync(snapDir)) rmSync(snapDir, { recursive: true, force: true });
  const r = hf(["snapshot", ".", "--at", times.join(","), "--no-end"], root);
  if (!existsSync(snapDir)) throw new Error(`snapshot failed: ${(r.out + r.err).slice(-400)}`);
  const files = readdirSync(snapDir)
    .filter((f) => /^frame-\d+/.test(f) && f.endsWith(".png"))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const { cols, tileW: cw, tileH: ch } = sheetGeometry(files.length);
  const fill = ffColor(loadTheme(projectFiles(root).theme).colors.canvas);
  const inputs = files.flatMap((f) => ["-i", join(snapDir, f)]);
  const scaled = files.map((_, i) => `[${i}]scale=${cw}:${ch}[a${i}]`).join(";");
  const layout = files.map((_, i) => `${(i % cols) * cw}_${Math.floor(i / cols) * ch}`).join("|");
  const out = join(ensureDir(join(root, "review")), `contact-${which}.jpg`);
  const graph = files.length === 1 ? `[0]scale=${cw}:${ch}` : `${scaled};${files.map((_, i) => `[a${i}]`).join("")}xstack=inputs=${files.length}:layout=${layout}:fill=${fill}`;
  ffmpeg([...inputs, "-filter_complex", graph, "-frames:v", "1", out]);
  return { out, times };
}
