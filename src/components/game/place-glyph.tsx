import type { ReactNode } from "react";
import type { PlaceId } from "@/lib/game/types";
import { cn } from "@/lib/utils";

/**
 * Hand-drawn line glyphs on a 20-unit grid: one stroke weight, no fills,
 * so they stay legible at 14px and inherit the surrounding text colour.
 */
const PATHS: Record<PlaceId, ReactNode> = {
  // 门廊 · arched stage door between two columns, with a step
  porch: (
    <>
      <path d="M4 17V8.5a6 6 0 0 1 12 0V17" />
      <path d="M7.5 17v-7a2.5 2.5 0 0 1 5 0v7" />
      <path d="M2.5 17h15" />
    </>
  ),
  // 正厅 · house curtain: swagged valance over two drawn-back drapes
  hall: (
    <>
      <path d="M2.5 3h15" />
      <path d="M2.5 3q2.5 3 5 0q2.5 3 5 0q2.5 3 5 0" />
      <path d="M3.5 6v11h3c1.4-4 .4-8-3-11" />
      <path d="M16.5 6v11h-3c-1.4-4-.4-8 3-11" />
    </>
  ),
  // 舞台 · spotlight beam ending in a pool of light on the boards
  stage: (
    <>
      <path d="M8.5 2.5h3" />
      <path d="M8.6 2.6 5.3 12.6M11.4 2.6l3.3 10" />
      <ellipse cx="10" cy="13.6" rx="5" ry="1.8" />
      <path d="M2.5 17.5h15" />
    </>
  ),
  // 妆室 · arched vanity mirror flanked by bulbs, on a dressing table
  dress: (
    <>
      <path d="M6.5 13V7a3.5 3.5 0 0 1 7 0v6" />
      <path d="M3 13.5h14M5 13.5V17M15 13.5V17" />
      <circle cx="3.6" cy="8" r="1" />
      <circle cx="16.4" cy="8" r="1" />
    </>
  ),
  // 夹层 · stairs climbing to a railed landing
  gallery: (
    <>
      <path d="M2.5 17.5H6V14h3.5v-3.5H13V7h4.5" />
      <path d="M12 3h5.5M13.2 3v4M16.2 3v4" />
    </>
  ),
  // 库房 · dome-lidded steamer trunk with two straps
  prop: (
    <>
      <path d="M3 9.5a7 4 0 0 1 14 0" />
      <rect x="3" y="9.5" width="14" height="7" rx=".8" />
      <path d="M7 6.2v10.3M13 6.2v10.3" />
      <path d="M9 11.5h2" />
    </>
  ),
};

export function PlaceGlyph({
  id,
  className,
  title,
}: {
  id: PlaceId;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {PATHS[id]}
    </svg>
  );
}

/**
 * Glyph-only label for tight spots: the name is kept for screen readers and
 * surfaces on hover (desktop) or while pressed (touch).
 */
export function PlaceMark({
  id,
  name,
  className,
  glyphClassName,
}: {
  id: PlaceId;
  name: string;
  className?: string;
  glyphClassName?: string;
}) {
  return (
    <span
      className={cn("group/place relative inline-flex items-center justify-center", className)}
      title={name}
      onTouchStart={() => undefined}
    >
      <PlaceGlyph id={id} className={glyphClassName} />
      <span className="sr-only">{name}</span>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded-sm bg-[var(--ink-deep)] px-1.5 py-0.5 text-[11px] font-normal not-italic text-[var(--parchment)] opacity-0 transition-opacity group-active/place:opacity-100 group-hover/place:opacity-100"
      >
        {name}
      </span>
    </span>
  );
}
