import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bandsFromGreedy,
  enumeratePaths,
  findConsistentAnswers,
  greedyMinQueries,
  observationsFromSealed,
  validateWithSolver,
} from "./solver";
import type { ScenarioBundle } from "./types";
import night from "@/data/scenarios/night-tea-poison.json";

const nightBundle = night as ScenarioBundle;

describe("enumeratePaths", () => {
  it("never stays in the same room and respects adjacency", () => {
    const adj = nightBundle.public.adjacency;
    const paths = enumeratePaths(adj, "hall");
    assert.ok(paths.length > 10);
    for (const path of paths) {
      assert.equal(path.length, 6);
      assert.equal(path[0], "hall");
      for (let i = 1; i < 6; i++) {
        assert.notEqual(path[i], path[i - 1]);
        assert.ok(adj[path[i - 1]].includes(path[i]));
      }
    }
  });
});

describe("night-tea-poison solver", () => {
  it("opening + rule leaves multiple answers", () => {
    const answers = findConsistentAnswers(nightBundle, [], {
      limitAnswers: 20,
    });
    assert.ok(answers.length > 1);
  });

  it("full query results uniquely recover sealed answers", () => {
    const answers = findConsistentAnswers(
      nightBundle,
      observationsFromSealed(nightBundle),
      { limitAnswers: 5 }
    );
    assert.equal(answers.length, 1);
    assert.equal(answers[0].who, nightBundle.sealed.answers.who);
    assert.equal(answers[0].where, nightBundle.sealed.answers.where);
    assert.equal(answers[0].when, String(nightBundle.sealed.answers.when));
  });

  it("greedy bands match soloBands and pass validateWithSolver", () => {
    const { steps } = greedyMinQueries(nightBundle);
    const bands = bandsFromGreedy(steps);
    assert.equal(bands.goldMax, nightBundle.public.soloBands.goldMax);
    assert.equal(bands.silverMax, nightBundle.public.soloBands.silverMax);
    const report = validateWithSolver(nightBundle);
    assert.equal(report.ok, true, report.errors.join("; "));
  });

  it("no single place_time query locks the relational case", () => {
    const sample = observationsFromSealed(nightBundle).filter(
      (o) => o.kind === "place_time"
    );
    for (const obs of sample) {
      const left = findConsistentAnswers(nightBundle, [obs], {
        limitAnswers: 6,
        samples: 4000,
      });
      assert.ok(
        left.length > 1,
        `single lock via ${obs.placeId}@${obs.timeId}`
      );
    }
  });
});
