// Objects of the 3D kit that act on a cue: a lock that opens and closes, gears that turn, a stack of layers that light
// one by one, a scanner whose beam sweeps, a crate that cracks and breaks, a key, a token and a clock. Each is a kind
// of iso-objects (same context) and returns `actions`: functions (t, args) that push seek-safe tweens, called by name
// through `place(...).run("open", t)`. An object's moves chain in time order (iso-tween animator), so call its actions
// in the order they play. Parts move by transform (x, y, z, rotation, scale); only leaf elements (a lamp, a crack) fade.
import { seededRandom } from "./direction.mjs";
import { animator, HIDDEN, SHOWN } from "./iso-tween.mjs";
import { rgba } from "./theme.mjs";

const MIN_LAYERS = 2;
const MAX_LAYERS = 6;
export const LAYER = { w: 440, d: 300, h: 34, gap: 104 };

// A zero-size group at (x, y, z): the origin its children are laid out (and turn) around.
const at = (k, { x = 0, y = 0, z = 0, id = "", style = "" }, inner = "") =>
  `<div ${id ? `id="${id}" ` : ""}class="${k.p("g")}" style="left:${x}px;top:${y}px;width:0;height:0${z ? `;transform:translateZ(${z}px)` : ""}${style ? `;${style}` : ""}">${inner}</div>`;
// A flat leaf (the only kind of part that may fade), optionally with an id, extra classes and content.
const leaf = (k, style, { id = "", cls = "", inner = "" } = {}) => `<div ${id ? `id="${id}" ` : ""}class="${k.p("f")}${cls ? ` ${cls}` : ""}" style="${style}">${inner}</div>`;
const clamp = (n, low, high) => Math.min(high, Math.max(low, Math.round(Number(n) || low)));
const round = (v) => Math.round(v * 100) / 100;

// A body with a shackle: `open` lifts the shackle and swings it aside and lights the lamp, `close` reverses it.
function lock({ k, box, pal, cx, cy, id, name }) {
  const body = 110;
  const keyhole = `<div style="position:absolute;left:50%;top:60%;width:22px;height:22px;margin:-11px;border-radius:50%;background:${pal.edge}"></div><div style="position:absolute;left:50%;top:36%;width:9px;height:26px;margin-left:-4.5px;background:${pal.edge}"></div>`;
  const post = (x) => box({ x, y: -13, w: 26, d: 26, h: 84, color: pal.crate, all: true });
  const shackle = at(k, { x: cx + 66, y: cy, z: body }, at(k, { id: name("shackle") }, post(-13) + post(-145) + box({ x: -145, y: -13, w: 171, d: 26, h: 26, z: 84, color: pal.crate, all: true })));
  const lamp = at(k, { z: body + 2 }, leaf(k, `left:${cx - 70}px;top:${cy + 12}px;width:36px;height:16px;border-radius:8px;background:${pal.edge};box-shadow:${pal.glow(1)};opacity:0`, { id: name("lamp") }));
  const html = box({ x: cx - 90, y: cy - 45, w: 180, d: 90, h: body, color: pal.body, glow: pal.glow(0.4), face: keyhole }) + lamp + shackle;
  const arm = animator(k, id("shackle"));
  const light = animator(k, id("lamp"), { opacity: 0 });
  const actions = {
    open(t) {
      arm.move({ z: 52 }, t, { dur: 0.35, ease: "power2.out" });
      arm.move({ rotation: 100 }, t + 0.3, { dur: 0.5, ease: "power2.inOut" });
      light.move({ opacity: 1 }, t + 0.5, { dur: 0.4 });
    },
    close(t) {
      arm.move({ rotation: 0 }, t, { dur: 0.45, ease: "power2.inOut" });
      arm.move({ z: 0 }, t + 0.4, { dur: 0.3, ease: "power3.in" });
      light.move({ opacity: 0 }, t, { dur: 0.3 });
    },
  };
  return { html, height: body + 115, actions, act: (t) => (actions.open(t), []) };
}

// Two meshing gears (spokes, a rim and a hub) that turn against each other: `spin` turns them together.
function gear({ k, box, pal, cx, cy, id, name }) {
  const wheels = [{ key: "big", x: -60, y: 0, r: 100, dir: 1 }, { key: "small", x: 105, y: 12, r: 64, dir: -1 }];
  const height = 34;
  const spoke = (r, angle) => at(k, { style: `transform:rotateZ(${angle}deg)` }, box({ x: -r, y: -r * 0.15, w: r * 2, d: r * 0.3, h: height, color: pal.crate, all: true }));
  const ring = (r) => leaf(k, `left:${-r * 0.8}px;top:${-r * 0.8}px;width:${r * 1.6}px;height:${r * 1.6}px;border-radius:50%;border:${Math.round(r * 0.1)}px solid ${pal.edge};box-shadow:${pal.glow(0.6)};transform:translateZ(${height + 1}px)`);
  const hub = (r) => leaf(k, `left:${-r * 0.22}px;top:${-r * 0.22}px;width:${r * 0.44}px;height:${r * 0.44}px;border-radius:50%;background:${pal.ink};transform:translateZ(${height + 2}px)`);
  const wheel = ({ key, x, y, r }) => at(k, { x: cx + x, y: cy + y, id: name(key) }, [0, 45, 90, 135].map((angle) => spoke(r, angle)).join("") + ring(r) + hub(r));
  const turning = wheels.map((w) => ({ ...w, move: animator(k, id(w.key)) }));
  const actions = {
    spin(t, { turns = 1, dur = 2 } = {}) {
      turning.forEach(({ move, dir, r }) => move.move({ rotation: round((move.state().rotation ?? 0) + dir * 360 * turns * (wheels[0].r / r)) }, t, { dur, ease: "power2.inOut" }));
    },
  };
  return { html: wheels.map(wheel).join(""), height, actions, act: (t) => (actions.spin(t), []) };
}

// Where a layer stands (z of its underside and of its top): layer 0 is the lowest.
const layerZ = (index) => index * (LAYER.h + LAYER.gap);

// A stack of slabs with air between them (`spec.count`, 2-6; layer 0 lowest). `light` and `dim` switch a layer's lamp.
function layers({ k, box, pal, cx, cy, id, name, spec }) {
  const count = clamp(spec.count ?? 4, MIN_LAYERS, MAX_LAYERS);
  const lampOf = (i) => leaf(k, `left:${cx - LAYER.w / 2}px;top:${cy - LAYER.d / 2}px;width:${LAYER.w}px;height:${LAYER.d}px;transform:translateZ(${LAYER.h + 2}px)`, { id: name(`lamp${i}`), cls: k.p("lamp") });
  const slab = (i) => at(k, { z: layerZ(i) }, box({ x: cx - LAYER.w / 2, y: cy - LAYER.d / 2, w: LAYER.w, d: LAYER.d, h: LAYER.h, color: i % 2 ? pal.slab : pal.body, glow: pal.glow(0.35) }) + lampOf(i));
  const lamps = Array.from({ length: count }, (_, i) => animator(k, id(`lamp${i}`), { opacity: 0 }));
  const layerAt = (index) => lamps[clamp(index, 0, count - 1)];
  const actions = {
    light: (t, { index = 0, dur = 0.4 } = {}) => layerAt(index).move({ opacity: 1 }, t, { dur }),
    dim: (t, { index = 0, dur = 0.4 } = {}) => layerAt(index).move({ opacity: 0 }, t, { dur }),
  };
  const anchors = { count, size: { w: LAYER.w, d: LAYER.d }, layerTop: (index) => layerZ(index) + LAYER.h };
  return { html: Array.from({ length: count }, (_, i) => slab(i)).join(""), height: layerZ(count - 1) + LAYER.h, actions, anchors };
}

// A bed with three crates and a gantry whose glowing sheet sweeps over them: `sweep` goes one way, then back on the
// next call; each crate lights as the sheet passes it.
function scanner({ k, box, pal, cx, cy, id, name }) {
  const reach = 150;
  const slots = [-90, 0, 90];
  const lamp = (x) => at(k, { z: 46 }, leaf(k, `left:${cx + x - 22}px;top:${cy - 22}px;width:44px;height:44px;border-radius:6px;background:${pal.edge};box-shadow:${pal.glow(1)};opacity:0`, { id: name(`hit${x}`) }));
  const crate = (x) => box({ x: cx + x - 28, y: cy - 28, w: 56, d: 56, h: 44, z: 14, color: pal.crate });
  const bed = box({ x: cx - 190, y: cy - 120, w: 380, d: 240, h: 14, color: pal.body, glow: pal.glow(0.3) });
  const post = (y) => box({ x: -10, y, w: 20, d: 20, h: 150, color: pal.body, all: true });
  const gantry = at(k, { x: cx, y: cy, id: name("gantry") }, post(-120) + post(100) + box({ x: -10, y: -120, w: 20, d: 240, h: 16, z: 150, color: pal.body, all: true })
    + box({ x: -3, y: -110, w: 6, d: 220, h: 140, z: 8, color: pal.edge, glow: pal.glow(1), all: true }));
  const move = animator(k, id("gantry"), { x: -reach });
  move.hold({ x: -reach });
  const hits = slots.map((x) => animator(k, id(`hit${x}`), { opacity: 0 }));
  const actions = {
    sweep(t, { dur = 1.8 } = {}) {
      const goingRight = (move.state().x ?? 0) < 0;
      const target = goingRight ? reach : -reach;
      move.move({ x: target }, t, { dur, ease: "none" });
      slots.forEach((x, n) => hits[n].move({ opacity: 1 }, t + (dur * (goingRight ? x + reach : reach - x)) / (2 * reach), { dur: 0.3 }));
    },
  };
  return { html: bed + slots.map(crate).join("") + slots.map(lamp).join("") + gantry, height: 160, actions, act: (t) => (actions.sweep(t), []) };
}

// A crate in two halves. `crack` shows a crack across the top and shakes it; `crash` splits the halves apart and
// bursts shards (hidden until then). The break is a transform move, the crack a leaf fade.
function crash({ k, box, pal, cx, cy, id, name, seed }) {
  const random = seededRandom(seed);
  const half = (x, key) => at(k, { x: cx, y: cy, id: name(key) }, box({ x, y: -80, w: 90, d: 160, h: 110, color: pal.body, glow: pal.glow(0.3), all: true }));
  const crack = `<svg viewBox="0 0 180 160" style="position:absolute;inset:0;width:100%;height:100%;fill:none;stroke:${pal.danger};stroke-width:8;stroke-linecap:round;stroke-linejoin:round"><path d="M90 0 L78 34 L104 62 L82 96 L98 128 L90 160"/></svg>`;
  const crackLeaf = at(k, { z: 112 }, leaf(k, `left:${cx - 90}px;top:${cy - 80}px;width:180px;height:160px;opacity:0`, { id: name("crack"), inner: crack }));
  const shards = Array.from({ length: 7 }, (_, n) => ({ n, dx: Math.round((random() - 0.5) * 300), dy: Math.round((random() - 0.5) * 240), lift: Math.round(80 + random() * 90), spin: Math.round((random() - 0.5) * 540) }));
  const shardHtml = shards.map(({ n }) => at(k, { x: cx, y: cy, z: 40 }, at(k, { id: name(`sh${n}`) }, box({ x: -12, y: -12, w: 24, d: 24, h: 24, color: pal.danger, all: true })))).join("");
  const parts = { left: animator(k, id("left")), right: animator(k, id("right")), crack: animator(k, id("crack"), { opacity: 0 }) };
  const flying = shards.map((s) => ({ ...s, move: animator(k, id(`sh${s.n}`), HIDDEN) }));
  flying.forEach(({ move }) => move.hold(HIDDEN));
  const actions = {
    crack(t) {
      parts.crack.move({ opacity: 1 }, t, { dur: 0.3 });
      parts.left.move({ rotation: -2 }, t, { dur: 0.1, ease: "power1.inOut" });
      parts.left.move({ rotation: 2 }, t + 0.1, { dur: 0.1, ease: "power1.inOut" });
      parts.left.move({ rotation: 0 }, t + 0.2, { dur: 0.1, ease: "power1.inOut" });
    },
    crash(t) {
      parts.left.move({ x: -70, rotation: -24 }, t, { dur: 0.5, ease: "power3.out" });
      parts.right.move({ x: 70, rotation: 20 }, t, { dur: 0.5, ease: "power3.out" });
      parts.crack.move({ opacity: 0 }, t, { dur: 0.2 });
      flying.forEach(({ move, dx, dy, lift, spin }) => {
        move.move({ ...SHOWN, x: dx, y: dy, z: lift, rotation: spin / 2 }, t, { dur: 0.4, ease: "power2.out" });
        move.move({ x: Math.round(dx * 1.3), y: Math.round(dy * 1.3), z: 0, rotation: spin }, t + 0.4, { dur: 0.45, ease: "power2.in" });
      });
    },
  };
  return { html: half(-90, "left") + half(0, "right") + crackLeaf + shardHtml, height: 120, actions, act: (t) => (actions.crack(t), actions.crash(t + 0.7), []) };
}

// A key floating over the surface; `turn` rotates it about its vertical axis.
function key({ k, box, pal, cx, cy, id, name }) {
  const ring = leaf(k, `left:-105px;top:-45px;width:90px;height:90px;border-radius:50%;border:18px solid ${pal.crate};box-shadow:${pal.glow(0.8)};transform:translateZ(8px)`);
  const parts = box({ x: -15, y: -9, w: 140, d: 18, h: 16, color: pal.crate, all: true }) + box({ x: 82, y: 9, w: 14, d: 26, h: 16, color: pal.crate, all: true }) + box({ x: 106, y: 9, w: 14, d: 20, h: 16, color: pal.crate, all: true });
  const turn = animator(k, id("turn"));
  const actions = { turn: (t, { degrees = 360, dur = 1.4 } = {}) => turn.move({ rotation: round((turn.state().rotation ?? 0) + degrees) }, t, { dur, ease: "power2.inOut" }) };
  return { html: at(k, { x: cx, y: cy, z: 40 }, at(k, { id: name("turn") }, ring + parts)), height: 70, actions, act: (t) => (actions.turn(t), []) };
}

// A glowing cube with a key on its faces, the thing that travels through a scene: move it with `place(...).move`;
// `pulse` swells it once.
function token({ k, box, pal, cx, cy, id, name }) {
  const size = 80;
  const face = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${k.icon("key", { size: 38, color: pal.ink })}</div>`;
  const cube = box({ x: -size / 2, y: -size / 2, w: size, d: size, h: size, color: pal.edge, glow: `0 0 40px ${pal.edge},0 0 80px ${rgba(pal.edge, 0.6)}`, face, all: true });
  const swell = animator(k, id("swell"));
  const actions = {
    pulse(t) {
      swell.move({ scale: 1.35 }, t, { dur: 0.2, ease: "power2.out" });
      swell.move({ scale: 1 }, t + 0.2, { dur: 0.3, ease: "power2.in" });
    },
  };
  return { html: at(k, { x: cx, y: cy }, at(k, { id: name("swell") }, cube)), height: size, actions, act: (t) => (actions.pulse(t), []) };
}

// A dial on a low base; `advance` sweeps the hands (the hour hand turns a twelfth as far).
function clock({ k, box, pal, cx, cy, id, name }) {
  const dial = 200;
  const base = box({ x: cx - 110, y: cy - 110, w: 220, d: 220, h: 22, color: pal.body, glow: pal.glow(0.4) });
  const face = leaf(k, `left:${cx - dial / 2}px;top:${cy - dial / 2}px;width:${dial}px;height:${dial}px;border-radius:50%;background:${pal.paper};border:6px solid ${pal.edge};box-shadow:${pal.glow(0.6)};transform:translateZ(24px)`);
  const tick = (n) => at(k, { x: cx, y: cy, style: `transform:translateZ(25px) rotateZ(${n * 30}deg)` }, leaf(k, `left:-3px;top:${-dial / 2 + 12}px;width:6px;height:${n % 3 ? 10 : 18}px;background:${pal.onPaper}`));
  const hand = (key, length, width, z) => at(k, { x: cx, y: cy, id: name(key) }, at(k, { z }, leaf(k, `left:${-width / 2}px;top:${-length}px;width:${width}px;height:${length + 10}px;border-radius:${width / 2}px;background:${key === "minute" ? pal.edge : pal.onPaper}`)));
  const hands = { minute: animator(k, id("minute")), hour: animator(k, id("hour")) };
  let minutes = 0;
  const actions = {
    advance(t, { by = 60, dur = 1.6 } = {}) {
      minutes += by;
      hands.minute.move({ rotation: round(minutes * 6) }, t, { dur, ease: "power2.inOut" });
      hands.hour.move({ rotation: round(minutes / 2) }, t, { dur, ease: "power2.inOut" });
    },
  };
  const html = base + face + Array.from({ length: 12 }, (_, n) => tick(n)).join("") + hand("hour", 52, 10, 27) + hand("minute", 78, 7, 28);
  return { html, height: 30, actions, act: (t) => (actions.advance(t), []) };
}

export const ACTORS = { lock, gear, layers, scanner, crash, key, token, clock };
