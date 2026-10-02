"use client";

import { useMemo, useState } from "react";
import type { PlaceId, ScenarioPublic } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { PlaceGlyph } from "./place-glyph";

const PLACE_ORDER: PlaceId[] = ["porch", "hall", "stage", "dress", "gallery", "prop"];

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
  const byId = useMemo(() => new Map(scenario.places.map((p) => [p.id, p])), [scenario.places]);
  const linked = (a: PlaceId, b: PlaceId) =>
    (scenario.adjacency[a] ?? []).includes(b) || (scenario.adjacency[b] ?? []).includes(a);

  const focus = selected ?? hovered;
  const neighbors = new Set(focus ? scenario.adjacency[focus] ?? [] : []);

  const door = (a: PlaceId, b: PlaceId, dir: "h" | "v") => {
    if (!linked(a, b)) return <div />;
    const lit = !!focus && (a === focus || b === focus);
    return (
      <div className="flex items-center justify-center">
        <div
          className={cn(
            "rounded-full transition-all duration-300",
            dir === "h" ? "h-[3px] w-full" : "h-full w-[3px]",
            lit ? "bg-[var(--amber)] shadow-[0_0_10px_rgba(212,161,90,0.8)]" : "bg-[var(--ink-faint)]"
          )}
        />
      </div>
    );
  };

  const room = (id: PlaceId, i: number) => {
    const place = byId.get(id)!;
    const isSel = selected === id;
    const isNeighbor = !!focus && neighbors.has(id) && id !== focus;
    return (
      <button
        key={id}
        type="button"
        disabled={!onSelect}
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
              ? "bg-[var(--amber)]/10 text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--amber-dim)]"
              : "bg-[var(--stage)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]",
          highlight === id && "animate-pulse-soft",
          !onSelect && "cursor-default"
        )}
      >
        <span className="flex w-full items-start justify-between">
          <span
            className={cn(
              "font-display text-xs italic",
              isSel ? "text-[var(--curtain)]/60" : "text-[var(--ink-faint)] group-hover:text-[var(--amber-dim)]"
            )}
          >
            0{i + 1}
          </span>
          <PlaceGlyph
            id={id}
            className={cn(
              "h-5 w-5 transition-colors duration-300 sm:h-6 sm:w-6",
              isSel ? "text-[var(--curtain)]/80" : "text-[var(--amber)]/70 group-hover:text-[var(--amber)]"
            )}
          />
        </span>
        <span className="font-display text-lg leading-none sm:text-2xl">{place.name}</span>
      </button>
    );
  };

  return (
    <div className="relative aspect-[3/2] w-full">
      <div
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: "1fr 14px 1fr 14px 1fr", gridTemplateRows: "1fr 14px 1fr" }}
      >
        {room("porch", 0)}
        {door("porch", "hall", "h")}
        {room("hall", 1)}
        {door("hall", "stage", "h")}
        {room("stage", 2)}
        {door("porch", "dress", "v")}
        <div />
        {door("hall", "gallery", "v")}
        <div />
        {door("stage", "prop", "v")}
        {room("dress", 3)}
        {door("dress", "gallery", "h")}
        {room("gallery", 4)}
        {door("gallery", "prop", "h")}
        {room("prop", 5)}
      </div>
      <span className="sr-only">{PLACE_ORDER.map((id) => byId.get(id)?.name).join("、")}</span>
    </div>
  );
}
