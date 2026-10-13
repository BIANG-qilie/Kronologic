"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { EdgeKind } from "@/lib/game/map-generator";

/**
 * Theater-parchment door / passage between two rooms.
 * Bidirectional = solid bar; one-way = bar + filled chevron pointing travel direction.
 */
export function MapPassage({
  kind,
  dir,
  lit = false,
  compact = false,
  tone = "stage",
}: {
  kind: EdgeKind;
  dir: "h" | "v";
  lit?: boolean;
  compact?: boolean;
  /** stage = dark map; parchment = desk board */
  tone?: "stage" | "parchment";
}) {
  if (kind === "none") return <div />;

  const forward = kind === "forward";
  const backward = kind === "backward";
  const oneWay = forward || backward;

  const barInk =
    tone === "parchment"
      ? lit
        ? "var(--amber-dim)"
        : "var(--ink-deep)"
      : lit
        ? "var(--amber)"
        : oneWay
          ? "var(--amber-dim)"
          : "var(--ink-muted)";

  const chevronInk =
    tone === "parchment"
      ? lit
        ? "var(--amber-dim)"
        : "var(--ink-deep)"
      : lit
        ? "var(--amber)"
        : "var(--amber)";

  const glow =
    tone === "stage" && (lit || oneWay)
      ? oneWay
        ? "shadow-[0_0_8px_rgba(212,161,90,0.55)]"
        : lit
          ? "shadow-[0_0_10px_rgba(212,161,90,0.8)]"
          : undefined
      : undefined;

  const barOpacity = tone === "parchment" ? (compact ? 0.5 : 0.65) : oneWay ? 0.95 : 1;

  // Filled chevron points toward destination along the door track.
  // h: forward = left→right; backward = right→left
  // v: forward = top→bottom; backward = bottom→top
  const chevronPath =
    dir === "h"
      ? forward
        ? "M1.5 1.5 L10.5 6 L1.5 10.5 Z"
        : "M10.5 1.5 L1.5 6 L10.5 10.5 Z"
      : forward
        ? "M1.5 1.5 L6 10.5 L10.5 1.5 Z"
        : "M1.5 10.5 L6 1.5 L10.5 10.5 Z";

  return (
    <div
      className="relative flex items-center justify-center self-stretch"
      title={
        oneWay
          ? forward
            ? "单向通道 →"
            : "单向通道 ←"
          : "双向通道"
      }
      aria-label={oneWay ? "单向通道" : "双向通道"}
    >
      <div
        className={cn(
          "rounded-full transition-[background-color,box-shadow,opacity] duration-300 motion-reduce:transition-none",
          dir === "h"
            ? compact
              ? "h-px w-full"
              : tone === "parchment"
                ? "h-2 w-full rounded-sm"
                : oneWay
                  ? "h-[3.5px] w-full"
                  : "h-[3px] w-full"
            : compact
              ? "h-full w-px"
              : tone === "parchment"
                ? "h-full w-2 rounded-sm"
                : oneWay
                  ? "h-full w-[3.5px]"
                  : "h-full w-[3px]",
          glow
        )}
        style={{ backgroundColor: barInk, opacity: barOpacity }}
      />
      {oneWay && (
        <span
          className={cn(
            "pointer-events-none absolute flex shrink-0 items-center justify-center rounded-full",
            tone === "stage" && "bg-[var(--curtain)]/85 ring-1 ring-[var(--amber)]/35",
            tone === "parchment" && "bg-[var(--parchment)]/90",
            compact ? "h-4 w-4 p-0.5" : "h-5 w-5 p-0.5"
          )}
          aria-hidden
        >
          <svg
            viewBox="0 0 12 12"
            className={cn(
              "shrink-0",
              compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5 sm:h-4 sm:w-4"
            )}
          >
            <path d={chevronPath} fill={chevronInk} opacity={tone === "parchment" ? 0.92 : 1} />
          </svg>
        </span>
      )}
    </div>
  );
}

/** Anchor mark for rooms that allow stay-in-place. Icon stays readable on phone. */
export function StayMark({
  selected = false,
  className,
  compact = false,
  /** always = map-lab; sm = game board (glyph already crowded); never = icon only */
  label = "sm",
}: {
  selected?: boolean;
  className?: string;
  /** Icon-only for tight desk cells */
  compact?: boolean;
  label?: "always" | "sm" | "never";
}) {
  const showLabel = label !== "never" && !compact;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[2px] tracking-[0.14em]",
        compact
          ? "px-0.5 py-0.5"
          : "min-h-7 px-1.5 py-1 sm:min-h-0 sm:px-1.5 sm:py-0.5",
        selected
          ? "bg-curtain/20 text-curtain/85"
          : "bg-amber/18 text-[var(--amber)] shadow-[inset_0_0_0_1px_rgba(212,161,90,0.28)]",
        className
      )}
      title="可停留"
      aria-label="可停留"
    >
      <svg
        viewBox="0 0 14 14"
        className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")}
        aria-hidden
      >
        <circle cx="7" cy="7" r="2.4" fill="currentColor" />
        <circle
          cx="7"
          cy="7"
          r="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.15"
          opacity="0.75"
        />
        <circle
          cx="7"
          cy="7"
          r="6.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.7"
          opacity="0.35"
        />
      </svg>
      {showLabel && (
        <span
          className={cn(
            "font-display text-[10px] italic leading-none sm:text-[11px]",
            label === "sm" && "hidden sm:inline"
          )}
        >
          可停留
        </span>
      )}
    </span>
  );
}

export function StayTip({ children }: { children: ReactNode }) {
  return (
    <span className="contents" title="可停留">
      {children}
    </span>
  );
}
