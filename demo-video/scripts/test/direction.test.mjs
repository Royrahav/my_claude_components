// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// Creative direction: a preset, then explicit knobs, resolve over the original look; bad values fail loudly;
// scene entrances are dealt from the transition mix the same way on every build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DIRECTION, PRESETS, describeDirection, enteringTransitions, resolveDirection } from "../lib/direction.mjs";

const ORIGINAL_LOOK = { pacing: "measured", motion: "calm", chrome: "full", background: "grid", captions: "pill", transitions: ["push"] };
const PRESET_NAMES = ["calm-technical", "energetic-launch", "story-driven", "minimal-documentary"];
const scenesOf = (count) => Array.from({ length: count }, (_, i) => ({ id: `s${i + 1}`, type: "bullets" }));
const withoutTransitions = ({ transitions, ...knobs }) => knobs;
const countOf = (list, name) => list.filter((entry) => entry === name).length;
// The entrances that set a video's rhythm: all but the first scene (none) and the last (the ending's fade).
const bodyEntrances = (transitions) => transitions.slice(1, -1);

// resolving the knobs -------------------------------------------------------------------------------

for (const [label, direction] of [["Undefined", undefined], ["Null", null], ["EmptyObject", {}]]) {
  test(`resolveDirection_${label}_isTheOriginalLook`, () => {
    assert.deepEqual({ ...resolveDirection(direction) }, ORIGINAL_LOOK);
  });
}

test("defaultDirection_isTheOriginalLook", () => {
  assert.deepEqual({ ...DEFAULT_DIRECTION }, ORIGINAL_LOOK);
});

test("presets_areExactlyTheFourDocumentedOnes", () => {
  assert.deepEqual(Object.keys(PRESETS), PRESET_NAMES);
});

for (const [preset, knobs] of [
  ["calm-technical", { pacing: "measured", motion: "calm", chrome: "full", background: "grid", captions: "pill" }],
  ["energetic-launch", { pacing: "brisk", motion: "lively", chrome: "minimal", background: "soft", captions: "pill" }],
  ["story-driven", { pacing: "relaxed", motion: "calm", chrome: "none", background: "soft", captions: "lower" }],
  ["minimal-documentary", { pacing: "measured", motion: "calm", chrome: "none", background: "plain", captions: "minimal" }],
]) {
  test(`resolveDirection_preset_${preset}_setsItsKnobs`, () => {
    assert.deepEqual(withoutTransitions(resolveDirection({ preset })), knobs);
  });
}

test("resolveDirection_calmTechnical_isAFadeHeavyMixWithSomePush", () => {
  const { transitions } = resolveDirection({ preset: "calm-technical" });

  assert.deepEqual(new Set(transitions), new Set(["fade", "push"]));
  assert.ok(countOf(transitions, "fade") > transitions.length / 2);
});

test("resolveDirection_energeticLaunch_mixesPushAndZoom", () => {
  assert.deepEqual(new Set(resolveDirection({ preset: "energetic-launch" }).transitions), new Set(["push", "zoom"]));
});

test("resolveDirection_storyDriven_isFadeLedWithAnOccasionalCut", () => {
  const { transitions } = resolveDirection({ preset: "story-driven" });

  assert.deepEqual(new Set(transitions), new Set(["fade", "cut"]));
  assert.ok(countOf(transitions, "fade") > countOf(transitions, "cut"));
});

test("resolveDirection_minimalDocumentary_mixesCutAndFade", () => {
  assert.deepEqual(new Set(resolveDirection({ preset: "minimal-documentary" }).transitions), new Set(["cut", "fade"]));
});

test("resolveDirection_explicitKnob_overridesThePreset", () => {
  const direction = resolveDirection({ preset: "energetic-launch", captions: "lower", transitions: "fade" });

  assert.deepEqual(direction, { ...resolveDirection({ preset: "energetic-launch" }), captions: "lower", transitions: ["fade"] });
});

test("resolveDirection_knobsWithoutAPreset_keepTheOriginalLookForTheRest", () => {
  assert.deepEqual({ ...resolveDirection({ motion: "lively", background: "plain" }) }, { ...ORIGINAL_LOOK, motion: "lively", background: "plain" });
});

test("resolveDirection_moodAndMotif_leaveTheKnobsAlone", () => {
  const direction = resolveDirection({ preset: "story-driven", mood: "warm, hopeful", motif: "a sheet reshaping from A4 to Letter" });

  assert.deepEqual(direction, resolveDirection({ preset: "story-driven" }));
});

test("resolveDirection_nullKnob_countsAsUnset", () => {
  assert.equal(resolveDirection({ preset: "energetic-launch", chrome: null }).chrome, "minimal");
});

test("resolveDirection_nullPreset_countsAsUnset", () => {
  assert.deepEqual({ ...resolveDirection({ preset: null }) }, ORIGINAL_LOOK);
});

// the transition mix --------------------------------------------------------------------------------

test("resolveDirection_transitionsMixed_isAVariedMixOfPushFadeAndZoom", () => {
  assert.deepEqual(new Set(resolveDirection({ transitions: "mixed" }).transitions), new Set(["push", "fade", "zoom"]));
});

for (const name of ["push", "fade", "zoom", "cut"]) {
  test(`resolveDirection_transitions_${name}_isAMixOfJustThatName`, () => {
    assert.deepEqual(resolveDirection({ transitions: name }).transitions, [name]);
  });
}

test("resolveDirection_listOfTransitions_isKeptAsTheWeightedMix", () => {
  assert.deepEqual(resolveDirection({ transitions: ["cut", "fade", "fade"] }).transitions, ["cut", "fade", "fade"]);
});

test("resolveDirection_changingAResolvedMix_leavesThePresetAlone", () => {
  resolveDirection({ preset: "minimal-documentary" }).transitions.push("zoom");

  assert.deepEqual(resolveDirection({ preset: "minimal-documentary" }).transitions, PRESETS["minimal-documentary"].transitions);
});

// bad values fail loudly ----------------------------------------------------------------------------

test("resolveDirection_unknownPreset_throwsListingThePresets", () => {
  assert.throws(() => resolveDirection({ preset: "loud" }), {
    message: 'brief.json direction.preset must be one of calm-technical, energetic-launch, story-driven, minimal-documentary, got "loud"',
  });
});

for (const [knob, bad, allowed] of [
  ["pacing", "fast", "measured, brisk, relaxed"],
  ["motion", "bouncy", "calm, lively"],
  ["chrome", "half", "full, minimal, none"],
  ["background", "dots", "grid, plain, soft"],
  ["captions", "karaoke", "pill, lower, minimal"],
]) {
  test(`resolveDirection_badValueFor_${knob}_throwsNamingTheKnobAndItsValues`, () => {
    assert.throws(() => resolveDirection({ [knob]: bad }), { message: `brief.json direction.${knob} must be one of ${allowed}, got "${bad}"` });
  });
}

test("resolveDirection_badKnobOverAValidPreset_stillThrows", () => {
  assert.throws(() => resolveDirection({ preset: "calm-technical", chrome: "Full" }), /direction\.chrome must be one of full, minimal, none, got "Full"/);
});

for (const [label, bad] of [["UnknownName", "slide"], ["EmptyList", []], ["ListWithAnUnknownName", ["fade", "wipe"]], ["Number", 3]]) {
  test(`resolveDirection_transitions${label}_throws`, () => {
    assert.throws(() => resolveDirection({ transitions: bad }), {
      message: `brief.json direction.transitions must be mixed, one of push, fade, zoom, cut, or a list of them, got ${JSON.stringify(bad)}`,
    });
  });
}

test("resolveDirection_unknownField_throwsNamingItAndTheKnownFields", () => {
  assert.throws(() => resolveDirection({ transition: "fade" }), {
    message: 'brief.json direction has an unknown field "transition" (known: preset, mood, motif, pacing, motion, chrome, background, captions, transitions)',
  });
});

for (const [label, bad] of [["String", "calm-technical"], ["List", ["calm-technical"]], ["Number", 1]]) {
  test(`resolveDirection_directionAs${label}_throwsAskingForAnObject`, () => {
    assert.throws(() => resolveDirection(bad), { message: `brief.json direction must be an object, got ${JSON.stringify(bad)}` });
  });
}

test("describeDirection_namesEveryKnobAndEachTransitionOnce", () => {
  assert.equal(describeDirection(resolveDirection({ preset: "energetic-launch" })), "pacing brisk, motion lively, chrome minimal, background soft, captions pill, transitions push/zoom");
});

// scene entrances -----------------------------------------------------------------------------------

test("enteringTransitions_withoutAMix_pushesIntoEverySceneAndFadesIntoTheLast", () => {
  assert.deepEqual(enteringTransitions(scenesOf(5)), [null, "push", "push", "push", "fade"]);
});

test("enteringTransitions_theDefaultDirection_entersLikeNoDirection", () => {
  assert.deepEqual(enteringTransitions(scenesOf(7), resolveDirection(undefined).transitions), enteringTransitions(scenesOf(7)));
});

test("enteringTransitions_firstScene_hasNoEntranceEvenWithItsOwnTransition", () => {
  const scenes = [{ type: "title", transition: "zoom" }, { type: "split" }, { type: "close" }];

  assert.equal(enteringTransitions(scenes)[0], null);
});

test("enteringTransitions_singleScene_hasOnlyTheEmptyEntrance", () => {
  assert.deepEqual(enteringTransitions(scenesOf(1), ["zoom"]), [null]);
});

test("enteringTransitions_twoScenes_fadeIntoTheLast", () => {
  assert.deepEqual(enteringTransitions(scenesOf(2), ["zoom"]), [null, "fade"]);
});

test("enteringTransitions_lastScene_fadesInWhateverTheMix", () => {
  for (const preset of PRESET_NAMES) assert.equal(enteringTransitions(scenesOf(9), resolveDirection({ preset }).transitions).at(-1), "fade");
});

test("enteringTransitions_sceneWithItsOwnTransition_keepsItOverTheMixAndTheFinalFade", () => {
  const scenes = [{ type: "title" }, { type: "split", transition: "cut" }, { type: "code" }, { type: "close", transition: "zoom" }];

  const transitions = enteringTransitions(scenes, ["fade"]);

  assert.deepEqual(transitions, [null, "cut", "fade", "zoom"]);
});

test("enteringTransitions_sameScenesAndMix_dealTheSameOnEveryBuild", () => {
  const mix = resolveDirection({ transitions: "mixed" }).transitions;

  assert.deepEqual(enteringTransitions(scenesOf(20), mix), enteringTransitions(scenesOf(20), mix));
});

test("enteringTransitions_dealing_neverDrawsARandomNumber", () => {
  const random = Math.random;
  Math.random = () => assert.fail("Math.random was called");
  try {
    enteringTransitions(scenesOf(20), ["push", "fade", "zoom"]);
  } finally {
    Math.random = random;
  }
});

test("enteringTransitions_dealtEntrances_useOnlyNamesFromTheMix", () => {
  const dealt = bodyEntrances(enteringTransitions(scenesOf(30), ["zoom", "cut"]));

  assert.deepEqual(new Set(dealt), new Set(["zoom", "cut"]));
});

test("enteringTransitions_everyRunOfTheMixLength_dealsTheWholeMix", () => {
  const mix = ["fade", "fade", "push", "zoom"];

  const dealt = bodyEntrances(enteringTransitions(scenesOf(mix.length * 6 + 2), mix));

  for (let run = 0; run < 6; run++) assert.deepEqual(dealt.slice(run * mix.length, (run + 1) * mix.length).sort(), [...mix].sort());
});

test("enteringTransitions_runsOfTheSameMix_comeInDifferentOrders", () => {
  const mix = ["push", "fade", "zoom", "cut"];

  const dealt = bodyEntrances(enteringTransitions(scenesOf(mix.length * 6 + 2), mix));

  const orders = new Set(Array.from({ length: 6 }, (_, run) => dealt.slice(run * mix.length, (run + 1) * mix.length).join(",")));
  assert.ok(orders.size > 1, `every run dealt ${[...orders][0]}`);
});

for (const preset of PRESET_NAMES) {
  test(`enteringTransitions_preset_${preset}_neverEntersEveryBodySceneTheSameWayFromSixScenes`, () => {
    const { transitions } = resolveDirection({ preset });

    for (let count = 6; count <= 30; count++) {
      assert.ok(new Set(bodyEntrances(enteringTransitions(scenesOf(count), transitions))).size > 1, `${count} scenes`);
    }
  });
}

// a scene's own transition --------------------------------------------------------------------------

// Five scenes, s1 to s5, where scene `id` sets its own `transition`.
const withTransition = (id, transition) => scenesOf(5).map((scene) => (scene.id === id ? { ...scene, transition } : scene));
const unknownTransition = (id, name) => `${id}: unknown transition ${JSON.stringify(name)} (valid: cut, fade, push, zoom)`;

for (const name of ["push", "fade", "zoom", "cut"]) {
  test(`enteringTransitions_sceneTransition_${name}_isKept`, () => {
    assert.equal(enteringTransitions(withTransition("s3", name))[2], name);
  });
}

test("enteringTransitions_unknownSceneTransition_throwsNamingTheSceneAndListingTheValidNames", () => {
  assert.throws(() => enteringTransitions(withTransition("s3", "fdae")), { message: 's3: unknown transition "fdae" (valid: cut, fade, push, zoom)' });
});

test("enteringTransitions_unknownTransitionOnTheFirstScene_throwsThoughItHasNoEntrance", () => {
  assert.throws(() => enteringTransitions(withTransition("s1", "slide")), { message: unknownTransition("s1", "slide") });
});

for (const [label, bad] of [["WrongCase", "Fade"], ["EmptyName", ""], ["List", ["fade"]], ["Number", 3]]) {
  test(`enteringTransitions_sceneTransition${label}_throws`, () => {
    assert.throws(() => enteringTransitions(withTransition("s3", bad)), { message: unknownTransition("s3", bad) });
  });
}

test("enteringTransitions_nullSceneTransition_countsAsUnset", () => {
  assert.deepEqual(enteringTransitions(withTransition("s3", null)), enteringTransitions(scenesOf(5)));
});
