import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNotes, serializeNotes } from "./notes-format";

const people = ["A", "R"];
const places = ["hall", "stage"];

describe("notes-format v2", () => {
  it("migrates v1 cells/visits into inference", () => {
    const v1 = JSON.stringify({
      version: 1,
      cells: { "3": { hall: "E" } },
      visits: { A: { stage: "2" } },
      free: "memo",
    });
    const parsed = parseNotes(v1, people, places);
    assert.equal(parsed.version, 2);
    assert.equal(parsed.inference.cells["3"]["hall"], "E");
    assert.equal(parsed.inference.visits["A"]["stage"], "2");
    assert.equal(parsed.free, "memo");
    const round = JSON.parse(serializeNotes(parsed));
    assert.equal(round.version, 2);
    assert.ok(!("cells" in round && round.cells && !round.inference));
    assert.ok(round.inference);
  });

  it("does not persist public/private into serialized notes", () => {
    const parsed = parseNotes(undefined, people, places);
    parsed.inference.cells["1"]["hall"] = "A";
    const raw = serializeNotes(parsed);
    assert.ok(!raw.includes("amongLetters"));
    assert.ok(!raw.includes('"public"'));
    assert.ok(raw.includes('"inference"'));
  });
});
