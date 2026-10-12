// House-style rules that `build` reports as warnings.
import { variantOf } from "./variants.mjs";

const MIN_RECAP_ITEMS = 2;
const MAX_RECAP_ITEMS = 4;
const MAX_TEMPLATE_SHARE = 0.4;
const MIN_SCENES_FOR_SHARE = 5;
const MIN_SCENES_FOR_TRANSITIONS = 6;
const MIN_SCENES_FOR_RHYTHM = 6;
const MIN_RHYTHM_SPREAD = 1.6; // longest over shortest middle scene

const ENDING_WARNING = "house style: end with a summary scene (a recap, or any scene with summary: true), then close";
const RECAP_WARNING = `house style: recap needs ${MIN_RECAP_ITEMS}-${MAX_RECAP_ITEMS} items, each with a title and an example`;
const SIGNATURE_WARNING = "house style: no signature scene (a project template designed for this demo)";

const isBlank = (value) => String(value ?? "").trim() === "";
const isCompleteRecapItem = (item) => !isBlank(item?.title) && !isBlank(item?.example);
export const isSummary = (scene) => scene.type === "recap" || scene.summary === true;
export const isClose = (scene) => scene.type === "close";
// A beat is punctuation, so it is not counted as a template use (it still may not repeat back to back).
const isBeat = (scene) => scene.type === "beat";

function isCompleteRecap(scene) {
  const items = Array.isArray(scene.data?.items) ? scene.data.items : [];
  return items.length >= MIN_RECAP_ITEMS && items.length <= MAX_RECAP_ITEMS && items.every(isCompleteRecapItem);
}

// `sources[i]` is where scene i's template came from (templateSource), `transitions[i]` how it
// enters (enteringTransitions) and `durations[i]` how long it runs (the timeline), so the rules see the
// video as built. Without durations the rhythm rule is skipped.
export function houseStyleWarnings(scenes, { sources, transitions, durations = [] }) {
  return [
    endingWarning(scenes),
    recapWarning(scenes),
    signatureWarning(sources),
    ...backToBackWarnings(scenes),
    ...overusedTemplateWarnings(scenes),
    sameTransitionWarning(transitions),
    rhythmWarning(durations),
  ].filter(Boolean);
}

// The video ends with a summary of the key takeaways, then the close.
function endingWarning(scenes) {
  const [summary, close] = scenes.slice(-2);
  return scenes.length >= 2 && isSummary(summary) && isClose(close) ? null : ENDING_WARNING;
}

function recapWarning(scenes) {
  return scenes.filter((scene) => scene.type === "recap").every(isCompleteRecap) ? null : RECAP_WARNING;
}

// At least one scene is designed only for this demo: a new project template or hand-written HTML. An
// override (a project copy of a built-in) is a layout fix, so it does not count.
function signatureWarning(sources) {
  return sources.some((source) => source === "project" || source === "custom") ? null : SIGNATURE_WARNING;
}

// Hand-written scenes are each their own design, so only templates can repeat.
function backToBackWarnings(scenes) {
  return scenes.slice(1).flatMap((scene, i) => {
    const previous = scenes[i];
    const repeats = scene.type !== "custom" && scene.type === previous.type && variantOf(scene) === variantOf(previous);
    return repeats ? [`house style: ${previous.id} and ${scene.id} both use ${scene.type} (${variantOf(scene)} variant) back to back; vary the template or variant`] : [];
  });
}

// Every video has a close and a summary, so they are left out of the count; a single use never repeats.
function overusedTemplateWarnings(scenes) {
  if (scenes.length < MIN_SCENES_FOR_SHARE) return [];
  const counted = scenes.filter((scene) => !isClose(scene) && !isSummary(scene) && !isBeat(scene));
  const uses = countBy(counted.filter((scene) => scene.type !== "custom").map((scene) => scene.type));
  return [...uses]
    .filter(([, count]) => count > 1 && count > counted.length * MAX_TEMPLATE_SHARE)
    .map(([type, count]) => `house style: ${type} is used in ${count} of ${counted.length} scenes (over ${MAX_TEMPLATE_SHARE * 100}%, close and summary aside); vary the templates`);
}

// The last scene's entrance is the ending's fade, so only the entrances before it are compared.
function sameTransitionWarning(transitions) {
  if (transitions.length < MIN_SCENES_FOR_TRANSITIONS) return null;
  const kinds = new Set(transitions.slice(1, -1));
  return kinds.size === 1 ? `house style: every scene enters with ${[...kinds][0]} (the final fade aside); vary direction.transitions or a scene's transition` : null;
}

// Scenes of nearly one length play like a metronome; the first and last (opening, close) are left out.
function rhythmWarning(durations) {
  if (durations.length < MIN_SCENES_FOR_RHYTHM) return null;
  const middle = durations.slice(1, -1);
  const [shortest, longest] = [Math.min(...middle), Math.max(...middle)];
  return longest / shortest < MIN_RHYTHM_SPREAD
    ? `house style: monotone rhythm (every scene ${Math.round(shortest)}-${Math.round(longest)} s); mix in a short beat or a longer showcase`
    : null;
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}
