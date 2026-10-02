import type { ScenarioBundle } from "@/lib/game/types";
import { assertValidBundle } from "@/lib/game/validate";
import nightTea from "@/data/scenarios/night-tea-poison.json";

const bundles: ScenarioBundle[] = [nightTea as ScenarioBundle];

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
