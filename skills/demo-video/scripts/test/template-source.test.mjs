// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// Where a scene's template comes from: a project file named like a built-in is an override, a project file
// under a new name is a project template, and build loads the project's file for both.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprint, normalizedSource, templateFacts, templatePath, templateSource } from "../lib/template-source.mjs";
import { SKILL_DIR } from "../lib/util.mjs";

const BUILT_IN_SCENES = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "scenes");

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dv-template-source-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const projectFile = (type) => join(root, "scenes", `${type}.mjs`);

function addProjectTemplate(type) {
  mkdirSync(join(root, "scenes"), { recursive: true });
  writeFileSync(projectFile(type), "export default () => ({ chrome: true });\n");
}

// templateSource ------------------------------------------------------------------------------------

test("templateSource_builtInWithoutAProjectFile_isBuiltin", () => {
  assert.equal(templateSource(root, "split"), "builtin");
});

test("templateSource_projectFileNamedLikeABuiltIn_isAnOverride", () => {
  addProjectTemplate("split");

  assert.equal(templateSource(root, "split"), "override");
});

test("templateSource_projectFileUnderANewName_isAProjectTemplate", () => {
  addProjectTemplate("sheet-reshape");

  assert.equal(templateSource(root, "sheet-reshape"), "project");
});

test("templateSource_customScene_isCustom", () => {
  assert.equal(templateSource(root, "custom"), "custom");
});

// templatePath --------------------------------------------------------------------------------------

test("templatePath_override_loadsTheProjectCopy", () => {
  addProjectTemplate("split");

  assert.equal(templatePath(root, "split"), projectFile("split"));
});

test("templatePath_projectTemplate_loadsTheProjectFile", () => {
  addProjectTemplate("sheet-reshape");

  assert.equal(templatePath(root, "sheet-reshape"), projectFile("sheet-reshape"));
});

test("templatePath_builtIn_loadsTheSkillsTemplate", () => {
  assert.equal(templatePath(root, "split"), join(BUILT_IN_SCENES, "split.mjs"));
});

// templateFacts -------------------------------------------------------------------------------------

const exampleSource = (name) => readFileSync(join(SKILL_DIR, "assets", "examples", name), "utf8");

test("normalizedSource_commentsAndWhitespace_doNotCount", () => {
  assert.equal(normalizedSource("const a = 1; // note\n\n  export default a;"), normalizedSource("const a=1;\nexport default a;"));
  assert.notEqual(fingerprint("const a = 1;"), fingerprint("const a = 2;"));
});

test("templateFacts_projectTemplateEqualToAWorkedExample_namesTheExampleWhateverItsType", () => {
  mkdirSync(join(root, "scenes"), { recursive: true });
  writeFileSync(join(root, "scenes", "hub-orbit.mjs"), `// my copy\n${exampleSource("signature-iso-orbit.mjs")}\n`);
  writeFileSync(join(root, "scenes", "mine.mjs"), "export default function () {}\n");
  const scenes = [{ type: "split" }, { type: "hub-orbit" }, { type: "mine" }];

  const facts = templateFacts(root, scenes, ["builtin", "project", "project"]);

  assert.equal(facts[0], null);
  assert.equal(facts[1].example, "signature-iso-orbit.mjs");
  assert.deepEqual([facts[2].example, facts[2].fingerprint.length], [null, 8]);
  assert.equal(facts[1].fingerprint, fingerprint(exampleSource("signature-iso-orbit.mjs")));
});
