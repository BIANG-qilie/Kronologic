"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlaceId, ScenarioPublic } from "@/lib/game/types";
import { cn } from "@/lib/utils";

const LAYOUT: Record<PlaceId, { col: number; row: number }> = {
  porch: { col: 1, row: 1 },
  hall: { col: 2, row: 1 },
  stage: { col: 3, row: 1 },
  dress: { col: 1, row: 2 },
  gallery: { col: 2, row: 2 },
  prop: { col: 3, row: 2 },
};

const PLACE_ORDER: PlaceId[] = [
  "porch",
  "hall",
  "stage",
  "dress",
  "gallery",
  "prop",
];

export function BoardMap({
  scenario,
  highlight,
  onSelect,
  selected,
}: {
  scenario: ScenarioPublic;
  highlight?: PlaceId | null;
  onSelect?: (id: PlaceId) => void;
  selected?: PlaceId | null;
}) {
  const [hovered, setHovered] = useState<PlaceId | null>(null);

  const byId = useMemo(() => {
    const m = new Map(scenario.places.map((p) => [p.id, p]));
    return m;
  }, [scenario.places]);

  const edges = useMemo(() => {
    const seen = new Set<string>();
    const list: [PlaceId, PlaceId][] = [];
    for (const [a, neighbors] of Object.entries(scenario.adjacency) as [
      PlaceId,
      PlaceId[],
    ][]) {
      for (const b of neighbors) {
        const key = [a, b].sort().join("-");
        if (seen.has(key)) continue;
        seen.add(key);
        list.push([a, b]);
      }
    }
    return list;
  }, [scenario.adjacency]);

  const focus = selected ?? hovered;
  const neighbors = useMemo(() => {
    if (!focus) return new Set<PlaceId>();
    return new Set(scenario.adjacency[focus] ?? []);
  }, [focus, scenario.adjacency]);

  function center(id: PlaceId) {
    const { col, row } = LAYOUT[id];
    return { x: (col - 0.5) * (100 / 3), y: (row - 0.5) * 50 };
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="relative aspect-[3/2] w-full">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          aria-hidden
        >
          {edges.map(([a, b]) => {
            const pa = center(a);
            const pb = center(b);
            const active =
              !!focus &&
              ((a === focus && neighbors.has(b)) ||
                (b === focus && neighbors.has(a)));
            return (
              <line
                key={`${a}-${b}`}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke={active ? "var(--amber)" : "var(--ink-muted)"}
                strokeWidth={active ? 2.2 : 1.6}
                strokeOpacity={active ? 0.95 : 0.55}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-3 p-2">
          {PLACE_ORDER.map((id) => {
            const place = byId.get(id)!;
            const isSel = selected === id;
            const isHi = highlight === id;
            const isNeighbor = !!focus && neighbors.has(id) && id !== focus;
            return (
              <button
                key={id}
                type="button"
                disabled={!onSelect}
                onClick={() => onSelect?.(id)}
                onMouseEnter={() => setHovered(id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(id)}
                onBlur={() => setHovered(null)}
                className={cn(
                  "relative z-10 flex flex-col items-center justify-center rounded-sm border px-2 py-3 text-center transition-all duration-200",
                  "bg-[var(--stage)]/85 backdrop-blur-sm",
                  isSel
                    ? "scale-[1.02] border-[var(--amber)] shadow-[0_0_0_1px_var(--amber)]"
                    : isNeighbor
                      ? "border-[var(--amber-dim)] bg-[var(--amber)]/10"
                      : "border-[var(--ink-faint)] hover:border-[var(--amber-dim)]",
                  isHi && "animate-pulse-soft border-[var(--green-win)]",
                  !onSelect && "cursor-default"
                )}
              >
                <span className="font-display text-lg tracking-wide text-[var(--ink)]">
                  {place.name}
                </span>
                <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                  {id}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-[var(--ink-muted)]">
        悬停或选中地点时，相邻通道会高亮
      </p>
    </div>
  );
}
