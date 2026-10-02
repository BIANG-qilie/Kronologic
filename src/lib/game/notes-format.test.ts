import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNotes, serializeNotes, soleTarget } from "./notes-format";

const people = ["A", "R"];
const places = ["hall", "stage"];

describe("notes-format v3", () => {
  it("migrates v1 cells/visits into structured marks", () => {
    const v1 = JSON.stringify({
      version: 1,
      cells: { "3": { hall: "E" } },
      visits: { A: { stage: "2" } },
      free: "memo",
    });
    const parsed = parseNotes(v1, people, places);
    assert.equal(parsed.version, 3);
    assert.deepEqual(parsed.inference.cells["3"]["hall"], { in: ["E"], out: [], count: null });
    assert.equal(parsed.inference.visits["A"]["stage"], 2);
    assert.equal(parsed.free, "memo");
  });

  it("migrates v2 text: letters, a count, and leftovers into the margin", () => {
    const v2 = JSON.stringify({
      version: 2,
      inference: {
        cells: { "2": { stage: "R M 2", hall: "大概 E?" } },
        visits: { R: { hall: "很多" } },
      },
      free: "",
    });
    const parsed = parseNotes(v2, people, places);
    assert.deepEqual(parsed.inference.cells["2"]["stage"], { in: ["R", "M"], out: [], count: 2 });
    assert.deepEqual(parsed.inference.cells["2"]["hall"].in, []);
    assert.match(parsed.free, /大概 E\?/);
    assert.match(parsed.free, /很多/);
    assert.equal(parsed.inference.visits["R"]["hall"], null);
  });

  it("round-trips v3 with the suspect board and drops junk", () => {
    const parsed = parseNotes(undefined, people, places);
    parsed.inference.cells["1"]["hall"] = { in: ["A"], out: ["R"], count: 1 };
    parsed.board.times["4"] = "target";
    parsed.board.people["R"] = "excluded";
    const raw = serializeNotes(parsed);
    assert.ok(!raw.includes("amongLetters"));
    assert.ok(!raw.includes('"public"'));
    const again = parseNotes(raw, people, places);
    assert.deepEqual(again.inference.cells["1"]["hall"], { in: ["A"], out: ["R"], count: 1 });
    assert.equal(again.board.times["4"], "target");
    assert.equal(again.board.people["R"], "excluded");

    const junk = JSON.stringify({
      version: 3,
      inference: { cells: { "1": { hall: { in: ["A", "Z"], out: ["A"], count: 9 } } }, visits: {} },
      board: { times: { "1": "maybe" } },
      free: "",
    });
    const cleaned = parseNotes(junk, people, places);
    assert.deepEqual(cleaned.inference.cells["1"]["hall"], { in: ["A"], out: [], count: null });
    assert.deepEqual(cleaned.board.times, {});
  });

  it("keeps plain text as margin", () => {
    assert.equal(parseNotes("just text", people, places).free, "just text");
  });

  it("soleTarget only answers when exactly one target", () => {
    assert.equal(soleTarget({ "1": "target", "2": "excluded" }), "1");
    assert.equal(soleTarget({ "1": "target", "2": "target" }), null);
    assert.equal(soleTarget({}), null);
  });
});
