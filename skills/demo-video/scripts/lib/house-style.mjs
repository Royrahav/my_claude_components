// House-style rules that `build` reports as warnings.
import { variantOf } from "./variants.mjs";

const MIN_RECAP_ITEMS = 2;
const MAX_RECAP_ITEMS = 4;
const MAX_TEMPLATE_SHARE = 0.4;
const MAX_3D_SHARE = 1 / 3; // 3D scenes (any scene that builds a 3D stage) stay about a third of the video
const MIN_SCENES_FOR_SHARE = 5;
const MIN_SCENES_FOR_TRANSITIONS = 6;
const MIN_SCENES_FOR_RHYTHM = 6;
const MIN_RHYTHM_SPREAD = 1.6; // longest over shortest middle scene

const ENDING_WARNING = "house style: end with a summary scene (a recap, or any scene with summary: true), then close";
const RECAP_WARNING = `house style: recap needs ${MIN_RECAP_ITEMS}-${MAX_RECAP_ITEMS} items, each with a title and an example`;
const SIGNATURE_WARNING = "house style: no signature scene (a project template designed for this demo)";

// How the feature was built, reviewed, tested or delivered: never part of a demo, which shows the feature and how to
// use it. Regex sources matched on word boundaries, longest alternative first. Words that are also labOS product
// words stay out unless the phrase makes the process meaning plain: "pipeline", "commit", "merge", "review", "ticket",
// "shelf", "test count", and "Cl 102" (chloride) or "PR 80" (a receptor), so a CL or PR needs its 5-digit number or "#".
// Generic ticket keys ("ISO-15189", "SHA-256" look the same) are out; only known project prefixes count.
// brief.json `allow_terms` lifts a term for a video whose product is itself a development tool.
export const PROCESS_TERMS = [
  "code[- ]review(?:s|ed|ers?|ing)?", "pull requests?", "merge requests?", "CI pipelines?", "pipeline runs?", "CI runs?",
  "build servers?", "unit[- ]test(?:s|ed|ing)?", "unit test counts?", "(?:test|code) coverage", "regression (?:tests?|suite)", "load tests?",
  "files changed", "changelists?", "CL\\s?#?\\d{5,}", "shelved? (?:the )?(?:CL|changelist|change)", "code commits?",
  "commit(?:s|ted)? to (?:the )?(?:repo|repository|main|master)", "Jira", "sprints?", "dev flow",
];
// Uppercase only: "qa" and "ci" in other words or lowercase prose are not hits, and "95% CI" is a confidence interval.
export const PROCESS_TERMS_UPPERCASE = [
  "QA", "UTs?", "Cypress", "(?<!%\\s?)CI(?!\\s+(?:pipelines?|runs?))", "PR\\s?#\\d+", "(?:LAB|IMA|WH)-\\d{2,}", "IMA#?\\d+",
];
const termPattern = (terms, flags) => new RegExp(`\\b(?:${terms.join("|")})\\b`, flags);
const PROCESS_TERM_PATTERNS = [termPattern(PROCESS_TERMS, "gi"), termPattern(PROCESS_TERMS_UPPERCASE, "g")];
const processWarning = (id, term) => `house style: ${id} mentions "${term}" (development process); a demo shows the feature, not how it was built`;

const isBlank = (value) => String(value ?? "").trim() === "";
const isCompleteRecapItem = (item) => !isBlank(item?.title) && !isBlank(item?.example);
export const isSummary = (scene) => scene.type === "recap" || scene.summary === true;
export const isClose = (scene) => scene.type === "close";
// A beat is punctuation, so it is not counted as a template use (it still may not repeat back to back).
export const isBeat = (scene) => scene.type === "beat";

function isCompleteRecap(scene) {
  const items = Array.isArray(scene.data?.items) ? scene.data.items : [];
  return items.length >= MIN_RECAP_ITEMS && items.length <= MAX_RECAP_ITEMS && items.every(isCompleteRecapItem);
}

// `sources[i]` is where scene i's template came from (templateSource), `transitions[i]` how it
// enters (enteringTransitions), `durations[i]` how long it runs (the timeline) and `threeD[i]` whether it built a 3D
// stage (the kit's `is3d`), so the rules see the video as built. Without durations the rhythm rule is skipped;
// without `threeD` a scene counts as 3D when its type is an iso-* template.
// `templates[i]` is what templateFacts found for a project template ({ fingerprint, example }): an unchanged worked
// example is not a scene designed for this demo.
export function houseStyleWarnings(scenes, { sources, transitions, durations = [], allowTerms = [], threeD = [], templates = [] }) {
  return [
    endingWarning(scenes),
    recapWarning(scenes),
    signatureWarning(sources),
    ...backToBackWarnings(scenes),
    ...overusedTemplateWarnings(scenes),
    ...overused3dWarnings(scenes, threeD),
    ...builtInThreeDWarnings(scenes, sources, threeD, templates),
    ...exampleCopyWarnings(scenes, templates),
    ...chapterOrderWarnings(scenes),
    sameTransitionWarning(transitions),
    rhythmWarning(durations),
    ...processTermWarnings(scenes, allowTerms),
  ].filter(Boolean);
}

// Narration and every on-screen string of a scene (the `chapter` tag and the `data`, at any depth) are what the viewer
// hears and reads; the `question` is never shown or voiced.
function spokenAndShownStrings(scene) {
  const strings = [];
  const collect = (value) => {
    if (typeof value === "string") strings.push(value);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect(scene.say);
  collect(scene.chapter);
  collect(scene.data);
  return strings;
}

// An allowed term lifts every hit that contains it as whole words: "CI" lifts "ci" and "ci run".
const termIsAllowed = (term, allowTerms) => allowTerms.some((allowed) => ` ${term} `.includes(` ${String(allowed).trim().toLowerCase()} `));

// One warning per scene and distinct term, so a repeated word does not flood the build output.
function processTermWarnings(scenes, allowTerms) {
  const allowed = [].concat(allowTerms ?? []).map(String);
  return scenes.flatMap((scene) => {
    const terms = spokenAndShownStrings(scene).flatMap((text) => PROCESS_TERM_PATTERNS.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[0].toLowerCase())));
    return [...new Set(terms)].filter((term) => !termIsAllowed(term, allowed)).map((term) => processWarning(scene.id, term));
  });
}

// Every scene but the opening, a beat and the close answers one question the viewer has at that point (`question` in
// scenes.json, never shown or voiced); `plan` reports the scenes that lack one.
const QUESTION_EXEMPT_TYPES = ["title", "beat", "close"];

export function missingQuestionWarnings(scenes) {
  return scenes
    .filter((scene) => !QUESTION_EXEMPT_TYPES.includes(scene.type) && isBlank(scene.question))
    .map((scene) => `plan: ${scene.id} has no question (the viewer question this scene answers)`);
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

// A 3D scene is one that built a 3D stage, whatever its type (`threeD[i]`, from the kit); the built-in iso-* types
// are the fallback when that was not recorded.
export const isThreeD = (scene, i, threeD = []) => threeD[i] ?? String(scene.type).startsWith("iso-");

// 3D is for spatial or flow content, not a look for the whole video. Counted like the template share (close, summary
// and beat aside), so a closing iso-map does not count.
function overused3dWarnings(scenes, threeD) {
  if (scenes.length < MIN_SCENES_FOR_SHARE) return [];
  const counted = scenes.filter((scene) => !isClose(scene) && !isSummary(scene) && !isBeat(scene));
  const count = scenes.filter((scene, i) => counted.includes(scene) && isThreeD(scene, i, threeD)).length;
  return count > counted.length * MAX_3D_SHARE ? [`house style: ${count} of ${counted.length} scenes are 3D (over a third, close and summary aside); keep 3D for spatial or flow content`] : [];
}

// When the content is spatial, at least one 3D scene is designed for this topic (a project template that is not an
// unchanged worked example); the built-in ones are fallbacks, each at most once per video. An override (a project copy
// of a built-in) is still the built-in.
function builtInThreeDWarnings(scenes, sources, threeD, templates) {
  const all3d = scenes.filter((scene, i) => isThreeD(scene, i, threeD));
  const builtIn = scenes.filter((scene, i) => isThreeD(scene, i, threeD) && sources[i] !== "project" && sources[i] !== "custom");
  const undesigned = scenes.filter((scene, i) => isThreeD(scene, i, threeD) && (builtIn.includes(scene) || templates[i]?.example));
  const types = [...new Set(undesigned.map((scene) => scene.type))].join(", ");
  const none = all3d.length > 0 && undesigned.length === all3d.length ? [`house style: every 3D scene is a built-in iso template or an unchanged worked example (${types}); design one for this topic (a 3D signature scene)`] : [];
  const twice = [...countBy(builtIn.map((scene) => scene.type))]
    .filter(([, count]) => count > 1)
    .map(([type, count]) => `house style: the built-in 3D template ${type} is used ${count} times; use each at most once and give other 3D scenes their own form or camera language`);
  return [...none, ...twice];
}

// A worked example copied under a new type name is the same template run again: the guide says to design the
// scene for the topic, so a project template equal to a shipped example (comments and whitespace aside) is reported.
function exampleCopyWarnings(scenes, templates) {
  const seen = new Set();
  return scenes.flatMap((scene, i) => {
    const example = templates[i]?.example;
    if (!example || seen.has(scene.type)) return [];
    seen.add(scene.type);
    return [`house style: ${scene.id} uses ${scene.type}, the worked example ${example} unchanged; design your own form, objects and camera for this topic`];
  });
}

// A chapter is one unbroken run: when a label comes back after a different one, the order jumps around.
// Scenes without a chapter label are skipped, so an unlabelled scene never splits a chapter.
function chapterOrderWarnings(scenes) {
  const seen = new Set();
  let current = null;
  return scenes.flatMap((scene) => {
    const label = String(scene.chapter ?? "").trim();
    if (label === "" || label === current) return [];
    const returned = seen.has(label);
    seen.add(label);
    current = label;
    return returned ? [`house style: chapter "${label}" reappears at ${scene.id} after another chapter; keep each chapter in one run`] : [];
  });
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
