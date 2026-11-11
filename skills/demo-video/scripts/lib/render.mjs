// Render with HyperFrames (voice + SFX in the composition), then mix the music bed under it with
// sidechain ducking, and normalize: two-pass loudnorm to -14 LUFS with true peak -1.5 (AAC adds
// about 0.5 dB of inter-sample overshoot, so -1.5 lands at about -1.2 dBTP).
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { introClip, prependIntro } from "./intro.mjs";
import { loopFilter, loopPlan } from "./music.mjs";
import { duration, ensureDir, ffmpeg, hf, lufs, r2, run } from "./util.mjs";

const TARGET = "I=-14:TP=-1.5:LRA=11";
const MUSIC_UNDER_VOICE_DB = 13;

// mixOnly reuses the last rendered video (renders/.video.mp4) and redoes only the music mix and loudness.
export function render(root, brief, tl, { quality = "standard", workers = 5, out, mixOnly = false } = {}) {
  ensureDir(join(root, "renders"));
  ensureDir(join(root, ".demo"));
  const video = join(root, "renders", ".video.mp4");
  if (!mixOnly || !existsSync(video)) {
    if (existsSync(video)) rmSync(video);
    const r = hf(["render", "--quality", quality, "--fps", "30", "--workers", String(workers), "--output", video], root);
    if (!existsSync(video)) throw new Error(`render failed: ${(r.out + r.err).split("\n").filter((l) => /error|Error|✗/.test(l)).slice(-8).join("\n")}`);
  }

  const mix = join(root, ".demo", "mix.wav");
  const music = join(root, "assets", "music", "bgm.mp3");
  const T = duration(video);
  let musicNote = "no music";
  if (brief.music !== false && existsSync(music)) {
    const lv = lufs(video) ?? -18;
    const lm = lufs(music) ?? -18;
    const gain = r2(lv - MUSIC_UNDER_VOICE_DB - lm + (brief.music_gain_db ?? 0));
    const plan = loopPlan(duration(music), T);
    const { prefix, label } = loopFilter(plan);
    const graph =
      prefix +
      `${label}atrim=0:${T},asetpts=PTS-STARTPTS,volume=${gain}dB,afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(0, T - 4).toFixed(2)}:d=4[m];` +
      `[0:a]asplit=2[v][k];[m][k]sidechaincompress=threshold=0.03:ratio=4:attack=20:release=450[md];` +
      `[v][md]amix=inputs=2:duration=first:normalize=0[o]`;
    ffmpeg(["-i", video, ...Array(plan.copies).fill(["-i", music]).flat(), "-filter_complex", graph, "-map", "[o]", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", mix]);
    musicNote = `music ${gain} dB (bed ${MUSIC_UNDER_VOICE_DB} dB under voice, ducked under speech${plan.copies > 1 ? `, looped ${plan.copies}x` : ""})`;
  } else {
    ffmpeg(["-i", video, "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", mix]);
  }

  const pass1 = ffmpeg(["-i", mix, "-af", `loudnorm=${TARGET}:print_format=json`, "-f", "null", "-"]);
  const j = JSON.parse(pass1.slice(pass1.lastIndexOf("{"), pass1.lastIndexOf("}") + 1));
  const measured = `measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  const final = out ?? join(root, "renders", `${brief.name}.mp4`);
  ffmpeg(["-i", video, "-i", mix, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-af", `loudnorm=${TARGET}:${measured},aresample=48000`, "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final]);
  const clip = introClip(brief);
  if (clip) musicNote += `, ${prependIntro(root, final, clip)}`;

  const v = run("ffmpeg", ["-hide_banner", "-nostats", "-i", final, "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"]).err;
  const I = v.match(/I:\s+(-?[\d.]+) LUFS/)?.[1];
  const P = v.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1];
  return `${final}\nduration ${duration(final).toFixed(1)}s, loudness ${I} LUFS, true peak ${P} dBFS, ${musicNote}`;
}
