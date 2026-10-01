import type { PlaceId, PersonId, TimeId } from "./types";

const TIMES: TimeId[] = [1, 2, 3, 4, 5, 6];

export type NotesInference = {
  cells: Record<string, Record<string, string>>;
  visits: Record<string, Record<string, string>>;
};

/** v2: only inference layer + free text. Public/private are never stored. */
export type NotesPayloadV2 = {
  version: 2;
  inference: NotesInference;
  free: string;
};

/** @deprecated read path still accepts v1 for migration */
export type NotesPayloadV1 = {
  version: 1;
  cells: Record<string, Record<string, string>>;
  visits: Record<string, Record<string, string>>;
  free: string;
};

export type NotesPayload = NotesPayloadV2;

function emptyInference(
  people: string[],
  places: string[]
): NotesInference {
  const cells: NotesInference["cells"] = {};
  for (const t of TIMES) {
    cells[String(t)] = {};
    for (const p of places) cells[String(t)][p] = "";
  }
  const visits: NotesInference["visits"] = {};
  for (const person of people) {
    visits[person] = {};
    for (const p of places) visits[person][p] = "";
  }
  return { cells, visits };
}

function mergeNested(
  base: Record<string, Record<string, string>>,
  extra?: Record<string, Record<string, string>>
) {
  const out: Record<string, Record<string, string>> = {};
  for (const [k, row] of Object.entries(base)) {
    out[k] = { ...row, ...(extra?.[k] ?? {}) };
  }
  if (extra) {
    for (const [k, row] of Object.entries(extra)) {
      if (!out[k]) out[k] = { ...row };
    }
  }
  return out;
}

export function emptyNotesV2(
  people: PersonId[] | string[],
  places: PlaceId[] | string[]
): NotesPayloadV2 {
  return {
    version: 2,
    inference: emptyInference(people, places),
    free: "",
  };
}

/**
 * Parse notes JSON. v2 preferred; v1 cell/visit strings migrate into inference;
 * plain text → free only.
 */
export function parseNotes(
  raw: string | undefined,
  people: PersonId[] | string[],
  places: PlaceId[] | string[]
): NotesPayloadV2 {
  const base = emptyNotesV2(people, places);
  if (!raw?.trim()) return base;
  try {
    const parsed = JSON.parse(raw) as NotesPayloadV2 | NotesPayloadV1;
    if (parsed?.version === 2 && parsed.inference) {
      return {
        version: 2,
        inference: {
          cells: mergeNested(base.inference.cells, parsed.inference.cells),
          visits: mergeNested(base.inference.visits, parsed.inference.visits),
        },
        free: parsed.free ?? "",
      };
    }
    if (
      (parsed as NotesPayloadV1)?.version === 1 &&
      (parsed as NotesPayloadV1).cells &&
      (parsed as NotesPayloadV1).visits
    ) {
      const v1 = parsed as NotesPayloadV1;
      return {
        version: 2,
        inference: {
          cells: mergeNested(base.inference.cells, v1.cells),
          visits: mergeNested(base.inference.visits, v1.visits),
        },
        free: v1.free ?? "",
      };
    }
  } catch {
    /* legacy plain text */
  }
  return { ...base, free: raw };
}

export function serializeNotes(payload: NotesPayloadV2): string {
  const out: NotesPayloadV2 = {
    version: 2,
    inference: payload.inference,
    free: payload.free,
  };
  return JSON.stringify(out);
}
