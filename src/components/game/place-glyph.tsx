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
  // 厢房 · box seat: drapes tied back over a balustrade
  wing: (
    <>
      <path d="M3 3h14" />
      <path d="M4 3c0 4 1.5 6 4 7M16 3c0 4-1.5 6-4 7" />
      <path d="M3 12h14v2H3z" />
      <path d="M5.5 14v3.5M10 14v3.5M14.5 14v3.5" />
    </>
  ),
  // 天桥 · fly-gallery catwalk with hanging lines and a sandbag
  bridge: (
    <>
      <path d="M2.5 5h15M2.5 8h15" />
      <path d="M5 5l2.5 3M10 5l-2.5 3M10 5l2.5 3M15 5l-2.5 3" />
      <path d="M6 8v6M14 8v4" />
      <circle cx="6" cy="15.2" r="1.2" />
      <rect x="12.8" y="12" width="2.4" height="3.6" rx=".5" />
    </>
  ),
  // 乐池 · curved pit rail, a music stand and a note
  pit: (
    <>
      <path d="M2.5 11q7.5 4 15 0" />
      <path d="M2.5 11v5.5h15V11" />
      <path d="M6 9.5 8.5 4.5h-5zM6 9.5v3" />
      <path d="M13.5 9V3.5l3 1" />
      <circle cx="12.4" cy="9" r="1.1" />
    </>
  ),
  // 侧廊 · converging walls toward a far door, with a wall sconce
  aisle: (
    <>
      <path d="M2.5 2.5 8 7v6l-5.5 4.5M17.5 2.5 12 7v6l5.5 4.5" />
      <path d="M8 7h4M8 13h4" />
      <path d="M9.2 13V9.6a.8.8 0 0 1 1.6 0V13" />
      <path d="M4.5 8v2.5M4.5 8l-.8-1.2h1.6z" />
    </>
  ),
  // 阁楼 · gable roof with a round window above a small door
  attic: (
    <>
      <path d="M2 10 10 3l8 7" />
      <path d="M4 8.5v9h12v-9" />
      <circle cx="10" cy="9" r="1.8" />
      <path d="M8.2 17.5v-3.5h3.6v3.5" />
    </>
  ),
  // 后场 · rigging pulley, rope and counterweight
  backstage: (
    <>
      <path d="M3 2.5h14" />
      <path d="M10 2.5v2" />
      <circle cx="10" cy="6.5" r="2" />
      <path d="M8 6.5v8M12 6.5v4" />
      <rect x="10.6" y="10.5" width="2.8" height="4" rx=".5" />
      <path d="M5.5 17.5h5" />
      <path d="M8 14.5v3" />
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
