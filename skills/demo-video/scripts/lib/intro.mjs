// The opening sting: a short branded clip played before the video (brief.json `intro`). The clip lands on its last
// frame, then a 0.8 s dip (to white on a light theme, to black on a dark one) brings in the video's first frame, held
// for that dip so no narration is lost; the sound crossfades over the same 0.8 s. The clip is scaled to 1920x1080,
// 30 fps, and its loudness is set 2 dB under the video so the narration stays the loudest thing.
import { existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { CONFIG_PATH, H, W, duration, ffmpeg, lufs, r2, readJson } from "./util.mjs";

const DIP_SECONDS = 0.8;
const UNDER_VIDEO_DB = 2;
export const DEFAULT_INTRO = join(dirname(CONFIG_PATH), "intro", "intro.mp4");

// brief `intro`: true uses the configured clip (config.json `intro_file`, else intro/intro.mp4 beside it), a string
// names a clip, false or absent adds nothing.
export function introClip(brief) {
  if (!brief.intro) return null;
  const file = typeof brief.intro === "string" ? brief.intro : (readJson(CONFIG_PATH, {}).intro_file ?? DEFAULT_INTRO);
  if (!existsSync(file)) throw new Error(`intro clip not found: ${file} (set brief.json "intro" to a file, or false)`);
  return file;
}

// Puts the intro in front of `final` in place; returns a one-line note for the render summary.
export function prependIntro(root, final, clip) {
  const body = join(root, ".demo", "body.mp4");
  renameSync(final, body);
  const theme = readJson(join(root, "theme", "theme.json"), {});
  const dip = theme.mode === "dark" ? "fadeblack" : "fadewhite";
  const offset = Math.max(0, duration(clip) - DIP_SECONDS).toFixed(3);
  const gain = r2((lufs(body) ?? -14) - UNDER_VIDEO_DB - (lufs(clip) ?? -20));
  const ms = Math.round(DIP_SECONDS * 1000);
  const graph =
    `[0:v]scale=${W}:${H}:flags=lanczos,fps=30,format=yuv420p,setsar=1,settb=1/30[iv];` +
    `[1:v]tpad=start_mode=clone:start_duration=${DIP_SECONDS},fps=30,format=yuv420p,setsar=1,settb=1/30[bv];` +
    // xfade negotiates its own pixel format (often yuv444p, which most players refuse): force yuv420p after it
    `[iv][bv]xfade=transition=${dip}:duration=${DIP_SECONDS}:offset=${offset},format=yuv420p[v];` +
    `[0:a]aresample=48000,volume=${gain}dB,alimiter=limit=0.89:level=disabled[ia];` +
    `[1:a]aresample=48000,adelay=${ms}|${ms}[ba];[ia][ba]acrossfade=d=${DIP_SECONDS}[a]`;
  ffmpeg(["-i", clip, "-i", body, "-filter_complex", graph, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high", "-crf", "18", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final]);
  return `intro ${duration(clip).toFixed(1)}s (${dip}, ${gain} dB)`;
}
