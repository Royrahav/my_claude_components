// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// The two worked 3D signature examples (assets/examples/signature-iso-stack.mjs and signature-iso-orbit.mjs), built
// on a light and a dark theme: deterministic, reveals recorded, no faded preserve-3d element, cues landing on the
// spoken words, labels legible, and nothing of the road-and-packet grammar of iso-journey.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import isoOrbit from "../../assets/examples/signature-iso-orbit.mjs";
import isoStack from "../../assets/examples/signature-iso-stack.mjs";
import { createScene } from "../lib/kit.mjs";
import { makeCue } from "../lib/timeline.mjs";
import { emptyScreenWarnings } from "../lib/screen-gaps.mjs";
import { contrast, loadTheme } from "../lib/theme.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const THEMES = join(ROOT, "assets", "themes");
const THEME_NAMES = ["labos", "labos-dark"];
const themes = THEME_NAMES.map((name) => loadTheme(join(THEMES, name, "theme.json")));
const DURATION = 24;
const WORD_GAP = 0.4;

// The scenes documented in references/custom-scene.md (3D signature scene recipe), parsed from the guide.
const guide = readFileSync(join(ROOT, "references", "custom-scene.md"), "utf8").split("### Worked 3D examples")[1];
const documented = (type) => JSON.parse(guide.match(new RegExp(`\`\`\`json\\r?\\n(\\{ "type": "${type}"[\\s\\S]*?)\\r?\\n\`\`\``))[1]);
const STACK = documented("scope-stack");
const ORBIT = documented("scope-orbit");

const wordsOf = (say) => say.split(/\s+/).map((text, i) => ({ text, start: 0.6 + i * WORD_GAP, end: 0.9 + i * WORD_GAP }));
const spokenAt = (say, word, from = 0) => 0.6 + (wordsOf(say).findIndex((w, i) => i >= from && w.text.replace(/\W/g, "").toLowerCase() === word.toLowerCase())) * WORD_GAP;

function build(template, scene, { theme = themes[0], data = scene.data, duration = DURATION } = {}) {
  const words = wordsOf(scene.say);
  const timeline = { id: "s1", type: scene.type, start: 0, duration, speechEnd: words.at(-1).end, words };
  const warnings = [];
  const k = createScene({ id: "s1", theme, fontsCss: "", brief: {}, scene, duration });
  const result = template(k, data, makeCue(timeline, warnings));
  return { k, result, warnings, html: k.html.join("\n"), css: k.css.join("\n") };
}

const EXAMPLES = [["signature-iso-stack", isoStack, STACK], ["signature-iso-orbit", isoOrbit, ORBIT]];
const tweensOf = (k, id) => k.js.filter((line) => line.startsWith(`tl.fromTo("#s1-${id}",`)).map((line) => ({ line, start: Number(line.match(/,([\d.]+)\);$/)[1]), duration: Number(line.match(/duration:([\d.]+)/)[1]) }));
const valueOf = (line, key) => Number(line.match(new RegExp(`${key}:(-?[\\d.]+)`))[1]);

test("iso3dExamples_source_importsNothingAndNeverDrawsARandomNumber", () => {
  for (const [name] of EXAMPLES) {
    const source = readFileSync(join(ROOT, "assets", "examples", `${name}.mjs`), "utf8");

    assert.doesNotMatch(source, /^\s*import\s/m, name);
    assert.doesNotMatch(source, /Math\.random/, name);
    assert.ok([...source].every((char) => char.charCodeAt(0) < 128), `${name}: plain ASCII only (hyphens, no en or em dashes)`);
  }
});

test("iso3dExamples_documentedScenes_buildOnLightAndDarkThemesWithEveryCueResolved", () => {
  for (const theme of themes)
    for (const [name, template, scene] of EXAMPLES) {
      const { warnings, result, k } = build(template, scene, { theme });

      assert.deepEqual(warnings, [], `${name} ${theme.name}`);
      assert.equal(result.chrome, true);
      assert.equal(k.is3d, true);
    }
});

test("iso3dExamples_sameDataTwice_buildsIdenticalHtmlAndTimeline", () => {
  for (const [name, template, scene] of EXAMPLES) {
    const [first, second] = [build(template, scene), build(template, scene)];

    assert.deepEqual(first.k.js, second.k.js, name);
    assert.equal(first.html, second.html, name);
  }
});

// The ids of the elements that hold 3D children, from the css the stage emitted.
function preserve3dIds(k) {
  const classes = new Set([...k.css.join("\n").matchAll(/\.s1-(\w+)\{[^}]*transform-style:preserve-3d/g)].map((match) => `s1-${match[1]}`));
  return [...k.html.join("\n").matchAll(/id="(s1-[\w-]+)" class="([^"]*)"/g)].filter((match) => match[2].split(" ").some((name) => classes.has(name))).map((match) => match[1]);
}

test("iso3dExamples_preserve3dElements_areNeverFadedAndOnlyTransformsAndOpacityMove", () => {
  for (const theme of themes)
    for (const [name, template, scene] of EXAMPLES) {
      const { k } = build(template, scene, { theme });
      const containers = preserve3dIds(k);

      assert.ok(containers.length > 4, name);
      for (const id of containers) assert.deepEqual(k.js.filter((line) => line.includes(`"#${id}"`) && line.includes("opacity")), [], `${name} ${id}`);
      assert.ok(k.js.filter((line) => line.startsWith("tl.fromTo(")).every((line) => !/[{,](left|top|width|height):/.test(line)), name);
    }
});

test("iso3dExamples_reveals_areRecordedSoTheEmptyScreenWarningStaysQuiet", () => {
  for (const [name, template, scene] of EXAMPLES) {
    const { k } = build(template, scene);

    assert.ok(k.visibleIntervals().some(({ from }) => from === 0), name);
    assert.deepEqual(emptyScreenWarnings({ id: "s1", scene, intervals: k.visibleIntervals(), duration: DURATION }), [], name);
  }
});

test("iso3dExamples_labels_standOnOpaquePillsThatPassAAOnLightAndDarkThemes", () => {
  for (const theme of themes) {
    const { k, css } = build(isoStack, STACK, { theme });
    const pal = k.iso.palette();

    assert.ok(contrast(pal.ink, pal.pillFill) >= 4.5, theme.name);
    assert.ok(contrast(theme.derived.mutedText, pal.pillFill) >= 4.5, theme.name);
    assert.match(css, new RegExp(`\\.s1-pill\\{[^}]*background:${pal.pillFill}`));
  }
});

test("iso3dExamples_unlikeIsoJourney_haveNoRoadNoPacketNoTrailAndNoTrackPullBack", () => {
  for (const [name, template, scene] of EXAMPLES) {
    const { html, k } = build(template, scene);

    assert.doesNotMatch(html, /s1-(road|pk|trail|pl\d)/, name);
    assert.ok(tweensOf(k, "track").length <= 3, name);
  }
});

// the stack ----------------------------------------------------------------------------------------------

const STACK_SAY = STACK.say;
// Each layer's lamp events after its baseline: { start, on } (the object counts layers from the bottom, the data from the top).
const lampEvents = (k, dataIndex, count = 3) => tweensOf(k, `stack_lamp${count - 1 - dataIndex}`).slice(1).map(({ line, start }) => ({ start, on: valueOf(line.split("},{")[1], "opacity") === 1 }));
const SLACK = 0.5; // arrivals are held back at most this long past their word when the words are close together

test("isoStack_layers_lightInOrderOnTheirWordsGoingInAndDimInReverseOrderComingBack", () => {
  const { k } = build(isoStack, STACK);
  const cues = [spokenAt(STACK_SAY, "Scope"), spokenAt(STACK_SAY, "participant"), spokenAt(STACK_SAY, "locks", 8)];

  const events = [0, 1, 2].map((layer) => lampEvents(k, layer));

  events.forEach(([lit, dimmed], layer) => {
    assert.ok(lit.on && !dimmed.on, `layer ${layer}`);
    assert.ok(lit.start >= cues[layer] - 1e-6 && lit.start < cues[layer] + SLACK, `layer ${layer} lights on its word`);
  });
  assert.ok(events[0][0].start < events[1][0].start && events[1][0].start < events[2][0].start, "in order going in");
  assert.ok(events[2][1].start < events[1][1].start && events[1][1].start < events[0][1].start, "the innermost layer is reached first on the way back");
});

test("isoStack_token_descendsThenRisesAndLeavesOverTheTopScaledToNothing", () => {
  const { k } = build(isoStack, STACK);

  const moves = tweensOf(k, "token").filter(({ line }) => line.includes("immediateRender:false") && /(^|[{,])z:/.test(line.split("},{")[1]));
  const heights = moves.map(({ line }) => valueOf(line.split("},{")[1], "z"));

  const strictly = (list, order) => list.every((z, i) => i === 0 || order(z, list[i - 1]));
  assert.equal(heights.length, 6);
  assert.ok(strictly(heights.slice(0, 3), (z, before) => z < before), "down through the three layers");
  assert.ok(strictly(heights.slice(2), (z, before) => z > before), "back up through them and out over the top");
  assert.ok(moves.at(-1).line.includes("scale:0.001"), "and gone");
});

test("isoStack_camera_cranesTowardSideOnDuringTheDescentAndOrbitsOnTheWayBack", () => {
  const { k } = build(isoStack, STACK);

  const [, crane] = tweensOf(k, "tilt");
  const [, orbit] = tweensOf(k, "spin");
  const lastDown = spokenAt(STACK_SAY, "locks", 8);

  assert.ok(valueOf(crane.line.split("},{")[1], "rotationX") > valueOf(crane.line.split("},{")[0], "rotationX"));
  assert.ok(crane.start < lastDown && orbit.start > lastDown);
  assert.ok(valueOf(orbit.line.split("},{")[1], "rotation") > valueOf(orbit.line.split("},{")[0], "rotation"));
});

test("isoStack_layersOutsideThreeToFive_stopTheBuildNamingTheLimits", () => {
  const two = { layers: STACK.data.layers.slice(0, 2) };
  const six = { layers: [...STACK.data.layers, ...STACK.data.layers] };

  assert.throws(() => build(isoStack, STACK, { data: two }), /needs 3-5 data\.layers, got 2/);
  assert.throws(() => build(isoStack, STACK, { data: six }), /needs 3-5 data\.layers, got 6/);
});

test("isoStack_layerWithoutAName_stopsTheBuildNamingTheLayer", () => {
  const layers = STACK.data.layers.map((layer, i) => (i === 1 ? { ...layer, name: " " } : layer));

  assert.throws(() => build(isoStack, STACK, { data: { layers } }), /layer 2 needs data\.name/);
});

test("isoStack_uncuedLayers_spreadOverTheNarrationInOrder", () => {
  const layers = STACK.data.layers.map(({ name }) => ({ name }));
  const { k, warnings } = build(isoStack, STACK, { data: { layers } });

  const lit = [0, 1, 2].map((layer) => lampEvents(k, layer)[0].start);

  assert.deepEqual(warnings, []);
  assert.ok(lit[0] < lit[1] && lit[1] < lit[2]);
});

// the orbit ----------------------------------------------------------------------------------------------

const ORBIT_SAY = ORBIT.say;

test("isoOrbit_satellites_joinInTheOrderOfTheirWordsEachAfterItsLineHasGrown", () => {
  const { k } = build(isoOrbit, ORBIT);

  const arrivals = [0, 1, 2].map((i) => tweensOf(k, `sat${i}`).find(({ line }) => line.includes("scale:1,")).start);
  const lines = [0, 1, 2].map((i) => tweensOf(k, `ln${i}`).find(({ line }) => line.includes("scaleX:1")));

  const words = ["editorder", "session", "Zero"].map((word) => spokenAt(ORBIT_SAY, word));
  arrivals.forEach((start, i) => assert.ok(start >= words[i] - 1e-6 && start < words[i] + 0.5, `satellite ${i} pops in on its word`));
  assert.ok(arrivals[0] < arrivals[1] && arrivals[1] < arrivals[2]);
  lines.forEach((line, i) => assert.ok(line.start + line.duration <= arrivals[i] + 1e-6, `line ${i} reaches its satellite before it pops in`));
});

test("isoOrbit_camera_orbitsThroughTheWholeSceneAndPushesInWhileItTurns", () => {
  const { k } = build(isoOrbit, ORBIT);

  const [, turn] = tweensOf(k, "spin");
  const [, push] = tweensOf(k, "tilt");

  assert.ok(turn.start + turn.duration > DURATION - 1.2 && turn.start < 1);
  assert.ok(valueOf(push.line.split("},{")[1], "z") > valueOf(push.line.split("},{")[0], "z"));
});

test("isoOrbit_centerAction_runsOnceTheLastSatelliteHasJoined", () => {
  const data = { ...ORBIT.data, center: { ...ORBIT.data.center, do: { action: "open", at: "Zero" } } };
  const { k } = build(isoOrbit, ORBIT, { data });

  const lastJoin = Math.max(...[0, 1, 2].map((i) => tweensOf(k, `sat${i}`).find(({ line }) => line.includes("scale:1,")).start));
  const [, open] = tweensOf(k, "hub_shackle");

  assert.ok(open.start >= lastJoin + 0.6 - 1e-6);
});

test("isoOrbit_centerActionOfAnotherKind_stopsTheBuildNamingTheActionsItHas", () => {
  const data = { ...ORBIT.data, center: { title: "Hub", kind: "gear", do: { action: "open" } } };

  assert.throws(() => build(isoOrbit, ORBIT, { data }), /gear has no action "open" \(has: spin\)/);
});

test("isoOrbit_satellitesOutsideThreeToFive_orACenterWithoutATitle_stopTheBuild", () => {
  const two = { ...ORBIT.data, satellites: ORBIT.data.satellites.slice(0, 2) };
  const untitled = { ...ORBIT.data, center: { kind: "lock" } };

  assert.throws(() => build(isoOrbit, ORBIT, { data: two }), /needs 3-5 data\.satellites, got 2/);
  assert.throws(() => build(isoOrbit, ORBIT, { data: untitled }), /the center needs data\.title/);
});

test("isoOrbit_everySatelliteKindOfTheLibrary_buildsOnBothThemes", () => {
  for (const theme of themes)
    for (const kind of ["users", "server", "database", "queue", "printer", "document", "shield", "cloud", "phone", "container", "gear", "layers", "scanner", "clock", "key"]) {
      const satellites = [{ title: "A", kind }, { title: "B", kind: "document" }, { title: "C", kind: "token" }];

      const { warnings } = build(isoOrbit, ORBIT, { theme, data: { ...ORBIT.data, satellites } });

      assert.deepEqual(warnings.filter((message) => !message.includes("not in narration")), [], kind);
    }
});

// The camera ends with the direction away from the camera (and toward it) a quarter gap off the nearest satellite.
const ORBIT_TILT_Z = -20;
const ORBIT_START = 30;
const endsClearOfTheHub = (count, turn) => {
  const gap = 360 / count;
  const back = -90 - (ORBIT_TILT_Z + turn);
  const clear = (azimuth) => { const offset = (((azimuth - ORBIT_START) % gap) + gap) % gap; return Math.min(offset, gap - offset) >= gap / 4 - 0.6; };
  return clear(back) && clear(back + 180);
};
const turnOf = (k) => {
  const [, turn] = tweensOf(k, "spin");
  return valueOf(turn.line.split("},{")[1], "rotation") - valueOf(turn.line.split("},{")[0], "rotation");
};

test("isoOrbit_defaultTurn_endsWithNoSatelliteBehindOrInFrontOfTheHubForThreeToFiveOfThem", () => {
  for (const count of [3, 4, 5]) {
    const satellites = ["document", "database", "users", "server", "queue"].slice(0, count).map((kind, i) => ({ title: `S${i}`, kind, at: String(i) }));
    const { k } = build(isoOrbit, ORBIT, { data: { ...ORBIT.data, satellites } });

    assert.ok(endsClearOfTheHub(count, turnOf(k)), `${count} satellites: turn ${turnOf(k)}`);
    assert.ok(Math.abs(turnOf(k) - 140) <= 180 / count + 1, `${count}: stays near 140 degrees`);
  }
});

test("isoOrbit_explicitDegrees_winOverTheComputedTurn", () => {
  const { k } = build(isoOrbit, ORBIT, { data: { ...ORBIT.data, degrees: 33 } });

  assert.equal(turnOf(k), 33);
});

test("isoStack_outermostLayer_endsLitAfterTheTokenLeaves", () => {
  const { k } = build(isoStack, STACK);

  const events = lampEvents(k, 0);

  assert.deepEqual(events.map(({ on }) => on), [true, false, true]);
  const exit = tweensOf(k, "token").at(-1);
  assert.ok(events[2].start > exit.start);
});

test("isoStack_tokenExit_collapsesAllThreeAxes", () => {
  const { k } = build(isoStack, STACK);

  assert.match(tweensOf(k, "token").at(-1).line, /scale:0\.001,scaleZ:0\.001/);
});
