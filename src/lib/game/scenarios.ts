import type { ScenarioBundle, ScenarioPublic } from "@/lib/game/types";
import { assertValidBundle } from "@/lib/game/validate";
import {
  bundleFromBankEntry,
  type CaseBankFile,
} from "@/lib/game/generate-case";
import bankJson from "@/data/case-bank/night-tea-bank.json";

const bank = bankJson as CaseBankFile;

const bundles: ScenarioBundle[] = bank.cases.map((entry) => {
  const b = bundleFromBankEntry(entry);
  assertValidBundle(b);
  return b;
});

if (!bundles.length) {
  throw new Error("题库为空");
}

export function listCaseBankMeta() {
  const tiers = [...new Set(bank.cases.map((c) => c.greedySteps))].sort(
    (a, b) => a - b
  );
  const perTier: Record<number, number> = {};
  for (const t of tiers) {
    perTier[t] = bank.cases.filter((c) => c.greedySteps === t).length;
  }
  return {
    family: bank.family,
    title: "夜茶的毒",
    synopsis: bundles[0].public.synopsis,
    selection: bank.selection,
    rationale: bank.rationale,
    tiers,
    perTier,
    total: bank.cases.length,
  };
}

/** One public view per bank entry (答案不在此）。 */
export function listScenariosPublic(): ScenarioPublic[] {
  return bundles.map((b) => b.public);
}

export function listDifficultyTiers(): number[] {
  return listCaseBankMeta().tiers;
}

export function pickScenarioIdForTier(greedyMin: number): string {
  const match = bundles.filter((b) => b.public.greedyMin === greedyMin);
  if (!match.length) {
    throw new Error(`没有难度 ${greedyMin} 问的题`);
  }
  return match[0].public.id;
}

export function getScenarioBundle(id: string): ScenarioBundle | undefined {
  return bundles.find((b) => b.public.id === id);
}

export function getDefaultScenarioId(): string {
  const tiers = listDifficultyTiers();
  return pickScenarioIdForTier(tiers[0]);
}

export function getCaseBank(): CaseBankFile {
  return bank;
}
