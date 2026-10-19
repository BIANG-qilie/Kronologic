import {
  outwardArcControl,
  quadBezierPoint,
  shortenChord,
  type MatrixEdge,
  type Pt2,
} from "./map-generator";

/** Axis-aligned room plaque in map (viewBox) units. */
export type Box = { cx: number; cy: number; hw: number; hh: number };

export type ArrowPlacement = {
  /** Control point of the curve to draw (the bend may have been adjusted). */
  ctrl: Pt2;
  t: number;
  /** Fraction of the requested chevron size that fits. */
  scale: number;
  /** False only when nothing in the search clears every plaque. */
  clear: boolean;
};

/** Distance from a point to the nearest edge of a box; 0 inside it. */
export function distanceToBox(p: Pt2, b: Box): number {
  const dx = Math.max(Math.abs(p.x - b.cx) - b.hw, 0);
  const dy = Math.max(Math.abs(p.y - b.cy) - b.hh, 0);
  return Math.hypot(dx, dy);
}

export function clearanceOf(p: Pt2, boxes: readonly Box[]): number {
  let c = Infinity;
  for (const b of boxes) c = Math.min(c, distanceToBox(p, b));
  return c;
}

const T_STEPS = Array.from({ length: 41 }, (_, i) => 0.1 + i * 0.02);
const SCALES = [1, 0.85, 0.7, 0.58];

/**
 * Find a spot on a one-way edge whose chevron disk misses every plaque and
 * stays on the canvas. Tries the drawn bend first, then gentler and stronger
 * bows either side of the chord, then smaller chevrons. Among clear spots it
 * prefers the middle of the curve and keeps off the ring's hub, where all the
 * diagonals cross.
 */
export function placeArrow(opts: {
  rawFrom: Pt2;
  rawTo: Pt2;
  /** Endpoints the curve is drawn between (may be pulled in from the centres). */
  from: Pt2;
  to: Pt2;
  center: Pt2;
  bend: number;
  boxes: readonly Box[];
  /** Part of the disk radius that shrinks with the chevron, in map units. */
  radius: number;
  /** Part of the disk radius that does not shrink (the ring around the chevron). */
  ring?: number;
  /** Canvas side length. */
  size: number;
  /** Extra air between disk and plaque. */
  margin?: number;
}): ArrowPlacement {
  const { rawFrom, rawTo, from, to, center, bend, boxes, radius, size } = opts;
  const margin = opts.margin ?? 4;
  const ring = opts.ring ?? 0;
  const sign = bend >= 0 ? 1 : -1;
  const bends = [
    bend,
    bend * 0.6,
    bend * 1.4,
    bend + sign * 0.35,
    bend - sign * 0.3,
    bend + sign * 0.7,
    -bend,
    -bend - sign * 0.4,
    bend + sign * 1.1,
    -bend - sign * 0.8,
    -bend - sign * 1.2,
  ];
  let fallback: ArrowPlacement & { score: number } = {
    ctrl: outwardArcControl(rawFrom, rawTo, center, bend),
    t: 0.5,
    scale: SCALES[SCALES.length - 1],
    clear: false,
    score: -Infinity,
  };

  for (const scale of SCALES) {
    const r = radius * scale + ring + margin;
    for (const b of bends) {
      const ctrl = outwardArcControl(rawFrom, rawTo, center, b);
      let best: { t: number; score: number } | null = null;
      for (const t of T_STEPS) {
        const p = quadBezierPoint(from, ctrl, to, t);
        const onCanvas = p.x >= r && p.y >= r && p.x <= size - r && p.y <= size - r;
        const clear = clearanceOf(p, boxes);
        const hub = Math.hypot(p.x - center.x, p.y - center.y);
        const score = Math.min(clear, 160) - Math.abs(t - 0.5) * 40 - Math.max(0, 120 - hub) * 0.8;
        if (onCanvas && clear >= r) {
          if (!best || score > best.score) best = { t, score };
        } else if (clear - r > fallback.score) {
          fallback = { ctrl, t, scale, clear: false, score: clear - r };
        }
      }
      if (best) return { ctrl, t: best.t, scale, clear: true };
    }
  }
  const { score: _score, ...rest } = fallback;
  void _score;
  return rest;
}

/**
 * Plaque size before the real ones can be measured (server render, first
 * paint). Deliberately generous so the first layout is already safe.
 */
export function estimatedBoxes(
  centers: readonly Pt2[],
  nodeCount: number,
  mapPx: number,
  canvas = 1000
): Box[] {
  const unit = canvas / mapPx;
  const narrow = mapPx < 640;
  const wPx = nodeCount >= 10 ? 54 : nodeCount >= 8 ? 60 : 64;
  const hPx = nodeCount >= 10 && narrow ? 50 : nodeCount >= 10 ? 70 : 76;
  return centers.map((c) => ({ cx: c.x, cy: c.y, hw: (wPx / 2) * unit, hh: (hPx / 2) * unit }));
}

export type EdgeGeometry = {
  edge: MatrixEdge;
  from: Pt2;
  to: Pt2;
  ctrl: Pt2;
  oneWay: boolean;
  /** Chevron position and size; `clear` is false only when no spot misses every plaque. */
  arrow: { t: number; scale: number; clear: boolean } | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Curves for every passage on the ring, plus a collision-free chevron spot
 * for each one-way passage. Shared by the map and its tests.
 */
export function layoutPolygonEdges(opts: {
  edges: readonly MatrixEdge[];
  positions: Record<string, Pt2>;
  boxes: readonly Box[];
  /** Full-size chevron half-size; scales down where space is tight. */
  arrowRadius: number;
  /** Fixed ring around the chevron, added to its disk radius at every scale. */
  arrowRing?: number;
  canvas: number;
  ringRadius: number;
  endPad: number;
}): EdgeGeometry[] {
  const { edges, positions, boxes, arrowRadius, arrowRing, canvas, ringRadius, endPad } = opts;
  const center = { x: canvas / 2, y: canvas / 2 };
  const out: EdgeGeometry[] = [];
  edges.forEach((edge, index) => {
    const pa = positions[edge.a];
    const pb = positions[edge.b];
    if (!pa || !pb) return;
    const rawFrom = edge.kind === "backward" ? pb : pa;
    const rawTo = edge.kind === "backward" ? pa : pb;
    const [sFrom, sTo] = shortenChord(rawFrom, rawTo, endPad);
    const oneWay = edge.kind !== "bidirectional";
    const rawLen = Math.hypot(rawTo.x - rawFrom.x, rawTo.y - rawFrom.y);
    // Ring neighbours sit a plaque apart: bow those arcs hard so they read.
    const short = rawLen < ringRadius * 0.95;
    const bend = short ? 0.62 : 0.16 + (index % 3) * 0.025;
    // Short arcs start under the plaques so they leave them cleanly, no hook.
    const from = short ? rawFrom : sFrom;
    const to = short ? rawTo : sTo;
    const a = { x: round2(from.x), y: round2(from.y) };
    const b = { x: round2(to.x), y: round2(to.y) };
    if (!oneWay) {
      const c = outwardArcControl(rawFrom, rawTo, center, bend);
      out.push({ edge, from: a, to: b, ctrl: { x: round2(c.x), y: round2(c.y) }, oneWay, arrow: null });
      return;
    }
    const placed = placeArrow({ rawFrom, rawTo, from: a, to: b, center, bend, boxes, radius: arrowRadius, ring: arrowRing, size: canvas });
    out.push({
      edge,
      from: a,
      to: b,
      ctrl: { x: round2(placed.ctrl.x), y: round2(placed.ctrl.y) },
      oneWay,
      arrow: { t: placed.t, scale: placed.scale, clear: placed.clear },
    });
  });
  return out;
}
