import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateCaseForSeed,
  hashSeed,
  mulberry32,
  bundleFromBankEntry,
} from "./generate-case";
import { getCaseBank, listCaseBankMeta, listDifficultyTiers } from "./scenarios";
import { greedyMinQueries, validateWithSolver } from "./solver";

describe("generate-case determinism", () => {
  it("same seed yields identical case id and fingerprint", () => {
    const seed = "unit-det|g5|#0";
    const a = generateCaseForSeed(seed, {
      targetGreedy: 5,
      maxAttempts: 200,
    });
    const b = generateCaseForSeed(seed, {
      targetGreedy: 5,
      maxAttempts: 200,
    });
    assert.ok(a);
    assert.ok(b);
    assert.equal(a!.id, b!.id);
    assert.equal(a!.fingerprint, b!.fingerprint);
    assert.equal(a!.greedySteps, 5);
  });

  it("mulberry32 is deterministic", () => {
    const r1 = mulberry32(hashSeed("abc"));
    const r2 = mulberry32(hashSeed("abc"));
    assert.equal(r1(), r2());
    assert.equal(r1(), r2());
  });
});

describe("case bank", () => {
  it("has ascending difficulty tiers with cases", () => {
    const meta = listCaseBankMeta();
    assert.equal(meta.selection, "pregenerated");
    const tiers = listDifficultyTiers();
    assert.ok(tiers.length >= 2);
    for (let i = 1; i < tiers.length; i++) {
      assert.ok(tiers[i] > tiers[i - 1], "tiers must increase");
    }
    for (const t of tiers) {
      assert.ok((meta.perTier[t] ?? 0) >= 1, `tier ${t} empty`);
    }
  });

  it("every bank entry passes solver and matches greedyMin", () => {
    const bank = getCaseBank();
    for (const entry of bank.cases) {
      const bundle = bundleFromBankEntry(entry);
      const report = validateWithSolver(bundle);
      assert.equal(report.ok, true, `${entry.id}: ${report.errors.join("; ")}`);
      assert.equal(report.greedySteps, entry.greedySteps);
      const { steps } = greedyMinQueries(bundle);
      assert.equal(steps, entry.greedySteps);
    }
  });

  it("adjacent tiers differ in greedy steps", () => {
    const tiers = listDifficultyTiers();
    for (let i = 1; i < tiers.length; i++) {
      assert.equal(tiers[i] - tiers[i - 1] > 0, true);
    }
  });
});
