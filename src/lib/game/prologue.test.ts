import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PROLOGUE, PROLOGUE_LEVEL } from "./prologue";
import { timesOf, placeOrder } from "./board";
import { peopleAt, validateTrajectory } from "./validate";
import { resolvePlacePerson, resolvePlaceTime } from "./query";
import { emptyNotesV3 } from "./notes-format";
import { listLevels, listScenariosPublic, getScenarioBundle } from "./scenarios";
import {
  askFocus,
  beatAt,
  beatDone,
  FIRST_BEAT,
  judgeAnswer,
  MAX_HINTS,
  nextBeat,
  TUTORIAL_STEPS,
  type AskBeat,
  type BeatRef,
  type MarkBeat,
} from "./tutorial-script";
import type { PersonId, PlaceId, QueryLogEntry, QueryTarget, TimeId } from "./types";

const pub = PROLOGUE.public;
const sealed = PROLOGUE.sealed;
const times = timesOf(pub);
const people = pub.people.map((p) => p.id);
const places = pub.places.map((p) => p.id);

function resolve(q: QueryTarget) {
  return q.kind === "place_time"
    ? resolvePlaceTime(sealed, q.placeId, q.timeId!)
    : resolvePlacePerson(sealed, q.placeId, q.personId!);
}

describe("prologue case", () => {
  it("is a 3 × 3 × 3 board that follows the movement rule", () => {
    assert.equal(times.length, 3);
    assert.equal(places.length, 3);
    assert.equal(people.length, 3);
    assert.deepEqual(validateTrajectory(pub, sealed), []);
    assert.deepEqual(placeOrder(pub), ["hall", "stage", "dress"]);
  });

  it("has exactly one moment where someone is alone in the dressing room, and it is the answer", () => {
    const alone = times
      .map((t) => ({ t, here: peopleAt(sealed, t, "dress") }))
      .filter((x) => x.here.length === 1);
    assert.equal(alone.length, 1);
    assert.equal(alone[0].here[0], sealed.answers.who);
    assert.equal(String(alone[0].t), sealed.answers.when);
    assert.deepEqual(sealed.rule, { type: "alone_at_place", placeId: "dress" });
  });

  it("stays out of the case bank and the level list", () => {
    assert.equal(PROLOGUE_LEVEL, 0);
    assert.ok(!listScenariosPublic().some((s) => s.id === pub.id));
    assert.ok(!listLevels().some((l) => l.level === PROLOGUE_LEVEL));
    assert.equal(getScenarioBundle(pub.id), undefined);
  });
});

describe("tutorial script", () => {
  const asks = TUTORIAL_STEPS.flatMap((s) => s.beats).filter((b): b is AskBeat => b.kind === "ask");
  const marks = TUTORIAL_STEPS.flatMap((s) => s.beats).filter((b): b is MarkBeat => b.kind === "mark");

  it("has six steps and walks every beat in order", () => {
    assert.equal(TUTORIAL_STEPS.length, 6);
    let ref: BeatRef | null = FIRST_BEAT;
    let n = 0;
    while (ref) {
      assert.ok(beatAt(ref));
      ref = nextBeat(ref);
      n++;
    }
    assert.equal(n, TUTORIAL_STEPS.reduce((sum, s) => sum + s.beats.length, 0));
    assert.equal(beatAt({ step: 5, beat: 0 }).kind, "submit");
  });

  it("gets the clues the copy promises", () => {
    const [dress2, hallP, dressP] = asks.map((b) => resolve(b.ask));
    assert.equal(dress2.shared.sharedLabel, "x1");
    assert.equal(dress2.private.privateLabel, "P");
    assert.equal(hallP.shared.sharedLabel, "x0");
    assert.equal(hallP.shared.askAgain, true, "white window must be empty to show 不计次");
    assert.equal(dressP.shared.sharedLabel, "x1");
    assert.equal(dressP.private.privateLabel, "2");
  });

  it("only asks for pencil marks that are true", () => {
    for (const m of marks) {
      const here = peopleAt(sealed, m.cell.time, m.cell.place).includes(m.person);
      assert.equal(here, m.state === "in", m.id);
    }
  });

  it("only highlights times on the timeline", () => {
    for (const b of TUTORIAL_STEPS.flatMap((s) => s.beats)) {
      if (b.kind === "read" && b.focusTime) assert.ok(times.includes(b.focusTime), b.id);
      if (b.kind === "mark") assert.ok(times.includes(b.cell.time), b.id);
    }
  });

  it("marks beats done from the log and the notes", () => {
    const log: QueryLogEntry[] = [];
    const notes = emptyNotesV3(people, places, times);
    assert.equal(beatDone(asks[0], { queryLog: log, notes }), false);
    log.push({ id: "q1", askerId: "you", askerNickname: "你", ...asks[0].ask, sharedLabel: "x1", askAgain: false, at: 0 });
    assert.equal(beatDone(asks[0], { queryLog: log, notes }), true);

    const m = marks[0];
    assert.equal(beatDone(m, { queryLog: log, notes }), false);
    notes.inference.cells[String(m.cell.time)][m.cell.place][m.state].push(m.person);
    assert.equal(beatDone(m, { queryLog: log, notes }), true);
  });

  it("lights up the next missing part of a question", () => {
    const ask: QueryTarget = { kind: "place_person", placeId: "hall", personId: "P" };
    assert.equal(askFocus(ask, null), "kind");
    assert.equal(askFocus(ask, { kind: "place_time", placeId: null, timeId: null, personId: null }), "kind");
    assert.equal(askFocus(ask, { kind: "place_person", placeId: null, timeId: null, personId: null }), "place");
    assert.equal(askFocus(ask, { kind: "place_person", placeId: "hall", timeId: null, personId: null }), "detail");
    assert.equal(askFocus(ask, { kind: "place_person", placeId: "hall", timeId: null, personId: "P" }), "send");
  });

  it("gives at most two hints, then the answer", () => {
    assert.equal(MAX_HINTS, 2);
    assert.equal(judgeAnswer("when", "2", "2", 0).type, "correct");
    const first = judgeAnswer("when", "2", "1", 0);
    assert.equal(first.type, "hint");
    assert.match(first.text, /时间 2 的绿窗人数/);
    assert.equal(judgeAnswer("when", "2", "3", 1).type, "hint");
    assert.equal(judgeAnswer("when", "2", "1", 2).type, "reveal");
    assert.equal(judgeAnswer("who", "P", "A", 2).type, "reveal");
  });

  it("leaves exactly one answer once the tutorial's clues and the movement rule are applied", () => {
    const clues = asks.map((b) => ({ q: b.ask, ...resolve(b.ask) }));
    const adj = pub.adjacency;
    const paths = (start: PlaceId | undefined): PlaceId[][] => {
      let out: PlaceId[][] = (start ? [start] : places).map((p) => [p]);
      for (let i = 1; i < times.length; i++) {
        out = out.flatMap((path) => (adj[path[i - 1]] ?? []).map((next) => [...path, next]));
      }
      return out;
    };
    const pools = people.map((p) => paths(pub.opening[p]));
    const answers = new Set<string>();
    for (const a of pools[0]) {
      for (const b of pools[1]) {
        for (const c of pools[2]) {
          const world: Record<string, PlaceId[]> = { [people[0]]: a, [people[1]]: b, [people[2]]: c };
          const at = (t: TimeId, place: PlaceId) => people.filter((p) => world[p][t - 1] === place);
          const visits = (person: PersonId, place: PlaceId) =>
            times.filter((t) => world[person][t - 1] === place);
          const fits = clues.every(({ q, shared, private: priv }) => {
            if (q.kind === "place_time") {
              const here = at(q.timeId!, q.placeId);
              return `x${here.length}` === shared.sharedLabel && (priv.privateLabel === "—" || here.includes(priv.privateLabel as PersonId));
            }
            const v = visits(q.personId!, q.placeId);
            return `x${v.length}` === shared.sharedLabel && (priv.privateLabel === "—" || v.includes(Number(priv.privateLabel) as TimeId));
          });
          if (!fits) continue;
          const alone = times.flatMap((t) => (at(t, "dress").length === 1 ? [`${at(t, "dress")[0]}@${t}`] : []));
          if (alone.length !== 1) continue;
          answers.add(alone[0]);
        }
      }
    }
    assert.deepEqual([...answers], [`${sealed.answers.who}@${sealed.answers.when}`]);
  });
});
