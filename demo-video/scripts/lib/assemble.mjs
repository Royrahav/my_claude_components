// index.html: scenes as sub-composition hosts on alternating tracks, one voice clip per scene,
// SFX clips, the caption track, and transitions. Transitions only extend the OUTGOING scene, so
// voice/SFX/captions keep their timing.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { TRANSITION_SECONDS, enteringTransitions } from "./direction.mjs";
import { r3 } from "./util.mjs";

const SFX_FILE = { whoosh: "whoosh", click: "click", pop: "pop", chime: "chime", typing: "typing" };
const VOICE_TRACKS = [10, 11]; // back-to-back clips alternate: on one track, touching ends lint as an overlap

function transitionJs(type, oldSel, newSel, T, D) {
  if (type === "zoom")
    return [`tl.to("${oldSel}",{scale:2.2,opacity:0,filter:"blur(8px)",duration:${D},ease:"power3.in"},${T});`, `tl.fromTo("${newSel}",{scale:0.6,opacity:0,filter:"blur(8px)"},{scale:1,opacity:1,filter:"blur(0px)",duration:${D},ease:"power3.out"},${T});`];
  if (type === "fade")
    return [`tl.to("${oldSel}",{filter:"blur(10px)",scale:1.03,opacity:0,duration:${D},ease:"power2.inOut"},${T});`, `tl.fromTo("${newSel}",{filter:"blur(10px)",scale:0.97,opacity:0},{filter:"blur(0px)",scale:1,opacity:1,duration:${D},ease:"power2.inOut"},${T});`];
  return [`tl.to("${oldSel}",{x:-1920,duration:${D},ease:"power3.inOut"},${T});`, `tl.fromTo("${newSel}",{x:1920},{x:0,duration:${D},ease:"power3.inOut"},${T});`];
}

// `transitions[i]` is how scene i enters (enteringTransitions); without it, push in and fade into the last.
export function writeIndex(root, tl, scenes, sceneSfx, { canvas, captions, sfxOn, transitions = enteringTransitions(scenes) }) {
  const body = [];
  const js = [];
  const sfx = [];
  let voiceClips = 0;
  tl.scenes.forEach((s, i) => {
    const scene = scenes[i];
    const next = scenes[i + 1];
    const type = next ? transitions[i + 1] : "cut";
    const D = type === "cut" ? 0 : TRANSITION_SECONDS[type] ?? 0.5;
    const hostDur = r3(s.duration + (next && type !== "cut" ? D : 0));
    body.push(`<div id="el-${s.id}" class="scene" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.start}" data-duration="${hostDur}" data-track-index="${i % 2}" data-width="1920" data-height="1080"></div>`);
    if (s.voice) body.push(`<audio id="el-${s.id}-voice" src="${s.voice}" data-start="${s.start}" data-duration="${s.duration}" data-track-index="${VOICE_TRACKS[voiceClips++ % 2]}" data-volume="1"></audio>`);
    if (next && type !== "cut") {
      const T = r3(s.start + s.duration);
      js.push(...transitionJs(type, `#el-${s.id}`, `#el-${next.id}`, T, D));
      if (sfxOn && ["pipeline", "metrics", "decision"].includes(next.type)) sfx.push({ sound: "whoosh", t: T, volume: 0.35 });
    }
    if (sfxOn) {
      for (const x of [...(sceneSfx[s.id] ?? []), ...(scene.sfx ?? []).map((e) => ({ sound: e.sound, t: e.t ?? 0, volume: e.volume }))]) {
        if (x.t < s.duration) sfx.push({ ...x, t: r3(s.start + x.t) });
      }
    }
  });
  sfx.forEach((x, i) => {
    const f = SFX_FILE[x.sound] ?? x.sound;
    body.push(`<audio id="el-sfx-${i}" src="assets/sfx/${f}.mp3" data-start="${x.t}" data-duration="1.6" data-track-index="${20 + i}" data-volume="${x.volume ?? 0.5}"></audio>`);
  });
  if (captions) body.push(`<div id="el-captions" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="${tl.total}" data-track-index="2" data-track-kind="captions" data-width="1920" data-height="1080"></div>`);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1920, height=1080" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;background:#000}
#root{position:relative;width:1920px;height:1080px;overflow:hidden;background:${canvas}}
.scene{position:absolute;inset:0;width:100%;height:100%}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${tl.total}" data-width="1920" data-height="1080">
${body.join("\n")}
</div>
<script>
(function () {
  var tl = gsap.timeline({ paused: true });
  ${js.join("\n  ")}
  tl.to({}, { duration: ${tl.total} }, 0);
  window.__timelines["main"] = tl;
})();
</script>
</body>
</html>
`;
  writeFileSync(join(root, "index.html"), html);
  return { sfx: sfx.length };
}
