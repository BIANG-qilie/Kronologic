/**
 * Replaceable night-trajectory kernel: adjacency matrix → legal 6-step paths.
 * Case packs supply matrix + placeIds; generation samples via this module.
 */

/** n×n 0/1 matrix; matrix[i][j]===1 means place i can move to place j. */
export type AdjacencyMatrix = ReadonlyArray<ReadonlyArray<number>>;

/** Deterministic PRNG: each call returns [0, 1). */
export type Rng = () => number;

/** One night path: length `steps` (default 6) place ids. */
export type TrajectoryPath<P extends string = string> = P[];

export type EnumeratePathsOptions<P extends string = string> = {
  /** Path length including start. Default 6. */
  steps?: number;
  /** If set, only paths that begin at this place. */
  start?: P;
};

export type SampleNightOptions<P extends string = string> = EnumeratePathsOptions<P> & {
  /** Precomputed pool (avoids re-enumerating inside a sampler loop). */
  paths?: readonly TrajectoryPath<P>[];
};

function assertSquareMatrix(matrix: AdjacencyMatrix, placeCount: number): void {
  if (matrix.length !== placeCount) {
    throw new Error(
      `AdjacencyMatrix rows (${matrix.length}) must match placeIds (${placeCount})`
    );
  }
  for (let i = 0; i < matrix.length; i++) {
    if (matrix[i]?.length !== placeCount) {
      throw new Error(`AdjacencyMatrix row ${i} must have length ${placeCount}`);
    }
  }
}

/**
 * Convert an adjacency-list record into a dense 0/1 matrix aligned to `placeIds`.
 * Diagonal is forced to 0 (no stay-in-place). Unknown neighbor ids are skipped.
 */
export function adjacencyRecordToMatrix<P extends string>(
  adjacency: Partial<Record<P, readonly P[]>>,
  placeIds: readonly P[]
): number[][] {
  const n = placeIds.length;
  const index = new Map(placeIds.map((id, i) => [id, i] as const));
  const matrix: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0)
  );
  for (let i = 0; i < n; i++) {
    for (const next of adjacency[placeIds[i]] ?? []) {
      const j = index.get(next);
      if (j === undefined || j === i) continue;
      matrix[i][j] = 1;
    }
  }
  return matrix;
}

/**
 * Convert a matrix back to an adjacency-list record (neighbor order = placeIds index).
 * Useful when the solver still expects the object shape.
 */
export function matrixToAdjacencyRecord<P extends string>(
  matrix: AdjacencyMatrix,
  placeIds: readonly P[]
): Record<P, P[]> {
  assertSquareMatrix(matrix, placeIds.length);
  const out = {} as Record<P, P[]>;
  for (let i = 0; i < placeIds.length; i++) {
    const neighbors: P[] = [];
    for (let j = 0; j < placeIds.length; j++) {
      if (i !== j && matrix[i][j] === 1) neighbors.push(placeIds[j]);
    }
    out[placeIds[i]] = neighbors;
  }
  return out;
}

/** Whether a single step from `from` to `to` is allowed by the matrix. */
export function isMatrixStepAllowed<P extends string>(
  matrix: AdjacencyMatrix,
  placeIds: readonly P[],
  from: P,
  to: P
): boolean {
  const i = placeIds.indexOf(from);
  const j = placeIds.indexOf(to);
  if (i < 0 || j < 0) return false;
  return matrix[i]?.[j] === 1;
}

/** Every consecutive pair in `path` must be a matrix edge. */
export function pathSatisfiesMatrix<P extends string>(
  matrix: AdjacencyMatrix,
  placeIds: readonly P[],
  path: readonly P[]
): boolean {
  for (let t = 1; t < path.length; t++) {
    if (!isMatrixStepAllowed(matrix, placeIds, path[t - 1], path[t])) return false;
  }
  return true;
}

/**
 * Enumerate all legal night paths of length `steps` (default 6) from the matrix.
 * Neighbor expansion order follows `placeIds` index order (j = 0..n-1).
 */
export function enumeratePathsFromMatrix<P extends string>(
  matrix: AdjacencyMatrix,
  placeIds: readonly P[],
  opts?: EnumeratePathsOptions<P>
): TrajectoryPath<P>[] {
  const n = placeIds.length;
  assertSquareMatrix(matrix, n);
  const steps = opts?.steps ?? 6;
  if (steps < 1) return [];

  const starts: number[] = [];
  if (opts?.start !== undefined) {
    const si = placeIds.indexOf(opts.start);
    if (si < 0) return [];
    starts.push(si);
  } else {
    for (let i = 0; i < n; i++) starts.push(i);
  }

  const out: TrajectoryPath<P>[] = [];
  const pathIdx: number[] = [];

  function dfs() {
    if (pathIdx.length === steps) {
      out.push(pathIdx.map((i) => placeIds[i]));
      return;
    }
    const prev = pathIdx[pathIdx.length - 1];
    for (let next = 0; next < n; next++) {
      if (matrix[prev][next] !== 1) continue;
      pathIdx.push(next);
      dfs();
      pathIdx.pop();
    }
  }

  for (const s of starts) {
    pathIdx.push(s);
    if (steps === 1) {
      out.push([placeIds[s]]);
    } else {
      dfs();
    }
    pathIdx.pop();
  }
  return out;
}

/**
 * Sample one legal night trajectory uniformly from the enumerated pool
 * (or from `opts.paths` when provided). Returns null if the pool is empty.
 */
export function sampleNightTrajectory<P extends string>(
  rng: Rng,
  matrix: AdjacencyMatrix,
  placeIds: readonly P[],
  opts?: SampleNightOptions<P>
): TrajectoryPath<P> | null {
  const pool =
    opts?.paths ??
    enumeratePathsFromMatrix(matrix, placeIds, {
      steps: opts?.steps,
      start: opts?.start,
    });
  if (!pool.length) return null;
  const i = Math.floor(rng() * pool.length);
  return [...pool[i]];
}
