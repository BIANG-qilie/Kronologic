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

export interface ScenarioPublic {
  id: string;
  title: string;
  subtitle: string;
  synopsis: string;
  places: PlaceDef[];
  people: PersonDef[];
  adjacency: Record<PlaceId, PlaceId[]>;
  /** Time-1 (or published opening) positions visible to all */
  opening: Record<PersonId, PlaceId>;
  winQuestions: WinQuestion[];
  soloBands: SoloBands;
  difficulty: number;
}

export interface ScenarioCase {
  /** position[person][time] = place ; times keyed as "1"…"6" */
  trajectory: Record<PersonId, Record<string, PlaceId>>;
  answers: Record<string, string>;
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
