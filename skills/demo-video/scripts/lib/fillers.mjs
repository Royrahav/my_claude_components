// What fills a scene before its content arrives: the backdrop word (scene field `backdrop`) and the chapter
// intro (direction.chapter_intro "on"). Both are pure builders of a scene's css, html and tweens; the kit's
// `wrap` places them. Ids are prefixed with the scene id, tweens are fromTo (seek-safe), nothing is random.
import { isClose, isSummary } from "./house-style.mjs";
import { rgba } from "./theme.mjs";

// ---- backdrop -------------------------------------------------------------------------------------------

const BACKDROP = { maxChars: 16, maxSize: 520, widthBudget: 1700, glyphEm: 0.62, centerY: 500, drift: 70, alphaLight: 0.07, alphaDark: 0.1 };

// A huge faint word behind the content that drifts slowly sideways; it is there from the first frame (the scene's own entrance brings it in). It is decorative: `data-layout-ignore` is
// the checker's opt-out for ghost typography (no contrast or layout finding), and aria-hidden keeps it out of
// the reading order. It lives in the scene's background layer, behind the content. Null without a backdrop.
export function backdropParts({ id, p, scene, theme, duration, esc }) {
  if (scene.backdrop == null) return null;
  const text = String(scene.backdrop).trim();
  if (text === "" || text.length > BACKDROP.maxChars) throw new Error(`${id}: backdrop must be 1-${BACKDROP.maxChars} characters, got ${JSON.stringify(scene.backdrop)}`);
  const size = Math.min(BACKDROP.maxSize, Math.floor(BACKDROP.widthBudget / (text.length * BACKDROP.glyphEm)));
  const alpha = theme.dark ? BACKDROP.alphaDark : BACKDROP.alphaLight;
  const name = p("backdrop");
  return {
    html: `<div id="${name}" class="${name}" data-layout-ignore aria-hidden="true">${esc(text)}</div>`,
    css: `.${name}{position:absolute;left:0;width:1920px;top:${BACKDROP.centerY - size / 2}px;text-align:center;white-space:nowrap;font:900 ${size}px/${size}px var(--font-display);color:${rgba(theme.colors.accent, alpha)}}`,
    js: [`tl.fromTo("#${name}",{x:${BACKDROP.drift}},{x:${-BACKDROP.drift},duration:${duration},ease:"none"},0);`],
  };
}

// ---- chapter intro --------------------------------------------------------------------------------------

const INTRO = { seconds: 1.45, minSeconds: 1.2, inShare: 0.28, holdShare: 0.34, centerY: 500, maxSize: 130, minSize: 60, widthBudget: 1500, glyphEm: 0.62, tagCenterY: 77, tagRight: 1824, tagCharPx: 13.3, tagPadPx: 42, tagScale: 0.2, leaveScale: 1.08 };

const labelOf = (scene) => String(scene.chapter ?? "").trim();
// Summary and close scenes (and beats, which have no chapter) are not chapters, as in the rail.
const isChapterScene = (scene) => labelOf(scene) !== "" && !isSummary(scene) && !isClose(scene);

// Whether scene i opens a chapter: it is labelled and the last labelled scene before it had another label.
export function startsChapter(scenes, i) {
  if (!isChapterScene(scenes[i])) return false;
  const before = scenes.slice(0, i).reverse().find(isChapterScene);
  return !before || labelOf(before) !== labelOf(scenes[i]);
}

// When the intro runs: from `start` for as long as fits before the first content cue (INTRO.seconds at most).
// Null when the cue leaves less than INTRO.minSeconds.
export function planChapterIntro({ start, firstCue }) {
  const total = Math.min(INTRO.seconds, firstCue - start);
  if (total < INTRO.minSeconds) return null;
  const rise = total * INTRO.inShare;
  const hold = total * INTRO.holdShare;
  return { start, rise, hold, leave: total - rise - hold, end: start + total };
}

// The chapter name enters large in the center, holds, then flies to the chapter tag's corner and scales down to
// it (the real tag fades in as it lands), or, when the chrome hides the tag, grows slightly and fades out.
export function chapterIntroParts({ p, text, plan, tagShown, theme, esc }) {
  const name = p("intro");
  const size = Math.max(INTRO.minSize, Math.min(INTRO.maxSize, Math.floor(INTRO.widthBudget / (text.length * INTRO.glyphEm))));
  const [round, f] = [Math.round, (x) => Math.round(x * 1000) / 1000];
  const leaveAt = f(plan.start + plan.rise + plan.hold);
  const tagWidth = text.length * INTRO.tagCharPx + INTRO.tagPadPx;
  const flight = tagShown
    ? [
        `tl.to("#${name}",{x:${round(INTRO.tagRight - tagWidth / 2 - 960)},y:${INTRO.tagCenterY - INTRO.centerY},scale:${INTRO.tagScale},duration:${f(plan.leave)},ease:"power3.inOut"},${leaveAt});`,
        `tl.to("#${name}",{opacity:0,duration:${f(plan.leave * 0.4)},ease:"power1.in"},${f(leaveAt + plan.leave * 0.6)});`,
      ]
    : [`tl.to("#${name}",{scale:${INTRO.leaveScale},opacity:0,duration:${f(plan.leave)},ease:"power2.in"},${leaveAt});`];
  return {
    html: `<div class="${p("introrow")}"><span id="${name}" class="${p("intro")}">${esc(text)}</span></div>`,
    css: `.${p("introrow")}{position:absolute;left:0;width:1920px;top:${INTRO.centerY - size}px;height:${size * 2}px;display:flex;align-items:center;justify-content:center}
.${name}{display:block;white-space:nowrap;font:900 ${size}px/1.1 var(--font-display);letter-spacing:-.01em;color:${theme.derived.accentText};opacity:0}`,
    js: [`tl.fromTo("#${name}",{opacity:0,scale:0.86,y:14},{opacity:1,scale:1,y:0,duration:${f(plan.rise)},ease:"power3.out"},${f(plan.start)});`, ...flight],
    // The scene's own chapter tag fades in at this time, as the flight lands.
    landsAt: f(plan.end - plan.leave * 0.2),
  };
}
