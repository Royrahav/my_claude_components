// The whole map in an isometric 3D world, as the zoom-out summary: the camera starts close on the first stop and
// pulls back; the packet runs the road and each stop lights in turn; the map then moves left and 2-4 takeaway rows
// rise beside it. Set `summary: true` on the scene so it counts as the closing summary.
// data: {
//   stops: [{ title, kind, at?, note? }]            2-4, as in iso-journey
//   takeaways: [{ title, example, at?, example_at? }]  2-4 rows
// }
import { buildWorld, fitZoom, labelZoom, overviewView, readStops } from "../iso-kit.mjs";
import { closeView, lightStop, moveView, placeView, scaleLabels, sendPacket, standStop } from "../iso-motion.mjs";

const OVERVIEW = { width: 1500, shiftY: -10, seconds: 2.2, afterFirst: 0.8 };
const DOCK = { width: 1060, centerX: 570, seconds: 1.0, lead: 1.0 };
const LIGHT_STEP = 1.2; // uncued stops light this far apart: the map is shown quickly, the rows carry the narration
const MIN_GAP = 1.0; // seconds between two stops lighting
const PACKET_LEG = 0.9;
const MAX_STOPS = 4; // more labels overlap their neighbours once the map docks beside the rows
const MIN_ROWS = 2;
const MAX_ROWS = 4;
const EXAMPLE_DELAY = 0.6;
const HOLD_WARN = 0.5; // a row held back longer than this is reported
const ROW_ROOM = 0.8; // a row needs this long before the scene ends
const POP_VOLUME = 0.35;

// Row metrics by count: sparse maps get roomier rows, and four rows still fit the free band.
const SIZES = { 2: { row: 168, gap: 24, badge: 68, title: 38, example: 26 }, 3: { row: 140, gap: 20, badge: 60, title: 36, example: 25 }, 4: { row: 118, gap: 16, badge: 54, title: 34, example: 24 } };
const ROWS_X = { left: 1160, width: 664 };

export default function isoMap(k, d, c) {
  const stops = readStops(k, d, MAX_STOPS);
  const rows = readRows(k, d);
  const world = buildWorld(k, stops);
  const lit = lightTimes(c, world.stops);
  const startView = closeView(world.stops[0]);
  const farZoom = fitZoom(stops.length, OVERVIEW.width);
  const overview = overviewView(farZoom, OVERVIEW);

  placeView(k, startView);
  world.stops.forEach((stop) => standStop(k, stop));
  world.stops.forEach((stop, i) => lightUp(k, world.stops, i, lit));
  const pullStart = lit[0] + OVERVIEW.afterFirst;
  moveView(k, startView, overview, pullStart, OVERVIEW.seconds);
  scaleLabels(k, stops.length, 1, labelZoom(farZoom), pullStart, OVERVIEW.seconds);

  const dockEarliest = pullStart + OVERVIEW.seconds + 0.2;
  const rowTimes = animateRows(k, c, rows, Math.max(lit.at(-1) + 1.2, dockEarliest + DOCK.seconds));
  const dockZoom = fitZoom(stops.length, DOCK.width);
  const dockStart = Math.max(dockEarliest, rowTimes[0] - DOCK.lead);
  moveView(k, overview, overviewView(dockZoom, { shiftY: OVERVIEW.shiftY, centerX: DOCK.centerX }), dockStart, DOCK.seconds);
  scaleLabels(k, stops.length, labelZoom(farZoom), labelZoom(dockZoom), dockStart, DOCK.seconds);
  return { chrome: true };
}

// Each stop lights on its cue, at least MIN_GAP after the one before.
function lightTimes(c, stops) {
  const from = c.first + 0.4;
  const auto = c.spread(stops.length, from, Math.min(from + (stops.length - 1) * LIGHT_STEP, Math.max(from, c.last - 2.4)));
  let previous = -Infinity;
  return stops.map((stop, i) => (previous = Math.max(c.cue(stop.at, auto[i]), previous + MIN_GAP)));
}

function lightUp(k, stops, i, lit) {
  if (i > 0) sendPacket(k, stops, i, lit[i] - PACKET_LEG, PACKET_LEG);
  lightStop(k, stops[i], lit[i]);
}

function readRows(k, d) {
  const rows = Array.isArray(d.takeaways) ? d.takeaways : [];
  if (rows.length < MIN_ROWS || rows.length > MAX_ROWS) throw new Error(`${k.id}: needs ${MIN_ROWS}-${MAX_ROWS} data.takeaways, got ${rows.length}`);
  return rows.map((row, i) => ({ ...row, title: k.need(row, "title", `takeaway ${i + 1}`) }));
}

// The rows rise in reading order (title, then its example), spread over the narration left after the map.
function animateRows(k, c, rows, from) {
  const size = SIZES[rows.length];
  const top = k.centeredTop(rows.length * size.row + (rows.length - 1) * size.gap);
  k.css.push(rowsCss(k.p, size, top));
  k.html.push(`<div class="${k.p("stack")}">${rows.map((row, i) => rowHtml(k, row, i)).join("")}</div>`);
  const auto = c.spread(rows.length, from, Math.max(from, c.last - 1.0));
  return rows.map((row, i) => {
    const cued = c.cue(row.at, auto[i]);
    const t = Math.max(from, cued);
    if (t - cued > HOLD_WARN) c.warn(`takeaway ${i + 1} "${row.title}" waits ${(t - cued).toFixed(1)} s for the map to move aside`);
    if (t + ROW_ROOM > c.duration) throw new Error(`${k.id}: takeaway ${i + 1} "${row.title}" would rise at ${t.toFixed(1)} s, too close to the scene's end (${c.duration.toFixed(1)} s); cue the stops earlier or set a longer hold`);
    k.rise(`r${i}`, t, 28, 0.6);
    k.pop(`b${i}`, t + 0.15);
    k.sound("pop", t + 0.15, POP_VOLUME);
    if (row.example) k.fade(`x${i}`, c.cue(row.example_at, t + EXAMPLE_DELAY), 0.5);
    return t;
  });
}

function rowHtml(k, row, i) {
  const example = row.example ? `<div id="${k.p(`x${i}`)}" class="${k.p("ex")}"><span class="${k.p("eg")}">e.g.</span>${k.esc(row.example)}</div>` : "";
  return `<div id="${k.p(`r${i}`)}" class="${k.p("rw")}"><div id="${k.p(`b${i}`)}" class="${k.p("bd")}">${i + 1}</div><div class="${k.p("tx")}"><div class="${k.p("rt")}">${k.esc(row.title)}</div>${example}</div></div>`;
}

function rowsCss(p, size, top) {
  return `.${p("stack")}{position:absolute;left:${ROWS_X.left}px;top:${top}px;width:${ROWS_X.width}px;display:flex;flex-direction:column;gap:${size.gap}px}
.${p("rw")}{display:flex;align-items:center;gap:28px;min-height:${size.row}px;padding:12px 32px;box-sizing:border-box;background:var(--surface);border:2px solid var(--line);border-radius:14px}
.${p("bd")}{flex:none;display:flex;align-items:center;justify-content:center;width:${size.badge}px;height:${size.badge}px;border-radius:50%;background:var(--accent-text);color:var(--on-accent);font:900 ${Math.round(size.badge / 2)}px/1 var(--font-body)}
.${p("tx")}{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.${p("rt")}{font:700 ${size.title}px/1.2 var(--font-display);color:var(--ink)}
.${p("ex")}{font:400 ${size.example}px/1.4 var(--font-body);color:var(--muted)}
.${p("eg")}{font-weight:700;color:var(--accent-text);margin-right:.5em}`;
}
