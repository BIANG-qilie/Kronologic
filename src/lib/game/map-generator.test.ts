import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { areLayoutAdjacent } from "./board";
import {
  MAP_DEFAULT_NODE_COUNT,
  MAP_NODE_COUNT_MAX,
  MAP_NODE_COUNT_MIN,
  collectMatrixEdges,
  collectNonAdjacentEdges,
  edgeKindBetween,
  generateRandomMap,
  isStayPlace,
  layoutForNodeCount,
  outwardArcControl,
  polygonVertexPositions,
  quadBezierPoint,
  quadBezierTangent,
  shortenChord,
} from "./map-generator";
import {
  enumeratePathsFromMatrix,
  pathSatisfiesMatrix,
  sampleNightTrajectory,
} from "./trajectory-kernel";
import { hashSeed, mulberry32 } from "./generate-case";

function undirectedConnected(matrix: number[][]): boolean {
  const n = matrix.length;
  const seen = new Set<number>([0]);
  const q = [0];
  while (q.length) {
    const u = q.pop()!;
    for (let v = 0; v < n; v++) {
      if (seen.has(v)) continue;
      if (matrix[u][v] === 1 || matrix[v][u] === 1) {
        seen.add(v);
        q.push(v);
      }
    }
  }
  return seen.size === n;
}

describe("generateRandomMap", () => {
  it("defaults to 6 nodes", () => {
    const map = generateRandomMap("default-n");
    assert.equal(map.nodeCount, MAP_DEFAULT_NODE_COUNT);
    assert.equal(map.placeIds.length, 6);
    assert.equal(map.matrix.length, 6);
  });

  it("accepts nodeCount=6 and nodeCount=8", () => {
    const six = generateRandomMap("n6", { nodeCount: 6 });
    const eight = generateRandomMap("n8", { nodeCount: 8 });
    assert.equal(six.placeIds.length, 6);
    assert.equal(eight.placeIds.length, 8);
    assert.equal(eight.matrix.length, 8);
    for (const row of eight.matrix) assert.equal(row.length, 8);
  });

  it("rejects nodeCount below min or above max", () => {
    assert.throws(() => generateRandomMap("bad", { nodeCount: 5 }), /nodeCount/);
    assert.throws(
      () => generateRandomMap("bad", { nodeCount: MAP_NODE_COUNT_MAX + 1 }),
      /nodeCount/
    );
    assert.throws(() => generateRandomMap("bad", { nodeCount: 6.5 }), /整数/);
  });

  it("rejects non-integer / out-of-range stayCount", () => {
    assert.throws(() => generateRandomMap("stay", { stayCount: -1 }), /stayCount/);
    assert.throws(() => generateRandomMap("stay", { nodeCount: 6, stayCount: 7 }), /stayCount/);
  });

  it("same seed reproduces the same map", () => {
    const a = generateRandomMap("repro|v1", { nodeCount: 8 });
    const b = generateRandomMap("repro|v1", { nodeCount: 8 });
    assert.deepEqual(a.matrix, b.matrix);
    assert.deepEqual(a.placeIds, b.placeIds);
    assert.deepEqual(a.stayIds, b.stayIds);
    assert.deepEqual(a.directedEdges, b.directedEdges);
  });

  it("different seeds differ", () => {
    const a = generateRandomMap("seed-a", { nodeCount: 7 });
    const b = generateRandomMap("seed-b", { nodeCount: 7 });
    assert.notDeepEqual(a.matrix, b.matrix);
  });

  it("marks stay cells on the diagonal and reports stayIds", () => {
    const map = generateRandomMap("stays", { nodeCount: 6, stayCount: 2 });
    assert.equal(map.stayIds.length, 2);
    for (const id of map.stayIds) {
      assert.ok(isStayPlace(map.matrix, map.placeIds, id));
    }
    for (let i = 0; i < map.placeIds.length; i++) {
      const stay = map.stayIds.includes(map.placeIds[i]);
      assert.equal(map.matrix[i][i], stay ? 1 : 0);
    }
  });

  it("includes at least one directed edge when directedFraction is high", () => {
    const map = generateRandomMap("dir", {
      nodeCount: 8,
      directedFraction: 0.55,
      extraEdges: 12,
    });
    assert.ok(map.directedEdges.length >= 1);
    for (const e of map.directedEdges) {
      assert.equal(edgeKindBetween(map.matrix, map.placeIds, e.from, e.to), "forward");
    }
  });

  it("is connected when directions are ignored", () => {
    for (const n of [MAP_NODE_COUNT_MIN, 8, MAP_NODE_COUNT_MAX]) {
      const map = generateRandomMap(`conn-${n}`, { nodeCount: n });
      assert.ok(undirectedConnected(map.matrix), `n=${n}`);
    }
  });

  it("can sample a full-night trajectory from every start (steps=6)", () => {
    const map = generateRandomMap("paths-6", { nodeCount: 8, steps: 6 });
    assert.equal(map.steps, 6);
    for (const start of map.placeIds) {
      const paths = enumeratePathsFromMatrix(map.matrix, map.placeIds, {
        steps: 6,
        start,
      });
      assert.ok(paths.length > 0, `no path from ${start}`);
    }
    const rng = mulberry32(hashSeed("sample-check"));
    const traj = sampleNightTrajectory(rng, map.matrix, map.placeIds, { steps: 6 });
    assert.ok(traj);
    assert.equal(traj!.length, 6);
    assert.ok(pathSatisfiesMatrix(map.matrix, map.placeIds, traj!));
  });

  it("nodeCount is independent of night steps", () => {
    const map = generateRandomMap("decouple", { nodeCount: 10, steps: 6 });
    assert.equal(map.nodeCount, 10);
    assert.equal(map.steps, 6);
    const traj = sampleNightTrajectory(
      mulberry32(hashSeed("decouple-sample")),
      map.matrix,
      map.placeIds,
      { steps: 6 }
    );
    assert.ok(traj);
    assert.equal(traj!.length, 6);
  });

  it("layout adjacency matches FloorPlan door tracks only", () => {
    const layout = [
      ["r0", "r1", "r2"],
      ["r3", "r4", "r5"],
    ];
    assert.equal(areLayoutAdjacent(layout, "r0", "r1"), true);
    assert.equal(areLayoutAdjacent(layout, "r0", "r3"), true);
    assert.equal(areLayoutAdjacent(layout, "r0", "r2"), false);
    assert.equal(areLayoutAdjacent(layout, "r0", "r4"), false);
    assert.equal(areLayoutAdjacent(layout, "r1", "r5"), false);
  });

  it("collectNonAdjacentEdges lists matrix edges outside the floor plan", () => {
    const map = generateRandomMap("map-lab|demo", { nodeCount: 6 });
    const layout = layoutForNodeCount(map.placeIds);
    const nonAdj = collectNonAdjacentEdges(map.matrix, map.placeIds, (a, b) =>
      areLayoutAdjacent(layout, a, b)
    );
    assert.ok(nonAdj.length >= 1, "demo seed should expose skip edges");
    for (const e of nonAdj) {
      assert.notEqual(e.kind, "none");
      assert.equal(areLayoutAdjacent(layout, e.a, e.b), false);
      assert.equal(edgeKindBetween(map.matrix, map.placeIds, e.a, e.b), e.kind);
    }
    // Door-neighbour edges must not appear in the overlay list
    for (const e of nonAdj) {
      assert.equal(areLayoutAdjacent(layout, e.a, e.b), false);
    }
  });

  it("collectMatrixEdges lists every undirected off-diagonal edge once", () => {
    const map = generateRandomMap("map-lab|demo", { nodeCount: 6 });
    const all = collectMatrixEdges(map.matrix, map.placeIds);
    assert.ok(all.length >= 5, "connected map has several edges");
    const keys = new Set(all.map((e) => `${e.a}|${e.b}`));
    assert.equal(keys.size, all.length);
    for (const e of all) {
      assert.equal(edgeKindBetween(map.matrix, map.placeIds, e.a, e.b), e.kind);
      assert.notEqual(e.a, e.b);
    }
    const layout = layoutForNodeCount(map.placeIds);
    const nonAdj = collectNonAdjacentEdges(map.matrix, map.placeIds, (a, b) =>
      areLayoutAdjacent(layout, a, b)
    );
    assert.ok(all.length >= nonAdj.length);
  });

  it("polygonVertexPositions places n points on the unit circle from the top", () => {
    const six = polygonVertexPositions(6);
    assert.equal(six.length, 6);
    // First vertex at top
    assert.ok(Math.abs(six[0].x) < 1e-9);
    assert.ok(Math.abs(six[0].y - -1) < 1e-9);
    for (const p of six) {
      assert.ok(Math.abs(Math.hypot(p.x, p.y) - 1) < 1e-9);
    }
    const eight = polygonVertexPositions(8);
    assert.equal(eight.length, 8);
    // Opposite of top ≈ bottom for even n
    assert.ok(Math.abs(eight[4].x) < 1e-9);
    assert.ok(Math.abs(eight[4].y - 1) < 1e-9);
  });

  it("quadBezier midpoint sits outward of the chord and tangent follows travel", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 0 };
    const center = { x: 50, y: 100 };
    const ctrl = outwardArcControl(from, to, center, 0.2);
    // Center is below; outward bow should go above (away from center)
    assert.ok(ctrl.y < 0);
    const mid = quadBezierPoint(from, ctrl, to, 0.5);
    assert.ok(mid.y < 0);
    assert.ok(Math.abs(mid.x - 50) < 1e-6);
    const tan = quadBezierTangent(from, ctrl, to, 0.5);
    assert.ok(tan.x > 0);
    assert.ok(Math.abs(tan.y) < 1e-6);
  });

  it("shortenChord pulls endpoints inward without flipping", () => {
    const [a, b] = shortenChord({ x: 0, y: 0 }, { x: 100, y: 0 }, 20);
    assert.equal(a.x, 20);
    assert.equal(b.x, 80);
    assert.equal(a.y, 0);
    assert.equal(b.y, 0);
  });
});
