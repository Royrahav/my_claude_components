// Object library of the 3D kit: what stands on a platform or is placed on a stage. Each kind is a small function of a
// context { k, pal, box, sprite, cx, cy, seed, spec, id, name } (origin at the footprint's top-left, z up from the
// surface, cx and cy the footprint's center; `spec` is what the object was declared with) and returns
// { html, height, act?, actions?, anchors? }. `height` is how tall the object stands (a label floats above it);
// `act(t)` lists the timeline lines the object plays when its stop lands (a printed sheet sliding out, crates moving
// along the belt). The kinds that act on cue (iso-actors: lock, gear, layers, scanner, crash, key, token, clock)
// return `actions`, which the scene calls by name.
import { seededRandom } from "./direction.mjs";
import { ACTORS } from "./iso-actors.mjs";
import { rgba } from "./theme.mjs";

const bar = (style) => `<i style="position:absolute;${style}"></i>`;
const led = (color) => `border-radius:4px;background:${color};box-shadow:0 0 12px ${color}`;
const slideLine = (id, from, to, t, dur) => `tl.fromTo("#${id}",{${from}},{${to},duration:${dur},ease:"power2.out"},${t.toFixed(2)});`;

// Two rows of people (a body and a head) standing in a loose crowd.
function users({ box, pal, seed, cx, cy }) {
  const random = seededRandom(seed);
  const people = [];
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 4; col++) {
      if (random() < 0.1) continue;
      const [x, y, h] = [cx - 150 + col * 90 + 25, cy - 120 + row * 90 + 20, Math.round(40 + random() * 26)];
      const color = (row + col) % 3 === 0 ? pal.crate : pal.voxel;
      people.push(box({ x, y, w: 36, d: 36, h, color }), box({ x: x + 6, y: y + 6, w: 24, d: 24, h: 22, z: h, color: pal.paper }));
    }
  return { html: people.join(""), height: 90 };
}

// Two towers with a column of lit strips on their camera-facing walls.
function server({ box, pal, cx, cy }) {
  const strips = [0, 1, 2, 3, 4].map((n) => bar(`left:14%;right:14%;top:${14 + n * 16}%;height:7px;${led(n % 2 ? pal.led2 : pal.led1)}`)).join("");
  const tower = (x) => box({ x, y: cy - 60, w: 110, d: 110, h: 190, color: pal.body, glow: pal.glow(0.4), face: strips });
  return { html: tower(cx - 150) + tower(cx + 40), height: 190 };
}

// A stack of glowing rings on a disc.
function database({ k, pal, cx, cy }) {
  const size = 200;
  const ring = (z) => `<div class="${k.p("ring")}" style="left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px;transform:translateZ(${z}px)"></div>`;
  const disc = `<div class="${k.p("f")}" style="left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;background:${pal.body};transform:translateZ(2px)"></div>`;
  return { html: disc + [0, 1, 2, 3, 4].map((n) => ring(24 + n * 38)).join(""), height: 176 };
}

// A belt with four crates that shift along it.
function queue({ k, box, pal, name, cx, cy }) {
  const belt = box({ x: cx - 180, y: cy - 60, w: 360, d: 120, h: 22, color: pal.body, glow: pal.glow(0.3) });
  const crates = [0, 1, 2, 3].map((n) => box({ x: cx - 180 + 40 + n * 80, y: cy - 30, w: 60, d: 60, h: 56, z: 22, color: pal.crate })).join("");
  const id = name("crates");
  return { html: `${belt}<div id="${id}" class="${k.p("g")}" style="left:0;top:0;width:0;height:0">${crates}</div>`, height: 78, act: (t) => [slideLine(id, "x:-40", "x:0", t, 1.1)] };
}

// A body with a sheet that slides out of the front.
function printer({ k, box, pal, name, cx, cy }) {
  const body = box({ x: cx - 120, y: cy - 80, w: 240, d: 170, h: 100, color: pal.body, glow: pal.glow(0.4) });
  const id = name("sheet");
  const sheet = `<div id="${id}" class="${k.p("f")}" style="left:${cx - 80}px;top:${cy + 20}px;width:160px;height:120px;background:${pal.paper};box-shadow:${pal.glow(0.6)};transform:translateZ(104px)"></div>`;
  return { html: body + sheet, height: 106, act: (t) => [slideLine(id, "y:0", "y:110", t, 1.2)] };
}

// Two standing pages with lines of text.
function pages({ box, pal, cx, cy }) {
  const text = bar(`left:14%;right:14%;top:12%;height:8px;background:${pal.edge}`) + [28, 40, 52, 64, 76].map((top, n) => bar(`left:14%;right:${n % 2 ? 30 : 14}%;top:${top}%;height:6px;background:${rgba(pal.edge, 0.4)}`)).join("");
  const page = (x, y) => box({ x, y, w: 150, d: 12, h: 180, color: pal.paper, face: text });
  return { html: page(cx - 105, cy - 20) + page(cx - 45, cy - 70), height: 180 };
}

// A tall slab carrying a shield.
function shield({ k, box, pal, cx, cy }) {
  const icon = k.icon("shield", { size: 130, color: pal.edgeText, style: `fill:${rgba(pal.edge, 0.2)}` });
  const face = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${icon}</div>`;
  return { html: box({ x: cx - 90, y: cy - 15, w: 180, d: 30, h: 190, color: pal.body, glow: pal.glow(0.4), face }), height: 190 };
}

// A cloud floating above a shadow: a billboard, so it always faces the camera.
function cloud({ k, pal, sprite, cx, cy }) {
  const shadow = `<div class="${k.p("f")}" style="left:${cx - 110}px;top:${cy - 60}px;width:220px;height:120px;border-radius:50%;background:${rgba(pal.edge, 0.22)}"></div>`;
  const icon = k.icon("cloud", { size: 220, color: pal.edgeText, style: `fill:${rgba(pal.canvas, 0.92)}` });
  const sky = sprite({ x: cx, y: cy, z: 170, html: `<div style="position:absolute;left:-110px;top:-110px">${icon}</div>` });
  return { html: shadow + sky, height: 260 };
}

// A slim slab with a lit screen.
function phone({ box, pal, cx, cy }) {
  const screen = `<div style="position:absolute;inset:6% 10%;border-radius:10px;background:linear-gradient(160deg,${rgba(pal.edge, 0.9)},${rgba(pal.led2, 0.75)})"></div>`;
  const lines = [24, 34, 44].map((top) => bar(`left:24%;right:${top % 20 ? 34 : 24}%;top:${top}%;height:7px;border-radius:4px;background:${pal.paper}`)).join("");
  return { html: box({ x: cx - 50, y: cy - 8, w: 100, d: 16, h: 180, color: pal.body, glow: pal.glow(0.4), face: screen + lines }), height: 180 };
}

// A shipping container with ribbed walls.
function container({ box, pal, cx, cy }) {
  const ribs = `<div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(0,0,0,.22) 0 6px,transparent 6px 28px)"></div>`;
  return { html: box({ x: cx - 140, y: cy - 65, w: 280, d: 130, h: 120, color: pal.crate, glow: pal.glow(0.35), face: ribs }), height: 120 };
}

const KINDS = { users, server, database, queue, printer, document: pages, shield, cloud, phone, container, ...ACTORS };

export const OBJECT_KINDS = Object.keys(KINDS);

export function buildObject(kind, ctx) {
  if (!Object.hasOwn(KINDS, kind)) throw new Error(`${ctx.k.id}: unknown object kind ${JSON.stringify(kind)} (valid: ${OBJECT_KINDS.join(", ")})`);
  return KINDS[kind](ctx);
}
