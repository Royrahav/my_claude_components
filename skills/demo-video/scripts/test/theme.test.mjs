// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contrast, loadTheme, mostReadableOn, themeVars } from "../lib/theme.mjs";

const THEMES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "themes");
const COLORS = { canvas: "#F6F7F9", surface: "#FFFFFF", ink: "#1E2430", muted: "#5A6272", light: "#6B7280", accent: "#3B5BDB", accent2: "#0F766E", danger: "#DC2626" };

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dv-theme-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function themeWith(overrides, mode = "light") {
  const file = join(dir, "theme.json");
  writeFileSync(file, JSON.stringify({ name: "T", mode, colors: { ...COLORS, ...overrides }, fonts: {}, weights: {}, logo: null }));
  return file;
}

const builtIn = (name) => loadTheme(join(THEMES_DIR, name, "theme.json"));

for (const name of ["labos", "labos-dark", "midnight", "neutral"]) {
  test(`loadTheme_builtInTheme_${name}_loadsAndDerivesTextColors`, () => {
    const theme = builtIn(name);

    assert.match(theme.derived.accentText, /^#[0-9a-f]{6}$/i);
  });

  test(`loadTheme_builtInTheme_${name}_textOnTheAccentFillReachesFourPointFiveToOne`, () => {
    const { derived } = builtIn(name);

    assert.ok(contrast(derived.onAccentFill, derived.accentText) >= 4.5);
  });
}

// text on accent-text fills: the caption active word, the options check mark, the recap badge ----------

test("loadTheme_lightBuiltInThemes_keepWhiteTextOnTheAccentFill", () => {
  assert.deepEqual(["labos", "neutral"].map((name) => builtIn(name).derived.onAccentFill), ["#FFFFFF", "#FFFFFF"]);
});

for (const name of ["midnight", "labos-dark"])
  test(`loadTheme_${name}_usesTheDarkCanvasOnItsBrightAccentFill`, () => {
    const theme = builtIn(name);

    assert.equal(theme.derived.onAccentFill, theme.colors.canvas);
  });

test("labosDarkLogo_comparedWithLabos_differsOnlyInTheCls2Fill", () => {
  const logoOf = (name) => readFileSync(join(THEMES_DIR, name, "logo.svg"), "utf8").replace(/(\.cls-2\s*\{\s*fill:\s*)#[0-9a-f]+/i, "$1<fill>");

  assert.equal(logoOf("labos-dark"), logoOf("labos"));
});

test("loadTheme_labosDark_keepsTheLabosFontsAndAVisibleLogo", () => {
  const dark = builtIn("labos-dark");
  const light = builtIn("labos");
  const logo = readFileSync(join(THEMES_DIR, "labos-dark", dark.logo), "utf8");

  assert.deepEqual(dark.fonts, light.fonts);
  assert.equal(dark.logo, "logo.svg");
  assert.ok(contrast(logo.match(/\.cls-2\s*\{\s*fill:\s*(#[0-9a-f]+)/i)[1], dark.colors.canvas) >= 4.5);
});

test("loadTheme_customDarkThemeWithDeepBlueAccent_picksTheCanvasAndReachesFourPointFive", () => {
  const colors = { canvas: "#0D1320", surface: "#151C2C", ink: "#E8EDF5", muted: "#A3AEC2", light: "#8F9BB3", accent: "#3B5BDB", accent2: "#93B4FF", danger: "#F87171" };

  const { derived } = loadTheme(themeWith(colors, "dark"));

  assert.equal(derived.onAccentFill, "#0D1320");
  assert.ok(contrast(derived.onAccentFill, derived.accentText) >= 4.5);
});

test("themeVars_onAccent_carriesTheChosenColor", () => {
  const theme = builtIn("midnight");

  assert.match(themeVars(theme), new RegExp(`--on-accent:${theme.colors.canvas};`));
});

test("mostReadableOn_candidates_returnsTheOneWithTheHighestContrast", () => {
  assert.equal(mostReadableOn("#2DD4BF", ["#FFFFFF", "#0D1320", "#E8EDF5"]), "#0D1320");
});

test("mostReadableOn_equalContrast_keepsTheFirstCandidate", () => {
  assert.equal(mostReadableOn("#000000", ["#fff", "#FFFFFF"]), "#fff");
});

test("mostReadableOn_noCandidateReachesFourPointFive_stillReturnsTheBestOne", () => {
  const fill = "#808080";

  const best = mostReadableOn(fill, ["#777777", "#FFFFFF", "#888888"]);

  assert.equal(best, "#FFFFFF");
  assert.ok(contrast(best, fill) < 4.5);
});

test("mostReadableOn_threeDigitHexFillAndCandidates_pickTheSameAsTheSixDigitForms", () => {
  const shortForm = mostReadableOn("#0af", ["#fff", "#000", "#888"]);
  const longForm = mostReadableOn("#00AAFF", ["#FFFFFF", "#000000", "#888888"]);

  assert.deepEqual([shortForm, longForm], ["#000", "#000000"]);
});

test("loadTheme_sixDigitHex_isAccepted", () => {
  assert.doesNotThrow(() => loadTheme(themeWith({ accent: "#3B5BDB" })));
});

test("loadTheme_threeDigitHex_isAccepted", () => {
  assert.doesNotThrow(() => loadTheme(themeWith({ accent: "#36d" })));
});

test("loadTheme_lowerAndMixedCaseHex_areAccepted", () => {
  assert.doesNotThrow(() => loadTheme(themeWith({ accent: "#3b5bDB", danger: "#dC2" })));
});

for (const [label, value] of [
  ["namedColor", "red"],
  ["rgbFunction", "rgb(10,20,30)"],
  ["fiveDigitHex", "#12345"],
  ["eightDigitHex", "#11223344"],
  ["missingHash", "3B5BDB"],
  ["nonHexLetters", "#GGGGGG"],
  ["emptyString", ""],
]) {
  test(`loadTheme_${label}_isRejectedNamingTheKeyAndValue`, () => {
    const file = themeWith({ accent: value });

    assert.throws(() => loadTheme(file), { message: `theme.json colors.accent must be #RGB or #RRGGBB, got ${JSON.stringify(value)}` });
  });
}

test("loadTheme_nonStringColor_isRejected", () => {
  const file = themeWith({ ink: 123 });

  assert.throws(() => loadTheme(file), /colors\.ink must be #RGB or #RRGGBB, got 123/);
});

test("loadTheme_badValueInAnyKey_isRejectedNotJustRequiredOnes", () => {
  const file = themeWith({ light: "grey" });

  assert.throws(() => loadTheme(file), /colors\.light must be/);
});

test("loadTheme_firstBadKeyIsTheOneReported", () => {
  const file = themeWith({ canvas: "white", accent: "blue" });

  assert.throws(() => loadTheme(file), /colors\.canvas must be/);
});
