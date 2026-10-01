import type {
  PlaceId,
  PersonId,
  ScenarioBundle,
  ScenarioCase,
  ScenarioPublic,
  TimeId,
} from "./types";

const TIMES: TimeId[] = [1, 2, 3, 4, 5, 6];

export function areAdjacent(
  adjacency: Record<PlaceId, PlaceId[]>,
  a: PlaceId,
  b: PlaceId
): boolean {
  return adjacency[a]?.includes(b) ?? false;
}

export function validateTrajectory(
  scenario: ScenarioPublic,
  sealed: ScenarioCase
): string[] {
  const errors: string[] = [];
  const people = scenario.people.map((p) => p.id);
  const placeIds = new Set(scenario.places.map((p) => p.id));

  for (const person of people) {
    const path = sealed.trajectory[person];
    if (!path) {
      errors.push(`缺少人物 ${person} 的轨迹`);
      continue;
    }
    for (const t of TIMES) {
      const place = path[String(t)];
      if (!place) {
        errors.push(`${person} 缺少时间 ${t}`);
        continue;
      }
      if (!placeIds.has(place)) {
        errors.push(`${person}@${t} 地点非法: ${place}`);
      }
      if (t === 1) {
        const open = scenario.opening[person];
        if (open && open !== place) {
          errors.push(
            `${person} 时间1 为 ${place}，与开场公开 ${open} 不一致`
          );
        }
      } else {
        const prev = path[String(t - 1)] as PlaceId;
        if (prev === place) {
          errors.push(`${person} 时间 ${t - 1}→${t} 连续停留在 ${place}`);
        } else if (!areAdjacent(scenario.adjacency, prev, place)) {
          errors.push(
            `${person} 时间 ${t - 1}→${t} 从 ${prev} 到 ${place} 不相邻`
          );
        }
      }
    }
  }

  for (const q of scenario.winQuestions) {
    if (!(q.id in sealed.answers)) {
      errors.push(`答案缺少问题 ${q.id}`);
    }
  }

  return errors;
}

export function assertValidBundle(bundle: ScenarioBundle): void {
  const errors = validateTrajectory(bundle.public, bundle.sealed);
  if (errors.length) {
    throw new Error(`场景校验失败:\n${errors.join("\n")}`);
  }
}

export function peopleAt(
  sealed: ScenarioCase,
  time: TimeId,
  place: PlaceId
): PersonId[] {
  const result: PersonId[] = [];
  for (const [person, path] of Object.entries(sealed.trajectory) as [
    PersonId,
    Record<string, PlaceId>,
  ][]) {
    if (path[String(time)] === place) result.push(person);
  }
  return result.sort();
}

export function visitsOf(
  sealed: ScenarioCase,
  person: PersonId,
  place: PlaceId
): TimeId[] {
  const path = sealed.trajectory[person];
  const times: TimeId[] = [];
  for (const t of TIMES) {
    if (path[String(t)] === place) times.push(t);
  }
  return times;
}
