"use client";

import { useState } from "react";
import type { PlaceDef, PlaceId } from "@/lib/game/types";
import { PolygonMap } from "@/components/game/polygon-map";
import { PlaceGlyph } from "@/components/game/place-glyph";
import { cn } from "@/lib/utils";

function LegendMidArrow() {
  return (
    <svg viewBox="0 0 28 12" className="h-3 w-7" aria-hidden>
      <path d="M1 6h26" stroke="var(--amber-dim)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="6" r="5" fill="var(--curtain)" stroke="var(--amber)" strokeWidth="1" />
      <path d="M11.8 3.2 17 6l-5.2 2.8z" fill="var(--amber)" />
    </svg>
  );
}

export function MapLegend({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[var(--ink-muted)]",
        className
      )}
    >
      <li className="inline-flex items-center gap-2">
        <svg viewBox="0 0 28 12" className="h-3 w-7" aria-hidden>
          <path d="M1 6h26" stroke="var(--ink-muted)" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        </svg>
        双向
      </li>
      <li className="inline-flex items-center gap-2">
        <LegendMidArrow />
        单向 · 只能顺箭头走
      </li>
      <li className="inline-flex items-center gap-2">
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--amber)]" aria-hidden>
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--curtain)]" />
        </span>
        可停留 · 下一时刻可原地不动
      </li>
    </ul>
  );
}

/** Read-only polygon preview; tapping a room lights its passages. */
export function CustomMapPreview({
  places,
  matrix,
  stayIds,
  className,
}: {
  places: readonly PlaceDef[];
  matrix: number[][];
  stayIds: readonly PlaceId[];
  className?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const byId = new Map(places.map((p) => [p.id, p.name]));
  return (
    <PolygonMap
      placeIds={places.map((p) => p.id)}
      matrix={matrix}
      stayIds={stayIds}
      labelOf={(id) => byId.get(id as PlaceId) ?? id}
      glyphOf={(id) => <PlaceGlyph id={id as PlaceId} className="h-4 w-4 sm:h-5 sm:w-5" />}
      selected={selected}
      onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
      className={cn("border border-ink-faint/30 bg-[var(--curtain)]/40", className)}
      markerPrefix="custom-preview"
    />
  );
}
