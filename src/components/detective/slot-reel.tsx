"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ReelItem = { main: string; sub?: string };

const ITEM_H = 64;
const REPS = 5;

type Phase = "idle" | "spin" | "settling" | "stopped";

/**
 * One reel. Spins while `spinning`; once `final` is known and spinning ends it
 * rolls down a long strip and lands on `final` after `stopDelay` ms.
 */
export function SlotReel({
  label,
  items,
  final,
  spinning,
  stopDelay,
  speed,
  reduced,
  onStopped,
}: {
  label: string;
  items: ReelItem[];
  final: ReelItem | null;
  spinning: boolean;
  stopDelay: number;
  speed: number;
  reduced: boolean;
  onStopped?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const stopMs = Math.round(1100 + stopDelay * 0.4);
  const [offset, setOffset] = useState(0);
  const stoppedRef = useRef(onStopped);
  useLayoutEffect(() => {
    stoppedRef.current = onStopped;
  });

  const strip: ReelItem[] = [];
  for (let r = 0; r < REPS; r++) strip.push(...items);
  const target = strip.length;
  if (final) strip.push(final);
  strip.push(...items.slice(0, 2));

  const hasFinal = !!final;
  useEffect(() => {
    if (spinning) {
      setPhase(reduced ? "idle" : "spin");
      setOffset(0);
      return;
    }
    if (!hasFinal) {
      setPhase("idle");
      return;
    }
    if (reduced) {
      setPhase("stopped");
      setOffset(target);
      stoppedRef.current?.();
      return;
    }
    const t = window.setTimeout(() => {
      setPhase("settling");
      setOffset(0);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setOffset(target);
        })
      );
    }, stopDelay);
    const done = window.setTimeout(() => {
      setPhase("stopped");
      setOffset(target);
      stoppedRef.current?.();
    }, stopDelay + stopMs + 80);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(done);
    };
  }, [spinning, hasFinal, reduced, stopDelay, target, stopMs]);

  const cycle = items.length * ITEM_H;
  const showPlaceholder = phase === "idle" && !final;

  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1.5 text-center text-[10px] tracking-[0.42em] text-amber/80">{label}</p>
      <div className="reel-window relative h-16 overflow-hidden rounded-[3px]" aria-hidden>
        {showPlaceholder ? (
          <div className="grid h-16 place-items-center font-display text-2xl text-[#5a4426]">
            {spinning ? <span className="animate-pulse-soft text-base tracking-[0.3em]">抽签中</span> : "？"}
          </div>
        ) : (
          <div
            className={cn(phase === "spin" && "reel-strip-spin", phase === "settling" && "reel-strip-stop")}
            style={{
              ["--reel-cycle" as string]: cycle,
              ["--reel-speed" as string]: `${speed}s`,
              ["--reel-stop" as string]: `${stopMs}ms`,
              transform: phase === "spin" ? undefined : `translateY(${-offset * ITEM_H}px)`,
              transition: phase === "settling" && offset === 0 ? "none" : undefined,
            }}
          >
            {strip.map((it, i) => (
              <div
                key={i}
                className={cn(
                  "flex h-16 flex-col items-center justify-center px-1 text-center text-[#2a1d0e]",
                  phase === "stopped" && i === target && "[text-shadow:0_0_10px_rgba(255,226,163,0.9)]"
                )}
              >
                <span className="block w-full truncate font-display text-[clamp(1rem,4.6vw,1.45rem)] leading-tight">
                  {it.main}
                </span>
                {it.sub && (
                  <span className="mt-0.5 block w-full truncate font-mono text-[10px] tracking-[0.12em] text-[#6b5332]">
                    {it.sub}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#8f5418]/25" />
      </div>
    </div>
  );
}
