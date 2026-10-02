export type PlaceId =
  | "porch"
  | "hall"
  | "stage"
  | "dress"
  | "gallery"
  | "prop";

export type PersonId = "A" | "R" | "M" | "E" | "T" | "K";

export type TimeId = 1 | 2 | 3 | 4 | 5 | 6;

export type RoomPhase =
  | "lobby"
  | "sealed"
  | "playing"
  | "submit_window"
  | "reveal"
  | "all_eliminated";

export type QueryKind = "place_time" | "place_person";

export interface PersonDef {
  id: PersonId;
  name: string;
  letter: PersonId;
}

export interface PlaceDef {
  id: PlaceId;
  name: string;
}

export interface WinQuestion {
  id: string;
  prompt: string;
  kind: "person" | "place" | "time";
}

export interface SoloBands {
  goldMax: number;
  silverMax: number;
}

/** Machine rule for offline solver / scenario validation (not shown as UI copy). */
export type ScenarioRule =
  | { type: "alone_at_place"; placeId: PlaceId }
  | { type: "alone_with_victim"; victimId: PersonId };

export interface ScenarioPublic {
  id: string;
  title: string;
  subtitle: string;
  synopsis: string;
  places: PlaceDef[];
  people: PersonDef[];
  adjacency: Record<PlaceId, PlaceId[]>;
  /**
   * Time-1 positions visible to all. Partial opening allowed:
   * omitted people are unknown at curtain-up.
   */
  opening: Partial<Record<PersonId, PlaceId>>;
  winQuestions: WinQuestion[];
  soloBands: SoloBands;
  difficulty: number;
  /** Lobby badge, e.g. 「5 问」 */
  tier?: string;
  /** Generator seed (reproducible bank entry) */
  seed?: string;
  /** Greedy min-query difficulty rung */
  greedyMin?: number;
}

export interface ScenarioCase {
  /** position[person][time] = place ; times keyed as "1"…"6" */
  trajectory: Record<PersonId, Record<string, PlaceId>>;
  answers: Record<string, string>;
  /** Offline solver rule matching the synopsis logic */
  rule: ScenarioRule;
}

export interface ScenarioBundle {
  public: ScenarioPublic;
  sealed: ScenarioCase;
}

export interface SharedQueryPayload {
  kind: QueryKind;
  placeId: PlaceId;
  timeId?: TimeId;
  personId?: PersonId;
  sharedLabel: string;
  askAgain: boolean;
}

export interface PrivateQueryPayload {
  privateLabel: string;
}

export interface QueryLogEntry {
  id: string;
  askerId: string;
  askerNickname: string;
  kind: QueryKind;
  placeId: PlaceId;
  timeId?: TimeId;
  personId?: PersonId;
  sharedLabel: string;
  askAgain: boolean;
  at: number;
}

export interface PrivateClue {
  queryId: string;
  privateLabel: string;
  kind: QueryKind;
  placeId: PlaceId;
  timeId?: TimeId;
  personId?: PersonId;
}

export interface PlayerPublic {
  id: string;
  nickname: string;
  seat: number;
  eliminated: boolean;
  connected: boolean;
  isHost: boolean;
  queryCount: number;
}

export interface SubmitAnswer {
  [questionId: string]: string;
}

export interface RoomPublicView {
  code: string;
  phase: RoomPhase;
  scenarioId: string;
  scenario: ScenarioPublic;
  players: PlayerPublic[];
  currentTurnPlayerId: string | null;
  queryLog: QueryLogEntry[];
  queryCountTotal: number;
  submitWindowEndsAt: number | null;
  winners: string[];
  revealAnswers: Record<string, string> | null;
  soloRating: "gold" | "silver" | "copper" | null;
  you: {
    playerId: string;
    privateClues: PrivateClue[];
    notes: string;
    canAct: boolean;
    canSubmit: boolean;
    eliminated: boolean;
  } | null;
}

export interface NotesState {
  text: string;
  updatedAt: number;
}

/** Player-persisted notes: see `notes-format.ts` (v3 structured inference JSON). */
export type { NotesPayloadV3, NotesInference, CellMark } from "./notes-format";
