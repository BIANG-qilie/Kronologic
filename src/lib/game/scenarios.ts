import type { ScenarioBundle, ScenarioPublic } from "@/lib/game/types";
import { assertValidBundle } from "@/lib/game/validate";
import {
  bundleFromBankEntry,
  type CaseBankFile,
} from "@/lib/game/generate-case";
import { orderByDifficulty, type LevelInfo } from "@/lib/game/levels";
import bankJson from "@/data/case-bank/night-tea-bank.json";

const bank = bankJson as CaseBankFile;

const bundles: ScenarioBundle[] = orderByDifficulty(bank.cases).map((entry, i) => {
  const b = bundleFromBankEntry(entry, i + 1);
  assertValidBundle(b);
  return b;
});

if (!bundles.length) {
  throw new Error("题库为空");
}

export function listLevels(): LevelInfo[] {
  return bundles.map((b) => ({ level: b.public.level!, greedyMin: b.public.greedyMin! }));
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
    levels: listLevels(),
    total: bank.cases.length,
  };
}

/** One public view per level, in level order (答案不在此）。 */
export function listScenariosPublic(): ScenarioPublic[] {
  return bundles.map((b) => b.public);
}

export function listDifficultyTiers(): number[] {
  return listCaseBankMeta().tiers;
}

export function pickScenarioIdForLevel(level: number): string {
  const match = bundles.find((b) => b.public.level === level);
  if (!match) throw new Error(`没有第 ${level} 关`);
  return match.public.id;
}

export function pickScenarioIdForTier(greedyMin: number): string {
  const match = bundles.find((b) => b.public.greedyMin === greedyMin);
  if (!match) throw new Error(`没有最少 ${greedyMin} 问的关卡`);
  return match.public.id;
}

export function getScenarioBundle(id: string): ScenarioBundle | undefined {
  return bundles.find((b) => b.public.id === id);
}

export function getDefaultScenarioId(): string {
  return bundles[0].public.id;
}

export function getCaseBank(): CaseBankFile {
  return bank;
}
