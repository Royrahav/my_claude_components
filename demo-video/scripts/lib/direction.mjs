// Creative direction: brief.json `direction` resolves to one value per style knob (a preset, then
// explicit knobs, over the original look), and to the transition mix scenes are dealt from.

const KNOB_VALUES = {
  pacing: ["measured", "brisk", "relaxed"],
  motion: ["calm", "lively"],
  chrome: ["full", "minimal", "none"],
  background: ["grid", "plain", "soft", "world"],
  captions: ["pill", "lower", "minimal"],
};
const TRANSITIONS = ["push", "fade", "zoom", "cut"];
const MIXED = ["push", "push", "fade", "fade", "zoom"]; // repeating a name weights it
// How long each entrance overlaps the outgoing scene; a cut is instant.
export const TRANSITION_SECONDS = Object.freeze({ push: 0.5, zoom: 0.45, fade: 0.6 });
const KNOB_FIELDS = [...Object.keys(KNOB_VALUES), "transitions"];
// Creative fields that change no visual: tone sets the voice delivery, freedom and notes steer the writer.
export const TONES = Object.freeze(["playful", "light", "balanced", "serious", "critical"]);
const FREEDOMS = ["guided", "creative", "auteur"];
export const RAIL_VALUES = Object.freeze(["off", "on"]);
export const CHAPTER_INTRO_VALUES = Object.freeze(["off", "on"]);
export const REVEAL_VALUES = Object.freeze(["cue", "blueprint"]);
const FIELDS = ["preset", "mood", "motif", "tone", "freedom", "notes", "thread", "rail", "chapter_intro", "reveal", ...KNOB_FIELDS];

// The original look: what a brief without a direction renders.
export const DEFAULT_DIRECTION = Object.freeze({
  pacing: "measured",
  motion: "calm",
  chrome: "full",
  background: "grid",
  captions: "pill",
  transitions: Object.freeze(["push"]),
});

export const PRESETS = Object.freeze({
  "calm-technical": { pacing: "measured", motion: "calm", chrome: "full", background: "grid", captions: "pill", transitions: ["fade", "fade", "push"] },
  "energetic-launch": { pacing: "brisk", motion: "lively", chrome: "minimal", background: "soft", captions: "pill", transitions: ["push", "zoom"] },
  "story-driven": { pacing: "relaxed", motion: "calm", chrome: "none", background: "soft", captions: "lower", transitions: ["fade", "fade", "fade", "cut"] },
  "minimal-documentary": { pacing: "measured", motion: "calm", chrome: "none", background: "plain", captions: "minimal", transitions: ["cut", "fade"] },
});

// Throws on an unknown field, preset or knob value, naming it, so a typo never falls back silently.
export function resolveDirection(direction) {
  if (direction == null) return DEFAULT_DIRECTION;
  if (typeof direction !== "object" || Array.isArray(direction)) throw new Error(`brief.json direction must be an object, got ${JSON.stringify(direction)}`);
  assertKnownFields(direction);
  const knobs = { ...DEFAULT_DIRECTION, ...presetKnobs(direction.preset), ...explicitKnobs(direction) };
  for (const [knob, allowed] of Object.entries(KNOB_VALUES)) assertOneOf(`direction.${knob}`, knobs[knob], allowed);
  return { ...knobs, transitions: transitionMix(knobs.transitions), ...creativeFields(direction) };
}

// One compact line for the build output.
export function describeDirection(direction) {
  const { pacing, motion, chrome, background, captions, transitions, tone, freedom, rail, thread, chapter_intro: intro, reveal } = direction;
  const creative = [tone && `, tone ${tone}`, freedom && `, freedom ${freedom}`, rail && `, rail ${rail}`, thread && `, thread ${JSON.stringify(thread)}`, intro && `, chapter_intro ${intro}`, reveal && `, reveal ${reveal}`].filter(Boolean).join("");
  return `pacing ${pacing}, motion ${motion}, chrome ${chrome}, background ${background}, captions ${captions}, transitions ${[...new Set(transitions)].join("/")}${creative}`;
}

// How each scene enters: its own `transition`, else a fade into the last scene, else a deal from the mix.
// Entry 0 is null: the first scene has no entrance. An unknown `transition` on any scene throws.
export function enteringTransitions(scenes, mix = DEFAULT_DIRECTION.transitions) {
  for (const scene of scenes) assertKnownTransition(scene);
  const last = scenes.length - 1;
  return scenes.map((scene, i) => {
    if (i === 0) return null;
    return scene.transition ?? (i === last ? "fade" : dealTransition(mix, i));
  });
}

function assertKnownFields(direction) {
  const unknown = Object.keys(direction).find((field) => !FIELDS.includes(field));
  if (unknown !== undefined) throw new Error(`brief.json direction has an unknown field "${unknown}" (known: ${FIELDS.join(", ")})`);
}

function presetKnobs(preset) {
  if (preset == null) return {};
  assertOneOf("direction.preset", preset, Object.keys(PRESETS));
  return PRESETS[preset];
}

// The knobs the direction sets itself; a null knob counts as unset.
function explicitKnobs(direction) {
  return Object.fromEntries(KNOB_FIELDS.filter((name) => direction[name] != null).map((name) => [name, direction[name]]));
}

// tone, freedom, notes, thread, rail, chapter_intro and reveal appear in the result only when set (so the original
// look resolves unchanged); a null counts as unset, like a null knob. thread is the running example every scene
// returns to; reveal "blueprint" and chapter_intro "on" are the opt-in screen fillers (visuals.md).
function creativeFields(direction) {
  const { tone, freedom, notes, thread, rail, chapter_intro, reveal } = direction;
  if (tone != null) assertOneOf("direction.tone", tone, TONES);
  if (freedom != null) assertOneOf("direction.freedom", freedom, FREEDOMS);
  if (rail != null) assertOneOf("direction.rail", rail, RAIL_VALUES);
  if (chapter_intro != null) assertOneOf("direction.chapter_intro", chapter_intro, CHAPTER_INTRO_VALUES);
  if (reveal != null) assertOneOf("direction.reveal", reveal, REVEAL_VALUES);
  assertText("notes", notes);
  assertText("thread", thread);
  return Object.fromEntries(Object.entries({ tone, freedom, notes, thread, rail, chapter_intro, reveal }).filter(([, value]) => value != null));
}

function assertText(name, value) {
  if (value != null && typeof value !== "string") throw new Error(`brief.json direction.${name} must be a string, got ${JSON.stringify(value)}`);
}

function assertOneOf(field, value, allowed) {
  if (!allowed.includes(value)) throw new Error(`brief.json ${field} must be one of ${allowed.join(", ")}, got ${JSON.stringify(value)}`);
}

// "mixed", one transition name, or a list of names; always returned as a fresh list.
function transitionMix(value) {
  if (value === "mixed") return [...MIXED];
  const mix = Array.isArray(value) ? value : [value];
  if (mix.length === 0 || !mix.every((name) => TRANSITIONS.includes(name)))
    throw new Error(`brief.json direction.transitions must be mixed, one of ${TRANSITIONS.join(", ")}, or a list of them, got ${JSON.stringify(value)}`);
  return [...mix];
}

// A null `transition` counts as unset, as it does when the entrance is picked.
function assertKnownTransition(scene) {
  if (scene.transition != null && !TRANSITIONS.includes(scene.transition))
    throw new Error(`${scene.id}: unknown transition ${JSON.stringify(scene.transition)} (valid: ${[...TRANSITIONS].sort().join(", ")})`);
}

// Deals like a shuffled deck: every run of mix.length entrances uses the whole mix, in an order seeded by
// the run's number, so builds are reproducible and a mix of two or more names never collapses into one.
function dealTransition(mix, sceneIndex) {
  const deal = sceneIndex - 1;
  const run = Math.floor(deal / mix.length);
  return shuffled(mix, run)[deal % mix.length];
}

function shuffled(list, seed) {
  const random = seededRandom(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// mulberry32: a small deterministic generator of floats in [0, 1).
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
