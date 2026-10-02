"use client";

import type { ReactNode } from "react";
import type { MarkSource } from "@/lib/game/project-facts";
import { cn } from "@/lib/utils";

export const SOURCE_COLOR: Record<MarkSource, string> = {
  public: "var(--mark-public)",
  private: "var(--mark-private)",
  inference: "var(--mark-inference)",
};

/** Overlaid outlines: circle = public, square = private, diamond = inference. */
export function SourceGlyph({
  sources,
  thin,
  conflict,
  className,
}: {
  sources: MarkSource[];
  thin?: boolean;
  conflict?: boolean;
  className?: string;
}) {
  const w = thin ? 1.4 : 1.9;
  const stroke = (s: MarkSource) => (conflict ? "var(--mark-conflict)" : SOURCE_COLOR[s]);
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full overflow-visible", className)}
    >
      {sources.includes("private") && (
        <rect x="4" y="4" width="16" height="16" rx="1" fill="none" stroke={stroke("private")} strokeWidth={w} />
      )}
      {sources.includes("public") && (
        <circle cx="12" cy="12" r="9.5" fill="none" stroke={stroke("public")} strokeWidth={w} />
      )}
      {sources.includes("inference") && (
        <polygon
          points="12,0.8 23.2,12 12,23.2 0.8,12"
          fill="none"
          stroke={stroke("inference")}
          strokeWidth={w}
          strokeDasharray={thin ? undefined : "2.6 1.6"}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/** A letter or number sitting inside its merged source outline. */
export function GlyphToken({
  sources,
  children,
  size = "md",
  conflict,
  dim,
  emphasis,
  className,
}: {
  sources: MarkSource[];
  children: ReactNode;
  size?: "xs" | "sm" | "md";
  conflict?: boolean;
  dim?: boolean;
  emphasis?: boolean;
  className?: string;
}) {
  const box =
    size === "xs"
      ? "h-[11px] w-[11px] text-[7px]"
      : size === "sm"
        ? "h-5 w-5 text-[10px]"
        : "h-8 w-8 text-sm";
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center font-mono font-semibold leading-none text-[var(--ink-deep)]",
        box,
        dim && "opacity-35 line-through",
        className
      )}
    >
      <SourceGlyph sources={sources} thin={size !== "md"} conflict={conflict} />
      <span className="relative">{children}</span>
      {emphasis && (
        <span
          className={cn(
            "absolute rounded-full bg-[var(--amber)]",
            size === "md" ? "-right-0.5 -top-0.5 h-2 w-2" : "-right-px -top-px h-1 w-1"
          )}
        />
      )}
    </span>
  );
}
