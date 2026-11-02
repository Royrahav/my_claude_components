// Where a scene's template comes from. A project template named like a built-in overrides it: build
// loads the project copy, but it is a layout fix, not a template designed for this demo.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SKILL_DIR } from "./util.mjs";

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
