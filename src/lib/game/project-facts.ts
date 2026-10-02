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
        // Mirror onto the desk cell so film + floor show 「其中有 S」
        if (Number.isFinite(timeNum) && timeNum >= 1 && timeNum <= 6) {
          const cell = ensureCell(cells, String(timeNum), q.placeId);
          const letter = String(q.personId);
          if (!cell.private.amongLetters.includes(letter)) {
            cell.private.amongLetters.push(letter);
            cell.private.amongLetters.sort();
          }
          if (!cell.private.sources.includes(q.id)) {
            cell.private.sources.push(q.id);
          }
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

export type MarkSource = "public" | "private" | "inference";

export const SOURCE_ORDER: MarkSource[] = ["public", "private", "inference"];

export const SOURCE_LABEL: Record<MarkSource, string> = {
  public: "绿窗",
  private: "白窗",
  inference: "推理",
};

export function sourcesLabel(sources: MarkSource[]): string {
  return SOURCE_ORDER.filter((s) => sources.includes(s))
    .map((s) => SOURCE_LABEL[s])
    .join(" + ");
}

export type MergedPerson = { person: string; sources: MarkSource[] };

export type MergedCount = {
  value: number;
  sources: MarkSource[];
  /** Inference count when it disagrees with the public count. */
  inferred?: number;
};

export type MergedCell = {
  people: MergedPerson[];
  /** Persons the player pencilled as not here. */
  absent: string[];
  count: MergedCount | null;
  conflict: boolean;
};

export type LayerVisibility = Record<MarkSource, boolean>;

const ALL_LAYERS: LayerVisibility = { public: true, private: true, inference: true };

/** Structured inference for one cell; mirrors `CellMark` in notes-format. */
export type CellInference = {
  in: string[];
  out: string[];
  count: number | null;
};

/**
 * Fold public, private and inference marks on one cell into a single token per
 * person (with every layer that names them) plus one count token.
 * Hidden layers neither appear nor contribute sources.
 */
export function mergeCellMarks(
  facts: CellFactLayers,
  mark: CellInference,
  layers: LayerVisibility = ALL_LAYERS
): MergedCell {
  const bySource = new Map<string, MarkSource[]>();
  const add = (person: string, src: MarkSource) => {
    const list = bySource.get(person) ?? [];
    if (!list.includes(src)) list.push(src);
    bySource.set(person, list);
  };
  if (layers.public) for (const p of facts.public.letters) add(p, "public");
  if (layers.private) for (const p of facts.private.amongLetters) add(p, "private");
  if (layers.inference) for (const p of mark.in) add(p, "inference");

  const people = [...bySource.entries()]
    .map(([person, sources]) => ({
      person,
      sources: SOURCE_ORDER.filter((s) => sources.includes(s)),
    }))
    .sort((a, b) => a.person.localeCompare(b.person));

  const pub = layers.public ? facts.public.count : undefined;
  const inf = layers.inference ? mark.count ?? undefined : undefined;
  let count: MergedCount | null = null;
  if (pub != null && inf != null) {
    count =
      pub === inf
        ? { value: pub, sources: ["public", "inference"] }
        : { value: pub, sources: ["public"], inferred: inf };
  } else if (pub != null) {
    count = { value: pub, sources: ["public"] };
  } else if (inf != null) {
    count = { value: inf, sources: ["inference"] };
  }

  return {
    people,
    absent: layers.inference ? [...mark.out].sort() : [],
    count,
    conflict: layers.inference ? cellHasConflict(facts.public, facts.private, mark) : false,
  };
}

export function cellHasConflict(
  publicFact: CellPublicFact,
  privateFact: CellPrivateFact,
  mark: CellInference
): boolean {
  const known = new Set([...publicFact.letters, ...privateFact.amongLetters]);
  const present = new Set([...known, ...mark.in]);
  if (mark.out.some((p) => known.has(p))) return true;
  // Opening letters are the complete roster of that cell.
  if (
    publicFact.letters.length > 0 &&
    mark.in.some((p) => !publicFact.letters.includes(p))
  ) {
    return true;
  }
  if (publicFact.count != null) {
    if (mark.count != null && mark.count !== publicFact.count) return true;
    if (present.size > publicFact.count) return true;
  }
  if (mark.count != null && present.size > mark.count) return true;
  return false;
}

export function visitHasConflict(
  publicFact: VisitPublicFact,
  inference: number | null
): boolean {
  if (inference == null || publicFact.count == null) return false;
  return inference !== publicFact.count;
}


/** Cells and visits that already carry a public or private fact take no new pencil marks. */
export function cellHasFacts(facts: CellFactLayers | undefined): boolean {
  if (!facts) return false;
  return (
    facts.public.count != null ||
    facts.public.letters.length > 0 ||
    facts.private.amongLetters.length > 0
  );
}

export function visitHasFacts(facts: VisitFactLayers | undefined): boolean {
  if (!facts) return false;
  return facts.public.count != null || facts.private.amongTimes.length > 0;
}
