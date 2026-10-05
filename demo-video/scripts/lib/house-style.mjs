// House-style rules that `build` reports as warnings.

const MIN_RECAP_ITEMS = 2;
const MAX_RECAP_ITEMS = 4;
const ENDING_WARNING = "house style: end with a recap scene, then close";
const RECAP_WARNING = `house style: recap needs ${MIN_RECAP_ITEMS}-${MAX_RECAP_ITEMS} items, each with a title and an example`;

const isBlank = (value) => String(value ?? "").trim() === "";
const isCompleteRecapItem = (item) => !isBlank(item?.title) && !isBlank(item?.example);

function isCompleteRecap(scene) {
  const items = Array.isArray(scene.data?.items) ? scene.data.items : [];
  return items.length >= MIN_RECAP_ITEMS && items.length <= MAX_RECAP_ITEMS && items.every(isCompleteRecapItem);
}

// Every video ends with a recap of the key takeaways, then the close, and each recap has 2-4 complete items.
export function houseStyleWarnings(scenes) {
  const types = scenes.map((scene) => scene.type);
  const endsWithRecapThenClose = types.at(-2) === "recap" && types.at(-1) === "close";
  const recapsAreComplete = scenes.filter((scene) => scene.type === "recap").every(isCompleteRecap);
  return [...(endsWithRecapThenClose ? [] : [ENDING_WARNING]), ...(recapsAreComplete ? [] : [RECAP_WARNING])];
}
