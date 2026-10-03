import {
  bandsFromGreedy,
  enumeratePaths,
  findConsistentAnswers,
  greedyMinQueries,
  observationsFromSealed,
  validateWithSolver,
} from "./solver";
import {
  NIGHT_TEA_ADJACENCY,
  NIGHT_TEA_FAMILY,
  PERSON_IDS,
  PLACE_IDS,
  VICTIM_ID,
  assembleNightTeaBundle,
} from "./night-tea-template";
import type { PlaceId, PersonId, ScenarioBundle, Trajectory } from "./types";

export type GeneratedCaseMeta = {
  id: string;
  seed: string;
  greedySteps: number;
  fingerprint: string;
};

export type GeneratedCase = GeneratedCaseMeta & {
  bundle: ScenarioBundle;
};

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pathToTraj(path: PlaceId[]): Record<string, PlaceId> {
  const o: Record<string, PlaceId> = {};
  path.forEach((p, i) => {
    o[String(i + 1)] = p;
  });
  return o;
}

function aloneWithHits(
  world: Record<PersonId, PlaceId[]>
): { who: PersonId; where: PlaceId; when: number }[] {
  const vp = world[VICTIM_ID];
  const hits: { who: PersonId; where: PlaceId; when: number }[] = [];
  for (let t = 0; t < 6; t++) {
    const place = vp[t];
    const others: PersonId[] = [];
    for (const pid of PERSON_IDS) {
      if (pid === VICTIM_ID) continue;
      if (world[pid][t] === place) others.push(pid);
    }
    if (others.length === 1) {
      hits.push({ who: others[0], where: place, when: t + 1 });
    }
  }
  return hits;
}

function fingerprintOf(
  opening: Partial<Record<PersonId, PlaceId>>,
  trajectory: Record<PersonId, Record<string, PlaceId>>
): string {
  const open = PERSON_IDS.map((p) => `${p}:${opening[p] ?? "-"}`).join(",");
  const traj = PERSON_IDS.map((p) =>
    [1, 2, 3, 4, 5, 6].map((t) => trajectory[p][String(t)]).join(">")
  ).join("|");
  return `${open}#${traj}`;
}

/**
 * Sample one alone-with-victim world + partial opening (may fail filters).
 */
export function sampleWorld(rng: () => number): {
  world: Record<PersonId, PlaceId[]>;
  opening: Partial<Record<PersonId, PlaceId>>;
  answer: { who: PersonId; where: PlaceId; when: number };
} | null {
  const allPaths = enumeratePaths(NIGHT_TEA_ADJACENCY);
  const vp = pick(rng, allPaths);
  const crimeTime = 1 + Math.floor(rng() * 5); // 1..5 bias toward mid; allow 1-6:
  const crimeT = Math.min(6, crimeTime + (rng() < 0.25 ? 1 : 0));
  const crimePlace = vp[crimeT - 1];
  const killers = PERSON_IDS.filter((p) => p !== VICTIM_ID);
  const killer = pick(rng, killers);

  const killerPaths = allPaths.filter((path) => {
    if (path[crimeT - 1] !== crimePlace) return false;
    for (let t = 0; t < 6; t++) {
      if (t === crimeT - 1) continue;
      if (path[t] === vp[t]) return false;
    }
    return true;
  });
  if (!killerPaths.length) return null;
  const kp = pick(rng, killerPaths);

  const world = {} as Record<PersonId, PlaceId[]>;
  world[VICTIM_ID] = vp;
  world[killer] = kp;

  const remaining = PERSON_IDS.filter((p) => p !== VICTIM_ID && p !== killer);
  for (const pid of remaining) {
    const candidates = allPaths.filter(
      (path) => path[crimeT - 1] !== crimePlace
    );
    if (!candidates.length) return null;
    world[pid] = pick(rng, candidates);
  }

  const hits = aloneWithHits(world);
  if (hits.length !== 1) return null;
  const answer = hits[0];
  if (answer.who !== killer) return null;

  // Partial opening: 2–4 people
  const openCount = 2 + Math.floor(rng() * 3);
  const openPeople = shuffle(rng, [...PERSON_IDS]).slice(0, openCount);
  const opening: Partial<Record<PersonId, PlaceId>> = {};
  for (const p of openPeople) opening[p] = world[p][0];

  return { world, opening, answer };
}

function bundleFromSample(
  seed: string,
  id: string,
  sample: NonNullable<ReturnType<typeof sampleWorld>>,
  greedySteps: number
): ScenarioBundle {
  const trajectory = {} as Record<PersonId, Record<string, PlaceId>>;
  for (const pid of PERSON_IDS) {
    trajectory[pid] = pathToTraj(sample.world[pid]);
  }
  const bands = bandsFromGreedy(greedySteps);
  return assembleNightTeaBundle({
    id,
    difficulty: greedySteps,
    opening: sample.opening,
    trajectory,
    answers: {
      who: sample.answer.who,
      where: sample.answer.where,
      when: String(sample.answer.when),
    },
    soloBands: bands,
    seed,
    greedyMin: greedySteps,
  });
}

export type GenerateOptions = {
  /** Exact greedy min-query target */
  targetGreedy: number;
  /** Max sampling attempts */
  maxAttempts?: number;
  /** Reject fingerprints already seen */
  seenFingerprints?: Set<string>;
};

/**
 * Generate one case for a seed targeting exact greedySteps.
 * Same seed + same target → same result (deterministic search).
 */
export function generateCaseForSeed(
  seed: string,
  opts: GenerateOptions
): GeneratedCase | null {
  const rng = mulberry32(hashSeed(`${seed}|g${opts.targetGreedy}`));
  const maxAttempts = opts.maxAttempts ?? 400;
  const seen = opts.seenFingerprints ?? new Set<string>();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const sample = sampleWorld(rng);
    if (!sample) continue;

    const traj = {} as Record<PersonId, Record<string, PlaceId>>;
    for (const pid of PERSON_IDS) traj[pid] = pathToTraj(sample.world[pid]);
    const fp = fingerprintOf(sample.opening, traj);
    if (seen.has(fp)) continue;

    const draftId = `${NIGHT_TEA_FAMILY}-g${opts.targetGreedy}-draft`;
    const draft = bundleFromSample(seed, draftId, sample, opts.targetGreedy);

    // Fast filters
    const openingAnswers = findConsistentAnswers(draft, [], {
      limitAnswers: 8,
    });
    if (openingAnswers.length <= 1) continue;

    const full = findConsistentAnswers(draft, observationsFromSealed(draft), {
      limitAnswers: 4,
    });
    if (full.length !== 1) continue;
    if (
      full[0].who !== draft.sealed.answers.who ||
      full[0].where !== draft.sealed.answers.where ||
      full[0].when !== String(draft.sealed.answers.when)
    ) {
      continue;
    }

    // Single-query lock (sample place_time)
    let locked = false;
    for (const obs of observationsFromSealed(draft).filter(
      (o) => o.kind === "place_time"
    )) {
      const left = findConsistentAnswers(draft, [obs], {
        limitAnswers: 4,
        samples: 2500,
      });
      if (left.length <= 1) {
        locked = true;
        break;
      }
    }
    if (locked) continue;

    const { steps } = greedyMinQueries(draft);
    if (steps !== opts.targetGreedy) continue;

    // Full validate
    const withBands = bundleFromSample(seed, draftId, sample, steps);
    const report = validateWithSolver(withBands);
    if (!report.ok) continue;

    const id = `${NIGHT_TEA_FAMILY}-g${steps}-${hashSeed(fp).toString(16).slice(0, 6)}`;
    const finalBundle = bundleFromSample(seed, id, sample, steps);
    seen.add(fp);
    return {
      id,
      seed,
      greedySteps: steps,
      fingerprint: fp,
      bundle: finalBundle,
    };
  }
  return null;
}

export type CaseBankFile = {
  family: string;
  generatedAt: string;
  selection: "pregenerated";
  rationale: string;
  tiers: number[];
  cases: Array<{
    id: string;
    seed: string;
    greedySteps: number;
    fingerprint: string;
    opening: Partial<Record<PersonId, PlaceId>>;
    trajectory: Trajectory;
    answers: Record<string, string>;
    soloBands: { goldMax: number; silverMax: number };
  }>;
};

export function bundleFromBankEntry(
  entry: CaseBankFile["cases"][number],
  level?: number
): ScenarioBundle {
  return assembleNightTeaBundle({
    id: entry.id,
    level,
    difficulty: entry.greedySteps,
    opening: entry.opening,
    trajectory: entry.trajectory,
    answers: entry.answers,
    soloBands: entry.soloBands,
    seed: entry.seed,
    greedyMin: entry.greedySteps,
  });
}

/** Unused import guard helper for PLACE_IDS in tests */
export function placeCount(): number {
  return PLACE_IDS.length;
}
