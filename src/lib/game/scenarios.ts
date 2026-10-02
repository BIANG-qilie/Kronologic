import type { ScenarioBundle } from "@/lib/game/types";
import { assertValidBundle } from "@/lib/game/validate";
import harbor from "@/data/scenarios/harbor-missing-score.json";
import nightTea from "@/data/scenarios/night-tea-poison.json";

/** Default first; harbor kept as 入门. */
const bundles: ScenarioBundle[] = [
  nightTea as ScenarioBundle,
  harbor as ScenarioBundle,
];

for (const b of bundles) {
  assertValidBundle(b);
}

export function listScenariosPublic() {
  return bundles.map((b) => b.public);
}

export function getScenarioBundle(id: string): ScenarioBundle | undefined {
  return bundles.find((b) => b.public.id === id);
}

export function getDefaultScenarioId(): string {
  return bundles[0].public.id;
}
