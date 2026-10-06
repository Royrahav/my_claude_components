// Layout variants: a template module's default export draws its default layout, and its optional
// `variants` export names other layouts of the same data. A scene picks one with `variant`.

export const DEFAULT_VARIANT = "default";

export const variantOf = (scene) => scene.variant ?? DEFAULT_VARIANT;

// The template function for the scene's variant. A name the template does not offer stops the build.
export function templateFor(templateModule, scene) {
  const layouts = { [DEFAULT_VARIANT]: templateModule.default, ...templateModule.variants };
  const name = variantOf(scene);
  if (!Object.hasOwn(layouts, name)) throw new Error(`${scene.id}: ${scene.type} has no variant ${JSON.stringify(name)} (valid: ${Object.keys(layouts).join(", ")})`);
  return layouts[name];
}
