import type {
  PlaceId,
  PersonId,
  ScenarioBundle,
  ScenarioPublic,
  SoloBands,
  Trajectory,
  WinQuestion,
} from "./types";
import { levelLabel } from "./levels";

export const NIGHT_TEA_FAMILY = "night-tea-poison";
export const VICTIM_ID: PersonId = "M";

export const NIGHT_TEA_PLACES: ScenarioPublic["places"] = [
  { id: "porch", name: "门廊" },
  { id: "hall", name: "正厅" },
  { id: "stage", name: "舞台" },
  { id: "dress", name: "妆室" },
  { id: "gallery", name: "夹层" },
  { id: "prop", name: "库房" },
];

export const NIGHT_TEA_PEOPLE: ScenarioPublic["people"] = [
  { id: "A", name: "安澄", letter: "A" },
  { id: "R", name: "阮衡", letter: "R" },
  { id: "M", name: "缪舟", letter: "M" },
  { id: "E", name: "鄂岚", letter: "E" },
  { id: "T", name: "唐珀", letter: "T" },
  { id: "K", name: "柯闻", letter: "K" },
];

export const NIGHT_TEA_ADJACENCY: Record<PlaceId, PlaceId[]> = {
  porch: ["hall", "dress"],
  hall: ["porch", "stage", "gallery"],
  stage: ["hall", "prop"],
  dress: ["porch", "gallery"],
  gallery: ["hall", "dress", "prop"],
  prop: ["stage", "gallery"],
};

export const NIGHT_TEA_WIN: WinQuestion[] = [
  { id: "who", prompt: "谁下的毒？", kind: "person" },
  { id: "when", prompt: "何时下的手？", kind: "time" },
  { id: "where", prompt: "在哪个房间？", kind: "place" },
];

export const NIGHT_TEA_SYNOPSIS =
  "散场后，指挥缪舟（M）喝下了一杯毒茶。整晚只有一个人与缪舟单独同处过一室，那人就是下毒者。\n查出：谁、何时、何地。";

export const PLACE_IDS = NIGHT_TEA_PLACES.map((p) => p.id);
export const PERSON_IDS = NIGHT_TEA_PEOPLE.map((p) => p.id);

export function assembleNightTeaBundle(input: {
  id: string;
  level?: number;
  difficulty: number;
  opening: Partial<Record<PersonId, PlaceId>>;
  trajectory: Trajectory;
  answers: Record<string, string>;
  soloBands: SoloBands;
  seed?: string;
  greedyMin?: number;
}): ScenarioBundle {
  return {
    public: {
      id: input.id,
      title: "夜茶的毒",
      subtitle:
        input.level != null ? `星河音乐厅 · 1925 · ${levelLabel(input.level)}` : "星河音乐厅 · 1925",
      synopsis: NIGHT_TEA_SYNOPSIS,
      difficulty: input.difficulty,
      places: NIGHT_TEA_PLACES,
      people: NIGHT_TEA_PEOPLE,
      adjacency: NIGHT_TEA_ADJACENCY,
      opening: input.opening,
      winQuestions: NIGHT_TEA_WIN,
      soloBands: input.soloBands,
      tier: input.level != null ? levelLabel(input.level) : undefined,
      level: input.level,
      seed: input.seed,
      greedyMin: input.greedyMin,
    },
    sealed: {
      rule: { type: "alone_with_victim", victimId: VICTIM_ID },
      trajectory: input.trajectory,
      answers: input.answers,
    },
  };
}
