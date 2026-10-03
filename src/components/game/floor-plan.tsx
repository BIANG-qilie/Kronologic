import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { PlaceId } from "@/lib/game/types";

/**
 * Rooms laid out row by row with a door track between neighbours:
 * room / door / room … horizontally, and a door row between room rows.
 */
export function FloorPlan({
  layout,
  gap,
  padding,
  room,
  door,
  className = "absolute inset-0 grid h-full w-full",
}: {
  layout: PlaceId[][];
  gap: string;
  padding?: string;
  room: (place: PlaceId, index: number) => ReactNode;
  door: (a: PlaceId, b: PlaceId, dir: "h" | "v") => ReactNode;
  className?: string;
}) {
  const cols = Math.max(...layout.map((r) => r.length));
  const track = (n: number) => Array.from({ length: n }, () => "1fr").join(` ${gap} `);
  const style: CSSProperties = {
    gridTemplateColumns: track(cols),
    gridTemplateRows: track(layout.length),
    padding,
  };
  let index = 0;
  return (
    <div className={className} style={style}>
      {layout.map((row, r) => (
        <Fragment key={r}>
          {r > 0 &&
            Array.from({ length: cols * 2 - 1 }, (_, c) => {
              const above = layout[r - 1][c / 2];
              const below = row[c / 2];
              return c % 2 === 0 && above && below ? (
                <Fragment key={`v${c}`}>{door(above, below, "v")}</Fragment>
              ) : (
                <div key={`v${c}`} />
              );
            })}
          {Array.from({ length: cols * 2 - 1 }, (_, c) => {
            if (c % 2 === 0) {
              const place = row[c / 2];
              return place ? <Fragment key={place}>{room(place, index++)}</Fragment> : <div key={`e${c}`} />;
            }
            const a = row[(c - 1) / 2];
            const b = row[(c + 1) / 2];
            return a && b ? <Fragment key={`h${c}`}>{door(a, b, "h")}</Fragment> : <div key={`h${c}`} />;
          })}
        </Fragment>
      ))}
    </div>
  );
}

/** Width / height for a plan with this layout; single-row plans get a bit more height. */
export function planAspect(layout: PlaceId[][]): string {
  const cols = Math.max(...layout.map((r) => r.length));
  return layout.length === 1 ? `${cols} / 1.3` : `${cols} / ${layout.length}`;
}
