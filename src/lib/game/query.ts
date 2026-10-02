import { peopleAt, visitsOf } from "./validate";
import type {
  PlaceId,
  PersonId,
  PrivateQueryPayload,
  ScenarioCase,
  SharedQueryPayload,
  TimeId,
} from "./types";

/**
 * Namespace used when calibrating greedySteps / soloBands for bank v1.
 * Changing this token changes private picks and invalidates the case bank.
 */
export const PRIVATE_REVEAL_NAMESPACE = "validator";

/**
 * Stable salt for white-window private reveals.
 * Same sealed case + same (place, time|person) → same private label for
 * every player and every repeat ask. Must NOT include room code or query order.
 *
 * `caseKey` (seed / scenario id) is accepted so call sites stay case-aware;
 * bank v1 was scored under {@link PRIVATE_REVEAL_NAMESPACE}, so the effective
 * salt stays that namespace for compatibility. A future bank regen can fold
 * `caseKey` into the salt without changing the call shape.
 */
export function privateRevealSalt(_caseKey?: string): string {
  return PRIVATE_REVEAL_NAMESPACE;
}

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
  salt: string = PRIVATE_REVEAL_NAMESPACE
): { shared: SharedQueryPayload; private: PrivateQueryPayload } {
  const present = peopleAt(sealed, timeId, placeId);
  const count = present.length;
  const sharedLabel = `x${count}`;
  let privateLabel = "—";
  if (count > 0) {
    privateLabel = pickDeterministic(present, `${salt}:${placeId}:${timeId}`);
  }
  const askAgain = privateLabel === "—";
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
  salt: string = PRIVATE_REVEAL_NAMESPACE
): { shared: SharedQueryPayload; private: PrivateQueryPayload } {
  const times = visitsOf(sealed, personId, placeId);
  const count = times.length;
  const sharedLabel = `x${count}`;
  let privateLabel = "—";
  if (count > 0) {
    privateLabel = String(
      pickDeterministic(times, `${salt}:${placeId}:${personId}`)
    );
  }
  const askAgain = privateLabel === "—";
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
