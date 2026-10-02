import type {
  PlaceId,
  PersonId,
  ScenarioBundle,
  ScenarioPublic,
  SoloBands,
  WinQuestion,
} from "./types";

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
  { id: "where", prompt: "在哪里下手？", kind: "place" },
  { id: "when", prompt: "在哪个时间下手？", kind: "time" },
];

export const NIGHT_TEA_SYNOPSIS =
  "指挥缪舟当晚只与一个人单独同处过一个房间，那个人就是下毒者。找出是谁、在哪个时间、在哪里下的手。";

export const PLACE_IDS = NIGHT_TEA_PLACES.map((p) => p.id);
export const PERSON_IDS = NIGHT_TEA_PEOPLE.map((p) => p.id);

export function assembleNightTeaBundle(input: {
  id: string;
  subtitle?: string;
  difficulty: number;
  opening: Partial<Record<PersonId, PlaceId>>;
  trajectory: Record<PersonId, Record<string, PlaceId>>;
  answers: Record<string, string>;
  soloBands: SoloBands;
  seed?: string;
  greedyMin?: number;
}): ScenarioBundle {
  return {
    public: {
      id: input.id,
      title: "夜茶的毒",
      subtitle: input.subtitle ?? "星河音乐厅 · 1925",
      synopsis: NIGHT_TEA_SYNOPSIS,
      difficulty: input.difficulty,
      places: NIGHT_TEA_PLACES,
      people: NIGHT_TEA_PEOPLE,
      adjacency: NIGHT_TEA_ADJACENCY,
      opening: input.opening,
      winQuestions: NIGHT_TEA_WIN,
      soloBands: input.soloBands,
      tier: input.greedyMin != null ? `${input.greedyMin} 问` : undefined,
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
