// A request's journey in an isometric 3D world: 2-6 stops on a road. A glowing packet travels from stop to stop and
// the camera follows it; each stop rises on its cue with its label. The first stop stands from the start (the
// establishing shot). The 3D look is a house-style exception: use it for spatial or flow content (see visuals.md).
// data: {
//   stops: [{ title, kind, at?, note?, panel? }]   2-6; kind: users | server | database | queue | printer |
//                                                  document | shield | cloud | phone | container
//   pull_back?: false, pull_back_at?                with 3 or more stops the camera pulls back to the whole map after
//                                                  the last one; false keeps it on the last stop, pull_back_at is a cue
// }
// note: a small line under the label. panel: a floating card beside the stop, { code?, chips?, at? }.
import { buildWorld, fitZoom, labelZoom, overviewView, readStops } from "../iso-kit.mjs";
import { announceStop, closeView, LABEL_DELAY, moveView, placeView, riseStop, scaleLabels, sendPacket, standStop, TRAVEL } from "../iso-motion.mjs";

const OVERVIEW = { width: 1500, shiftY: -10, seconds: 2.2, afterLast: 2.4 };
const PULL_BACK_FROM = 3; // stops from which the pull-back is on by default
const MIN_GAP = 1.6; // seconds between two arrivals
const LEG = { rest: 0.8, lead: 0.05, shortest: 0.75 }; // the packet leaves a stop this long after the arrival
const PANEL = { delay: 1.0, exit: 0.1, fade: 0.3, minShown: 0.8 };
const PULL_MIN = 1.0; // a pull-back shorter than this is skipped
const SLIP_WARN = 0.5; // an arrival later than its cue by more than this is reported
const LABEL_RISE = 0.5;

export default function isoJourney(k, d, c) {
  const stops = readStops(k, d);
  const panels = stops.map((stop, i) => panelOf(k, stop, i));
  const world = buildWorld(k, stops);
  const plan = planArrivals(c, world.stops);
  assertFits(k, c, world.stops, plan);
  const pull = pullBackPlan(c, d, plan.at(-1).arrive, world.stops.length);

  addPanelCss(k);
  placeView(k, closeView(world.stops[0]));
  standStop(k, world.stops[0]);
  announceStop(k, world.stops[0], plan[0].arrive);
  world.stops.forEach((_, i) => {
    if (i > 0) travelTo(k, world.stops, i, plan);
    if (panels[i]) showPanel(k, panels[i], i, ...panelWindow(k, plan, pull, i));
  });
  if (pull) pullBack(k, world.stops, pull);
  return { chrome: true };
}

// Each stop's arrival and its panel's time, resolved in reading order and at least MIN_GAP apart.
function planArrivals(c, stops) {
  const auto = c.spread(stops.length, c.first + 0.4, Math.max(c.first + 0.4, c.last - 1.2));
  let previous = -Infinity;
  return stops.map((stop, i) => {
    const cued = c.cue(stop.at, auto[i]);
    previous = Math.max(cued, previous + MIN_GAP);
    if (previous - cued > SLIP_WARN) c.warn(`stop ${i + 1} "${stop.title}" arrives ${(previous - cued).toFixed(1)} s after its cue (stops need ${MIN_GAP} s apart)`);
    return { arrive: previous, panelAt: stop.panel ? c.cue(stop.panel.at, undefined) : undefined };
  });
}

// Every stop must have risen and shown its label before the scene ends.
function assertFits(k, c, stops, plan) {
  const late = plan.findIndex(({ arrive }) => arrive + LABEL_DELAY + LABEL_RISE > c.duration);
  if (late >= 0) throw new Error(`${k.id}: stop ${late + 1} "${stops[late].title}" would arrive at ${plan[late].arrive.toFixed(1)} s, after its label could show before the scene ends (${c.duration.toFixed(1)} s); use fewer stops, cue them earlier or set a longer hold`);
}

// The camera and the packet leave stop i-1 together and arrive just before stop i rises.
function travelTo(k, stops, i, plan) {
  const arrive = plan[i].arrive;
  const start = Math.max(plan[i - 1].arrive + LEG.rest, arrive - TRAVEL.seconds - LEG.lead);
  const dur = Math.min(TRAVEL.seconds, Math.max(LEG.shortest, arrive - LEG.lead - start));
  moveView(k, closeView(stops[i - 1]), closeView(stops[i]), start, dur);
  sendPacket(k, stops, i, start, dur);
  k.sound("whoosh", start, 0.3);
  riseStop(k, stops[i], arrive);
}

// The pull-back is on from 3 stops (`pull_back: false` turns it off); `pull_back_at` is its cue.
function pullBackPlan(c, d, lastArrive, count) {
  if (d.pull_back === false || (count < PULL_BACK_FROM && d.pull_back !== true && d.pull_back_at == null)) return null;
  const latest = c.duration - OVERVIEW.seconds - 0.2;
  const start = Math.max(Math.min(c.cue(d.pull_back_at, lastArrive + OVERVIEW.afterLast), latest), lastArrive + LEG.rest);
  const seconds = Math.min(OVERVIEW.seconds, c.duration - 0.1 - start);
  if (seconds >= PULL_MIN) return { start, seconds, zoom: fitZoom(count, OVERVIEW.width) };
  c.warn(`the pull-back is skipped: only ${Math.max(0, seconds).toFixed(1)} s are left after the last stop (set a longer hold or cue the last stop earlier)`);
  return null;
}

function pullBack(k, stops, { start, seconds, zoom }) {
  moveView(k, closeView(stops.at(-1)), overviewView(zoom, OVERVIEW), start, seconds);
  scaleLabels(k, stops.length, 1, labelZoom(zoom), start, seconds);
}

// A stop's panel leaves just before the camera does: when the next leg starts, or the pull-back.
function leavesAt(plan, pull, i) {
  if (i + 1 < plan.length) return Math.max(plan[i].arrive + LEG.rest, plan[i + 1].arrive - TRAVEL.seconds - LEG.lead) - PANEL.exit;
  return pull ? pull.start - PANEL.exit : undefined;
}

// When a stop's panel shows and leaves: after its stop arrives and at least PANEL.minShown before the camera leaves, so
// its exit always follows its rise. A window too short for that stops the build.
function panelWindow(k, plan, pull, i) {
  const { arrive, panelAt } = plan[i];
  const leave = leavesAt(plan, pull, i);
  const wanted = Math.max(arrive, panelAt ?? arrive + PANEL.delay);
  if (leave === undefined) return [wanted, leave];
  if (leave - PANEL.minShown < arrive) throw new Error(`${k.id}: stop ${i + 1} panel has ${Math.max(0, leave - arrive).toFixed(1)} s before the camera leaves; cue the next stop later or drop the panel`);
  return [Math.min(wanted, leave - PANEL.minShown), leave];
}

// panel: { code?, chips? } is a floating 2D card; a panel with neither stops the build.
function panelOf(k, stop, i) {
  if (!stop.panel) return null;
  const { code, chips = [] } = stop.panel;
  if (!code && chips.length === 0) throw new Error(`${k.id}: stop ${i + 1} panel needs data.stops[${i}].panel.code or .chips`);
  return { code, chips };
}

function showPanel(k, panel, i, at, leave) {
  const { p } = k;
  const code = panel.code ? `<span class="${p("code")}">${k.esc(panel.code)}</span>` : "";
  k.html.push(`<div id="${p(`pn${i}`)}" class="${p("pn")}">${panel.chips.map((chip) => k.chip(chip, { size: 26 })).join("")}${code}</div>`);
  k.rise(`pn${i}`, at, 20, 0.5);
  if (leave !== undefined) k.to(`pn${i}`, leave, { opacity: 0 }, PANEL.fade);
}

function addPanelCss(k) {
  const { p } = k;
  k.css.push(`.${p("pn")}{position:absolute;left:1330px;top:470px;max-width:500px;box-sizing:border-box;padding:20px 24px;background:var(--surface);border:2px solid var(--line);border-radius:14px;display:flex;flex-wrap:wrap;gap:10px}
.${p("pn")} .${p("code")}{white-space:normal;overflow-wrap:anywhere;font-size:28px}`);
}
