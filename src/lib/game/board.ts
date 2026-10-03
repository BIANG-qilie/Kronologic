import type { PlaceId, ScenarioPublic, TimeId } from "./types";

export const DEFAULT_TIME_COUNT = 6;

export const DEFAULT_LAYOUT: PlaceId[][] = [
  ["porch", "hall", "stage"],
  ["dress", "gallery", "prop"],
];

export function timesOf(scenario: Pick<ScenarioPublic, "timeCount">): TimeId[] {
  const n = scenario.timeCount ?? DEFAULT_TIME_COUNT;
  return Array.from({ length: n }, (_, i) => (i + 1) as TimeId);
}

export function layoutOf(scenario: Pick<ScenarioPublic, "layout">): PlaceId[][] {
  return scenario.layout?.length ? scenario.layout : DEFAULT_LAYOUT;
}

/** Places in reading order of the floor plan. */
export function placeOrder(scenario: Pick<ScenarioPublic, "layout">): PlaceId[] {
  return layoutOf(scenario).flat();
}
