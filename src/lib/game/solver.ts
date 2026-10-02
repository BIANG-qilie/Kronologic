import type {
  PlaceId,
  PersonId,
  ScenarioBundle,
  ScenarioRule,
  TimeId,
} from "./types";
import { resolvePlacePerson, resolvePlaceTime } from "./query";

export const SOLVER_TIMES: TimeId[] = [1, 2, 3, 4, 5, 6];

export type AnswerTriple = {
  who: string;
  where: string;
  when: string;
};

export type QueryObservation =
  | {
      kind: "place_time";
      placeId: PlaceId;
      timeId: TimeId;
      count: number;
      privateLabel: string;
    }
  | {
      kind: "place_person";
      placeId: PlaceId;
      personId: PersonId;
      count: number;
      privateLabel: string;
    };

export type SolverReport = {
  openingAnswerCount: number;
  openingAnswers: AnswerTriple[];
  fullInfoAnswerCount: number;
  fullInfoAnswers: AnswerTriple[];
  greedySteps: number;
  singleQueryMaxLock: number;
  goldMax: number;
  silverMax: number;
  ok: boolean;
  errors: string[];
};

export function enumeratePaths(
  adjacency: Record<PlaceId, PlaceId[]>,
  start?: PlaceId
): PlaceId[][] {
  const places = Object.keys(adjacency) as PlaceId[];
  const starts = start ? [start] : places;
  const out: PlaceId[][] = [];
  function dfs(path: PlaceId[]) {
    if (path.length === 6) {
      out.push([...path]);
      return;
    }
    const prev = path[path.length - 1];
    for (const next of adjacency[prev] ?? []) {
      if (next === prev) continue;
      path.push(next);
      dfs(path);
      path.pop();
    }
  }
  for (const s of starts) dfs([s]);
  return out;
}

function parseCountLabel(label: string): number {
  const m = /^x?(\d+)$/i.exec(label.trim());
  return m ? Number(m[1]) : -1;
}

export function observationsFromSealed(
  bundle: ScenarioBundle
): QueryObservation[] {
  const { public: pub, sealed } = bundle;
  const places = pub.places.map((p) => p.id);
  const people = pub.people.map((p) => p.id);
  const obs: QueryObservation[] = [];
  const salt = "validator";
  for (const placeId of places) {
    for (const timeId of SOLVER_TIMES) {
      const r = resolvePlaceTime(sealed, placeId, timeId, salt);
      obs.push({
        kind: "place_time",
        placeId,
        timeId,
        count: parseCountLabel(r.shared.sharedLabel),
        privateLabel: r.private.privateLabel,
      });
    }
  }
  for (const placeId of places) {
    for (const personId of people) {
      const r = resolvePlacePerson(sealed, placeId, personId, salt);
      obs.push({
        kind: "place_person",
        placeId,
        personId,
        count: parseCountLabel(r.shared.sharedLabel),
        privateLabel: r.private.privateLabel,
      });
    }
  }
  return obs;
}

function trueAnswer(bundle: ScenarioBundle): AnswerTriple {
  return {
    who: bundle.sealed.answers.who,
    where: bundle.sealed.answers.where,
    when: String(bundle.sealed.answers.when),
  };
}

function answerKey(a: AnswerTriple): string {
  return `${a.who}|${a.where}|${a.when}`;
}

function pathPassesIndividualObs(
  person: PersonId,
  path: PlaceId[],
  observations: QueryObservation[]
): boolean {
  for (const obs of observations) {
    if (obs.kind === "place_person" && obs.personId === person) {
      const times: number[] = [];
      for (let i = 0; i < 6; i++) {
        if (path[i] === obs.placeId) times.push(i + 1);
      }
      if (times.length !== obs.count) return false;
      if (
        obs.count > 0 &&
        obs.privateLabel !== "—" &&
        !times.map(String).includes(obs.privateLabel)
      ) {
        return false;
      }
    }
    if (obs.kind === "place_time") {
      if (obs.count === 0 && path[obs.timeId - 1] === obs.placeId) return false;
      if (
        obs.privateLabel === person &&
        path[obs.timeId - 1] !== obs.placeId
      ) {
        return false;
      }
    }
  }
  return true;
}

export function buildPathPools(
  bundle: ScenarioBundle,
  observations: QueryObservation[]
): Record<PersonId, PlaceId[][]> {
  const pools = {} as Record<PersonId, PlaceId[][]>;
  for (const person of bundle.public.people.map((p) => p.id)) {
    const start = bundle.public.opening[person];
    pools[person] = enumeratePaths(bundle.public.adjacency, start).filter(
      (path) => pathPassesIndividualObs(person, path, observations)
    );
  }
  return pools;
}

function meetingMask(path: PlaceId[], victimPath: PlaceId[]): number {
  let mask = 0;
  for (let i = 0; i < 6; i++) {
    if (path[i] === victimPath[i]) mask |= 1 << i;
  }
  return mask;
}

function countsReachable(maskLists: number[][], target: number[]): boolean {
  const STATES = 6 ** 6;
  let reachable = new Uint8Array(STATES);
  reachable[0] = 1;
  for (const masks of maskLists) {
    const next = new Uint8Array(STATES);
    for (let state = 0; state < STATES; state++) {
      if (!reachable[state]) continue;
      for (const mask of masks) {
        let ns = 0;
        let bad = false;
        for (let t = 0; t < 6; t++) {
          const digit = Math.floor(state / 6 ** t) % 6;
          const add = mask & (1 << t) ? 1 : 0;
          const nd = digit + add;
          if (nd > target[t]) {
            bad = true;
            break;
          }
          ns += nd * 6 ** t;
        }
        if (!bad) next[ns] = 1;
      }
    }
    reachable = next;
  }
  let goal = 0;
  for (let t = 0; t < 6; t++) goal += target[t] * 6 ** t;
  return reachable[goal] === 1;
}

function aloneWithVictimByDP(
  victimId: PersonId,
  others: PersonId[],
  pools: Record<PersonId, PlaceId[][]>,
  limitAnswers: number
): AnswerTriple[] {
  const answers = new Map<string, AnswerTriple>();
  for (const vp of pools[victimId]) {
    const maskLists = others.map((pid) => {
      const set = new Set<number>();
      for (const path of pools[pid]) set.add(meetingMask(path, vp));
      return [...set];
    });
    const STATES = 6 ** 6;
    let reachable = new Uint8Array(STATES);
    reachable[0] = 1;
    for (const masks of maskLists) {
      const next = new Uint8Array(STATES);
      for (let state = 0; state < STATES; state++) {
        if (!reachable[state]) continue;
        for (const mask of masks) {
          let ns = 0;
          let bad = false;
          for (let t = 0; t < 6; t++) {
            const digit = Math.floor(state / 6 ** t) % 6;
            const add = mask & (1 << t) ? 1 : 0;
            const nd = digit + add;
            if (nd > 5) {
              bad = true;
              break;
            }
            ns += nd * 6 ** t;
          }
          if (!bad) next[ns] = 1;
        }
      }
      reachable = next;
    }
    for (let state = 0; state < STATES; state++) {
      if (!reachable[state]) continue;
      const counts: number[] = [];
      let ones = 0;
      let oneTime = -1;
      let valid = true;
      for (let t = 0; t < 6; t++) {
        const c = Math.floor(state / 6 ** t) % 6;
        counts.push(c);
        if (c === 1) {
          ones++;
          oneTime = t;
        } else if (c !== 0 && c < 2) valid = false;
      }
      if (!valid || ones !== 1 || oneTime < 0) continue;
      for (let oi = 0; oi < others.length; oi++) {
        const a0 = {
          who: others[oi],
          where: vp[oneTime],
          when: String(oneTime + 1),
        };
        if (answers.has(answerKey(a0))) continue;
        for (const km of maskLists[oi].filter((m) => m & (1 << oneTime))) {
          const remain = counts.map((c, t) => c - (km & (1 << t) ? 1 : 0));
          if (remain.some((c) => c < 0) || remain[oneTime] !== 0) continue;
          const otherLists = maskLists
            .filter((_, j) => j !== oi)
            .map((list) => list.filter((m) => !(m & (1 << oneTime))));
          if (otherLists.some((l) => !l.length)) continue;
          if (!countsReachable(otherLists, remain)) continue;
          answers.set(answerKey(a0), a0);
          if (answers.size >= limitAnswers) return [...answers.values()];
          break;
        }
      }
    }
  }
  return [...answers.values()];
}

function extractAnswer(
  rule: ScenarioRule,
  world: Record<PersonId, PlaceId[]>
): AnswerTriple | null {
  if (rule.type === "alone_with_victim") {
    const victim = rule.victimId;
    const vp = world[victim];
    const hits: AnswerTriple[] = [];
    for (let t = 0; t < 6; t++) {
      const place = vp[t];
      const others: string[] = [];
      for (const [pid, path] of Object.entries(world) as [
        PersonId,
        PlaceId[],
      ][]) {
        if (pid === victim) continue;
        if (path[t] === place) others.push(pid);
      }
      if (others.length === 1) {
        hits.push({ who: others[0], where: place, when: String(t + 1) });
      }
    }
    return hits.length === 1 ? hits[0] : null;
  }
  const place = rule.placeId;
  const hits: AnswerTriple[] = [];
  for (let t = 0; t < 6; t++) {
    const present: string[] = [];
    for (const [pid, path] of Object.entries(world) as [
      PersonId,
      PlaceId[],
    ][]) {
      if (path[t] === place) present.push(pid);
    }
    if (present.length === 1) {
      hits.push({ who: present[0], where: place, when: String(t + 1) });
    }
  }
  return hits.length === 1 ? hits[0] : null;
}

function worldPassesJoint(
  world: Record<PersonId, PlaceId[]>,
  people: PersonId[],
  observations: QueryObservation[]
): boolean {
  for (const obs of observations) {
    if (obs.kind !== "place_time") continue;
    const present: PersonId[] = [];
    for (const pid of people) {
      if (world[pid][obs.timeId - 1] === obs.placeId) present.push(pid);
    }
    if (present.length !== obs.count) return false;
    if (
      obs.count > 0 &&
      obs.privateLabel !== "—" &&
      !present.includes(obs.privateLabel as PersonId)
    ) {
      return false;
    }
  }
  return true;
}

function poolProduct(pools: Record<PersonId, PlaceId[][]>, people: PersonId[]): number {
  let n = 1;
  for (const p of people) {
    n *= Math.max(1, pools[p].length);
    if (n > 1_000_000) return n;
  }
  return n;
}

function collectAnswersExhaustive(
  rule: ScenarioRule,
  people: PersonId[],
  pools: Record<PersonId, PlaceId[][]>,
  observations: QueryObservation[],
  limitAnswers: number
): AnswerTriple[] {
  const answers = new Map<string, AnswerTriple>();
  const order = [...people].sort((a, b) => pools[a].length - pools[b].length);
  const assignment: Partial<Record<PersonId, PlaceId[]>> = {};
  const occ: Record<string, number>[] = Array.from({ length: 6 }, () => ({}));
  const placeTime = observations.filter((o) => o.kind === "place_time");
  let worlds = 0;

  function apply(path: PlaceId[], d: number) {
    for (let t = 0; t < 6; t++) {
      occ[t][path[t]] = (occ[t][path[t]] ?? 0) + d;
    }
  }
  function okPartial(path: PlaceId[]): boolean {
    for (let t = 0; t < 6; t++) {
      const c = (occ[t][path[t]] ?? 0) + 1;
      for (const obs of placeTime) {
        if (obs.timeId === t + 1 && obs.placeId === path[t] && c > obs.count) {
          return false;
        }
      }
    }
    return true;
  }
  function bt(idx: number) {
    if (answers.size >= limitAnswers) return;
    if (idx === order.length) {
      worlds++;
      const world = assignment as Record<PersonId, PlaceId[]>;
      if (!worldPassesJoint(world, people, observations)) return;
      const a = extractAnswer(rule, world);
      if (a) answers.set(answerKey(a), a);
      return;
    }
    const person = order[idx];
    for (const path of pools[person]) {
      if (!okPartial(path)) continue;
      assignment[person] = path;
      apply(path, 1);
      bt(idx + 1);
      apply(path, -1);
      delete assignment[person];
      if (answers.size >= limitAnswers) return;
    }
  }
  bt(0);
  void worlds;
  return [...answers.values()];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function collectAnswersSampled(
  rule: ScenarioRule,
  people: PersonId[],
  pools: Record<PersonId, PlaceId[][]>,
  observations: QueryObservation[],
  limitAnswers: number,
  samples: number,
  seed = 0x1a2b3c4d
): AnswerTriple[] {
  const rnd = mulberry32(seed);
  const answers = new Map<string, AnswerTriple>();
  for (let i = 0; i < samples && answers.size < limitAnswers; i++) {
    const world = {} as Record<PersonId, PlaceId[]>;
    for (const pid of people) {
      const list = pools[pid];
      world[pid] = list[Math.floor(rnd() * list.length)];
    }
    if (!worldPassesJoint(world, people, observations)) continue;
    const a = extractAnswer(rule, world);
    if (a) answers.set(answerKey(a), a);
  }
  return [...answers.values()];
}

/** Opening search for alone_at_place: try each (who,when) with constrained pools. */
function aloneAtPlaceCandidates(
  placeId: PlaceId,
  people: PersonId[],
  pools: Record<PersonId, PlaceId[][]>,
  observations: QueryObservation[],
  limitAnswers: number
): AnswerTriple[] {
  const found: AnswerTriple[] = [];
  for (const who of people) {
    for (let t = 0; t < 6; t++) {
      const constrained = {} as Record<PersonId, PlaceId[][]>;
      let ok = true;
      for (const pid of people) {
        let list = pools[pid];
        if (pid === who) list = list.filter((p) => p[t] === placeId);
        else list = list.filter((p) => p[t] !== placeId);
        if (!list.length) {
          ok = false;
          break;
        }
        constrained[pid] = list;
      }
      if (!ok) continue;
      const sample = collectAnswersSampled(
        { type: "alone_at_place", placeId },
        people,
        constrained,
        observations,
        2,
        1200,
        (who.charCodeAt(0) * 17 + t * 131) >>> 0
      );
      const expect = { who, where: placeId, when: String(t + 1) };
      if (sample.some((a) => answerKey(a) === answerKey(expect))) {
        found.push(expect);
        if (found.length >= limitAnswers) return found;
      } else {
        // small exhaustive if product tiny
        const product = poolProduct(constrained, people);
        if (product <= 30_000) {
          const ex = collectAnswersExhaustive(
            { type: "alone_at_place", placeId },
            people,
            constrained,
            observations,
            3
          );
          if (ex.some((a) => answerKey(a) === answerKey(expect))) {
            found.push(expect);
            if (found.length >= limitAnswers) return found;
          }
        }
      }
    }
  }
  return found;
}

/**
 * Distinct answers still consistent with observations + rule.
 */
export function findConsistentAnswers(
  bundle: ScenarioBundle,
  observations: QueryObservation[],
  opts?: { limitAnswers?: number; samples?: number }
): AnswerTriple[] {
  const rule = bundle.sealed.rule;
  if (!rule) return [];
  const limitAnswers = opts?.limitAnswers ?? 40;
  const people = bundle.public.people.map((p) => p.id);
  const pools = buildPathPools(bundle, observations);
  for (const p of people) {
    if (!pools[p].length) return [];
  }

  const placeTimeObs = observations.filter((o) => o.kind === "place_time");
  if (placeTimeObs.length === 0 && rule.type === "alone_with_victim") {
    return aloneWithVictimByDP(
      rule.victimId,
      people.filter((p) => p !== rule.victimId),
      pools,
      limitAnswers
    );
  }
  if (placeTimeObs.length === 0 && rule.type === "alone_at_place") {
    return aloneAtPlaceCandidates(
      rule.placeId,
      people,
      pools,
      observations,
      limitAnswers
    );
  }

  const product = poolProduct(pools, people);
  if (product <= 80_000) {
    return collectAnswersExhaustive(
      rule,
      people,
      pools,
      observations,
      limitAnswers
    );
  }
  return collectAnswersSampled(
    rule,
    people,
    pools,
    observations,
    limitAnswers,
    opts?.samples ?? 4000,
    0x9e3779b9
  );
}

function obsKey(o: QueryObservation): string {
  return o.kind === "place_time"
    ? `pt:${o.placeId}:${o.timeId}`
    : `pp:${o.placeId}:${o.personId}`;
}

export function greedyMinQueries(bundle: ScenarioBundle): {
  steps: number;
  queries: QueryObservation[];
} {
  const remaining = observationsFromSealed(bundle).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "place_time" ? -1 : 1;
    return obsKey(a).localeCompare(obsKey(b));
  });
  const used: QueryObservation[] = [];
  const queries: QueryObservation[] = [];
  let answers = findConsistentAnswers(bundle, used, {
    limitAnswers: 10,
    samples: 2500,
  });

  while (answers.length > 1 && remaining.length && queries.length < 24) {
    let best: QueryObservation | null = null;
    let bestSize = answers.length;
    // Score a rotating window of candidates
    const window = remaining.slice(0, 16);
    for (const cand of window) {
      const next = findConsistentAnswers(bundle, [...used, cand], {
        limitAnswers: 10,
        samples: 2000,
      });
      if (next.length < bestSize) {
        bestSize = next.length;
        best = cand;
        if (bestSize <= 1) break;
      }
    }
    if (!best) best = remaining[0];
    used.push(best);
    queries.push(best);
    const idx = remaining.findIndex((r) => obsKey(r) === obsKey(best!));
    if (idx >= 0) remaining.splice(idx, 1);
    answers = findConsistentAnswers(bundle, used, {
      limitAnswers: 10,
      samples: 3000,
    });
  }

  return { steps: queries.length, queries };
}

export function bandsFromGreedy(greedySteps: number): {
  goldMax: number;
  silverMax: number;
} {
  const goldMax = Math.max(1, greedySteps);
  const silverMax = Math.max(goldMax + 1, Math.ceil(greedySteps * 1.75));
  return { goldMax, silverMax };
}

export function validateWithSolver(bundle: ScenarioBundle): SolverReport {
  const errors: string[] = [];
  if (!bundle.sealed.rule) errors.push("缺少 sealed.rule");

  const openingAnswers = bundle.sealed.rule
    ? findConsistentAnswers(bundle, [], { limitAnswers: 20 })
    : [];

  // Full info: prefer exhaustive on tiny pools
  const fullInfoAnswers = bundle.sealed.rule
    ? findConsistentAnswers(bundle, observationsFromSealed(bundle), {
        limitAnswers: 5,
        samples: 1000,
      })
    : [];

  const { steps: greedySteps } = bundle.sealed.rule
    ? greedyMinQueries(bundle)
    : { steps: 0 };
  const { goldMax, silverMax } = bandsFromGreedy(greedySteps);

  let singleQueryMaxLock = openingAnswers.length;
  if (bundle.sealed.rule) {
    for (const obs of observationsFromSealed(bundle).filter(
      (o) => o.kind === "place_time"
    )) {
      const left = findConsistentAnswers(bundle, [obs], {
        limitAnswers: 6,
        samples: 3000,
      });
      singleQueryMaxLock = Math.min(singleQueryMaxLock, Math.max(left.length, 1));
      // If sampling found only 1, double-check with more samples before failing
      if (left.length <= 1) {
        const verify = findConsistentAnswers(bundle, [obs], {
          limitAnswers: 6,
          samples: 8000,
        });
        singleQueryMaxLock = Math.min(singleQueryMaxLock, verify.length);
        if (singleQueryMaxLock <= 1) break;
      }
    }
  }

  if (openingAnswers.length <= 1) {
    errors.push(
      `开场+案情规则下答案应不唯一，当前候选 ${openingAnswers.length}`
    );
  }
  if (fullInfoAnswers.length !== 1) {
    errors.push(
      `全提问结果下答案应唯一，当前候选 ${fullInfoAnswers.length}`
    );
  } else if (answerKey(fullInfoAnswers[0]) !== answerKey(trueAnswer(bundle))) {
    errors.push(
      `全信息答案 ${answerKey(fullInfoAnswers[0])} 与 sealed ${answerKey(trueAnswer(bundle))} 不一致`
    );
  }

  const sealedGold = bundle.public.soloBands.goldMax;
  const sealedSilver = bundle.public.soloBands.silverMax;
  if (sealedGold !== goldMax || sealedSilver !== silverMax) {
    errors.push(
      `soloBands 应为 goldMax=${goldMax} silverMax=${silverMax}（由贪心 ${greedySteps} 步推出），当前为 ${sealedGold}/${sealedSilver}`
    );
  }
  if (greedySteps < sealedGold) {
    errors.push(
      `贪心最少提问数 ${greedySteps} 低于金放大镜下限 ${sealedGold}`
    );
  }
  if (singleQueryMaxLock <= 1) {
    // alone_at_place 规则把地点写进案情时，单题问到案发格即可锁死；
    // 关系型 alone_with_victim 必须通过「无单题秒杀」。
    if (bundle.sealed.rule?.type === "alone_with_victim") {
      errors.push("存在单题即可锁定全部答案");
    }
  }

  return {
    openingAnswerCount: openingAnswers.length,
    openingAnswers,
    fullInfoAnswerCount: fullInfoAnswers.length,
    fullInfoAnswers,
    greedySteps,
    singleQueryMaxLock,
    goldMax,
    silverMax,
    ok: errors.length === 0,
    errors,
  };
}
