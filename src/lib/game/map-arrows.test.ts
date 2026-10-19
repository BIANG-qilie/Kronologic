import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clearanceOf,
  distanceToBox,
  estimatedBoxes,
  layoutPolygonEdges,
  placeArrow,
  type Box,
} from "./map-arrows";
import {
  collectMatrixEdges,
  generateRandomMap,
  polygonVertexPositions,
  quadBezierPoint,
  type Pt2,
} from "./map-generator";

const VB = 1000;
const RING = VB * 0.36;
/** Chevron half-sizes the map uses per node count, and the fixed ring around them. */
const arrowHalf = (n: number) => (n >= 10 ? 19 : n >= 8 ? 21 : 24);
const ARROW_RING = 6;

function ring(n: number, ids: readonly string[]): Record<string, Pt2> {
  const unit = polygonVertexPositions(n);
  return Object.fromEntries(ids.map((id, i) => [id, { x: VB / 2 + unit[i].x * RING, y: VB / 2 + unit[i].y * RING }]));
}

describe("distanceToBox", () => {
  const b: Box = { cx: 0, cy: 0, hw: 10, hh: 5 };
  it("is zero inside and measures to the nearest edge or corner outside", () => {
    assert.equal(distanceToBox({ x: 3, y: 2 }, b), 0);
    assert.equal(distanceToBox({ x: 14, y: 0 }, b), 4);
    assert.equal(distanceToBox({ x: 0, y: -9 }, b), 4);
    assert.equal(distanceToBox({ x: 13, y: 9 }, b), 5);
  });
});

describe("placeArrow", () => {
  it("moves the chevron off a plaque sitting on the curve's midpoint", () => {
    const from = { x: 200, y: 500 };
    const to = { x: 800, y: 500 };
    const blocker: Box = { cx: 500, cy: 500, hw: 60, hh: 60 };
    const placed = placeArrow({ rawFrom: from, rawTo: to, from, to, center: { x: 500, y: 900 }, bend: 0, boxes: [blocker], radius: 30, size: VB });
    assert.ok(placed.clear);
    assert.ok(clearanceOf(quadBezierPoint(from, placed.ctrl, to, placed.t), [blocker]) >= 30 * placed.scale);
  });

  it("bends or shrinks when the whole straight chord is covered", () => {
    const from = { x: 450, y: 500 };
    const to = { x: 550, y: 500 };
    const boxes: Box[] = [
      { cx: 450, cy: 500, hw: 45, hh: 40 },
      { cx: 550, cy: 500, hw: 45, hh: 40 },
    ];
    const placed = placeArrow({ rawFrom: from, rawTo: to, from, to, center: { x: 500, y: 500 - 400 }, bend: 0.2, boxes, radius: 26, size: VB });
    assert.ok(placed.clear);
    const p = quadBezierPoint(from, placed.ctrl, to, placed.t);
    assert.ok(clearanceOf(p, boxes) >= 26 * placed.scale);
  });
});

describe("one-way chevrons never touch a room", () => {
  // Map widths from a 360px phone (≈300–330px map) to a wide desktop column.
  const widths = [300, 320, 360, 430, 520, 700];
  for (let n = 6; n <= 12; n++) {
    it(`${n} rooms, 8 seeds, every width`, () => {
      let arrows = 0;
      for (let s = 0; s < 8; s++) {
        for (const oneWayCount of [n, Math.ceil(n / 2)]) {
          const map = generateRandomMap(`arrow-${n}-${s}-${oneWayCount}`, {
            nodeCount: n,
            oneWayCount,
            stayCount: s % 3,
            extraEdges: Math.ceil(n * 0.5),
          });
          const positions = ring(n, map.placeIds);
          const edges = collectMatrixEdges(map.matrix, map.placeIds);
          for (const px of widths) {
            const boxes = estimatedBoxes(map.placeIds.map((id) => positions[id]), n, px, VB);
            const half = arrowHalf(n);
            const laid = layoutPolygonEdges({
              edges,
              positions,
              boxes,
              arrowRadius: half,
              arrowRing: ARROW_RING,
              canvas: VB,
              ringRadius: RING,
              endPad: 58,
            });
            for (const e of laid) {
              if (!e.arrow) continue;
              arrows++;
              const where = `${map.seed} @${px}px ${e.edge.a}→${e.edge.b}`;
              assert.ok(e.arrow.clear, `no clear spot: ${where}`);
              const p = quadBezierPoint(e.from, e.ctrl, e.to, e.arrow.t);
              // As drawn: the chevron shrinks, its ring does not.
              const r = half * e.arrow.scale + ARROW_RING;
              assert.ok(clearanceOf(p, boxes) >= r, `disk hits a plaque: ${where}`);
              assert.ok(p.x >= r && p.y >= r && p.x <= VB - r && p.y <= VB - r, `off canvas: ${where}`);
              assert.ok(e.arrow.scale >= 0.58, where);
            }
          }
        }
      }
      assert.ok(arrows > 0);
    });
  }
});
