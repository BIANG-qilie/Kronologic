"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  collectMatrixEdges,
  polygonVertexPositions,
  quadBezierPoint,
  quadBezierTangent,
  type EdgeKind,
  type MatrixEdge,
  type Pt2,
} from "@/lib/game/map-generator";
import type { AdjacencyMatrix } from "@/lib/game/trajectory-kernel";
import { estimatedBoxes, layoutPolygonEdges, type Box } from "@/lib/game/map-arrows";
import { edgeKey, focusFrom } from "@/lib/game/map-focus";
import { cn } from "@/lib/utils";

/** ViewBox units — square canvas; nodes sit on a circle of this radius. */
const VB = 1000;
const CX = VB / 2;
const CY = VB / 2;
/** Ring radius as fraction of half-canvas; leave margin for labels. */
const RING = 0.36;
/** Clear node plaques so mid-edge marks sit on open ink. */
const END_PAD = 58;
/** Mid-arrow chevron half-size in viewBox units (reads on 360px). */
const ARROW_HALF = 24;

function strokeForKind(kind: Exclude<EdgeKind, "none">, lit: boolean): string {
  if (kind === "bidirectional") {
    return lit ? "var(--amber)" : "var(--ink-muted)";
  }
  return lit ? "var(--amber)" : "var(--amber-dim)";
}

function arrowFill(lit: boolean): string {
  return lit ? "var(--amber)" : "var(--amber)";
}

/** Filled chevron at the bezier midpoint, oriented along the tangent. */
function MidEdgeArrow({
  p0,
  ctrl,
  p2,
  t = 0.5,
  lit,
  size = ARROW_HALF,
  clear = true,
}: {
  p0: Pt2;
  ctrl: Pt2;
  p2: Pt2;
  t?: number;
  lit: boolean;
  size?: number;
  clear?: boolean;
}) {
  const mid = quadBezierPoint(p0, ctrl, p2, t);
  const tan = quadBezierTangent(p0, ctrl, p2, t);
  // Round for SSR/client parity (avoid hydration mismatch on float noise).
  const mx = Math.round(mid.x * 100) / 100;
  const my = Math.round(mid.y * 100) / 100;
  const angle = Math.round((Math.atan2(tan.y, tan.x) * 180) / Math.PI * 100) / 100;
  const fill = arrowFill(lit);
  const h = size;

  return (
    <g
      transform={`translate(${mx} ${my}) rotate(${angle})`}
      data-testid="mid-edge-arrow"
      data-clear={clear ? undefined : "false"}
    >
      {/* Curtain disc + amber ring so the mark punches through crossing chords */}
      <circle
        r={h + 5}
        fill="var(--curtain)"
        opacity={0.96}
        stroke="var(--amber)"
        strokeWidth={2}
        strokeOpacity={lit ? 0.85 : 0.55}
      />
      <path
        d={`M ${-h * 0.52} ${-h * 0.78} L ${h * 0.82} 0 L ${-h * 0.52} ${h * 0.78} Z`}
        fill={fill}
        stroke="rgba(20,16,12,0.55)"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </g>
  );
}

type LaidEdge = {
  key: string;
  from: Pt2;
  to: Pt2;
  ctrl: Pt2;
  /** Where on the curve the one-way chevron sits. */
  arrowT: number;
  /** Chevron size multiplier, below 1 only where space is tight. */
  arrowScale: number;
  arrowClear: boolean;
  d: string;
  lit: boolean;
  oneWay: boolean;
  stroke: string;
  title: string;
};

function layoutEdges(
  edges: MatrixEdge[],
  positions: Record<string, Pt2>,
  litEdges: ReadonlySet<string>,
  labelOf: (id: string) => string,
  boxes: readonly Box[],
  arrowSize: number
): LaidEdge[] {
  return layoutPolygonEdges({
    edges,
    positions,
    boxes,
    arrowRadius: arrowSize,
    arrowRing: ARROW_RING,
    canvas: VB,
    ringRadius: VB * RING,
    endPad: END_PAD,
  }).map(({ edge, from, to, ctrl, oneWay, arrow }) => {
    const lit = litEdges.has(edgeKey(edge));
    return {
      key: edgeKey(edge),
      from,
      to,
      ctrl,
      arrowT: arrow?.t ?? 0.5,
      arrowScale: arrow?.scale ?? 1,
      arrowClear: arrow?.clear ?? true,
      d: `M ${from.x} ${from.y} Q ${ctrl.x} ${ctrl.y} ${to.x} ${to.y}`,
      lit,
      oneWay,
      stroke: strokeForKind(edge.kind, lit),
      title:
        edge.kind === "bidirectional"
          ? `双向 ${labelOf(edge.a)} ↔ ${labelOf(edge.b)}`
          : edge.kind === "forward"
            ? `单向 ${labelOf(edge.a)} → ${labelOf(edge.b)}`
            : `单向 ${labelOf(edge.b)} → ${labelOf(edge.a)}`,
    };
  });
}

function PolygonEdges({
  laid,
}: {
  laid: LaidEdge[];
}) {
  return (
    <>
      {/* Pass 1: all strokes so later chords don't bury mid-arrows */}
      {laid.map((e) => (
        <path
          key={`stroke-${e.key}`}
          d={e.d}
          fill="none"
          stroke={e.stroke}
          strokeWidth={e.oneWay ? 3.8 : 2.5}
          strokeLinecap="round"
          opacity={e.lit ? 0.98 : e.oneWay ? 0.94 : 0.62}
        >
          <title>{e.title}</title>
        </path>
      ))}
    </>
  );
}

/** Mid-edge chevrons, drawn above the room plaques so none is ever buried. */
function PolygonArrows({ laid, size }: { laid: LaidEdge[]; size: number }) {
  return (
    <>
      {laid.map(
        (e) =>
          e.oneWay && (
            <MidEdgeArrow
              key={`arrow-${e.key}`}
              p0={e.from}
              ctrl={e.ctrl}
              p2={e.to}
              t={e.arrowT}
              lit={e.lit}
              size={Math.round(size * e.arrowScale * 100) / 100}
              clear={e.arrowClear}
            />
          )
      )}
    </>
  );
}

/** Map width assumed before the plaques are measured: the narrowest phone. */
const ESTIMATE_PX = 320;

/** Chevron disk beyond its half-size: circle r = size + 5, plus half its stroke. */
const ARROW_RING = 6;

/** Plaque plus its stay pip, which hangs off the corner. */
function unionRect(el: HTMLElement) {
  const b = el.getBoundingClientRect();
  const pip = el.querySelector("[data-testid=stay-pip]")?.getBoundingClientRect();
  if (!pip) return b;
  const left = Math.min(b.left, pip.left);
  const right = Math.max(b.right, pip.right);
  const top = Math.min(b.top, pip.top);
  const bottom = Math.max(b.bottom, pip.bottom);
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

function sameBoxes(a: Record<string, Box> | null, b: Record<string, Box>): boolean {
  if (!a) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((id) => {
    const x = a[id];
    const y = b[id];
    return !!y && x.cx === y.cx && x.cy === y.cy && x.hw === y.hw && x.hh === y.hh;
  });
}

function nodeRadiusPx(n: number): number {
  if (n <= 6) return 56;
  if (n <= 8) return 50;
  if (n <= 10) return 44;
  return 40;
}

/**
 * Graph map: n places on regular n-gon vertices; every matrix edge uses the
 * same chord/outer-arc rendering (no floor-plan door tracks).
 * One-way edges carry a mid-path amber arrow; bidirectional edges are ink only.
 */
export function PolygonMap({
  placeIds,
  matrix,
  stayIds,
  labelOf,
  glyphOf,
  onSelect,
  selected = null,
  highlight = null,
  isEnabled,
  className,
  markerPrefix: _markerPrefix = "poly-map",
}: {
  placeIds: readonly string[];
  matrix: AdjacencyMatrix;
  stayIds?: readonly string[];
  labelOf: (id: string) => string;
  glyphOf?: (id: string) => ReactNode;
  onSelect?: (id: string) => void;
  selected?: string | null;
  highlight?: string | null;
  isEnabled?: (id: string) => boolean;
  className?: string;
  /** Kept for call-site compatibility; mid-arrows no longer use SVG markers. */
  markerPrefix?: string;
}) {
  void _markerPrefix;
  const [hovered, setHovered] = useState<string | null>(null);
  const n = placeIds.length;
  const focus = selected ?? hovered;

  const staySet = useMemo(() => new Set(stayIds ?? []), [stayIds]);
  const unit = useMemo(() => polygonVertexPositions(n), [n]);

  const positions = useMemo(() => {
    const r = VB * RING;
    const round = (n: number) => Math.round(n * 100) / 100;
    const out: Record<string, Pt2> = {};
    placeIds.forEach((id, i) => {
      out[id] = {
        x: round(CX + unit[i].x * r),
        y: round(CY + unit[i].y * r),
      };
    });
    return out;
  }, [placeIds, unit]);

  const edges = useMemo(
    () => collectMatrixEdges(matrix, placeIds),
    [matrix, placeIds]
  );

  const lit = useMemo(() => focusFrom(edges, focus, staySet), [edges, focus, staySet]);

  const arrowSize = n >= 10 ? 19 : n >= 8 ? 21 : ARROW_HALF;
  const [measured, setMeasured] = useState<Record<string, Box> | null>(null);
  const boxList = useMemo(() => {
    const centers = placeIds.map((id) => positions[id]);
    const guess = estimatedBoxes(centers, n, ESTIMATE_PX, VB);
    return placeIds.map((id, i) => measured?.[id] ?? guess[i]);
  }, [placeIds, positions, n, measured]);
  const laid = useMemo(
    () => layoutEdges(edges, positions, lit.edges, labelOf, boxList, arrowSize),
    [edges, positions, lit.edges, labelOf, boxList, arrowSize]
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const nodeEls = useRef(new Map<string, HTMLElement>());
  const nodeRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) nodeEls.current.set(id, el);
      else nodeEls.current.delete(id);
    },
    []
  );

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const frame = stage.getBoundingClientRect();
      if (!frame.width) return;
      const k = VB / frame.width;
      const next: Record<string, Box> = {};
      for (const [id, el] of nodeEls.current) {
        const b = unionRect(el);
        next[id] = {
          cx: Math.round(((b.left + b.right) / 2 - frame.left) * k),
          cy: Math.round(((b.top + b.bottom) / 2 - frame.top) * k),
          hw: Math.ceil((b.width / 2) * k),
          hh: Math.ceil((b.height / 2) * k),
        };
      }
      setMeasured((prev) => (sameBoxes(prev, next) ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    for (const el of nodeEls.current.values()) ro.observe(el);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [placeIds]);

  const rNode = nodeRadiusPx(n);
  const pct = (v: number) => `${(v / VB) * 100}%`;
  const nodeW = `${((rNode * 2) / VB) * 100}%`;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[3px]",
        "aspect-[1/1.04] min-h-[300px] max-[360px]:min-h-[320px] sm:min-h-0",
        className
      )}
      data-testid="polygon-map"
      data-layout="polygon"
      data-node-count={n}
    >
      {/* One square frame for strokes and plaques, so both share coordinates. */}
      <div ref={stageRef} className="absolute inset-x-0 top-1/2 aspect-square -translate-y-1/2">
      <svg
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
        viewBox={`0 0 ${VB} ${VB}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
        data-testid="polygon-map-edges"
      >
        <circle
          cx={CX}
          cy={CY}
          r={VB * RING}
          fill="none"
          stroke="var(--ink-faint)"
          strokeWidth="1"
          opacity="0.28"
          strokeDasharray="3 10"
        />
        <PolygonEdges laid={laid} />
      </svg>
      <svg
        className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
        viewBox={`0 0 ${VB} ${VB}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
        data-testid="polygon-map-arrows"
      >
        <PolygonArrows laid={laid} size={arrowSize} />
      </svg>

      {placeIds.map((id, i) => {
        const p = positions[id];
        if (!p) return null;
        const isSel = selected === id;
        const isNeighbor = lit.reachable.has(id);
        const off = !!isEnabled && !isEnabled(id);
        const canStay = staySet.has(id);
        // Focused stay room: it is also a move (stay put), shown with its own inner ring.
        const stayLit = canStay && focus === id && lit.canStay;
        const label = labelOf(id);
        const interactive = !!onSelect;

        return (
          <button
            key={id}
            ref={nodeRef(id)}
            type="button"
            data-place={id}
            data-reachable={isNeighbor ? "" : undefined}
            data-stay-lit={stayLit ? "" : undefined}
            data-tutorial={`place-${id}`}
            disabled={!interactive || off}
            aria-pressed={isSel}
            aria-label={canStay ? `${label}（可停留）` : label}
            title={canStay ? `${label} · 可停留` : label}
            onClick={() => onSelect?.(id)}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(id)}
            onBlur={() => setHovered(null)}
            className={cn(
              "group absolute z-[1] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-[3px] text-center",
              "min-h-11 min-w-11 p-1.5 max-[360px]:p-1 sm:p-2",
              "transition-[background-color,box-shadow,transform,opacity] duration-300 motion-reduce:transition-none",
              interactive && "active:scale-[0.97] motion-reduce:active:scale-100",
              isSel
                ? stayLit
                  ? "bg-[var(--amber)] text-[var(--curtain)] shadow-[inset_0_0_0_3px_var(--amber),inset_0_0_0_4.5px_var(--curtain),0_14px_32px_-14px_rgba(212,161,90,0.95)]"
                  : "bg-[var(--amber)] text-[var(--curtain)] shadow-[0_14px_32px_-14px_rgba(212,161,90,0.95)]"
                : stayLit
                  ? "bg-[var(--stage)] bg-[image:linear-gradient(145deg,rgba(212,161,90,0.26),rgba(212,161,90,0.08)_60%)] text-[var(--ink)] shadow-[inset_0_0_0_1.5px_var(--amber),inset_0_0_0_4px_var(--stage),inset_0_0_0_5px_rgba(212,161,90,0.55),0_10px_28px_-16px_rgba(212,161,90,0.7)]"
                : isNeighbor
                  ? "bg-amber/12 text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--amber-dim)]"
                  : canStay
                    ? "bg-[var(--stage)] bg-[image:linear-gradient(145deg,rgba(212,161,90,0.14),transparent_42%)] text-[var(--ink)] shadow-[inset_0_0_0_1px_rgba(212,161,90,0.38)]"
                    : "bg-[var(--stage)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--ink-faint)]",
              interactive &&
                !isSel &&
                !stayLit &&
                !off &&
                "hover:shadow-[inset_0_0_0_1px_var(--amber-dim),0_10px_28px_-18px_rgba(212,161,90,0.55)]",
              highlight === id && "animate-pulse-soft",
              !interactive && "cursor-default",
              off && "cursor-not-allowed opacity-35 active:scale-100"
            )}
            style={{
              left: pct(p.x),
              top: pct(p.y),
              minWidth: `max(2.75rem, ${nodeW})`,
              maxWidth: "26%",
            }}
          >
            {canStay && (
              <span
                aria-hidden
                data-testid="stay-pip"
                className={cn(
                  "pointer-events-none absolute -right-1.5 -top-1.5 z-[3] flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2 ring-[var(--curtain)]",
                  "transition-[transform,box-shadow] duration-300 motion-reduce:transition-none",
                  isSel ? "bg-[var(--curtain)]" : "bg-[var(--amber)]",
                  stayLit && "scale-125 shadow-[0_0_0_5px_rgba(212,161,90,0.32),0_0_14px_2px_rgba(212,161,90,0.55)]"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", isSel ? "bg-[var(--amber)]" : "bg-[var(--curtain)]")} />
              </span>
            )}
            <span className="relative flex w-full items-start justify-between gap-0.5 px-0.5">
              <span
                className={cn(
                  "font-display text-[9px] italic leading-none tracking-wide sm:text-[10px]",
                  isSel ? "text-curtain/55" : "text-[var(--ink-faint)]"
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            </span>
            {glyphOf && (
              <span
                aria-hidden
                className={cn(
                  "flex justify-center",
                  n >= 10 && "max-sm:hidden",
                  isSel ? "text-[var(--curtain)]" : "text-[var(--amber-dim)]"
                )}
              >
                {glyphOf(id)}
              </span>
            )}
            <span
              className={cn(
                "w-full whitespace-nowrap px-0.5 font-display leading-tight",
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
    </div>
  );
}
