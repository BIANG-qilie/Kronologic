import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOM_DIFFICULTIES,
  CUSTOM_NODE_DEFAULT,
  CustomLevelAborted,
  CustomLevelError,
  CustomLevelExhausted,
  buildCustomMap,
  customInputFromQuery,
  customLevelId,
  customRequestToQuery,
  generateCustomLevel,
  generateCustomLevelAsync,
  getCustomDifficulty,
  parseCustomRequest,
  type CustomLevelInput,
} from "./custom-level";
import { findConsistentAnswers, greedyMinQueries, validateWithSolver } from "./solver";
import { assertValidBundle } from "./validate";
import type { CustomLevelRequest } from "./types";

function rejects(input: CustomLevelInput, field: keyof CustomLevelRequest) {
  assert.throws(
    () => parseCustomRequest(input),
    (e: unknown) => e instanceof CustomLevelError && e.field === field && /[\u4e00-\u9fff]/.test(e.message)
  );
}

function oneWayPairs(m: number[][]): number {
  let k = 0;
  for (let i = 0; i < m.length; i++)
    for (let j = i + 1; j < m.length; j++) if (m[i][j] !== m[j][i]) k++;
  return k;
}

describe("parseCustomRequest", () => {
  it("fills defaults", () => {
    const req = parseCustomRequest({ seed: "ABC" });
    assert.equal(req.caseId, "night-tea");
    assert.equal(req.nodeCount, CUSTOM_NODE_DEFAULT);
    assert.equal(req.difficulty, "normal");
    assert.equal(req.oneWay, false);
    assert.equal(req.stay, false);
    assert.equal(req.seed, "ABC");
  });

  it("rolls a seed when none is given", () => {
    assert.match(parseCustomRequest({}).seed, /^[A-Z0-9]{6}$/);
  });

  it("rejects node counts outside 6–12 or not whole", () => {
    rejects({ nodeCount: 5 }, "nodeCount");
    rejects({ nodeCount: 13 }, "nodeCount");
    rejects({ nodeCount: 7.5 }, "nodeCount");
    rejects({ nodeCount: "七" }, "nodeCount");
    assert.equal(parseCustomRequest({ nodeCount: "12", seed: "x" }).nodeCount, 12);
  });

  it("checks the one-way count only when one-way is on", () => {
    rejects({ oneWay: true, oneWayCount: 0 }, "oneWayCount");
    rejects({ nodeCount: 6, oneWay: true, oneWayCount: 7 }, "oneWayCount");
    rejects({ oneWay: true, oneWayCount: "两" }, "oneWayCount");
    assert.equal(parseCustomRequest({ oneWay: true, oneWayCount: "", seed: "x" }).oneWayCount, null);
    assert.equal(parseCustomRequest({ oneWay: false, oneWayCount: 99, seed: "x" }).oneWayCount, null);
  });

  it("checks the stay count", () => {
    rejects({ stay: true, stayCount: 0 }, "stayCount");
    rejects({ nodeCount: 8, stay: true, stayCount: 9 }, "stayCount");
    assert.equal(parseCustomRequest({ nodeCount: 8, stay: true, stayCount: 8, seed: "x" }).stayCount, 8);
  });

  it("rejects unknown cases, difficulties and bad seeds", () => {
    rejects({ caseId: "nope" }, "caseId");
    rejects({ difficulty: "insane" }, "difficulty");
    rejects({ seed: "a".repeat(33) }, "seed");
    rejects({ seed: "有 空格" }, "seed");
    assert.equal(parseCustomRequest({ seed: "夜茶-01#a" }).seed, "夜茶-01#a");
  });
});

describe("buildCustomMap", () => {
  it("resolves random counts inside the range, the same way every time", () => {
    for (let i = 0; i < 20; i++) {
      const req = parseCustomRequest({ nodeCount: 6 + (i % 7), oneWay: true, stay: true, seed: `R${i}` });
      const a = buildCustomMap(req);
      const b = buildCustomMap(req);
      assert.deepEqual(a, b);
      const hi = Math.ceil(req.nodeCount * 0.35);
      assert.ok(a.oneWayCount >= 1 && a.oneWayCount <= hi, `oneWay ${a.oneWayCount}`);
      assert.ok(a.stayCount >= 1 && a.stayCount <= hi, `stay ${a.stayCount}`);
    }
  });

  it("honours an exact one-way count and stay count", () => {
    for (const [n, k, s] of [
      [6, 3, 2],
      [9, 5, 1],
      [12, 12, 4],
    ]) {
      const map = buildCustomMap(
        parseCustomRequest({ nodeCount: n, oneWay: true, oneWayCount: k, stay: true, stayCount: s, seed: `E${n}` })
      );
      assert.equal(map.placeIds.length, n);
      assert.equal(oneWayPairs(map.matrix), k);
      assert.equal(map.oneWayCount, k);
      assert.equal(map.stayIds.length, s);
      map.placeIds.forEach((id, i) => assert.equal(map.matrix[i][i] === 1, map.stayIds.includes(id)));
    }
  });

  it("keeps passages two-way and rooms stay-free when both options are off", () => {
    const map = buildCustomMap(parseCustomRequest({ nodeCount: 10, seed: "OFF" }));
    assert.equal(oneWayPairs(map.matrix), 0);
    assert.deepEqual(map.stayIds, []);
  });
});

describe("generateCustomLevel", () => {
  it("is deterministic and passes the solver gates", () => {
    const req = parseCustomRequest({ nodeCount: 6, difficulty: "easy", oneWay: true, stay: true, seed: "T2" });
    const a = generateCustomLevel(req);
    const b = generateCustomLevel(req);
    assert.deepEqual(a.bundle, b.bundle);
    assert.equal(a.bundle.public.id, customLevelId(req));
    assertValidBundle(a.bundle);
    const report = validateWithSolver(a.bundle);
    assert.ok(report.ok, report.errors.join("; "));
    assert.deepEqual(a.bundle.public.custom?.request, req);
  });

  for (const c of [
    { nodeCount: 6, difficulty: "normal", oneWay: true, stay: false, seed: "T1" },
    { nodeCount: 7, difficulty: "hard", stay: true, stayCount: 2, seed: "T3" },
    { nodeCount: 8, difficulty: "normal", oneWay: true, oneWayCount: 2, stay: true, seed: "T3" },
    { nodeCount: 6, difficulty: "expert", oneWay: true, stay: true, seed: "T1" },
  ] as const) {
    it(`lands inside the ${c.difficulty} band on ${c.nodeCount} rooms (${c.seed})`, () => {
      const req = parseCustomRequest(c);
      const band = getCustomDifficulty(req.difficulty)!;
      const { bundle, steps } = generateCustomLevel(req);
      assert.ok(steps >= band.min && steps <= band.max, `steps ${steps} not in ${band.min}–${band.max}`);
      assert.equal(bundle.public.greedyMin, steps);
      assertValidBundle(bundle);

      assert.ok(findConsistentAnswers(bundle, []).length > 1, "opening must not already give the answer away");
      assert.equal(greedyMinQueries(bundle).steps, steps);
      assert.ok(validateWithSolver(bundle).ok);

      const meta = bundle.public.custom!;
      assert.equal(bundle.public.places.length, req.nodeCount);
      assert.equal(meta.matrix.length, req.nodeCount);
      for (const id of meta.stayIds) assert.ok(bundle.public.adjacency[id]?.includes(id));
      if (req.oneWayCount != null) assert.equal(oneWayPairs(meta.matrix), req.oneWayCount);
    });
  }

  it("covers every difficulty band without gaps", () => {
    for (let i = 1; i < CUSTOM_DIFFICULTIES.length; i++) {
      assert.equal(CUSTOM_DIFFICULTIES[i].min, CUSTOM_DIFFICULTIES[i - 1].max + 1);
    }
  });

  it("fails with a retryable error when the budget runs out", async () => {
    const req = parseCustomRequest({ difficulty: "expert", seed: "NOPE" });
    assert.throws(
      () => generateCustomLevel(req, { deadlineMs: 0 }),
      (e: unknown) => e instanceof CustomLevelExhausted && e.retryable && e.field === "difficulty"
    );
    await assert.rejects(
      generateCustomLevelAsync(req, { screensPerMap: 1, maxMaps: 1, deadlineMs: 0 }),
      (e: unknown) => e instanceof CustomLevelError && e.retryable
    );
  });
});

describe("custom level links", () => {
  it("round-trips through the query string", () => {
    for (const input of [
      { nodeCount: 9, oneWay: true, oneWayCount: 3, stay: true, difficulty: "hard", seed: "夜茶" },
      { nodeCount: 6, oneWay: true, stay: false, difficulty: "easy", seed: "A1" },
      { nodeCount: 12, oneWay: false, stay: true, stayCount: null, difficulty: "expert", seed: "x.y" },
    ]) {
      const req = parseCustomRequest(input);
      assert.deepEqual(parseCustomRequest(customInputFromQuery(customRequestToQuery(req))), req);
    }
  });

  it("drops the seed for a fresh roll", () => {
    const req = parseCustomRequest({ seed: "KEEP" });
    assert.ok(!customRequestToQuery(req, false).includes("KEEP"));
  });
});

describe("cancelling generation", () => {
  const slow = parseCustomRequest({ nodeCount: 6, difficulty: "expert", oneWay: true, stay: true, seed: "T3" });

  it("refuses to start with an aborted signal", async () => {
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(generateCustomLevelAsync(slow, { signal: ac.signal }), (e: unknown) => e instanceof CustomLevelAborted);
  });

  it("stops mid-search, keeps the event loop free and does no more work", async () => {
    const ac = new AbortController();
    let screens = 0;
    let ticks = 0;
    const ticker = setInterval(() => ticks++, 1);
    const run = generateCustomLevelAsync(slow, { signal: ac.signal, onScreen: () => screens++ });
    await new Promise((r) => setTimeout(r, 250));
    const abortedAt = Date.now();
    ac.abort();
    await assert.rejects(run, (e: unknown) => e instanceof CustomLevelAborted && !e.retryable);
    const lag = Date.now() - abortedAt;
    clearInterval(ticker);
    assert.ok(lag < 2000, `took ${lag}ms to stop`);
    assert.ok(ticks > 5, `event loop starved (${ticks} ticks)`);
    const after = screens;
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(screens, after);
  });
});
