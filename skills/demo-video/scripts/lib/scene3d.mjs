// Which scenes built a 3D stage at the last build: the kit knows (`k.is3d`), a type name does not. Kept per scene id in
// .demo/scene3d.json so a `--only` build and the render's history record still see the scenes they did not build.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readJson } from "./util.mjs";

export const threeDPath = (root) => join(root, ".demo", "scene3d.json");
export const readThreeD = (root) => (existsSync(threeDPath(root)) ? readJson(threeDPath(root)) : {});

// The flags a build starts from: a full build rebuilds every scene, so it starts clean (renamed or removed scenes
// drop out); `--only` keeps the flags of the scenes it does not rebuild.
export const previousThreeD = (root, only) => (only ? readThreeD(root) : {});

export const threeDFlags = (scenes, built) => scenes.map((scene) => built[scene.id]);
