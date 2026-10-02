/**
 * Offline batch: generate night-tea case bank by greedy-step tiers.
 * Usage: npx tsx scripts/generate-case-bank.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  generateCaseForSeed,
  type CaseBankFile,
} from "../src/lib/game/generate-case";
import { NIGHT_TEA_FAMILY } from "../src/lib/game/night-tea-template";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(
  __dirname,
  "../src/data/case-bank/night-tea-bank.json"
);

const TIERS = [5, 6, 7, 8, 9];
const PER_TIER = 3;
const MASTER = "lampxu-night-tea-bank-v1";

async function main() {
  const seen = new Set<string>();
  const cases: CaseBankFile["cases"] = [];
  const tierCounts: Record<number, number> = {};

  for (const tier of TIERS) {
    tierCounts[tier] = 0;
    let slot = 0;
    let guard = 0;
    while (tierCounts[tier] < PER_TIER && guard < PER_TIER * 80) {
      guard++;
      const seed = `${MASTER}|g${tier}|#${slot}`;
      slot++;
      const t0 = Date.now();
      const got = generateCaseForSeed(seed, {
        targetGreedy: tier,
        maxAttempts: 500,
        seenFingerprints: seen,
      });
      const ms = Date.now() - t0;
      if (!got) {
        console.error(`miss tier=${tier} seed=${seed} (${ms}ms)`);
        continue;
      }
      console.log(
        `ok tier=${tier} id=${got.id} seed=${got.seed} (${ms}ms)`
      );
      cases.push({
        id: got.id,
        seed: got.seed,
        greedySteps: got.greedySteps,
        fingerprint: got.fingerprint,
        opening: got.bundle.public.opening,
        trajectory: got.bundle.sealed.trajectory,
        answers: got.bundle.sealed.answers,
        soloBands: got.bundle.public.soloBands,
      });
      tierCounts[tier]++;
    }
  }

  const bank: CaseBankFile = {
    family: NIGHT_TEA_FAMILY,
    generatedAt: new Date().toISOString(),
    selection: "pregenerated",
    rationale:
      "求解校验（开场多解/全信息唯一/贪心步数/单题锁）单次常需数百毫秒且失败需重试，开房即时生成无法在 1 秒内稳定命中目标难度；故离线预生成题库，开房只选题。",
    tiers: TIERS.filter((t) => (tierCounts[t] ?? 0) > 0),
    cases,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(bank, null, 2) + "\n");
  console.log("wrote", outPath);
  console.log("tierCounts", tierCounts);
  console.log("total", cases.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
