import type {
  PlaceId,
  PersonId,
  PrivateClue,
  QueryLogEntry,
  TimeId,
} from "./types";

export type CellPublicFact = {
  /** Shared occupancy count from place×time green window */
  count?: number;
  /** Known letters at this cell (e.g. time-1 opening) */
  letters: string[];
  sources: string[];
};

export type CellPrivateFact = {
  /** "其中有 S" — one of those present, not exclusive */
  amongLetters: string[];
  sources: string[];
};

export type VisitPublicFact = {
  count?: number;
  sources: string[];
};

export type VisitPrivateFact = {
  /** "其中一次是时间 5" */
  amongTimes: number[];
  sources: string[];
};

export type CellFactLayers = {
  public: CellPublicFact;
  private: CellPrivateFact;
};

export type VisitFactLayers = {
  public: VisitPublicFact;
  private: VisitPrivateFact;
};

export type FactProjection = {
  cells: Record<string, Record<string, CellFactLayers>>;
  visits: Record<string, Record<string, VisitFactLayers>>;
};

const TIMES: TimeId[] = [1, 2, 3, 4, 5, 6];

function emptyCell(): CellFactLayers {
  return {
    public: { letters: [], sources: [] },
    private: { amongLetters: [], sources: [] },
  };
}

function emptyVisit(): VisitFactLayers {
  return {
    public: { sources: [] },
    private: { amongTimes: [], sources: [] },
  };
}

function parseCount(label: string): number | undefined {
  const m = /^x?(\d+)$/i.exec(label.trim());
  if (!m) return undefined;
  return Number(m[1]);
}

function ensureCell(
  cells: FactProjection["cells"],
  time: string,
  place: string
): CellFactLayers {
  if (!cells[time]) cells[time] = {};
  if (!cells[time][place]) cells[time][place] = emptyCell();
  return cells[time][place];
}

function ensureVisit(
  visits: FactProjection["visits"],
  person: string,
  place: string
): VisitFactLayers {
  if (!visits[person]) visits[person] = {};
  if (!visits[person][place]) visits[person][place] = emptyVisit();
  return visits[person][place];
}

export interface ProjectFactsInput {
  opening: Record<string, PlaceId | string>;
  places: PlaceId[] | string[];
  people: PersonId[] | string[];
  queryLog: QueryLogEntry[];
  /** Omit or empty → private layer stays empty (public still projects) */
  privateClues?: PrivateClue[] | null;
}

/**
 * Pure projection: opening + shared query log (+ optional private clues)
 * → per-cell / per-visit public & private marks.
 * Public layer depends only on opening + queryLog (not privateClues).
 */
export function projectFacts(input: ProjectFactsInput): FactProjection {
  const cells: FactProjection["cells"] = {};
  const visits: FactProjection["visits"] = {};

  for (const t of TIMES) {
    cells[String(t)] = {};
    for (const place of input.places) {
      cells[String(t)][place] = emptyCell();
    }
  }
  for (const person of input.people) {
    visits[person] = {};
    for (const place of input.places) {
      visits[person][place] = emptyVisit();
    }
  }

  // Time-1 opening → public letters
  for (const [person, place] of Object.entries(input.opening)) {
    const cell = ensureCell(cells, "1", place);
    if (!cell.public.letters.includes(person)) {
      cell.public.letters.push(person);
    }
    if (!cell.public.sources.includes("opening")) {
      cell.public.sources.push("opening");
    }
  }
  for (const t of TIMES) {
    for (const place of input.places) {
      const cell = cells[String(t)][place];
      cell.public.letters.sort();
    }
  }

  const clueByQuery = new Map<string, PrivateClue>();
  for (const c of input.privateClues ?? []) {
    clueByQuery.set(c.queryId, c);
  }

  for (const q of input.queryLog) {
    if (q.kind === "place_time" && q.timeId != null) {
      const cell = ensureCell(cells, String(q.timeId), q.placeId);
      const count = parseCount(q.sharedLabel);
      if (count !== undefined) {
        cell.public.count = count;
      }
      if (!cell.public.sources.includes(q.id)) {
        cell.public.sources.push(q.id);
      }

      const priv = clueByQuery.get(q.id);
      if (priv?.privateLabel && priv.privateLabel !== "—") {
        const letter = priv.privateLabel.trim();
        if (letter && !cell.private.amongLetters.includes(letter)) {
          cell.private.amongLetters.push(letter);
          cell.private.amongLetters.sort();
        }
        if (!cell.private.sources.includes(q.id)) {
          cell.private.sources.push(q.id);
        }
      }
    } else if (q.kind === "place_person" && q.personId) {
      const visit = ensureVisit(visits, q.personId, q.placeId);
      const count = parseCount(q.sharedLabel);
      if (count !== undefined) {
        visit.public.count = count;
      }
      if (!visit.public.sources.includes(q.id)) {
        visit.public.sources.push(q.id);
      }

      const priv = clueByQuery.get(q.id);
      if (priv?.privateLabel && priv.privateLabel !== "—") {
        const timeNum = Number(priv.privateLabel.trim());
        if (
          Number.isFinite(timeNum) &&
          !visit.private.amongTimes.includes(timeNum)
        ) {
          visit.private.amongTimes.push(timeNum);
          visit.private.amongTimes.sort((a, b) => a - b);
        }
        if (!visit.private.sources.includes(q.id)) {
          visit.private.sources.push(q.id);
        }
      }
    }
  }

  return { cells, visits };
}

/** Public-only slice for equality tests (strips private). */
export function publicLayerOnly(proj: FactProjection): {
  cells: Record<string, Record<string, CellPublicFact>>;
  visits: Record<string, Record<string, VisitPublicFact>>;
} {
  const cells: Record<string, Record<string, CellPublicFact>> = {};
  const visits: Record<string, Record<string, VisitPublicFact>> = {};
  for (const [t, places] of Object.entries(proj.cells)) {
    cells[t] = {};
    for (const [p, layers] of Object.entries(places)) {
      cells[t][p] = {
        count: layers.public.count,
        letters: [...layers.public.letters],
        sources: [...layers.public.sources],
      };
    }
  }
  for (const [person, places] of Object.entries(proj.visits)) {
    visits[person] = {};
    for (const [p, layers] of Object.entries(places)) {
      visits[person][p] = {
        count: layers.public.count,
        sources: [...layers.public.sources],
      };
    }
  }
  return { cells, visits };
}

export function cellHasConflict(
  publicFact: CellPublicFact,
  privateFact: CellPrivateFact,
  inference: string
): boolean {
  const text = inference.trim();
  if (!text) return false;
  if (publicFact.count === 0) return true;
  const inferredLetters = text
    .toUpperCase()
    .match(/[A-Z]/g)?.filter((c, i, a) => a.indexOf(c) === i) ?? [];
  if (
    publicFact.letters.length > 0 &&
    inferredLetters.length > 0 &&
    inferredLetters.some((l) => !publicFact.letters.includes(l)) &&
    // conflict only when inference asserts letters that contradict known opening set
    // e.g. opening has A at cell but inference is only R
    !inferredLetters.every((l) => publicFact.letters.includes(l))
  ) {
    // If public has definite letters and inference letters don't overlap at all
    if (
      inferredLetters.every((l) => !publicFact.letters.includes(l))
    ) {
      return true;
    }
  }
  if (
    privateFact.amongLetters.length > 0 &&
    inferredLetters.length === 1 &&
    !privateFact.amongLetters.includes(inferredLetters[0])
  ) {
    return true;
  }
  if (
    publicFact.count != null &&
    inferredLetters.length > publicFact.count
  ) {
    return true;
  }
  return false;
}

export function visitHasConflict(
  publicFact: VisitPublicFact,
  inference: string
): boolean {
  const text = inference.trim();
  if (!text) return false;
  if (publicFact.count == null) return false;
  if (!/^\d+$/.test(text)) return false;
  return Number(text) !== publicFact.count;
}
