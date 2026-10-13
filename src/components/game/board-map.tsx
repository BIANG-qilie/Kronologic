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
  const byId = useMemo(() => new Map(scenario.places.map((p) => [p.id, p])), [scenario.places]);
  const placeIds = useMemo(() => placeOrder(scenario), [scenario]);

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
        data-tutorial={`place-${id}`}
        disabled={!onSelect || off}
        aria-pressed={isSel}
        onClick={() => onSelect?.(id)}
        onMouseEnter={() => setHovered(id)}
        onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered(id)}
        onBlur={() => setHovered(null)}
        className={cn(
          "group relative flex flex-col justify-between rounded-[3px] p-2.5 text-left transition-all duration-300 active:scale-[0.98] sm:p-4",
          isSel
            ? "bg-[var(--amber)] text-[var(--curtain)] shadow-[0_18px_40px_-16px_rgba(212,161,90,0.9)]"
            : isNeighbor
              ? "bg-amber/10 text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--amber-dim)]"
              : "bg-[var(--stage)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]",
          highlight === id && "animate-pulse-soft",
          !onSelect && "cursor-default",
          off && "cursor-not-allowed opacity-35 active:scale-100"
        )}
      >
        <span className="flex w-full items-start justify-between gap-1">
          <span
            className={cn(
              "font-display text-xs italic",
              isSel ? "text-curtain/60" : "text-[var(--ink-faint)] group-hover:text-[var(--amber-dim)]"
            )}
          >
            0{i + 1}
          </span>
          <span className="flex items-center gap-1">
            {canStay && <StayMark selected={isSel} />}
            <PlaceGlyph
              id={id}
              className={cn(
                "h-5 w-5 transition-colors duration-300 sm:h-6 sm:w-6",
                isSel ? "text-curtain/80" : "text-amber/70 group-hover:text-[var(--amber)]"
              )}
            />
          </span>
        </span>
        <span className="font-display text-lg leading-none sm:text-2xl">{place.name}</span>
      </button>
    );
  };

  return (
    <div className="relative w-full" style={{ aspectRatio: planAspect(layoutOf(scenario)) }}>
      <FloorPlan layout={layoutOf(scenario)} gap="14px" className="absolute inset-0 grid" room={room} door={door} />
      <span className="sr-only">{placeOrder(scenario).map((id) => byId.get(id)?.name).join("、")}</span>
    </div>
  );
}
