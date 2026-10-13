/**
 * Seeded random map generator → placeIds + adjacency matrix for trajectory-kernel.
 * Supports directed edges and stay-allowed diagonals.
 */

import { hashSeed, mulberry32 } from "./generate-case";
import {
  enumeratePathsFromMatrix,
  sampleNightTrajectory,
  type AdjacencyMatrix,
  type Rng,
} from "./trajectory-kernel";

export const MAP_NODE_COUNT_MIN = 6;
export const MAP_NODE_COUNT_MAX = 12;
export const MAP_DEFAULT_NODE_COUNT = 6;
export const MAP_DEFAULT_STEPS = 6;

export type DirectedEdge = {
  from: string;
  to: string;
};

export type GenerateRandomMapOptions = {
  /** Node count. Default 6; allowed range [6, 12]. */
  nodeCount?: number;
  /** Night path length used for reachability checks. Default 6 (independent of nodeCount). */
  steps?: number;
  /** How many nodes allow stay (diagonal 1). Default ~25% of nodes (at least 1 when n≥6). */
  stayCount?: number;
  /** Target fraction of undirected pairs that become one-way. Default 0.22. */
  directedFraction?: number;
  /** Extra edges beyond a spanning tree. Default ~n. */
  extraEdges?: number;
};

export type GeneratedMap = {
  placeIds: string[];
  matrix: number[][];
  stayIds: string[];
  directedEdges: DirectedEdge[];
  seed: string;
  nodeCount: number;
  steps: number;
};

const PLACE_NAME_POOL = [
  "门廊",
  "正厅",
  "舞台",
  "妆室",
  "夹层",
  "库房",
  "厢房",
  "天桥",
  "乐池",
  "侧廊",
  "阁楼",
  "后场",
] as const;

function assertNodeCount(n: number): number {
  if (!Number.isInteger(n)) {
    throw new Error(`nodeCount 必须是整数，收到 ${n}`);
  }
  if (n < MAP_NODE_COUNT_MIN || n > MAP_NODE_COUNT_MAX) {
    throw new Error(
      `nodeCount 须在 ${MAP_NODE_COUNT_MIN}–${MAP_NODE_COUNT_MAX} 之间，收到 ${n}`
    );
  }
  return n;
}

function emptyMatrix(n: number): number[][] {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
}

function undirectedConnected(matrix: AdjacencyMatrix): boolean {
  const n = matrix.length;
  if (n === 0) return true;
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

/** Every start has at least one legal path of length `steps`. */
function everyStartReachable(
  matrix: AdjacencyMatrix,
  placeIds: readonly string[],
  steps: number
): boolean {
  for (const start of placeIds) {
    const paths = enumeratePathsFromMatrix(matrix, placeIds, { steps, start });
    if (!paths.length) return false;
  }
  return true;
}

function pickStayCount(rng: Rng, n: number, override?: number): number {
  if (override !== undefined) {
    if (!Number.isInteger(override) || override < 0 || override > n) {
      throw new Error(`stayCount 须为 0–${n} 的整数，收到 ${override}`);
    }
    return override;
  }
  const lo = 1;
  const hi = Math.max(lo, Math.min(n - 1, Math.ceil(n * 0.35)));
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function buildSpanningTree(rng: Rng, n: number, matrix: number[][]): void {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (let i = 1; i < n; i++) {
    const child = order[i];
    const parent = order[Math.floor(rng() * i)];
    matrix[parent][child] = 1;
    matrix[child][parent] = 1;
  }
}

function candidatePairs(n: number): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push([i, j]);
    }
  }
  return pairs;
}

function addExtraEdges(
  rng: Rng,
  matrix: number[][],
  extra: number,
  directedFraction: number
): void {
  const n = matrix.length;
  const pairs = candidatePairs(n).filter(([i, j]) => matrix[i][j] === 0 && matrix[j][i] === 0);
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  const take = Math.min(extra, pairs.length);
  for (let k = 0; k < take; k++) {
    const [i, j] = pairs[k];
    if (rng() < directedFraction) {
      if (rng() < 0.5) matrix[i][j] = 1;
      else matrix[j][i] = 1;
    } else {
      matrix[i][j] = 1;
      matrix[j][i] = 1;
    }
  }
}

/** Flip a few existing bidirectional edges into one-way for texture. */
function carveDirected(
  rng: Rng,
  matrix: number[][],
  directedFraction: number
): void {
  const n = matrix.length;
  const bi: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (matrix[i][j] === 1 && matrix[j][i] === 1) bi.push([i, j]);
    }
  }
  const carve = Math.floor(bi.length * directedFraction);
  for (let t = 0; t < carve && bi.length; t++) {
    const idx = Math.floor(rng() * bi.length);
    const [i, j] = bi.splice(idx, 1)[0];
    if (rng() < 0.5) matrix[j][i] = 0;
    else matrix[i][j] = 0;
    // Keep undirected connectivity: if carving broke it, restore.
    if (!undirectedConnected(matrix)) {
      matrix[i][j] = 1;
      matrix[j][i] = 1;
    }
  }
}

function applyStays(rng: Rng, matrix: number[][], stayCount: number): number[] {
  const n = matrix.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const stays = idx.slice(0, stayCount);
  for (const i of stays) matrix[i][i] = 1;
  return stays;
}

function collectDirected(matrix: AdjacencyMatrix, placeIds: readonly string[]): DirectedEdge[] {
  const out: DirectedEdge[] = [];
  const n = placeIds.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (matrix[i][j] === 1 && matrix[j][i] !== 1) {
        out.push({ from: placeIds[i], to: placeIds[j] });
      }
    }
  }
  return out;
}

function attemptMap(
  rng: Rng,
  placeIds: string[],
  opts: {
    steps: number;
    stayCount?: number;
    directedFraction: number;
    extraEdges: number;
  }
): GeneratedMap | null {
  const n = placeIds.length;
  const matrix = emptyMatrix(n);
  buildSpanningTree(rng, n, matrix);
  addExtraEdges(rng, matrix, opts.extraEdges, opts.directedFraction);
  carveDirected(rng, matrix, opts.directedFraction);

  const stayIdx = applyStays(rng, matrix, pickStayCount(rng, n, opts.stayCount));

  if (!undirectedConnected(matrix)) return null;
  if (!everyStartReachable(matrix, placeIds, opts.steps)) return null;

  // Spot-check sampling still works from a random start.
  const sample = sampleNightTrajectory(rng, matrix, placeIds, { steps: opts.steps });
  if (!sample) return null;

  return {
    placeIds: [...placeIds],
    matrix,
    stayIds: stayIdx.map((i) => placeIds[i]),
    directedEdges: collectDirected(matrix, placeIds),
    seed: "",
    nodeCount: n,
    steps: opts.steps,
  };
}

/**
 * Generate a reproducible random map compatible with trajectory-kernel matrices.
 */
export function generateRandomMap(
  seed: string,
  opts?: GenerateRandomMapOptions
): GeneratedMap {
  const nodeCount = assertNodeCount(opts?.nodeCount ?? MAP_DEFAULT_NODE_COUNT);
  const steps = opts?.steps ?? MAP_DEFAULT_STEPS;
  if (!Number.isInteger(steps) || steps < 2) {
    throw new Error(`steps 须为 ≥2 的整数，收到 ${steps}`);
  }

  const directedFraction = opts?.directedFraction ?? 0.22;
  const extraEdges = opts?.extraEdges ?? Math.max(nodeCount, Math.ceil(nodeCount * 1.1));

  const placeIds = PLACE_NAME_POOL.slice(0, nodeCount).map((_, i) => `r${i}`);
  const placeLabels = PLACE_NAME_POOL.slice(0, nodeCount);

  // Attach human labels via id→name helper for UI; ids stay stable `r0`…
  void placeLabels;

  const MAX_ATTEMPTS = 48;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32(hashSeed(`${seed}|map|n${nodeCount}|a${attempt}`));
    const built = attemptMap(rng, placeIds, {
      steps,
      stayCount: opts?.stayCount,
      directedFraction,
      extraEdges: extraEdges + attempt, // loosen connectivity on retries
    });
    if (built) {
      return { ...built, seed };
    }
  }

  throw new Error(
    `无法在 ${MAX_ATTEMPTS} 次尝试内生成合法地图（seed=${seed}, nodeCount=${nodeCount}, steps=${steps}）`
  );
}

/** Chinese display names aligned to generated `r0`… ids. */
export function placeLabelForGeneratedId(id: string): string {
  const m = /^r(\d+)$/.exec(id);
  if (!m) return id;
  const i = Number(m[1]);
  return PLACE_NAME_POOL[i] ?? id;
}

/** Pack nodes into a simple row layout for FloorPlan. */
export function layoutForNodeCount(placeIds: readonly string[]): string[][] {
  const n = placeIds.length;
  if (n <= 3) return [[...placeIds]];
  if (n === 4) return [placeIds.slice(0, 2), placeIds.slice(2)];
  if (n === 5) return [placeIds.slice(0, 3), placeIds.slice(3)];
  if (n === 6) return [placeIds.slice(0, 3), placeIds.slice(3)];
  if (n === 7) return [placeIds.slice(0, 3), placeIds.slice(3, 5), placeIds.slice(5)];
  if (n === 8) return [placeIds.slice(0, 4), placeIds.slice(4)];
  if (n === 9) return [placeIds.slice(0, 3), placeIds.slice(3, 6), placeIds.slice(6)];
  if (n === 10) return [placeIds.slice(0, 4), placeIds.slice(4, 7), placeIds.slice(7)];
  if (n === 11) return [placeIds.slice(0, 4), placeIds.slice(4, 8), placeIds.slice(8)];
  return [placeIds.slice(0, 4), placeIds.slice(4, 8), placeIds.slice(8)];
}

export type EdgeKind = "none" | "bidirectional" | "forward" | "backward";

/** Directed relation between two places given a matrix + placeIds. */
export function edgeKindBetween(
  matrix: AdjacencyMatrix,
  placeIds: readonly string[],
  a: string,
  b: string
): EdgeKind {
  const i = placeIds.indexOf(a);
  const j = placeIds.indexOf(b);
  if (i < 0 || j < 0) return "none";
  const ab = matrix[i]?.[j] === 1;
  const ba = matrix[j]?.[i] === 1;
  if (ab && ba) return "bidirectional";
  if (ab) return "forward";
  if (ba) return "backward";
  return "none";
}

export type NonAdjacentEdge = {
  a: string;
  b: string;
  kind: Exclude<EdgeKind, "none">;
};

/**
 * Matrix edges that FloorPlan door tracks cannot show (not grid-adjacent).
 * Each undirected pair appears once; `kind` is relative to `a`→`b`
 * (forward = a→b only, backward = b→a only).
 */
export function collectNonAdjacentEdges(
  matrix: AdjacencyMatrix,
  placeIds: readonly string[],
  isAdjacent: (a: string, b: string) => boolean
): NonAdjacentEdge[] {
  const out: NonAdjacentEdge[] = [];
  for (let i = 0; i < placeIds.length; i++) {
    for (let j = i + 1; j < placeIds.length; j++) {
      const a = placeIds[i];
      const b = placeIds[j];
      const kind = edgeKindBetween(matrix, placeIds, a, b);
      if (kind === "none") continue;
      if (isAdjacent(a, b)) continue;
      out.push({ a, b, kind });
    }
  }
  return out;
}

export function isStayPlace(
  matrix: AdjacencyMatrix,
  placeIds: readonly string[],
  id: string
): boolean {
  const i = placeIds.indexOf(id);
  if (i < 0) return false;
  return matrix[i]?.[i] === 1;
}
