import type { MatrixEdge } from "./map-generator";

export type MapFocus = {
  /** Keys (`a|b|kind`) of edges you can leave the focused room by. */
  edges: Set<string>;
  /** Rooms one move away from the focused room (never the room itself). */
  reachable: Set<string>;
  /** The focused room lets you stay put for a turn. */
  canStay: boolean;
};

export function edgeKey(e: MatrixEdge): string {
  return `${e.a}|${e.b}|${e.kind}`;
}

/** Where the edge leads from `from`, or null when it cannot be walked that way. */
export function edgeTargetFrom(e: MatrixEdge, from: string): string | null {
  if (e.a === from && (e.kind === "bidirectional" || e.kind === "forward")) return e.b;
  if (e.b === from && (e.kind === "bidirectional" || e.kind === "backward")) return e.a;
  return null;
}

/**
 * What hovering or selecting a room lights up: only moves out of it
 * (`matrix[from][to]`), so a one-way passage into the room stays dark.
 */
export function focusFrom(
  edges: readonly MatrixEdge[],
  focus: string | null,
  stayIds: ReadonlySet<string> | readonly string[] = []
): MapFocus {
  const out: MapFocus = { edges: new Set(), reachable: new Set(), canStay: false };
  if (!focus) return out;
  const stays = stayIds instanceof Set ? stayIds : new Set(stayIds as readonly string[]);
  out.canStay = stays.has(focus);
  for (const e of edges) {
    const to = edgeTargetFrom(e, focus);
    if (to === null || to === focus) continue;
    out.edges.add(edgeKey(e));
    out.reachable.add(to);
  }
  return out;
}
