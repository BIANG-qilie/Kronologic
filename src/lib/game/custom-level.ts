import {
  emptyScreenStats,
  hashSeed,
  mulberry32,
  sampleWorld,
  screenDraftSteps,
  type ScreenStats,
  type WorldContext,
} from "./generate-case";
import { getCustomCase, type CustomCaseDef } from "./custom-cases";
import {
  MAP_DEFAULT_NODE_COUNT,
  MAP_NODE_COUNT_MAX,
  MAP_NODE_COUNT_MIN,
  generateRandomMap,
  layoutForNodeCount,
} from "./map-generator";
import { bandsFromGreedy } from "./solver";
import { enumeratePathsFromMatrix, matrixToAdjacencyRecord } from "./trajectory-kernel";
import type {
  CustomDifficultyId,
  CustomLevelMeta,
  CustomLevelRequest,
  PersonId,
  PlaceId,
  ScenarioBundle,
  Trajectory,
} from "./types";

export const CUSTOM_NODE_MIN = MAP_NODE_COUNT_MIN;
export const CUSTOM_NODE_MAX = MAP_NODE_COUNT_MAX;
export const CUSTOM_NODE_DEFAULT = MAP_DEFAULT_NODE_COUNT;

export interface CustomDifficulty {
  id: CustomDifficultyId;
  label: string;
  /** Accepted greedy min-query range, inclusive. */
  min: number;
  max: number;
  /** Where it sits against the fifteen bank levels. */
  compare: string;
}

/** Same yardstick as levels 1–15: the greedy minimum number of asks. */
export const CUSTOM_DIFFICULTIES: CustomDifficulty[] = [
  { id: "easy", label: "入门", min: 4, max: 5, compare: "约等于第 1–3 关" },
  { id: "normal", label: "进阶", min: 6, max: 7, compare: "约等于第 4–9 关" },
  { id: "hard", label: "烧脑", min: 8, max: 9, compare: "约等于第 10–15 关" },
  { id: "expert", label: "极限", min: 10, max: 13, compare: "比第 15 关更难" },
];

export function getCustomDifficulty(id: string): CustomDifficulty | undefined {
  return CUSTOM_DIFFICULTIES.find((d) => d.id === id);
}

/** Upper bounds for the two counts; the lower bound is 1 when the option is on. */
export function oneWayCountMax(nodeCount: number): number {
  return nodeCount;
}
export function stayCountMax(nodeCount: number): number {
  return nodeCount;
}

/** Extra passages on top of a spanning tree: sparse enough for the solver to stay fast. */
function extraEdgesFor(nodeCount: number): number {
  return Math.ceil(nodeCount * 0.5);
}

export type CustomLevelInput = {
  caseId?: unknown;
  nodeCount?: unknown;
  oneWay?: unknown;
  oneWayCount?: unknown;
  stay?: unknown;
  stayCount?: unknown;
  difficulty?: unknown;
  seed?: unknown;
};

export class CustomLevelError extends Error {
  constructor(
    message: string,
    /** Which field is wrong, for inline form errors. */
    readonly field?: keyof CustomLevelRequest,
    /** Whether rolling a new seed could help. */
    readonly retryable = false
  ) {
    super(message);
    this.name = "CustomLevelError";
  }
}

function optionalCount(v: unknown): number | null | "bad" {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isInteger(n) ? n : "bad";
}

export function randomSeed(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

/**
 * Check and normalise player input. Throws `CustomLevelError` with a
 * readable message and the offending field.
 */
export function parseCustomRequest(input: CustomLevelInput): CustomLevelRequest {
  const caseId = String(input.caseId ?? "night-tea");
  if (!getCustomCase(caseId)) throw new CustomLevelError("没有这个案件，换一个试试", "caseId");

  const rawNodes = input.nodeCount ?? CUSTOM_NODE_DEFAULT;
  const nodeCount = typeof rawNodes === "number" ? rawNodes : Number(String(rawNodes).trim());
  if (!Number.isInteger(nodeCount)) {
    throw new CustomLevelError("地点数要填整数", "nodeCount");
  }
  if (nodeCount < CUSTOM_NODE_MIN || nodeCount > CUSTOM_NODE_MAX) {
    throw new CustomLevelError(`地点数须在 ${CUSTOM_NODE_MIN}–${CUSTOM_NODE_MAX} 之间`, "nodeCount");
  }

  const oneWay = input.oneWay === true || input.oneWay === "true";
  const stay = input.stay === true || input.stay === "true";

  const oneWayCount = oneWay ? optionalCount(input.oneWayCount) : null;
  if (oneWayCount === "bad") throw new CustomLevelError("单向通道数要填整数，或留空随机", "oneWayCount");
  if (oneWayCount !== null && (oneWayCount < 1 || oneWayCount > oneWayCountMax(nodeCount))) {
    throw new CustomLevelError(
      `${nodeCount} 个地点时，单向通道数须在 1–${oneWayCountMax(nodeCount)} 之间`,
      "oneWayCount"
    );
  }

  const stayCount = stay ? optionalCount(input.stayCount) : null;
  if (stayCount === "bad") throw new CustomLevelError("可停留地点数要填整数，或留空随机", "stayCount");
  if (stayCount !== null && (stayCount < 1 || stayCount > stayCountMax(nodeCount))) {
    throw new CustomLevelError(
      `${nodeCount} 个地点时，可停留地点数须在 1–${stayCountMax(nodeCount)} 之间`,
      "stayCount"
    );
  }

  const difficulty = String(input.difficulty ?? "normal");
  if (!getCustomDifficulty(difficulty)) {
    throw new CustomLevelError("难度只能是入门、进阶、烧脑或极限", "difficulty");
  }

  const rawSeed = input.seed == null ? "" : String(input.seed).trim();
  if (rawSeed.length > 32) throw new CustomLevelError("种子最长 32 个字符", "seed");
  if (rawSeed && !/^[\p{L}\p{N}_\-|#.]+$/u.test(rawSeed)) {
    throw new CustomLevelError("种子只能用文字、数字和 - _ | # .", "seed");
  }

  return {
    caseId,
    nodeCount,
    oneWay,
    oneWayCount,
    stay,
    stayCount,
    difficulty: difficulty as CustomDifficultyId,
    seed: rawSeed || randomSeed(),
  };
}

export type CustomMap = {
  placeIds: PlaceId[];
  matrix: number[][];
  stayIds: PlaceId[];
  oneWayCount: number;
  stayCount: number;
  /** Seed variant that produced this map (0 = the request seed itself). */
  variant: number;
};

function resolveCount(
  enabled: boolean,
  fixed: number | null,
  max: number,
  rng: () => number,
  nodeCount: number
): number {
  if (!enabled) return 0;
  if (fixed !== null) return fixed;
  const hi = Math.max(1, Math.min(max, Math.ceil(nodeCount * 0.35)));
  return 1 + Math.floor(rng() * hi);
}

/**
 * Map for a request: rolls the random counts, then lays passages. Same request
 * → same map. `variant` re-rolls the layout under the same counts.
 */
export function buildCustomMap(req: CustomLevelRequest, variant = 0): CustomMap {
  const def = getCustomCase(req.caseId);
  if (!def) throw new CustomLevelError("没有这个案件", "caseId");
  const countRng = mulberry32(hashSeed(`${req.seed}|counts|n${req.nodeCount}`));
  const oneWayCount = resolveCount(req.oneWay, req.oneWayCount, oneWayCountMax(req.nodeCount), countRng, req.nodeCount);
  const stayCount = resolveCount(req.stay, req.stayCount, stayCountMax(req.nodeCount), countRng, req.nodeCount);

  const ids = def.places.slice(0, req.nodeCount).map((p) => p.id);
  let map;
  try {
    map = generateRandomMap(variant ? `${req.seed}~${variant}` : req.seed, {
      nodeCount: req.nodeCount,
      oneWayCount,
      stayCount,
      extraEdges: extraEdgesFor(req.nodeCount),
    });
  } catch {
    throw new CustomLevelError(
      `${req.nodeCount} 个地点排不下 ${oneWayCount} 条单向通道${
        stayCount ? "" : "（没有可停留地点时，单向通道容易把人困死）"
      }，减少单向通道或打开可停留`,
      "oneWayCount",
      true
    );
  }
  const index = (generatedId: string) => Number(generatedId.slice(1));
  return {
    placeIds: ids,
    matrix: map.matrix,
    stayIds: map.stayIds.map((g) => ids[index(g)]).sort((a, b) => ids.indexOf(a) - ids.indexOf(b)),
    oneWayCount,
    stayCount,
    variant,
  };
}

/** Adjacency list for the solver; a staying room lists itself. */
export function customAdjacency(map: Pick<CustomMap, "matrix" | "placeIds" | "stayIds">) {
  const adj = matrixToAdjacencyRecord(map.matrix, map.placeIds);
  for (const id of map.stayIds) adj[id] = [id, ...adj[id]];
  return adj;
}

function pathToTraj(path: PlaceId[]): Record<string, PlaceId> {
  const o: Record<string, PlaceId> = {};
  path.forEach((p, i) => {
    o[String(i + 1)] = p;
  });
  return o;
}

export function customLevelId(req: CustomLevelRequest): string {
  const key = [
    req.caseId,
    req.nodeCount,
    req.oneWay ? `o${req.oneWayCount ?? "r"}` : "o-",
    req.stay ? `s${req.stayCount ?? "r"}` : "s-",
    req.difficulty,
    req.seed,
  ].join("|");
  return `custom-${hashSeed(key).toString(16).padStart(8, "0")}`;
}

function assembleCustomBundle(input: {
  def: CustomCaseDef;
  req: CustomLevelRequest;
  map: CustomMap;
  id: string;
  difficultyLabel: string;
  opening: Partial<Record<PersonId, PlaceId>>;
  trajectory: Trajectory;
  answers: Record<string, string>;
  steps: number;
}): ScenarioBundle {
  const { def, req, map } = input;
  const meta: CustomLevelMeta = {
    request: req,
    oneWayCount: map.oneWayCount,
    stayCount: map.stayCount,
    matrix: map.matrix,
    stayIds: map.stayIds,
  };
  return {
    public: {
      id: input.id,
      title: def.title,
      subtitle: `${def.venue} · ${def.year} · 自定义 · ${input.difficultyLabel}`,
      synopsis: def.synopsis,
      places: def.places.slice(0, req.nodeCount),
      people: def.people,
      adjacency: customAdjacency(map),
      layout: layoutForNodeCount(map.placeIds) as PlaceId[][],
      opening: input.opening,
      winQuestions: def.winQuestions,
      soloBands: bandsFromGreedy(input.steps),
      difficulty: input.steps,
      tier: `自定义 · ${input.difficultyLabel}`,
      seed: `${req.seed}#${map.variant}`,
      greedyMin: input.steps,
      custom: meta,
    },
    sealed: {
      rule: { type: "alone_with_victim", victimId: def.victimId },
      trajectory: input.trajectory,
      answers: input.answers,
    },
  };
}

/**
 * How many curtain-up positions to reveal. Bigger maps reveal more, or the
 * opening pool explodes; easier bands reveal more, harder ones fewer.
 */
function openingRange(nodeCount: number, difficulty: CustomDifficultyId): [number, number] {
  const base: [number, number] = nodeCount <= 7 ? [2, 4] : nodeCount <= 9 ? [3, 4] : [3, 5];
  if (difficulty === "easy") return [base[0] + 1, Math.min(5, base[1] + 1)];
  if (difficulty === "expert") return [Math.max(1, base[0] - 1), base[1] - 1];
  return base;
}

export type GenerateCustomOptions = {
  /** Worlds put through the solver per map before moving to the next map variant. */
  screensPerMap?: number;
  /** Map variants tried before giving up. */
  maxMaps?: number;
  /**
   * Wall-clock budget. Hitting it fails the request rather than changing the
   * result, so a level that generates is still reproducible.
   */
  deadlineMs?: number;
  /** Stops the search between steps; the half-built level is thrown away. */
  signal?: AbortSignal;
  /** Called after every solver screen (diagnostics and tests). */
  onScreen?: () => void;
};

export type CustomLevelResult = {
  bundle: ScenarioBundle;
  steps: number;
  /** Worlds screened before a hit, for diagnostics. */
  tried: number;
  stats: ScreenStats;
};

export class CustomLevelExhausted extends CustomLevelError {
  constructor(
    label: string,
    readonly tried: number,
    readonly stats: ScreenStats
  ) {
    super(`这组设置下没能排出「${label}」难度的案子，换个种子或调整难度再试`, "difficulty", true);
    this.name = "CustomLevelExhausted";
  }
}

export class CustomLevelAborted extends CustomLevelError {
  constructor() {
    super("排演已取消", undefined, false);
    this.name = "CustomLevelAborted";
  }
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) throw new CustomLevelAborted();
}

/** The search itself; yields after every solver call so callers can breathe. */
function* searchCustomLevel(
  req: CustomLevelRequest,
  opts: GenerateCustomOptions
): Generator<void, CustomLevelResult, void> {
  const def = getCustomCase(req.caseId);
  if (!def) throw new CustomLevelError("没有这个案件", "caseId");
  const band = getCustomDifficulty(req.difficulty);
  if (!band) throw new CustomLevelError("没有这个难度", "difficulty");

  const screensPerMap = opts.screensPerMap ?? 12;
  const maxMaps = opts.maxMaps ?? 6;
  const deadline = Date.now() + (opts.deadlineMs ?? 30_000);
  const people = def.people.map((p) => p.id);
  const id = customLevelId(req);
  const openRange = openingRange(req.nodeCount, req.difficulty);
  let tried = 0;
  const stats = emptyScreenStats();

  for (let variant = 0; variant < maxMaps && Date.now() < deadline; variant++) {
    throwIfAborted(opts.signal);
    let map: CustomMap;
    try {
      map = buildCustomMap(req, variant);
    } catch (e) {
      // The request's own map must exist; later variants are only extra chances.
      if (variant === 0) throw e;
      continue;
    }
    const ctx: WorldContext = {
      paths: enumeratePathsFromMatrix(map.matrix, map.placeIds),
      people,
      victimId: def.victimId,
    };
    const rng = mulberry32(hashSeed(`${req.seed}|case|${req.difficulty}|v${variant}`));

    let screened = 0;
    for (let a = 0; a < screensPerMap * 40 && screened < screensPerMap; a++) {
      if (Date.now() > deadline) break;
      throwIfAborted(opts.signal);
      const sample = sampleWorld(rng, ctx, openRange);
      if (!sample) {
        if (a % 20 === 19) yield;
        continue;
      }
      screened++;
      tried++;
      const trajectory: Trajectory = {};
      for (const pid of people) trajectory[pid] = pathToTraj(sample.world[pid]);
      const answers = {
        who: sample.answer.who,
        where: sample.answer.where,
        when: String(sample.answer.when),
      };
      const build = (steps: number) =>
        assembleCustomBundle({
          def,
          req,
          map,
          id,
          difficultyLabel: band.label,
          opening: sample.opening,
          trajectory,
          answers,
          steps,
        });
      const steps = yield* screenDraftSteps(
        build(band.min),
        (s) => s >= band.min && s <= band.max,
        build,
        stats
      );
      opts.onScreen?.();
      throwIfAborted(opts.signal);
      if (steps !== null) return { bundle: build(steps), steps, tried, stats };
      yield;
    }
  }

  throw new CustomLevelExhausted(band.label, tried, stats);
}

/**
 * Build a playable level: a map honouring the request, a night whose greedy
 * minimum asks fall inside the chosen difficulty band, and a clean solver
 * report. Deterministic for a given request. Throws `CustomLevelError`
 * (retryable `CustomLevelExhausted` when nothing qualifies within the budget).
 */
export function generateCustomLevel(
  req: CustomLevelRequest,
  opts: GenerateCustomOptions = {}
): CustomLevelResult {
  const it = searchCustomLevel(req, opts);
  for (;;) {
    const step = it.next();
    if (step.done) return step.value;
  }
}

/** Hand the event loop back; setImmediate skips the 1ms timer clamp where it exists. */
function breathe(): Promise<void> {
  return new Promise<void>((resolve) =>
    typeof setImmediate === "function" ? setImmediate(resolve) : setTimeout(resolve, 0)
  );
}

/** Same as {@link generateCustomLevel}, but hands the event loop back between screens. */
export async function generateCustomLevelAsync(
  req: CustomLevelRequest,
  opts: GenerateCustomOptions = {}
): Promise<CustomLevelResult> {
  throwIfAborted(opts.signal);
  const it = searchCustomLevel(req, opts);
  for (;;) {
    const step = it.next();
    if (step.done) return step.value;
    await breathe();
    throwIfAborted(opts.signal);
  }
}

/** Shareable `/custom?…` query for a request; `withSeed: false` asks for a fresh roll. */
export function customRequestToQuery(req: CustomLevelRequest, withSeed = true): string {
  const q = new URLSearchParams();
  q.set("case", req.caseId);
  q.set("n", String(req.nodeCount));
  q.set("d", req.difficulty);
  if (req.oneWay) q.set("ow", req.oneWayCount == null ? "r" : String(req.oneWayCount));
  if (req.stay) q.set("st", req.stayCount == null ? "r" : String(req.stayCount));
  if (withSeed) q.set("seed", req.seed);
  return q.toString();
}

/** Inverse of {@link customRequestToQuery}, loose: unknown values fall back at parse time. */
export function customInputFromQuery(search: string | URLSearchParams): CustomLevelInput {
  const q = typeof search === "string" ? new URLSearchParams(search) : search;
  const ow = q.get("ow");
  const st = q.get("st");
  return {
    caseId: q.get("case") ?? undefined,
    nodeCount: q.get("n") ?? undefined,
    difficulty: q.get("d") ?? undefined,
    oneWay: ow != null,
    oneWayCount: ow && ow !== "r" ? ow : null,
    stay: st != null,
    stayCount: st && st !== "r" ? st : null,
    seed: q.get("seed") ?? undefined,
  };
}
