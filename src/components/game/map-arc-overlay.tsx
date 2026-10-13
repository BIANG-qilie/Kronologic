"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { areLayoutAdjacent } from "@/lib/game/board";
import {
  collectNonAdjacentEdges,
  type EdgeKind,
  type NonAdjacentEdge,
} from "@/lib/game/map-generator";
import type { AdjacencyMatrix } from "@/lib/game/trajectory-kernel";
import { cn } from "@/lib/utils";

type Pt = { x: number; y: number };

function roomCenter(
  el: Element,
  origin: DOMRect
): Pt {
  const r = el.getBoundingClientRect();
  return {
    x: r.left - origin.left + r.width / 2,
    y: r.top - origin.top + r.height / 2,
  };
}

/** Quadratic arc that bows away from the straight chord. */
function arcPath(from: Pt, to: Pt, bend: number): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular unit × bend (alternate side via sign of bend)
  const cx = mx + (-dy / len) * bend;
  const cy = my + (dx / len) * bend;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

function bendForEdge(edge: NonAdjacentEdge, index: number, dist: number): number {
  const base = Math.min(48, Math.max(18, dist * 0.28));
  const side = index % 2 === 0 ? 1 : -1;
  const spread = 1 + (index % 5) * 0.08;
  // Prefer bowing "outward" slightly differently per kind so uni/bi don't stack
  const kindBias = edge.kind === "bidirectional" ? 1.05 : 0.95;
  return base * side * spread * kindBias;
}

function strokeForKind(kind: Exclude<EdgeKind, "none">, lit: boolean): string {
  if (kind === "bidirectional") {
    return lit ? "var(--amber)" : "var(--ink-muted)";
  }
  return lit ? "var(--amber)" : "var(--amber-dim)";
}

/**
 * SVG overlay: arcs for matrix edges that are not FloorPlan door-neighbours.
 * Measures `[data-place]` nodes inside `container`.
 */
export function MapArcOverlay({
  container,
  layout,
  placeIds,
  matrix,
  focus = null,
  className,
}: {
  container: HTMLElement | null;
  layout: readonly (readonly string[])[];
  placeIds: readonly string[];
  matrix: AdjacencyMatrix;
  /** When set, arcs touching this place get amber emphasis. */
  focus?: string | null;
  className?: string;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [centers, setCenters] = useState<Record<string, Pt>>({});

  const measure = useCallback(() => {
    if (!container) return;
    const origin = container.getBoundingClientRect();
    const next: Record<string, Pt> = {};
    for (const id of placeIds) {
      const el = container.querySelector(`[data-place="${CSS.escape(id)}"]`);
      if (el) next[id] = roomCenter(el, origin);
    }
    setCenters(next);
    setSize({ w: origin.width, h: origin.height });
  }, [container, placeIds]);

  useEffect(() => {
    if (!container) return;
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    // Re-measure after fonts / layout settle
    const t = window.setTimeout(measure, 50);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [container, measure]);

  const edges = useMemo(
    () =>
      collectNonAdjacentEdges(matrix, placeIds, (a, b) =>
        areLayoutAdjacent(layout, a, b)
      ),
    [matrix, placeIds, layout]
  );

  if (!container || size.w < 8 || size.h < 8 || edges.length === 0) return null;

  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 z-[1] overflow-visible", className)}
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w} ${size.h}`}
      aria-hidden
      data-testid="map-arc-overlay"
    >
      <defs>
        <marker
          id="map-arc-arrow-amber"
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0 0 L7 3.5 L0 7 Z" fill="var(--amber)" />
        </marker>
        <marker
          id="map-arc-arrow-amber-dim"
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0 0 L7 3.5 L0 7 Z" fill="var(--amber-dim)" />
        </marker>
        <marker
          id="map-arc-arrow-ink"
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0 0 L7 3.5 L0 7 Z" fill="var(--ink-muted)" />
        </marker>
        <marker
          id="map-arc-arrow-amber-start"
          markerWidth="7"
          markerHeight="7"
          refX="1"
          refY="3.5"
          orient="auto-start-reverse"
          markerUnits="strokeWidth"
        >
          <path d="M0 0 L7 3.5 L0 7 Z" fill="var(--amber)" />
        </marker>
        <marker
          id="map-arc-arrow-ink-start"
          markerWidth="7"
          markerHeight="7"
          refX="1"
          refY="3.5"
          orient="auto-start-reverse"
          markerUnits="strokeWidth"
        >
          <path d="M0 0 L7 3.5 L0 7 Z" fill="var(--ink-muted)" />
        </marker>
      </defs>
      {edges.map((edge, index) => {
        const pa = centers[edge.a];
        const pb = centers[edge.b];
        if (!pa || !pb) return null;
        // One-way: draw in travel direction so marker-end always points correctly.
        const from = edge.kind === "backward" ? pb : pa;
        const to = edge.kind === "backward" ? pa : pb;
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        if (dist < 4) return null;
        const bend = bendForEdge(edge, index, dist);
        const lit = !!focus && (focus === edge.a || focus === edge.b);
        const oneWay = edge.kind !== "bidirectional";
        const stroke = strokeForKind(edge.kind, lit);
        const amberMarker = lit ? "url(#map-arc-arrow-amber)" : "url(#map-arc-arrow-amber-dim)";
        const inkMarker = lit ? "url(#map-arc-arrow-amber)" : "url(#map-arc-arrow-ink)";
        const inkStart = lit ? "url(#map-arc-arrow-amber-start)" : "url(#map-arc-arrow-ink-start)";

        const markerEnd = oneWay ? amberMarker : inkMarker;
        const markerStart = oneWay ? undefined : inkStart;

        return (
          <path
            key={`${edge.a}|${edge.b}|${edge.kind}`}
            d={arcPath(from, to, bend)}
            fill="none"
            stroke={stroke}
            strokeWidth={oneWay ? 2.25 : 2}
            strokeLinecap="round"
            strokeDasharray={oneWay ? "5 4" : "4 5"}
            opacity={lit ? 0.95 : oneWay ? 0.88 : 0.72}
            markerEnd={markerEnd}
            markerStart={markerStart}
          >
            <title>
              {edge.kind === "bidirectional"
                ? `跨区通道（双向） ${edge.a} ↔ ${edge.b}`
                : edge.kind === "forward"
                  ? `跨区通道（单向） ${edge.a} → ${edge.b}`
                  : `跨区通道（单向） ${edge.b} → ${edge.a}`}
            </title>
          </path>
        );
      })}
    </svg>
  );
}
