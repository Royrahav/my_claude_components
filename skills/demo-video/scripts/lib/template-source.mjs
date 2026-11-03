// Where a scene's template comes from. A project template named like a built-in overrides it: build
// loads the project copy, but it is a layout fix, not a template designed for this demo.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SKILL_DIR } from "./util.mjs";

const FINGERPRINT_LENGTH = 8;
const projectTemplatePath = (root, type) => join(root, "scenes", `${type}.mjs`);
const builtInTemplatePath = (type) => join(SKILL_DIR, "scripts", "lib", "scenes", `${type}.mjs`);

// custom (hand-written HTML), project (a new type in <project>/scenes/), override (a project copy of a
// built-in, under its name) or builtin.
export function templateSource(root, type) {
  if (type === "custom") return "custom";
  if (!existsSync(projectTemplatePath(root, type))) return "builtin";
  return existsSync(builtInTemplatePath(type)) ? "override" : "project";
}

// The template module build loads: the project's own file when there is one, else the skill's.
export function templatePath(root, type) {
  const projectPath = projectTemplatePath(root, type);
  return existsSync(projectPath) ? projectPath : builtInTemplatePath(type);
}

// A template's source with comments and whitespace removed: what makes two copies of one template the same.
export const normalizedSource = (text) => text.replace(/\/\/.*$/gm, "").replace(/\s+/g, "");
export const fingerprint = (text) => createHash("sha1").update(normalizedSource(text)).digest("hex").slice(0, FINGERPRINT_LENGTH);

const examplesDir = () => join(SKILL_DIR, "assets", "examples");
// fingerprint -> file name, for every worked example the skill ships.
const exampleFingerprints = () => new Map(readdirSync(examplesDir()).filter((file) => file.endsWith(".mjs")).map((file) => [fingerprint(readFileSync(join(examplesDir(), file), "utf8")), file]));

// Per scene: for a project template { fingerprint, example } (`example` is the worked example it equals once comments and
// whitespace are ignored, or null), else null. A renamed copy of an example is still that example.
export function templateFacts(root, scenes, sources) {
  const examples = exampleFingerprints();
  return scenes.map((scene, i) => {
    if (sources[i] !== "project") return null;
    const print = fingerprint(readFileSync(projectTemplatePath(root, scene.type), "utf8"));
    return { fingerprint: print, example: examples.get(print) ?? null };
  });
}
