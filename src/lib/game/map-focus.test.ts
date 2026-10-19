import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { collectMatrixEdges, generateRandomMap } from "./map-generator";
import { edgeKey, focusFrom } from "./map-focus";

// a ⇄ b, a → c (one-way), d → a (one-way), c ⇄ d; c can stay.
const ids = ["a", "b", "c", "d"] as const;
const matrix = [
  [0, 1, 1, 0],
  [1, 0, 0, 0],
  [0, 0, 0, 1],
  [1, 0, 1, 0],
];
const edges = collectMatrixEdges(matrix, ids);
const keyOf = (x: string, y: string) => edgeKey(edges.find((e) => (e.a === x && e.b === y) || (e.a === y && e.b === x))!);

describe("focusFrom", () => {
  it("lights nothing without a focus", () => {
    const f = focusFrom(edges, null, ["c"]);
    assert.equal(f.edges.size, 0);
    assert.equal(f.reachable.size, 0);
    assert.equal(f.canStay, false);
  });

  it("follows one-way passages out of the room only", () => {
    const f = focusFrom(edges, "a");
    assert.deepEqual([...f.reachable].sort(), ["b", "c"]);
    assert.deepEqual([...f.edges].sort(), [keyOf("a", "b"), keyOf("a", "c")].sort());
    assert.ok(!f.edges.has(keyOf("a", "d")), "d → a leads in, not out");
  });

  it("keeps the end of a one-way passage from lighting the way back", () => {
    const f = focusFrom(edges, "c");
    assert.ok(!f.reachable.has("a"), "a → c cannot be walked from c");
    assert.ok(!f.edges.has(keyOf("a", "c")));
    assert.deepEqual([...f.reachable], ["d"]);
  });

  it("lights both ways of a two-way passage", () => {
    assert.ok(focusFrom(edges, "b").reachable.has("a"));
    assert.ok(focusFrom(edges, "a").reachable.has("b"));
    const fd = focusFrom(edges, "d");
    assert.deepEqual([...fd.reachable].sort(), ["a", "c"]);
  });

  it("marks a stay room as its own move, never as its own neighbour", () => {
    const fc = focusFrom(edges, "c", new Set(["c"]));
    assert.equal(fc.canStay, true);
    assert.ok(!fc.reachable.has("c"));
    assert.equal(focusFrom(edges, "a", ["c"]).canStay, false);
  });

  it("matches the matrix row on random maps", () => {
    for (let n = 6; n <= 12; n++) {
      for (let s = 0; s < 6; s++) {
        const map = generateRandomMap(`focus-${n}-${s}`, { nodeCount: n, oneWayCount: Math.ceil(n / 2), stayCount: 2 });
        const es = collectMatrixEdges(map.matrix, map.placeIds);
        map.placeIds.forEach((from, i) => {
          const f = focusFrom(es, from, map.stayIds);
          const row = map.placeIds.filter((to, j) => j !== i && map.matrix[i][j] === 1);
          assert.deepEqual([...f.reachable].sort(), [...row].sort(), `${map.seed} ${from}`);
          assert.equal(f.canStay, map.stayIds.includes(from));
        });
      }
    }
  });
});
