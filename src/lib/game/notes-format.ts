import type { PlaceId, PersonId, TimeId } from "./types";

const TIMES: TimeId[] = [1, 2, 3, 4, 5, 6];
const PERSON_IDS: PersonId[] = ["A", "R", "M", "E", "T", "K"];

/** Pencil marks on one room × time. `in` and `out` never share a person. */
export type CellMark = {
  in: PersonId[];
  out: PersonId[];
  count: number | null;
};

export type Verdict = "target" | "excluded";

export type SuspectBoard = {
  times: Record<string, Verdict>;
  places: Record<string, Verdict>;
  people: Record<string, Verdict>;
};

export type NotesInference = {
  cells: Record<string, Record<string, CellMark>>;
  visits: Record<string, Record<string, number | null>>;
};

/** v3: structured inference + suspect board + free text. Public/private are never stored. */
export type NotesPayloadV3 = {
  version: 3;
  inference: NotesInference;
  board: SuspectBoard;
  free: string;
};

/** @deprecated read path only */
export type NotesPayloadV2 = {
  version: 2;
  inference: {
    cells: Record<string, Record<string, string>>;
    visits: Record<string, Record<string, string>>;
  };
  free: string;
};

/** @deprecated read path only */
export type NotesPayloadV1 = {
  version: 1;
  cells: Record<string, Record<string, string>>;
  visits: Record<string, Record<string, string>>;
  free: string;
};

export type NotesPayload = NotesPayloadV3;

export function emptyCellMark(): CellMark {
  return { in: [], out: [], count: null };
}

export function isCellMarkEmpty(mark: CellMark | undefined): boolean {
  return !mark || (mark.in.length === 0 && mark.out.length === 0 && mark.count == null);
}

function emptyInference(people: string[], places: string[]): NotesInference {
  const cells: NotesInference["cells"] = {};
  for (const t of TIMES) {
    cells[String(t)] = {};
    for (const p of places) cells[String(t)][p] = emptyCellMark();
  }
  const visits: NotesInference["visits"] = {};
  for (const person of people) {
    visits[person] = {};
    for (const p of places) visits[person][p] = null;
  }
  return { cells, visits };
}

export function emptyNotesV3(
  people: PersonId[] | string[],
  places: PlaceId[] | string[]
): NotesPayloadV3 {
  return {
    version: 3,
    inference: emptyInference(people, places),
    board: { times: {}, places: {}, people: {} },
    free: "",
  };
}

function isPerson(x: unknown): x is PersonId {
  return typeof x === "string" && (PERSON_IDS as string[]).includes(x);
}

function normalizeCount(x: unknown, max: number): number | null {
  if (typeof x !== "number" || !Number.isInteger(x) || x < 0 || x > max) return null;
  return x;
}

function normalizeMark(raw: unknown): CellMark {
  if (!raw || typeof raw !== "object") return emptyCellMark();
  const r = raw as Partial<CellMark>;
  const inList = Array.isArray(r.in) ? r.in.filter(isPerson) : [];
  const outList = Array.isArray(r.out)
    ? r.out.filter((p) => isPerson(p) && !inList.includes(p))
    : [];
  return {
    in: [...new Set(inList)],
    out: [...new Set(outList)],
    count: normalizeCount(r.count, 6),
  };
}

function normalizeVerdicts(raw: unknown): Record<string, Verdict> {
  const out: Record<string, Verdict> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw)) {
    if (v === "target" || v === "excluded") out[k] = v;
  }
  return out;
}

/** Legacy free-text cell → structured mark; leftovers are returned for the margin. */
export function legacyCellToMark(text: string): { mark: CellMark; rest: string } {
  const mark = emptyCellMark();
  const leftovers: string[] = [];
  for (const token of text.trim().split(/[\s,，、/]+/).filter(Boolean)) {
    if (/^[0-6]$/.test(token) && mark.count == null) {
      mark.count = Number(token);
      continue;
    }
    const letters = token.toUpperCase().split("");
    if (letters.every(isPerson)) {
      for (const l of letters) if (!mark.in.includes(l)) mark.in.push(l);
      continue;
    }
    leftovers.push(token);
  }
  return { mark, rest: leftovers.join(" ") };
}

function legacyVisit(text: string): { value: number | null; rest: string } {
  const t = text.trim();
  if (!t) return { value: null, rest: "" };
  if (/^\d$/.test(t)) return { value: Number(t), rest: "" };
  return { value: null, rest: t };
}

function migrateLegacy(
  base: NotesPayloadV3,
  cells: Record<string, Record<string, string>> | undefined,
  visits: Record<string, Record<string, string>> | undefined,
  free: string
): NotesPayloadV3 {
  const notes: string[] = [];
  for (const [t, row] of Object.entries(cells ?? {})) {
    for (const [place, text] of Object.entries(row ?? {})) {
      if (typeof text !== "string" || !text.trim()) continue;
      const { mark, rest } = legacyCellToMark(text);
      if (!base.inference.cells[t]) base.inference.cells[t] = {};
      base.inference.cells[t][place] = mark;
      if (rest) notes.push(`时间${t} ${place}：${rest}`);
    }
  }
  for (const [person, row] of Object.entries(visits ?? {})) {
    for (const [place, text] of Object.entries(row ?? {})) {
      if (typeof text !== "string") continue;
      const { value, rest } = legacyVisit(text);
      if (!base.inference.visits[person]) base.inference.visits[person] = {};
      base.inference.visits[person][place] = value;
      if (rest) notes.push(`${person} 到访 ${place}：${rest}`);
    }
  }
  base.free = [free, ...notes].filter(Boolean).join("\n");
  return base;
}

/**
 * Parse notes JSON. v3 preferred; v1/v2 free-text cells migrate into structured
 * marks (unparsed text lands in the margin); plain text → free only.
 */
export function parseNotes(
  raw: string | undefined,
  people: PersonId[] | string[],
  places: PlaceId[] | string[]
): NotesPayloadV3 {
  const base = emptyNotesV3(people, places);
  if (!raw?.trim()) return base;
  let parsed: NotesPayloadV3 | NotesPayloadV2 | NotesPayloadV1;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...base, free: raw };
  }
  if (parsed?.version === 3 && parsed.inference) {
    for (const [t, row] of Object.entries(parsed.inference.cells ?? {})) {
      if (!base.inference.cells[t]) base.inference.cells[t] = {};
      for (const [place, mark] of Object.entries(row ?? {})) {
        base.inference.cells[t][place] = normalizeMark(mark);
      }
    }
    for (const [person, row] of Object.entries(parsed.inference.visits ?? {})) {
      if (!base.inference.visits[person]) base.inference.visits[person] = {};
      for (const [place, v] of Object.entries(row ?? {})) {
        base.inference.visits[person][place] = normalizeCount(v, 9);
      }
    }
    base.board = {
      times: normalizeVerdicts(parsed.board?.times),
      places: normalizeVerdicts(parsed.board?.places),
      people: normalizeVerdicts(parsed.board?.people),
    };
    base.free = typeof parsed.free === "string" ? parsed.free : "";
    return base;
  }
  if (parsed?.version === 2 && parsed.inference) {
    return migrateLegacy(base, parsed.inference.cells, parsed.inference.visits, parsed.free ?? "");
  }
  if (parsed?.version === 1 && parsed.cells && parsed.visits) {
    return migrateLegacy(base, parsed.cells, parsed.visits, parsed.free ?? "");
  }
  return { ...base, free: raw };
}

export function serializeNotes(payload: NotesPayloadV3): string {
  const out: NotesPayloadV3 = {
    version: 3,
    inference: payload.inference,
    board: payload.board,
    free: payload.free,
  };
  return JSON.stringify(out);
}

/** The single "target" in a board row, if exactly one is marked. */
export function soleTarget(row: Record<string, Verdict>): string | null {
  const targets = Object.entries(row).filter(([, v]) => v === "target");
  return targets.length === 1 ? targets[0][0] : null;
}
