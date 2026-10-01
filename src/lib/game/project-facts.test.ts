import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  projectFacts,
  publicLayerOnly,
} from "./project-facts";
import type { PlaceId, PersonId, PrivateClue, QueryLogEntry } from "./types";

const places: PlaceId[] = [
  "porch",
  "hall",
  "stage",
  "dress",
  "gallery",
  "prop",
];
const people: PersonId[] = ["A", "R", "M", "E", "T", "K"];
const opening: Record<PersonId, PlaceId> = {
  A: "hall",
  R: "stage",
  M: "dress",
  E: "prop",
  T: "gallery",
  K: "porch",
};

function q(
  partial: Partial<QueryLogEntry> &
    Pick<QueryLogEntry, "id" | "kind" | "placeId" | "sharedLabel">
): QueryLogEntry {
  return {
    askerId: "p1",
    askerNickname: "测",
    askAgain: false,
    at: 1,
    ...partial,
  };
}

describe("projectFacts", () => {
  it("same public log yields identical public layer with or without private clues", () => {
    const queryLog: QueryLogEntry[] = [
      q({
        id: "q1",
        kind: "place_time",
        placeId: "hall",
        timeId: 3,
        sharedLabel: "x1",
      }),
      q({
        id: "q2",
        kind: "place_person",
        placeId: "gallery",
        personId: "A",
        sharedLabel: "x1",
      }),
    ];
    const privateClues: PrivateClue[] = [
      {
        queryId: "q1",
        privateLabel: "E",
        kind: "place_time",
        placeId: "hall",
        timeId: 3,
      },
      {
        queryId: "q2",
        privateLabel: "4",
        kind: "place_person",
        placeId: "gallery",
        personId: "A",
      },
    ];

    const withPriv = projectFacts({
      opening,
      places,
      people,
      queryLog,
      privateClues,
    });
    const withoutPriv = projectFacts({
      opening,
      places,
      people,
      queryLog,
      privateClues: null,
    });

    assert.deepEqual(
      publicLayerOnly(withPriv),
      publicLayerOnly(withoutPriv)
    );
  });

  it("private marks never appear when privateClues omitted", () => {
    const queryLog: QueryLogEntry[] = [
      q({
        id: "q1",
        kind: "place_time",
        placeId: "hall",
        timeId: 3,
        sharedLabel: "x1",
      }),
    ];
    const proj = projectFacts({
      opening,
      places,
      people,
      queryLog,
      privateClues: undefined,
    });
    const cell = proj.cells["3"]["hall"];
    assert.equal(cell.public.count, 1);
    assert.deepEqual(cell.private.amongLetters, []);
    assert.deepEqual(cell.private.sources, []);
  });

  it("projects opening letters onto time-1 public cells", () => {
    const proj = projectFacts({
      opening,
      places,
      people,
      queryLog: [],
    });
    assert.deepEqual(proj.cells["1"]["hall"].public.letters, ["A"]);
    assert.deepEqual(proj.cells["1"]["stage"].public.letters, ["R"]);
    assert.ok(proj.cells["1"]["hall"].public.sources.includes("opening"));
  });

  it("attaches private among-letter only for matching clue owner view", () => {
    const queryLog: QueryLogEntry[] = [
      q({
        id: "q1",
        kind: "place_time",
        placeId: "hall",
        timeId: 3,
        sharedLabel: "x2",
      }),
    ];
    const askerView = projectFacts({
      opening,
      places,
      people,
      queryLog,
      privateClues: [
        {
          queryId: "q1",
          privateLabel: "E",
          kind: "place_time",
          placeId: "hall",
          timeId: 3,
        },
      ],
    });
    const otherView = projectFacts({
      opening,
      places,
      people,
      queryLog,
      privateClues: [],
    });
    assert.deepEqual(askerView.cells["3"]["hall"].private.amongLetters, ["E"]);
    assert.deepEqual(otherView.cells["3"]["hall"].private.amongLetters, []);
    assert.equal(askerView.cells["3"]["hall"].public.count, 2);
    assert.equal(otherView.cells["3"]["hall"].public.count, 2);
  });

  it("projects place×person visit count and private among-time", () => {
    const queryLog: QueryLogEntry[] = [
      q({
        id: "q2",
        kind: "place_person",
        placeId: "prop",
        personId: "T",
        sharedLabel: "x2",
      }),
    ];
    const proj = projectFacts({
      opening,
      places,
      people,
      queryLog,
      privateClues: [
        {
          queryId: "q2",
          privateLabel: "6",
          kind: "place_person",
          placeId: "prop",
          personId: "T",
        },
      ],
    });
    assert.equal(proj.visits["T"]["prop"].public.count, 2);
    assert.deepEqual(proj.visits["T"]["prop"].private.amongTimes, [6]);
  });
});
