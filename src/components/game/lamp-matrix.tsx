"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const PLACES = ["门廊", "正厅", "舞台", "妆室", "夹层", "库房"];
const TIMES = [1, 2, 3, 4, 5, 6];

type Lamp = "off" | "shared" | "private";

/** Deterministic first frame so server and client render the same markup. */
const SEED: Lamp[] = Array.from({ length: 36 }, (_, i) =>
  [3, 8, 14, 21, 27, 32].includes(i) ? "shared" : [10, 19, 30].includes(i) ? "private" : "off"
);

function useFlicker(enabled: boolean) {
  const [lamps, setLamps] = useState<Lamp[]>(SEED);
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setLamps((prev) => {
        const next = [...prev];
        for (let k = 0; k < 2; k++) {
          const i = Math.floor(Math.random() * 36);
          const r = Math.random();
          next[i] = r < 0.5 ? "off" : r < 0.82 ? "shared" : "private";
        }
        return next;
      });
    }, 1400);
    return () => window.clearInterval(id);
  }, [enabled]);
  return lamps;
}

export function LampMatrix({ className, animate = true }: { className?: string; animate?: boolean }) {
  const lamps = useFlicker(animate);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  return (
    <figure className={cn("select-none", className)} aria-label="六时六地灯阵">
      <div
        className="grid gap-x-2 gap-y-2.5 sm:gap-x-3 sm:gap-y-3.5"
        style={{ gridTemplateColumns: "auto repeat(6, minmax(0, 1fr))" }}
        onMouseLeave={() => setHoverTime(null)}
      >
        <span />
        {TIMES.map((t) => (
          <span
            key={t}
            className={cn(
              "text-center font-display text-xs italic transition-colors duration-300 tabular sm:text-sm",
              hoverTime === t ? "text-[var(--amber)]" : "text-[var(--ink-muted)]/70"
            )}
          >
            {t}
          </span>
        ))}
        {PLACES.map((place, row) => (
          <Row
            key={place}
            place={place}
            row={row}
            lamps={lamps}
            hoverTime={hoverTime}
            onHover={setHoverTime}
          />
        ))}
      </div>
    </figure>
  );
}

function Row({
  place,
  row,
  lamps,
  hoverTime,
  onHover,
}: {
  place: string;
  row: number;
  lamps: Lamp[];
  hoverTime: number | null;
  onHover: (t: number) => void;
}) {
  return (
    <>
      <span className="self-center pr-2 text-right text-[11px] tracking-[0.2em] text-[var(--ink-muted)]/70 sm:text-xs">
        {place}
      </span>
      {TIMES.map((t, col) => {
        const i = row * 6 + col;
        const state = lamps[i];
        return (
          <span
            key={t}
            onMouseEnter={() => onHover(t)}
            className="relative flex aspect-square items-center justify-center"
          >
            <span
              className={cn(
                "lamp block h-[42%] w-[42%] rounded-full transition-[background-color,box-shadow,transform] duration-700",
                state === "shared" &&
                  "bg-[var(--green-win)] shadow-[0_0_18px_4px_rgba(111,191,138,0.45)]",
                state === "private" &&
                  "bg-[#f3e6c8] shadow-[0_0_18px_4px_rgba(243,230,200,0.35)]",
                state === "off" && "bg-[var(--ink-faint)]",
                hoverTime === t && "scale-125"
              )}
              style={{ ["--i" as string]: (row + col) * 70 + 300 }}
            />
            {hoverTime === t && (
              <span className="absolute inset-0 rounded-full ring-1 ring-[var(--amber)]/30" />
            )}
          </span>
        );
      })}
    </>
  );
}
