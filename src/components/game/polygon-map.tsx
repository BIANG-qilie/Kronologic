"use client";

import { useMemo, useState } from "react";
import {
  collectMatrixEdges,
  polygonVertexPositions,
  type EdgeKind,
  type MatrixEdge,
} from "@/lib/game/map-generator";
import type { AdjacencyMatrix } from "@/lib/game/trajectory-kernel";
import { cn } from "@/lib/utils";
import { StayMark } from "./map-passage";

type Pt = { x: number; y: number };

/** ViewBox units — square canvas; nodes sit on a circle of this radius. */
const VB = 1000;
const CX = VB / 2;
const CY = VB / 2;
/** Ring radius as fraction of half-canvas; leave margin for labels. */
const RING = 0.34;

function strokeForKind(kind: Exclude<EdgeKind, "none">, lit: boolean): string {
  if (kind === "bidirectional") {
    return lit ? "var(--amber)" : "var(--ink-muted)";
  }
  return lit ? "var(--amber)" : "var(--amber-dim)";
}

/**
 * Slight outward quadratic: control point past the chord midpoint,
 * away from the polygon centre so edges hug the ring rather than the hub.
 */
function outwardArc(from: Pt, to: Pt, center: Pt, bendFrac = 0.18): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const ox = mx - center.x;
  const oy = my - center.y;
  const olen = Math.hypot(ox, oy) || 1;
  const chord = Math.hypot(to.x - from.x, to.y - from.y);
  const bend = chord * bendFrac;
  const cx = mx + (ox / olen) * bend;
  const cy = my + (oy / olen) * bend;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

function nodeRadiusPx(n: number): number {
  // Larger touch targets when few nodes; shrink glyphs as n grows.
  if (n <= 6) return 54;
  if (n <= 8) return 48;
  if (n <= 10) return 42;
  return 38;
}

function PolygonEdges({
  edges,
  positions,
  focus,
  markerPrefix,
}: {
  edges: MatrixEdge[];
  positions: Record<string, Pt>;
  focus: string | null;
  markerPrefix: string;
}) {
  const center = { x: CX, y: CY };
  return (
    <>
      {edges.map((edge, index) => {
        const pa = positions[edge.a];
        const pb = positions[edge.b];
        if (!pa || !pb) return null;
        const from = edge.kind === "backward" ? pb : pa;
        const to = edge.kind === "backward" ? pa : pb;
        const lit = !!focus && (focus === edge.a || focus === edge.b);
        const oneWay = edge.kind !== "bidirectional";
        const stroke = strokeForKind(edge.kind, lit);
        const bend = 0.14 + (index % 3) * 0.02;
        const amberEnd = lit
          ? `url(#${markerPrefix}-arrow-amber)`
          : `url(#${markerPrefix}-arrow-amber-dim)`;
        const inkEnd = lit
          ? `url(#${markerPrefix}-arrow-amber)`
          : `url(#${markerPrefix}-arrow-ink)`;
        const inkStart = lit
          ? `url(#${markerPrefix}-arrow-amber-start)`
          : `url(#${markerPrefix}-arrow-ink-start)`;

        return (
          <path
            key={`${edge.a}|${edge.b}|${edge.kind}`}
            d={outwardArc(from, to, center, bend)}
            fill="none"
            stroke={stroke}
            strokeWidth={oneWay ? 3.2 : 2.8}
            strokeLinecap="round"
            opacity={lit ? 0.96 : oneWay ? 0.9 : 0.72}
            markerEnd={oneWay ? amberEnd : inkEnd}
            markerStart={oneWay ? undefined : inkStart}
          >
            <title>
              {edge.kind === "bidirectional"
                ? `双向 ${edge.a} ↔ ${edge.b}`
                : edge.kind === "forward"
                  ? `单向 ${edge.a} → ${edge.b}`
                  : `单向 ${edge.b} → ${edge.a}`}
            </title>
          </path>
        );
      })}
    </>
  );
}

function EdgeMarkers({ prefix }: { prefix: string }) {
  const mk = (
    id: string,
    fill: string,
    opts?: { start?: boolean }
  ) => (
    <marker
      id={`${prefix}-${id}`}
      markerWidth="8"
      markerHeight="8"
      refX={opts?.start ? 1.2 : 6.8}
      refY="4"
      orient={opts?.start ? "auto-start-reverse" : "auto"}
      markerUnits="strokeWidth"
    >
      <path d="M0 0 L8 4 L0 8 Z" fill={fill} />
    </marker>
  );
  return (
    <defs>
      {mk("arrow-amber", "var(--amber)")}
      {mk("arrow-amber-dim", "var(--amber-dim)")}
      {mk("arrow-ink", "var(--ink-muted)")}
      {mk("arrow-amber-start", "var(--amber)", { start: true })}
      {mk("arrow-ink-start", "var(--ink-muted)", { start: true })}
    </defs>
  );
}

/**
 * Graph map: n places on regular n-gon vertices; every matrix edge uses the
 * same chord/outer-arc rendering (no floor-plan door tracks).
 */
export function PolygonMap({
  placeIds,
  matrix,
  stayIds,
  labelOf,
  onSelect,
  selected = null,
  highlight = null,
  isEnabled,
  className,
  markerPrefix = "poly-map",
}: {
  placeIds: readonly string[];
  matrix: AdjacencyMatrix;
  stayIds?: readonly string[];
  labelOf: (id: string) => string;
  onSelect?: (id: string) => void;
  selected?: string | null;
  highlight?: string | null;
  isEnabled?: (id: string) => boolean;
  className?: string;
  /** Unique SVG marker id prefix when multiple maps mount. */
  markerPrefix?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const n = placeIds.length;
  const focus = selected ?? hovered;

  const staySet = useMemo(
    () => new Set(stayIds ?? []),
    [stayIds]
  );

  const unit = useMemo(() => polygonVertexPositions(n), [n]);

  const positions = useMemo(() => {
    const r = VB * RING;
    const out: Record<string, Pt> = {};
    placeIds.forEach((id, i) => {
      out[id] = {
        x: CX + unit[i].x * r,
        y: CY + unit[i].y * r,
      };
    });
    return out;
  }, [placeIds, unit]);

  const edges = useMemo(
    () => collectMatrixEdges(matrix, placeIds),
    [matrix, placeIds]
  );

  const neighbors = useMemo(() => {
    if (!focus) return new Set<string>();
    const set = new Set<string>();
    for (const e of edges) {
      if (e.a === focus) set.add(e.b);
      if (e.b === focus) set.add(e.a);
    }
    return set;
  }, [edges, focus]);

  const rNode = nodeRadiusPx(n);
  // Percent of viewBox for absolute HTML nodes
  const pct = (v: number) => `${(v / VB) * 100}%`;
  const nodeW = `${(rNode * 2) / VB * 100}%`;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[3px]",
        // Slightly taller than square so labels breathe on narrow screens
        "aspect-[1/1.06] min-h-[280px] max-[360px]:min-h-[300px] sm:min-h-0",
        className
      )}
      data-testid="polygon-map"
      data-layout="polygon"
      data-node-count={n}
    >
      <svg
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
        viewBox={`0 0 ${VB} ${VB}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
        data-testid="polygon-map-edges"
      >
        <EdgeMarkers prefix={markerPrefix} />
        {/* faint ring hint */}
        <circle
          cx={CX}
          cy={CY}
          r={VB * RING}
          fill="none"
          stroke="var(--ink-faint)"
          strokeWidth="1.2"
          opacity="0.35"
        />
        <PolygonEdges
          edges={edges}
          positions={positions}
          focus={focus}
          markerPrefix={markerPrefix}
        />
      </svg>

      {placeIds.map((id, i) => {
        const p = positions[id];
        if (!p) return null;
        const isSel = selected === id;
        const isNeighbor = !!focus && neighbors.has(id) && id !== focus;
        const off = !!isEnabled && !isEnabled(id);
        const canStay = staySet.has(id);
        const label = labelOf(id);

        return (
          <button
            key={id}
            type="button"
            data-place={id}
            data-tutorial={`place-${id}`}
            disabled={!onSelect || off}
            aria-pressed={isSel}
            aria-label={canStay ? `${label}（可停留）` : label}
            title={canStay ? `${label} · 可停留` : label}
            onClick={() => onSelect?.(id)}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(id)}
            onBlur={() => setHovered(null)}
            className={cn(
              "absolute z-[1] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-[3px] text-center transition-[background-color,box-shadow,transform,opacity] duration-300 motion-reduce:transition-none",
              "min-h-11 min-w-11 p-1.5 max-[360px]:p-1 sm:p-2",
              "active:scale-[0.97]",
              isSel
                ? "bg-[var(--amber)] text-[var(--curtain)] shadow-[0_14px_32px_-14px_rgba(212,161,90,0.95)]"
                : isNeighbor
                  ? "bg-amber/12 text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--amber-dim)]"
                  : canStay
                    ? "bg-[linear-gradient(145deg,rgba(212,161,90,0.14),transparent_42%),var(--stage)] text-[var(--ink)] shadow-[inset_0_0_0_1px_rgba(212,161,90,0.38)]"
                    : "bg-[var(--stage)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]",
              highlight === id && "animate-pulse-soft",
              !onSelect && "cursor-default",
              off && "cursor-not-allowed opacity-35 active:scale-100"
            )}
            style={{
              left: pct(p.x),
              top: pct(p.y),
              width: nodeW,
              maxWidth: "28%",
            }}
          >
            <span className="relative flex w-full items-start justify-between gap-0.5 px-0.5">
              <span
                className={cn(
                  "font-display text-[9px] italic leading-none sm:text-[10px]",
                  isSel ? "text-curtain/55" : "text-[var(--ink-faint)]"
                )}
              >
                0{i + 1}
              </span>
              {canStay && (
                <StayMark selected={isSel} density="corner" label="sm" />
              )}
            </span>
            <span
              className={cn(
                "w-full truncate px-0.5 font-display leading-tight",
                n >= 10
                  ? "text-[0.7rem] max-[360px]:text-[0.65rem] sm:text-[0.85rem]"
                  : n >= 8
                    ? "text-[0.8rem] max-[360px]:text-[0.72rem] sm:text-[0.95rem]"
                    : "text-[0.9rem] max-[360px]:text-[0.8rem] sm:text-[1.05rem]",
                isSel ? "text-[var(--curtain)]" : "text-[var(--ink)]"
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
