// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { houseStyleWarnings } from "../lib/house-style.mjs";

const ENDING_WARNING = "house style: end with a recap scene, then close";
const RECAP_WARNING = "house style: recap needs 2-4 items, each with a title and an example";

const item = (n = 1) => ({ title: `Takeaway ${n}`, example: `Example ${n}` });
const itemsOf = (count) => Array.from({ length: count }, (_, i) => item(i + 1));
const recapScene = (items = itemsOf(3)) => ({ type: "recap", data: { items } });
// A "recap" in the list becomes a complete recap; any other type is a bare scene.
const scenesOf = (...types) => types.map((type) => (type === "recap" ? recapScene() : { type }));
const closingWith = (recap) => [{ type: "title" }, recap, { type: "close" }];

// the ending -----------------------------------------------------------------------------------------

test("houseStyleWarnings_endsWithRecapThenClose_hasNoWarning", () => {
  assert.deepEqual(houseStyleWarnings(scenesOf("title", "split", "recap", "close")), []);
});

test("houseStyleWarnings_onlyRecapThenClose_hasNoWarning", () => {
  assert.deepEqual(houseStyleWarnings(scenesOf("recap", "close")), []);
});

test("houseStyleWarnings_closeWithoutRecap_warns", () => {
  assert.deepEqual(houseStyleWarnings(scenesOf("title", "split", "close")), [ENDING_WARNING]);
});

test("houseStyleWarnings_recapNotRightBeforeClose_warns", () => {
  assert.deepEqual(houseStyleWarnings(scenesOf("title", "recap", "statement", "close")), [ENDING_WARNING]);
});

test("houseStyleWarnings_recapAfterClose_warns", () => {
  assert.deepEqual(houseStyleWarnings(scenesOf("title", "close", "recap")), [ENDING_WARNING]);
});

test("houseStyleWarnings_recapAsTheLastScene_warns", () => {
  assert.deepEqual(houseStyleWarnings(scenesOf("title", "recap")), [ENDING_WARNING]);
});

test("houseStyleWarnings_closeOnly_warns", () => {
  assert.deepEqual(houseStyleWarnings(scenesOf("close")), [ENDING_WARNING]);
});

test("houseStyleWarnings_noScenes_warns", () => {
  assert.deepEqual(houseStyleWarnings([]), [ENDING_WARNING]);
});

test("houseStyleWarnings_anEarlierRecap_doesNotCountWhenTheEndingIsWrong", () => {
  assert.deepEqual(houseStyleWarnings(scenesOf("recap", "split", "close")), [ENDING_WARNING]);
});

// the recap's content --------------------------------------------------------------------------------

for (const count of [2, 3, 4]) {
  test(`houseStyleWarnings_recapWith${count}CompleteItems_hasNoWarning`, () => {
    assert.deepEqual(houseStyleWarnings(closingWith(recapScene(itemsOf(count)))), []);
  });
}

for (const count of [0, 1, 5, 6]) {
  test(`houseStyleWarnings_recapWith${count}Items_warns`, () => {
    assert.deepEqual(houseStyleWarnings(closingWith(recapScene(itemsOf(count)))), [RECAP_WARNING]);
  });
}

test("houseStyleWarnings_recapWithoutData_warns", () => {
  assert.deepEqual(houseStyleWarnings(closingWith({ type: "recap" })), [RECAP_WARNING]);
});

test("houseStyleWarnings_recapDataWithoutItems_warns", () => {
  assert.deepEqual(houseStyleWarnings(closingWith({ type: "recap", data: { title: "T" } })), [RECAP_WARNING]);
});

test("houseStyleWarnings_recapWhoseItemsIsNotAList_warns", () => {
  assert.deepEqual(houseStyleWarnings(closingWith({ type: "recap", data: { items: "nope" } })), [RECAP_WARNING]);
});

for (const [label, broken] of [
  ["MissingTitle", { example: "E" }],
  ["EmptyTitle", { title: "", example: "E" }],
  ["BlankTitle", { title: "   ", example: "E" }],
  ["NullTitle", { title: null, example: "E" }],
  ["MissingExample", { title: "T" }],
  ["EmptyExample", { title: "T", example: "" }],
  ["BlankExample", { title: "T", example: " \n " }],
  ["NullExample", { title: "T", example: null }],
]) {
  test(`houseStyleWarnings_recapItemWith${label}_warns`, () => {
    assert.deepEqual(houseStyleWarnings(closingWith(recapScene([item(1), broken, item(3)]))), [RECAP_WARNING]);
  });
}

test("houseStyleWarnings_recapItemThatIsNull_warns", () => {
  assert.deepEqual(houseStyleWarnings(closingWith(recapScene([item(1), null, item(3)]))), [RECAP_WARNING]);
});

test("houseStyleWarnings_optionalItemFields_doNotMatter", () => {
  const rich = { title: "T", example: "E", icon: "gear", who: "Support", at: "one", example_at: "two" };

  assert.deepEqual(houseStyleWarnings(closingWith(recapScene([rich, rich]))), []);
});

test("houseStyleWarnings_incompleteRecapInTheWrongPlace_warnsAboutBoth", () => {
  const scenes = [{ type: "title" }, recapScene([item(1)]), { type: "statement" }, { type: "close" }];

  assert.deepEqual(houseStyleWarnings(scenes), [ENDING_WARNING, RECAP_WARNING]);
});

test("houseStyleWarnings_noRecapAtAll_doesNotAlsoWarnAboutItsContent", () => {
  assert.deepEqual(houseStyleWarnings(scenesOf("title", "close")), [ENDING_WARNING]);
});

test("houseStyleWarnings_twoRecapsWhereOneIsIncomplete_warnsOnlyOnce", () => {
  const scenes = [recapScene(), { type: "split" }, recapScene([item(1)]), { type: "close" }];

  assert.deepEqual(houseStyleWarnings(scenes), [RECAP_WARNING]);
});
