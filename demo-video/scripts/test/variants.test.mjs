// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// Layout variants: a scene's `variant` picks the template function, an unknown name stops the build, and
// every built-in template's default layout stays byte-identical to its output before variants existed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createScene, wrap } from "../lib/kit.mjs";
import { loadTheme } from "../lib/theme.mjs";
import { makeCue } from "../lib/timeline.mjs";
import { DEFAULT_VARIANT, templateFor, variantOf } from "../lib/variants.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = loadTheme(join(HERE, "..", "..", "assets", "themes", "labos", "theme.json"));
const GOLDEN_SCENES = JSON.parse(readFileSync(join(HERE, "fixtures", "golden-scenes.json"), "utf8")).scenes;
const loadTemplate = (type) => import(pathToFileURL(join(HERE, "..", "lib", "scenes", `${type}.mjs`)).href);

const defaultLayout = () => "default layout";
const kineticLayout = () => "kinetic layout";
const withVariants = { default: defaultLayout, variants: { kinetic: kineticLayout } };
const withoutVariants = { default: defaultLayout };
const sceneOf = (variant) => ({ id: "s03", type: "title", ...(variant === undefined ? {} : { variant }) });

// templateFor ---------------------------------------------------------------------------------------

test("templateFor_sceneWithoutVariant_isTheDefaultExport", () => {
  assert.equal(templateFor(withVariants, sceneOf()), defaultLayout);
});

test("templateFor_variantNamedDefault_isTheDefaultExport", () => {
  assert.equal(templateFor(withVariants, sceneOf("default")), defaultLayout);
});

test("templateFor_nullVariant_isTheDefaultExport", () => {
  assert.equal(templateFor(withVariants, sceneOf(null)), defaultLayout);
});

test("templateFor_namedVariant_isThatVariantsFunction", () => {
  assert.equal(templateFor(withVariants, sceneOf("kinetic")), kineticLayout);
});

test("templateFor_unknownVariant_throwsNamingTheSceneAndListingTheValidOnes", () => {
  assert.throws(() => templateFor(withVariants, sceneOf("kinetc")), { message: 's03: title has no variant "kinetc" (valid: default, kinetic)' });
});

test("templateFor_templateWithoutVariants_onlyAcceptsTheDefault", () => {
  assert.throws(() => templateFor(withoutVariants, sceneOf("kinetic")), { message: 's03: title has no variant "kinetic" (valid: default)' });
});

test("templateFor_emptyVariantName_isUnknownRatherThanTheDefault", () => {
  assert.throws(() => templateFor(withVariants, sceneOf("")), /has no variant ""/);
});

test("templateFor_inheritedObjectKeyAsVariant_isUnknown", () => {
  assert.throws(() => templateFor(withVariants, sceneOf("toString")), /has no variant "toString"/);
});

test("variantOf_sceneWithoutVariant_isTheDefaultName", () => {
  assert.deepEqual([variantOf({}), DEFAULT_VARIANT], ["default", "default"]);
});

// the built-in templates' variants ------------------------------------------------------------------

const OFFERED = {
  title: ["default", "kinetic", "split"],
  split: ["default", "stacked"],
  bullets: ["default", "list"],
  statement: ["default", "full-bleed"],
  recap: ["default", "cards"],
  pipeline: ["default", "vertical"],
};
const offeredBy = (type) => OFFERED[type] ?? ["default"];

for (const { type } of GOLDEN_SCENES) {
  test(`${type}_unknownVariant_stopsTheBuildListingTheVariantsItOffers`, async () => {
    const templateModule = await loadTemplate(type);

    assert.throws(() => templateFor(templateModule, { id: "s05", type, variant: "nope" }), { message: `s05: ${type} has no variant "nope" (valid: ${offeredBy(type).join(", ")})` });
  });
}

test("scenesDoc_namesEveryVariantATemplateOffers", () => {
  const doc = readFileSync(join(HERE, "..", "..", "references", "scenes.md"), "utf8");

  const undocumented = Object.entries(OFFERED).flatMap(([type, names]) => {
    const section = doc.split(`### ${type}:`)[1]?.split(/\r?\n### /)[0] ?? "";
    return names.filter((name) => name !== DEFAULT_VARIANT && !section.includes(`\`${name}\``)).map((name) => `${type}/${name}`);
  });

  assert.deepEqual(undocumented, []);
});

// default layouts stay byte-identical ---------------------------------------------------------------

// sha256 prefixes of each template's composition plus its sound cues, built from golden-scenes.json before
// layout variants existed. A changed digest means the default layout changed: if that is intended, rebuild
// a real project before and after, compare compositions/ and index.html, then update the digest.
const DEFAULT_DIGESTS = {
  title: "aa5c42278ddcbf89",
  split: "aef83ab1e9928ebb",
  options: "525c7f3411ad7d4c",
  pipeline: "53a1b27ba3c52eb0",
  decision: "e7d3599d6713e47e",
  steps: "b17e9b6b78e85da2",
  cards: "a340be2f6ed03bf0",
  states: "d204a2d7ee8afd6a",
  metrics: "5baa2126e2e905e7",
  code: "26215d7db5fc98d4",
  bullets: "77bfc5af3b067c30",
  statement: "449cc7074b026238",
  recap: "14082360c1258c5b",
  close: "aa60a70d77e5d88e",
};

// The composition `build` writes for the scene, with synthetic word timing over its narration.
function composition(template, scene) {
  const words = scene.say.split(/\s+/).map((text, i) => ({ text, start: 0.6 + i * 0.4, end: 0.9 + i * 0.4 }));
  const speechEnd = words[words.length - 1].end;
  const timeline = { id: "s01", type: scene.type, start: 0, duration: speechEnd + 3, speechEnd, words };
  const k = createScene({ id: "s01", theme: THEME, fontsCss: "", brief: {}, scene, duration: timeline.duration });
  const result = template(k, scene.data, makeCue(timeline, [])) ?? {};
  return wrap(k, { fontsCss: "", chrome: result.chrome !== false, eyebrow: "PRODUCT" }) + JSON.stringify(k.sfx);
}

const digest = (text) => createHash("sha256").update(text).digest("hex").slice(0, 16);

test("goldenScenes_coverEveryBuiltInTemplateOnce", () => {
  assert.deepEqual(GOLDEN_SCENES.map((scene) => scene.type).sort(), Object.keys(DEFAULT_DIGESTS).sort());
});

for (const golden of GOLDEN_SCENES) {
  for (const variant of [undefined, "default"]) {
    test(`${golden.type}_${variant ? "defaultVariantNamed" : "noVariant"}_buildsTheOutputPinnedBeforeVariants`, async () => {
      const scene = { ...golden, id: "s01", ...(variant ? { variant } : {}) };

      const output = composition(templateFor(await loadTemplate(scene.type), scene), scene);

      assert.equal(digest(output), DEFAULT_DIGESTS[scene.type]);
    });
  }
}
