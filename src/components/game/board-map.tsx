"use client";

import { useMemo, useState } from "react";
import type { PlaceId, ScenarioPublic } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { layoutOf, placeOrder } from "@/lib/game/board";
import { adjacencyRecordToMatrix } from "@/lib/game/trajectory-kernel";
import { edgeKindBetween, isStayPlace } from "@/lib/game/map-generator";
import { PlaceGlyph } from "./place-glyph";
import { FloorPlan, planAspect } from "./floor-plan";
import { MapPassage, StayMark } from "./map-passage";
import { MapArcOverlay } from "./map-arc-overlay";

export function BoardMap({
  scenario,
  highlight,
  onSelect,
  selected,
  isEnabled,
  /** Optional stay places (diagonal). Night-tea has none. */
  stayIds,
  /** Optional dense matrix; when omitted, derived from scenario.adjacency (asymmetry = directed). */
  matrix,
}: {
  scenario: ScenarioPublic;
  highlight?: PlaceId | null;
  onSelect?: (id: PlaceId) => void;
  selected?: PlaceId | null;
  /** Rooms outside this predicate are shown but cannot be picked. */
  isEnabled?: (id: PlaceId) => boolean;
  stayIds?: readonly PlaceId[];
  matrix?: ReadonlyArray<ReadonlyArray<number>>;
}) {
  const [hovered, setHovered] = useState<PlaceId | null>(null);
  const [planEl, setPlanEl] = useState<HTMLDivElement | null>(null);
  const byId = useMemo(() => new Map(scenario.places.map((p) => [p.id, p])), [scenario.places]);
  const placeIds = useMemo(() => placeOrder(scenario), [scenario]);
  const layout = useMemo(() => layoutOf(scenario), [scenario]);

  const adjMatrix = useMemo(() => {
    if (matrix) return matrix;
    return adjacencyRecordToMatrix(scenario.adjacency, placeIds);
  }, [matrix, scenario.adjacency, placeIds]);

  const staySet = useMemo(() => {
    if (stayIds?.length) return new Set(stayIds);
    return new Set(
      placeIds.filter((id) => isStayPlace(adjMatrix, placeIds, id))
    );
  }, [stayIds, placeIds, adjMatrix]);

  const focus = selected ?? hovered;
  const neighbors = new Set(focus ? scenario.adjacency[focus] ?? [] : []);

  const door = (a: PlaceId, b: PlaceId, dir: "h" | "v") => {
    const kind = edgeKindBetween(adjMatrix, placeIds, a, b);
    if (kind === "none") return <div />;
    const lit = !!focus && (a === focus || b === focus);
    return <MapPassage kind={kind} dir={dir} lit={lit} tone="stage" />;
  };

  const room = (id: PlaceId, i: number) => {
    const place = byId.get(id)!;
    const isSel = selected === id;
    const isNeighbor = !!focus && neighbors.has(id) && id !== focus;
    const off = !!isEnabled && !isEnabled(id);
    const canStay = staySet.has(id);
    return (
      <button
        key={id}
        type="button"
        data-place={id}
        data-tutorial={`place-${id}`}
        disabled={!onSelect || off}
        aria-pressed={isSel}
        onClick={() => onSelect?.(id)}
        onMouseEnter={() => setHovered(id)}
        onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered(id)}
        onBlur={() => setHovered(null)}
        className={cn(
          "group relative flex min-h-11 flex-col justify-between rounded-[3px] p-2 text-left transition-[background-color,box-shadow,transform,opacity] duration-300 motion-reduce:transition-none active:scale-[0.98] max-[360px]:p-1.5 sm:min-h-0 sm:p-4",
          isSel
            ? "bg-[var(--amber)] text-[var(--curtain)] shadow-[0_18px_40px_-16px_rgba(212,161,90,0.9)]"
            : isNeighbor
              ? "bg-amber/10 text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--amber-dim)]"
              : canStay
                ? "bg-[linear-gradient(145deg,rgba(212,161,90,0.12),transparent_40%),var(--stage)] text-[var(--ink)] shadow-[inset_0_0_0_1px_rgba(212,161,90,0.32)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
                : "bg-[var(--stage)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]",
          highlight === id && "animate-pulse-soft",
          !onSelect && "cursor-default",
          off && "cursor-not-allowed opacity-35 active:scale-100"
        )}
      >
        <span className="flex w-full items-start justify-between gap-0.5 max-[360px]:gap-0">
          <span
            className={cn(
              "font-display text-xs italic",
              isSel ? "text-curtain/60" : "text-[var(--ink-faint)] group-hover:text-[var(--amber-dim)]"
            )}
          >
            0{i + 1}
          </span>
          <span className="flex items-center gap-1 max-[360px]:gap-0">
            {/* ≤360: stay → corner pin; glyph keeps the header slot */}
            {canStay && <StayMark selected={isSel} density="corner" label="sm" />}
            <PlaceGlyph
              id={id}
              className={cn(
                "h-5 w-5 shrink-0 transition-colors duration-300 motion-reduce:transition-none sm:h-6 sm:w-6",
                isSel ? "text-curtain/80" : "text-amber/70 group-hover:text-[var(--amber)]"
              )}
            />
          </span>
        </span>
        <span className="truncate font-display text-base leading-none max-[360px]:text-[0.95rem] sm:text-2xl">
          {place.name}
        </span>
      </button>
    );
  };

  return (
    <div
      ref={setPlanEl}
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: planAspect(layout) }}
    >
      <FloorPlan layout={layout} gap="22px" className="absolute inset-0 grid" room={room} door={door} />
      <MapArcOverlay
        container={planEl}
        layout={layout}
        placeIds={placeIds}
        matrix={adjMatrix}
        focus={focus}
      />
      <span className="sr-only">{placeOrder(scenario).map((id) => byId.get(id)?.name).join("、")}</span>
    </div>
  );
}
