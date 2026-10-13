"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { EdgeKind } from "@/lib/game/map-generator";

/**
 * Theater-parchment door / passage between two rooms.
 * Bidirectional = solid bar; one-way = bar + chevron pointing travel direction.
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

  const ink =
    tone === "parchment"
      ? lit
        ? "var(--amber-dim)"
        : "var(--ink-deep)"
      : lit
        ? "var(--amber)"
        : "var(--ink-faint)";
  const glow =
    tone === "stage" && lit ? "shadow-[0_0_10px_rgba(212,161,90,0.8)]" : undefined;
  const barOpacity = tone === "parchment" ? (compact ? 0.5 : 0.65) : 1;

  const forward = kind === "forward";
  const backward = kind === "backward";
  const oneWay = forward || backward;

  // Chevron points toward destination along the door track.
  // h: forward = left→right (a→b); backward = right→left (b→a)
  // v: forward = top→bottom; backward = bottom→top
  const chevron =
    dir === "h"
      ? forward
        ? "M2 2 L10 6 L2 10"
        : "M10 2 L2 6 L10 10"
      : forward
        ? "M2 2 L6 10 L10 2"
        : "M2 10 L6 2 L10 10";

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
          "rounded-full transition-all duration-300",
          dir === "h"
            ? compact
              ? "h-px w-full"
              : tone === "parchment"
                ? "h-2 w-full rounded-sm"
                : "h-[3px] w-full"
            : compact
              ? "h-full w-px"
              : tone === "parchment"
                ? "h-full w-2 rounded-sm"
                : "h-full w-[3px]",
          glow
        )}
        style={{ backgroundColor: ink, opacity: barOpacity }}
      />
      {oneWay && (
        <svg
          viewBox="0 0 12 12"
          className={cn(
            "pointer-events-none absolute shrink-0",
            compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5 sm:h-4 sm:w-4"
          )}
          aria-hidden
        >
          <path
            d={chevron}
            fill="none"
            stroke={ink}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={tone === "parchment" ? 0.9 : 1}
          />
        </svg>
      )}
    </div>
  );
}

/** Small anchor mark for rooms that allow stay-in-place. */
export function StayMark({
  selected = false,
  className,
}: {
  selected?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] tracking-wider sm:text-[11px]",
        selected
          ? "bg-curtain/15 text-curtain/80"
          : "bg-amber/15 text-[var(--amber)]",
        className
      )}
      title="可停留"
      aria-label="可停留"
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0" aria-hidden>
        <circle cx="6" cy="6" r="2.2" fill="currentColor" />
        <circle
          cx="6"
          cy="6"
          r="4.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          opacity="0.7"
        />
      </svg>
      <span className="hidden font-display italic leading-none sm:inline">可停留</span>
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
