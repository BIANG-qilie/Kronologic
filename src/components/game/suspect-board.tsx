"use client";

import { Crosshair } from "lucide-react";
import type { SuspectBoard as Board, Verdict } from "@/lib/game/notes-format";
import type { PlaceId, RoomPublicView } from "@/lib/game/types";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { rovingKeys } from "./cell-mark-picker";
import { PlaceGlyph } from "./place-glyph";

type Row = keyof Board;

function nextVerdict(v: Verdict | undefined): Verdict | undefined {
  if (!v) return "target";
  if (v === "target") return "excluded";
  return undefined;
}

export function cycleBoard(board: Board, row: Row, key: string): Board {
  const next = nextVerdict(board[row][key]);
  const rowCopy = { ...board[row] };
  if (next) rowCopy[key] = next;
  else delete rowCopy[key];
  return { ...board, [row]: rowCopy };
}

function Chip({
  verdict,
  label,
  title,
  onClick,
}: {
  verdict: Verdict | undefined;
  label: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-chip
      onClick={onClick}
      aria-label={`${title}：${verdict === "target" ? "目标" : verdict === "excluded" ? "排除" : "未标"}`}
      className={cn(
        "inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-sm border px-2 text-xs transition-colors sm:h-7 sm:min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--amber)]",
        verdict === "target" &&
          "border-[var(--amber-dim)] bg-[var(--amber)]/30 font-semibold text-[var(--ink-deep)]",
        verdict === "excluded" &&
          "border-[var(--ink-deep)]/10 text-[var(--ink-deep)]/35 line-through",
        !verdict &&
          "border-[var(--ink-deep)]/15 text-[var(--ink-deep)]/75 hover:border-[var(--ink-deep)]/35"
      )}
    >
      {verdict === "target" && <Crosshair className="h-3 w-3" aria-hidden />}
      {label}
    </button>
  );
}

export function SuspectBoard({
  view,
  board,
  onChange,
}: {
  view: RoomPublicView;
  board: Board;
  onChange: (board: Board) => void;
}) {
  const rows: { row: Row; name: string; items: { key: string; label: ReactNode; title: string }[] }[] = [
    {
      row: "times",
      name: "时间",
      items: [1, 2, 3, 4, 5, 6].map((t) => ({ key: String(t), label: String(t), title: `时间 ${t}` })),
    },
    {
      row: "places",
      name: "房间",
      items: view.scenario.places.map((p) => ({
        key: p.id,
        label: (
          <>
            <PlaceGlyph id={p.id as PlaceId} className="h-3.5 w-3.5" />
            {p.name}
          </>
        ),
        title: p.name,
      })),
    },
    {
      row: "people",
      name: "人物",
      items: view.scenario.people.map((p) => ({
        key: p.id,
        label: (
          <>
            <span className="font-mono font-semibold">{p.letter}</span>
            {p.name}
          </>
        ),
        title: `${p.name}（${p.letter}）`,
      })),
    },
  ];

  return (
    <div className="mb-4 mt-3 space-y-1.5 rounded-sm border border-[var(--ink-deep)]/12 bg-[var(--ink-deep)]/[0.03] p-2.5">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-sm text-[var(--ink-deep)]">嫌疑板</p>
        <p className="text-[10px] text-[var(--ink-deep)]/55">点一次标目标，再点排除，三点清除</p>
      </div>
      {rows.map(({ row, name, items }) => (
        <div key={row} className="flex items-start gap-2">
          <span className="w-7 shrink-0 pt-3 text-[11px] text-[var(--ink-deep)]/55 sm:pt-1.5">{name}</span>
          <div className="flex flex-wrap gap-1" onKeyDown={rovingKeys}>
            {items.map((it) => (
              <Chip
                key={it.key}
                verdict={board[row][it.key]}
                label={it.label}
                title={it.title}
                onClick={() => onChange(cycleBoard(board, row, it.key))}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
