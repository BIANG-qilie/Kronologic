"use client";

import { useState } from "react";
import { ChevronDown, Waypoints } from "lucide-react";
import type { PlaceId, ScenarioPublic } from "@/lib/game/types";
import { PolygonMap } from "./polygon-map";
import { PlaceGlyph } from "./place-glyph";
import { MapLegend } from "@/components/custom/custom-map-preview";
import { cn } from "@/lib/utils";

function DeskMap({ scenario, markerPrefix }: { scenario: ScenarioPublic; markerPrefix: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const custom = scenario.custom!;
  const byId = new Map(scenario.places.map((p) => [p.id, p.name]));
  return (
    <PolygonMap
      placeIds={scenario.places.map((p) => p.id)}
      matrix={custom.matrix}
      stayIds={custom.stayIds}
      labelOf={(id) => byId.get(id as PlaceId) ?? id}
      glyphOf={(id) => <PlaceGlyph id={id as PlaceId} className="h-4 w-4" />}
      selected={selected}
      onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
      className="border border-ink-faint/30 bg-[var(--curtain)]/40"
      markerPrefix={markerPrefix}
    />
  );
}

/** Custom maps have no floor plan, so the desk keeps the connection graph in reach. */
export function DeskMapPanel({
  scenario,
  variant,
}: {
  scenario: ScenarioPublic;
  variant: "sidebar" | "inline";
}) {
  const [open, setOpen] = useState(false);
  if (!scenario.custom) return null;
  const n = scenario.places.length;

  const heading = (
    <span className="flex items-baseline gap-2 text-[11px] tracking-[0.32em] text-[var(--ink-muted)]">
      <Waypoints className="h-3.5 w-3.5 self-center text-[var(--amber-dim)]" aria-hidden />
      连通图
      <span className="font-mono tracking-normal tabular text-ink-muted/70">{n} 处</span>
    </span>
  );

  if (variant === "sidebar") {
    return (
      <section aria-label="连通图" className="mb-8">
        <p className="mb-3 flex items-baseline justify-between">{heading}</p>
        <DeskMap scenario={scenario} markerPrefix="desk-side" />
        <MapLegend className="mt-3 gap-x-3 text-[11px]" />
        <p className="mt-2 text-[11px] text-ink-muted/70">点一个地点，只亮它能走出去的路。</p>
      </section>
    );
  }

  return (
    <section
      aria-label="连通图"
      className="mb-6 rounded-[3px] shadow-[inset_0_0_0_1px_var(--ink-faint)] transition-shadow data-[open=true]:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
      data-open={open}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="desk-map-inline"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-3.5 text-left active:bg-amber/5"
      >
        {heading}
        <span className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
          {open ? "收起" : "看路径"}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform duration-300 motion-reduce:transition-none", open && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>
      <div
        id="desk-map-inline"
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-3 pb-3.5">
            <div className="mx-auto max-w-[26rem]">
              <DeskMap scenario={scenario} markerPrefix="desk-inline" />
            </div>
            <MapLegend className="mt-3 gap-x-4 text-[11px]" />
          </div>
        </div>
      </div>
    </section>
  );
}
