import { peopleAt, visitsOf } from "./validate";
import type {
  PlaceId,
  PersonId,
  PrivateQueryPayload,
  ScenarioCase,
  SharedQueryPayload,
  TimeId,
} from "./types";

function pickDeterministic<T>(items: T[], salt: string): T {
  let h = 0;
  for (let i = 0; i < salt.length; i++) {
    h = (h * 31 + salt.charCodeAt(i)) >>> 0;
  }
  return items[h % items.length];
}

export function resolvePlaceTime(
  sealed: ScenarioCase,
  placeId: PlaceId,
  timeId: TimeId,
  salt: string
): { shared: SharedQueryPayload; private: PrivateQueryPayload } {
  const present = peopleAt(sealed, timeId, placeId);
  const count = present.length;
  const askAgain = count === 0;
  const sharedLabel = `x${count}`;
  let privateLabel = "—";
  if (count > 0) {
    privateLabel = pickDeterministic(present, `${salt}:${placeId}:${timeId}`);
  }
  return {
    shared: {
      kind: "place_time",
      placeId,
      timeId,
      sharedLabel,
      askAgain,
    },
    private: { privateLabel },
  };
}

export function resolvePlacePerson(
  sealed: ScenarioCase,
  placeId: PlaceId,
  personId: PersonId,
  salt: string
): { shared: SharedQueryPayload; private: PrivateQueryPayload } {
  const times = visitsOf(sealed, personId, placeId);
  const count = times.length;
  const askAgain = count === 0;
  const sharedLabel = `x${count}`;
  let privateLabel = "—";
  if (count > 0) {
    privateLabel = String(
      pickDeterministic(times, `${salt}:${placeId}:${personId}`)
    );
  }
  return {
    shared: {
      kind: "place_person",
      placeId,
      personId,
      sharedLabel,
      askAgain,
    },
    private: { privateLabel },
  };
}

export function checkAnswers(
  sealed: ScenarioCase,
  submission: Record<string, string>
): boolean {
  for (const [id, expected] of Object.entries(sealed.answers)) {
    const got = (submission[id] ?? "").trim();
    if (got !== expected) return false;
  }
  return true;
}

export function soloRating(
  queryCount: number,
  goldMax: number,
  silverMax: number
): "gold" | "silver" | "copper" {
  if (queryCount <= goldMax) return "gold";
  if (queryCount <= silverMax) return "silver";
  return "copper";
}
