// The music library: five mood slots in CACHE_DIR/music, each generated once per machine and reused by
// every video. A mood is picked from the brief and the history, copied into the project as its bed, and
// looped with a crossfade at render time when the video outlasts it.
import { copyFileSync, existsSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { CACHE_DIR, duration, ensureDir, projectFiles } from "./util.mjs";
import { resolveDirection } from "./direction.mjs";
import { music as generateTrack } from "./voice.mjs";

export const MUSIC_SLOT_SECONDS = 360;
export const LOOP_CROSSFADE_S = 3;

const BED = "Instrumental, no vocals, no drops or builds, an even low-energy bed that sits under a voiceover. Loop-friendly: it starts at once with no long intro and ends with no big ending.";

// One slot per mood, each with its own character so two videos rarely sound alike.
export const MOODS = Object.freeze({
  "calm-tech": `Calm modern technology background music. Soft synth pads, light clean piano, gentle muted percussion, steady 92 BPM, warm and quietly optimistic. ${BED}`,
  "story-warm": `Warm human storytelling background music. Acoustic guitar plucks, soft strings, a light brushed shaker, relaxed 84 BPM, gentle and reassuring. ${BED}`,
  "launch-bright": `Bright upbeat product launch background music. Light electronic arpeggios, crisp soft claps, airy synth plucks, driving but unobtrusive 112 BPM, optimistic. ${BED}`,
  "focus-serious": `Focused serious background music. Minimal low synth pulses, deep sustained bass tones, sparse dark piano notes, slow 76 BPM, concentrated and calm. ${BED}`,
  "minimal-ambient": `Minimal ambient background music. Sparse evolving textures, long soft pads, faint glassy tones, no beat and no rhythm, spacious and neutral. ${BED}`,
});

const MOOD_SLOTS = Object.keys(MOODS);
const DEFAULT_FITS = ["calm-tech", "minimal-ambient"];
const PRESET_FITS = { "calm-technical": ["calm-tech", "minimal-ambient"], "energetic-launch": ["launch-bright"], "story-driven": ["story-warm"], "minimal-documentary": ["focus-serious", "minimal-ambient"] };
const TONE_FIT = { playful: "launch-bright", light: "story-warm", serious: "focus-serious", critical: "focus-serious" };

export const libraryDir = (cache = CACHE_DIR) => join(cache, "music");
export const slotFile = (slot, dir = libraryDir()) => join(dir, `${slot}.mp3`);

export function assertSlot(slot) {
  if (!Object.hasOwn(MOODS, String(slot))) throw new Error(`unknown music mood "${slot}" (slots: ${MOOD_SLOTS.join(", ")})`);
  return slot;
}

// brief.music_mood wins. Otherwise the moods that fit the tone, then the preset, and of those the first one
// the last video did not use (the first if all did).
export function pickMood(brief, lastMood = null) {
  if (brief.music_mood) return assertSlot(brief.music_mood);
  const tone = resolveDirection(brief.direction).tone;
  const fits = [...new Set([TONE_FIT[tone], ...(PRESET_FITS[brief.direction?.preset] ?? [])].filter(Boolean))];
  const candidates = fits.length ? fits : DEFAULT_FITS;
  return candidates.find((slot) => slot !== lastMood) ?? candidates[0];
}

// Every slot, filled or not; lengthOf is injectable so a test needs no audio.
export function listLibrary(dir = libraryDir(), lengthOf = duration) {
  return MOOD_SLOTS.map((slot) => {
    const file = slotFile(slot, dir);
    return existsSync(file) ? { slot, present: true, seconds: Math.round(lengthOf(file)) } : { slot, present: false, seconds: 0 };
  });
}

export const describeSlot = ({ slot, present, seconds }) => `${slot}: ${present ? `present, ${seconds}s` : "missing"}`;

// What a `music` command does to the brief and the bed. A one-off bed (`custom`, from --file or --prompt) is kept
// by a later plain run; --mood or a library pick replaces it. Returns the next brief (the input is not touched),
// the library mood to copy (null for a custom bed) and whether the project's custom bed stays as it is.
export function planMusic(brief, { asked = null, custom = false, customBedPresent = false, lastMood = null }) {
  if (custom) return { brief: without({ ...brief, music_custom: true }, "music_mood"), mood: null, keepBed: false };
  if (!asked && brief.music_custom && customBedPresent) return { brief, mood: null, keepBed: true };
  const mood = asked ? assertSlot(asked) : pickMood(brief, lastMood);
  return { brief: without({ ...brief, music_mood: mood }, "music_custom"), mood, keepBed: false };
}

function without(object, key) {
  const { [key]: dropped, ...rest } = object;
  return rest;
}

// A bed shorter than a library track loops audibly at render time, so seeding the library with one deserves a warning.
export function shortBedWarning(bed, lengthOf = duration) {
  const seconds = Math.round(lengthOf(bed));
  return seconds < MUSIC_SLOT_SECONDS ? `warn: the adopted bed is ${seconds}s, under the ${MUSIC_SLOT_SECONDS}s of a library track; it will loop in long videos` : null;
}

// Seeds an empty slot from a project's bed; a filled slot is never overwritten.
export function adoptBed(slot, bed, dir = libraryDir()) {
  const track = slotFile(assertSlot(slot), dir);
  if (!existsSync(bed)) throw new Error(`no music bed to adopt: ${bed} does not exist`);
  if (existsSync(track)) throw new Error(`slot ${slot} is already filled and is never overwritten`);
  ensureDir(dir);
  copyFileSync(bed, track);
  return track;
}

// Copies the slot's track into the project as its bed. Only a missing slot is generated (the one credit spend), into a
// temporary file that is renamed on success, so a failed or interrupted run never leaves a half-written slot.
// To regenerate a slot you dislike, delete its file.
export async function useMood(root, slot, { dir = libraryDir(), generate = generateTrack } = {}) {
  const track = slotFile(assertSlot(slot), dir);
  const generated = !existsSync(track);
  if (generated) await generateSlot(root, slot, track, dir, generate);
  const { music: bed } = projectFiles(root);
  ensureDir(dirname(bed));
  copyFileSync(track, bed);
  return { bed, generated };
}

async function generateSlot(root, slot, track, dir, generate) {
  const partial = join(dir, `${slot}.tmp.mp3`);
  ensureDir(dir);
  try {
    await generate(root, MOODS[slot], MUSIC_SLOT_SECONDS, partial);
    renameSync(partial, track);
  } finally {
    rmSync(partial, { force: true });
  }
}

// How many copies of a bed of bedSeconds cover videoSeconds when each joins the next with a crossfade.
export function loopPlan(bedSeconds, videoSeconds, wantedCrossfade = LOOP_CROSSFADE_S) {
  if (!(bedSeconds > 0) || bedSeconds >= videoSeconds) return { copies: 1, crossfade: 0 };
  const crossfade = Math.round(Math.min(wantedCrossfade, bedSeconds / 3) * 100) / 100;
  return { copies: Math.ceil((videoSeconds - crossfade) / (bedSeconds - crossfade)), crossfade };
}

// The ffmpeg filter that joins `copies` inputs of the bed (inputs 1..copies; asplit copies would be cut short
// by acrossfade) into one: { prefix, label }, and no prefix for a single copy.
export function loopFilter({ copies, crossfade }) {
  const joins = Array.from({ length: copies - 1 }, (_, i) => `${i ? `[j${i}]` : "[1:a]"}[${i + 2}:a]acrossfade=d=${crossfade}:c1=qsin:c2=qsin[j${i + 1}]`);
  return { prefix: joins.map((join) => `${join};`).join(""), label: copies === 1 ? "[1:a]" : `[j${copies - 1}]` };
}
