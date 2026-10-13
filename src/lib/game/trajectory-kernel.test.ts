import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NIGHT_TEA_ADJACENCY, PLACE_IDS } from "./night-tea-template";
import { enumeratePaths } from "./solver";
import {
  adjacencyRecordToMatrix,
  enumeratePathsFromMatrix,
  matrixToAdjacencyRecord,
  pathSatisfiesMatrix,
  sampleNightTrajectory,
} from "./trajectory-kernel";
import { hashSeed, mulberry32 } from "./generate-case";
import type { PlaceId } from "./types";

describe("trajectory-kernel matrix adapters", () => {
  it("forces diagonal to 0 even if the record had self-loops", () => {
    const placeIds = ["a", "b", "c"] as const;
    const matrix = adjacencyRecordToMatrix(
      {
        a: ["a", "b"],
        b: ["c"],
        c: ["a", "c"],
      },
      placeIds
    );
    assert.equal(matrix.length, 3);
    for (let i = 0; i < 3; i++) assert.equal(matrix[i][i], 0);
    assert.equal(matrix[0][1], 1);
    assert.equal(matrix[0][0], 0);
    assert.equal(matrix[2][2], 0);
  });

  it("preserves asymmetric edges", () => {
    const placeIds = ["x", "y"] as const;
    const matrix = adjacencyRecordToMatrix(
      { x: ["y"], y: [] },
      placeIds
    );
    assert.equal(matrix[0][1], 1);
    assert.equal(matrix[1][0], 0);
    const back = matrixToAdjacencyRecord(matrix, placeIds);
    assert.deepEqual(back.x, ["y"]);
    assert.deepEqual(back.y, []);
  });

  it("night-tea adapter matches legacy adjacency enumeration order", () => {
    const matrix = adjacencyRecordToMatrix(NIGHT_TEA_ADJACENCY, PLACE_IDS);
    for (let i = 0; i < PLACE_IDS.length; i++) {
      assert.equal(matrix[i][i], 0);
    }
    const fromMatrix = enumeratePathsFromMatrix(matrix, PLACE_IDS);
    const fromRecord = enumeratePaths(NIGHT_TEA_ADJACENCY);
    assert.equal(fromMatrix.length, fromRecord.length);
    assert.deepEqual(fromMatrix, fromRecord);
  });
});

describe("trajectory-kernel sampling", () => {
  const placeIds = ["a", "b", "c"] as const;
  /** Directed cycle a→b→c→a plus a→c (asymmetric: no c→b). */
  const matrix = [
    [0, 1, 1],
    [0, 0, 1],
    [1, 0, 0],
  ];

  it("every sampled step satisfies the matrix", () => {
    const rng = mulberry32(hashSeed("matrix-steps"));
    for (let n = 0; n < 40; n++) {
      const path = sampleNightTrajectory(rng, matrix, placeIds, { steps: 6 });
      assert.ok(path);
      assert.equal(path!.length, 6);
      assert.ok(pathSatisfiesMatrix(matrix, placeIds, path!));
      for (let t = 1; t < path!.length; t++) {
        assert.notEqual(path![t], path![t - 1]);
      }
    }
  });

  it("same seed reproduces the same trajectory", () => {
    const seed = "repro-traj|v1";
    const a = sampleNightTrajectory(mulberry32(hashSeed(seed)), matrix, placeIds);
    const b = sampleNightTrajectory(mulberry32(hashSeed(seed)), matrix, placeIds);
    assert.deepEqual(a, b);
    assert.ok(a);
  });

  it("different seeds draw independent streams", () => {
    const ra = mulberry32(hashSeed("seed-a"));
    const rb = mulberry32(hashSeed("seed-b"));
    const seqA = Array.from({ length: 8 }, () =>
      sampleNightTrajectory(ra, matrix, placeIds)
    );
    const seqB = Array.from({ length: 8 }, () =>
      sampleNightTrajectory(rb, matrix, placeIds)
    );
    assert.notDeepEqual(seqA, seqB);
  });

  it("sampleNightTrajectory respects start option", () => {
    const paths = enumeratePathsFromMatrix(matrix, placeIds, {
      start: "b",
      steps: 4,
    });
    assert.ok(paths.length > 0);
    for (const p of paths) assert.equal(p[0], "b");
    const sampled = sampleNightTrajectory(
      mulberry32(1),
      matrix,
      placeIds,
      { start: "b", steps: 4, paths }
    );
    assert.equal(sampled?.[0], "b");
  });
});

describe("night-tea matrix generation parity", () => {
  it("PLACE_IDS-aligned matrix has no self-loops and mirrors NIGHT_TEA_ADJACENCY", () => {
    const matrix = adjacencyRecordToMatrix(NIGHT_TEA_ADJACENCY, PLACE_IDS);
    for (let i = 0; i < PLACE_IDS.length; i++) {
      assert.equal(matrix[i][i], 0);
      const expected = new Set(NIGHT_TEA_ADJACENCY[PLACE_IDS[i] as PlaceId]);
      for (let j = 0; j < PLACE_IDS.length; j++) {
        const edge = matrix[i][j] === 1;
        assert.equal(edge, expected.has(PLACE_IDS[j] as PlaceId));
      }
    }
  });
});
