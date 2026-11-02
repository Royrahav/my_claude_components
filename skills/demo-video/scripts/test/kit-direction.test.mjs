// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The direction's motion, chrome and background in the scene kit. Without a direction every helper and the
// scene wrapper emit exactly the original markup and timeline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createScene, wrap } from "../lib/kit.mjs";
import { resolveDirection } from "../lib/direction.mjs";
import { loadTheme } from "../lib/theme.mjs";

const THEME = loadTheme(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "themes", "labos", "theme.json"));
const newKit = ({ direction, scene = {} } = {}) =>
  createScene({ id: "s1", theme: THEME, fontsCss: "", brief: {}, scene, duration: 10, ...(direction ? { direction: resolveDirection(direction) } : {}) });
const emitted = (kit, call) => {
  call(kit);
  return kit.js;
};
const durationOf = (line) => Number(line.match(/duration:([\d.]+)/)[1]);
// The position argument closes the tween call; count() wraps its tween in an immediately run function.
const startOf = (line) => Number(line.match(/,(-?[\d.]+)\);(?:\}\)\(\);)?$/)[1]);
const easeOf = (line) => line.match(/ease:"([^"]+)"/)[1];
const wrapped = (options = {}, { chrome = true } = {}) => wrap(newKit(options), { fontsCss: "", chrome, eyebrow: "PRODUCT" });

// Every motion helper, called the way a template calls it.
const HELPERS = {
  rise: (k) => k.rise("a", 1),
  pop: (k) => k.pop("a", 1),
  slide: (k) => k.slide("a", 1),
  fade: (k) => k.fade("a", 1),
  grow: (k) => k.grow("a", 1),
  draw: (k) => k.draw("a", 1),
  drawY: (k) => k.drawY("a", 1),
  type: (k) => k.type("a", 1),
  to: (k) => k.to("a", 1, { x: 5 }),
  count: (k) => k.count("n", 50, 1),
  flip: (k) => k.flip("t", 1),
};

// motion: the original timeline without a direction ----------------------------------------------------

const ORIGINAL_MOTION = {
  rise: ['tl.fromTo("#s1-a",{opacity:0,y:22},{opacity:1,y:0,duration:0.55,ease:"power3.out"},1);'],
  pop: ['tl.fromTo("#s1-a",{opacity:0,scale:0.7},{opacity:1,scale:1,duration:0.45,ease:"back.out(1.6)"},1);'],
  slide: ['tl.fromTo("#s1-a",{opacity:0,x:-40},{opacity:1,x:0,duration:0.55,ease:"power3.out"},1);'],
  fade: ['tl.fromTo("#s1-a",{opacity:0},{opacity:1,duration:0.5,ease:"power2.out"},1);'],
  grow: ['tl.fromTo("#s1-a",{opacity:0,scale:0.92},{opacity:1,scale:1,duration:0.7,ease:"power3.out"},1);'],
  draw: ['tl.fromTo("#s1-a",{scaleX:0},{scaleX:1,duration:0.6,ease:"power2.inOut"},1);'],
  drawY: ['tl.fromTo("#s1-a",{scaleY:0},{scaleY:1,duration:0.6,ease:"power2.inOut"},1);'],
  type: ['tl.fromTo("#s1-a",{clipPath:"inset(0 100% 0 0)"},{clipPath:"inset(0 0% 0 0)",duration:0.9,ease:"steps(24)"},1);'],
  to: ['tl.to("#s1-a",Object.assign({"x":5},{duration:0.5,ease:"power2.out"}),1);'],
  count: ['(function(){var o={v:0},el=document.getElementById("s1-n");tl.fromTo(o,{v:0},{v:50,duration:1,ease:"power2.out",immediateRender:false,onUpdate:function(){var s=o.v.toFixed(0);el.textContent=s;}},1);})();'],
  flip: [
    'tl.fromTo("#s1-t-k",{x:0},{x:34,duration:0.35,ease:"power2.inOut"},1);',
    'tl.fromTo("#s1-t",{backgroundColor:"rgba(51, 51, 51, 0.12)"},{backgroundColor:"#00B08A",duration:0.35,ease:"power2.inOut"},1);',
  ],
};

for (const [name, call] of Object.entries(HELPERS)) {
  test(`kit_${name}WithoutDirection_emitsTheOriginalTween`, () => {
    assert.deepEqual(emitted(newKit(), call), ORIGINAL_MOTION[name]);
  });

  test(`kit_${name}WithCalmMotion_emitsTheOriginalTween`, () => {
    assert.deepEqual(emitted(newKit({ direction: { motion: "calm" } }), call), ORIGINAL_MOTION[name]);
  });
}

test("kit_templateDurationWithManyDecimals_isEmittedAsWrittenWithoutDirection", () => {
  const [line] = emitted(newKit(), (k) => k.rise("a", 1, 22, 0.4666666666666667));

  assert.match(line, /duration:0\.4666666666666667,/);
});

test("kit_ambientWithoutDirection_driftsTheGridAndPushesTheCamera", () => {
  assert.deepEqual(emitted(newKit(), (k) => k.ambient(8)), [
    'tl.fromTo("#s1-grid",{x:0,y:0},{x:-40,y:-20,duration:8,ease:"none"},0);',
    'tl.fromTo("#s1-cam",{scale:1},{scale:1.02,duration:8,ease:"none"},0);',
  ]);
});

// motion: lively --------------------------------------------------------------------------------------

// Every helper but `to`, which is the template's own choreography.
const REVEALS = Object.entries(HELPERS).filter(([name]) => name !== "to");

for (const [name, call] of REVEALS) {
  test(`kit_${name}WithLivelyMotion_playsInThreeQuartersOfTheTimeFromTheSameStart`, () => {
    const calm = emitted(newKit(), call);

    const lively = emitted(newKit({ direction: { motion: "lively" } }), call);

    lively.forEach((line, i) => {
      near(durationOf(line), Math.round(durationOf(calm[i]) * 0.75 * 1000) / 1000);
      assert.equal(startOf(line), startOf(calm[i]));
    });
  });
}

for (const name of ["rise", "pop", "slide", "grow"]) {
  test(`kit_${name}WithLivelyMotion_revealsWithAnOvershootingEase`, () => {
    const [line] = emitted(newKit({ direction: { motion: "lively" } }), HELPERS[name]);

    assert.match(easeOf(line), /^back\.out\(/);
    assert.notEqual(easeOf(line), easeOf(ORIGINAL_MOTION[name][0]));
  });
}

for (const name of ["fade", "draw", "drawY", "to", "count"]) {
  test(`kit_${name}WithLivelyMotion_usesASnappierEase`, () => {
    const [line] = emitted(newKit({ direction: { motion: "lively" } }), HELPERS[name]);

    assert.notEqual(easeOf(line), easeOf(ORIGINAL_MOTION[name][0]));
  });
}

test("kit_typeWithLivelyMotion_keepsTheTypingSteps", () => {
  const [line] = emitted(newKit({ direction: { motion: "lively" } }), HELPERS.type);

  assert.equal(easeOf(line), "steps(24)");
});

test("kit_toWithLivelyMotion_keepsTheTemplatesDurationAndStart", () => {
  const [line] = emitted(newKit({ direction: { motion: "lively" } }), (k) => k.to("cam", 9.2, { opacity: 0 }, 0.8));

  assert.deepEqual([durationOf(line), startOf(line)], [0.8, 9.2]);
});

test("kit_toWithAnEaseFromTheTemplate_keepsThatEaseUnderLivelyMotion", () => {
  const [line] = emitted(newKit({ direction: { motion: "lively" } }), (k) => k.to("a", 2, { x: 9 }, 1.0, "power1.inOut"));

  assert.deepEqual([easeOf(line), durationOf(line)], ["power1.inOut", 1]);
});

test("kit_ambientWithLivelyMotion_keepsTheSceneLongDrift", () => {
  assert.deepEqual(emitted(newKit({ direction: { motion: "lively" } }), (k) => k.ambient(8)), emitted(newKit(), (k) => k.ambient(8)));
});

// chrome --------------------------------------------------------------------------------------------

const CHAPTER = { chapter: "The problem" };
const EYEBROW_HTML = '<div id="s1-eyebrow" class="s1-eyebrow">PRODUCT</div>';
const TAG_HTML = '<div id="s1-tag" class="s1-tag">The problem</div>';
const chromeTween = (targets) => `tl.fromTo([${targets}],{opacity:0,y:8},{opacity:1,y:0,duration:0.4,ease:"power3.out"},0);`;

test("wrap_withoutDirection_showsTheEyebrowAndTheChapterTag", () => {
  const html = wrapped({ scene: CHAPTER });

  assert.ok(html.includes(EYEBROW_HTML + TAG_HTML));
  assert.ok(html.includes(chromeTween('"#s1-eyebrow","#s1-tag"')));
});

test("wrap_fullChrome_isTheOriginalChrome", () => {
  assert.equal(wrapped({ scene: CHAPTER, direction: { chrome: "full" } }), wrapped({ scene: CHAPTER }));
});

test("wrap_fullChromeWithoutAChapter_showsOnlyTheEyebrow", () => {
  const html = wrapped({ direction: { chrome: "full" } });

  assert.ok(html.includes(EYEBROW_HTML));
  assert.ok(!html.includes('id="s1-tag"'));
  assert.ok(html.includes(chromeTween('"#s1-eyebrow"')));
});

test("wrap_minimalChrome_keepsOnlyTheChapterTag", () => {
  const html = wrapped({ scene: CHAPTER, direction: { chrome: "minimal" } });

  assert.ok(html.includes(TAG_HTML));
  assert.ok(!html.includes('id="s1-eyebrow"'));
  assert.ok(html.includes(chromeTween('"#s1-tag"')));
});

test("wrap_minimalChromeWithoutAChapter_showsNoChromeAndAnimatesNone", () => {
  const html = wrapped({ direction: { chrome: "minimal" } });

  assert.ok(!/id="s1-(eyebrow|tag)"/.test(html));
  assert.ok(!html.includes("{opacity:0,y:8}"));
});

test("wrap_noChrome_showsNeitherTheEyebrowNorTheTag", () => {
  const html = wrapped({ scene: CHAPTER, direction: { chrome: "none" } });

  assert.ok(!/id="s1-(eyebrow|tag)"/.test(html));
  assert.ok(!html.includes("{opacity:0,y:8}"));
});

test("wrap_templateWithoutChrome_showsNoneEvenUnderFullChrome", () => {
  const html = wrapped({ scene: CHAPTER, direction: { chrome: "full" } }, { chrome: false });

  assert.ok(!/id="s1-(eyebrow|tag)"/.test(html));
});

// background ----------------------------------------------------------------------------------------

const GRID_HTML = '<div id="s1-grid" class="s1-grid"></div>';
const GRID_CSS = ".s1-grid{position:absolute;inset:-60px;background-image:radial-gradient(circle,var(--grid) 2px,transparent 2.5px);background-size:46px 46px}";
const backgroundOf = (html) => html.match(/<div id="s1-bg"[^>]*>(.*?)<\/div>\n<div id="s1-cam"/)[1];
const ambientFor = (direction) => emitted(newKit({ direction }), (k) => k.ambient(8));

test("wrap_withoutDirection_drawsTheDottedGrid", () => {
  const html = wrapped();

  assert.equal(backgroundOf(html), GRID_HTML);
  assert.ok(html.includes(`.s1-bg{position:absolute;inset:0;background:var(--canvas);overflow:hidden}\n${GRID_CSS}\n.s1-cam{`));
});

test("wrap_gridBackground_isTheOriginalBackground", () => {
  assert.equal(wrapped({ direction: { background: "grid" } }), wrapped());
});

test("wrap_plainBackground_isTheCanvasAlone", () => {
  const html = wrapped({ direction: { background: "plain" } });

  assert.equal(backgroundOf(html), "");
  assert.ok(html.includes(".s1-bg{position:absolute;inset:0;background:var(--canvas);overflow:hidden}\n.s1-cam{"));
});

test("ambient_plainBackground_onlyPushesTheCamera", () => {
  assert.deepEqual(ambientFor({ background: "plain" }), ['tl.fromTo("#s1-cam",{scale:1},{scale:1.02,duration:8,ease:"none"},0);']);
});

test("wrap_softBackground_drawsAGlowLayerWithoutTheDots", () => {
  const html = wrapped({ direction: { background: "soft" } });

  assert.equal(backgroundOf(html), '<div id="s1-glow" class="s1-glow"></div>');
  assert.ok(!html.includes("radial-gradient(circle"));
});

test("wrap_softBackground_tintsWithThemeVariablesOnly", () => {
  const glowCss = wrapped({ direction: { background: "soft" } }).match(/\.s1-glow\{[^}]*\}/)[0];

  assert.match(glowCss, /var\(--tint2\)/);
  assert.doesNotMatch(glowCss, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

test("ambient_softBackground_driftsTheGlowLikeTheGrid", () => {
  assert.deepEqual(ambientFor({ background: "soft" }), [
    'tl.fromTo("#s1-glow",{x:0,y:0},{x:-40,y:-20,duration:8,ease:"none"},0);',
    'tl.fromTo("#s1-cam",{scale:1},{scale:1.02,duration:8,ease:"none"},0);',
  ]);
});

// the whole scene -----------------------------------------------------------------------------------

test("wrap_emptyDirection_isTheSceneWithoutDirection", () => {
  const scene = { chapter: "Proof" };
  const build = (options) => {
    const k = newKit({ scene, ...options });
    k.rise("a", 1);
    k.ambient();
    return wrap(k, { fontsCss: "", chrome: true, eyebrow: "PRODUCT" });
  };

  assert.equal(build({ direction: {} }), build({}));
});

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !~ ${expected}`);
}
