import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAP_DEFAULT_NODE_COUNT,
  MAP_NODE_COUNT_MAX,
  MAP_NODE_COUNT_MIN,
  edgeKindBetween,
  generateRandomMap,
  isStayPlace,
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
});
