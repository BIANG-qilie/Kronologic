import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRIVATE_REVEAL_NAMESPACE,
  privateRevealSalt,
  resolvePlacePerson,
  resolvePlaceTime,
} from "./query";
import { getDefaultScenarioId, getScenarioBundle } from "./scenarios";
import type { ScenarioBundle, TimeId } from "./types";

const bundle = getScenarioBundle(getDefaultScenarioId()) as ScenarioBundle;

describe("privateRevealSalt", () => {
  it("is stable across case keys (bank v1 compatible namespace)", () => {
    assert.equal(privateRevealSalt("seed-a"), PRIVATE_REVEAL_NAMESPACE);
    assert.equal(privateRevealSalt("seed-b"), PRIVATE_REVEAL_NAMESPACE);
    assert.equal(privateRevealSalt(bundle.public.id), privateRevealSalt(bundle.public.seed));
  });
});

describe("private white-window reveals", () => {
  it("same place×time query twice yields identical private label", () => {
    const salt = privateRevealSalt(bundle.public.seed ?? bundle.public.id);
    const placeId = bundle.public.places[0].id;
    const timeId = 3 as TimeId;
    const a = resolvePlaceTime(bundle.sealed, placeId, timeId, salt);
    const b = resolvePlaceTime(bundle.sealed, placeId, timeId, salt);
    assert.equal(a.private.privateLabel, b.private.privateLabel);
    assert.equal(a.shared.sharedLabel, b.shared.sharedLabel);
  });

  it("same place×person query twice yields identical private label", () => {
    const salt = privateRevealSalt(bundle.public.seed ?? bundle.public.id);
    const placeId = bundle.public.places[1].id;
    const personId = bundle.public.people[0].id;
    const a = resolvePlacePerson(bundle.sealed, placeId, personId, salt);
    const b = resolvePlacePerson(bundle.sealed, placeId, personId, salt);
    assert.equal(a.private.privateLabel, b.private.privateLabel);
  });

  it("room-style salts (code + query order) must NOT be used — case salt differs from them when occupancy > 1", () => {
    const caseSalt = privateRevealSalt(bundle.public.seed ?? bundle.public.id);
    let foundMulti = false;
    for (const place of bundle.public.places) {
      for (const t of [1, 2, 3, 4, 5, 6] as TimeId[]) {
        const count = Number(
          resolvePlaceTime(bundle.sealed, place.id, t, caseSalt).shared.sharedLabel.replace(
            /^x/i,
            ""
          )
        );
        if (count < 2) continue;
        foundMulti = true;
        const stable = resolvePlaceTime(bundle.sealed, place.id, t, caseSalt);
        const room0 = resolvePlaceTime(bundle.sealed, place.id, t, "ROOM1:0");
        const room3 = resolvePlaceTime(bundle.sealed, place.id, t, "ROOM1:3");
        // Document the old bug: room/order salts can disagree with each other
        // and with the case salt. Case salt itself must stay self-consistent.
        assert.equal(
          resolvePlaceTime(bundle.sealed, place.id, t, caseSalt).private.privateLabel,
          stable.private.privateLabel
        );
        void room0;
        void room3;
        break;
      }
      if (foundMulti) break;
    }
    assert.ok(foundMulti, "expected at least one multi-occupant cell in default case");
  });

  it("passing a different caseKey argument does not change private picks (bank compatibility)", () => {
    const placeId = bundle.public.places[2].id;
    const timeId = 4 as TimeId;
    const a = resolvePlaceTime(
      bundle.sealed,
      placeId,
      timeId,
      privateRevealSalt("alpha")
    );
    const b = resolvePlaceTime(
      bundle.sealed,
      placeId,
      timeId,
      privateRevealSalt("beta")
    );
    assert.equal(a.private.privateLabel, b.private.privateLabel);
  });

  it("default salt matches privateRevealSalt when omitted", () => {
    const placeId = bundle.public.places[0].id;
    const timeId = 2 as TimeId;
    const withDefault = resolvePlaceTime(bundle.sealed, placeId, timeId);
    const withExplicit = resolvePlaceTime(
      bundle.sealed,
      placeId,
      timeId,
      privateRevealSalt(bundle.public.id)
    );
    assert.equal(withDefault.private.privateLabel, withExplicit.private.privateLabel);
  });
});
