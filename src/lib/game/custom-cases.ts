import {
  NIGHT_TEA_PEOPLE,
  NIGHT_TEA_SYNOPSIS,
  NIGHT_TEA_WIN,
  VICTIM_ID,
} from "./night-tea-template";
import type { PersonDef, PersonId, PlaceDef, WinQuestion } from "./types";

/**
 * A case a custom level can be built on: the cast, the victim and the copy.
 * The map, opening and night are generated; everything here stays fixed.
 */
export interface CustomCaseDef {
  id: string;
  title: string;
  venue: string;
  year: string;
  /** One line for the picker. */
  blurb: string;
  synopsis: string;
  people: PersonDef[];
  victimId: PersonId;
  winQuestions: WinQuestion[];
  /** Rooms in generator order; the first `nodeCount` are used. */
  places: PlaceDef[];
}

/** Twelve rooms of the concert hall; the first six are the night-tea floor. */
export const CONCERT_HALL_PLACES: PlaceDef[] = [
  { id: "porch", name: "门廊" },
  { id: "hall", name: "正厅" },
  { id: "stage", name: "舞台" },
  { id: "dress", name: "妆室" },
  { id: "gallery", name: "夹层" },
  { id: "prop", name: "库房" },
  { id: "wing", name: "厢房" },
  { id: "bridge", name: "天桥" },
  { id: "pit", name: "乐池" },
  { id: "aisle", name: "侧廊" },
  { id: "attic", name: "阁楼" },
  { id: "backstage", name: "后场" },
];

export const CUSTOM_CASES: CustomCaseDef[] = [
  {
    id: "night-tea",
    title: "夜茶的毒",
    venue: "星河音乐厅",
    year: "1925",
    blurb: "散场后指挥喝下毒茶，唯一与他独处过的人就是凶手。",
    synopsis: NIGHT_TEA_SYNOPSIS,
    people: NIGHT_TEA_PEOPLE,
    victimId: VICTIM_ID,
    winQuestions: NIGHT_TEA_WIN,
    places: CONCERT_HALL_PLACES,
  },
];

export const DEFAULT_CUSTOM_CASE_ID = CUSTOM_CASES[0].id;

export function getCustomCase(id: string): CustomCaseDef | undefined {
  return CUSTOM_CASES.find((c) => c.id === id);
}
