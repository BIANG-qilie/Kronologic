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

/** Row/col of a place in a floor-plan layout, or null if missing. */
export function findLayoutCell<P extends string>(
  layout: readonly (readonly P[])[],
  id: P
): { row: number; col: number } | null {
  for (let row = 0; row < layout.length; row++) {
    const col = layout[row].indexOf(id);
    if (col >= 0) return { row, col };
  }
  return null;
}

/**
 * True when two places share a door track in FloorPlan:
 * same row and neighbouring columns, or same column and neighbouring rows.
 */
export function areLayoutAdjacent<P extends string>(
  layout: readonly (readonly P[])[],
  a: P,
  b: P
): boolean {
  const pa = findLayoutCell(layout, a);
  const pb = findLayoutCell(layout, b);
  if (!pa || !pb) return false;
  const sameRow = pa.row === pb.row && Math.abs(pa.col - pb.col) === 1;
  const sameCol = pa.col === pb.col && Math.abs(pa.row - pb.row) === 1;
  return sameRow || sameCol;
}
