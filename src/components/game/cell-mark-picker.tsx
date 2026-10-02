"use client";

import type { KeyboardEvent } from "react";
import type { CellMark } from "@/lib/game/notes-format";
import type { MergedCell } from "@/lib/game/project-facts";
import { sourcesLabel } from "@/lib/game/project-facts";
import type { PersonId, PlaceId, RoomPublicView } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { GlyphToken } from "./source-glyph";
import { PlaceGlyph } from "./place-glyph";

const COUNTS = [0, 1, 2, 3, 4, 5, 6];

/** Arrow keys move focus between sibling chips inside the container. */
export function rovingKeys(e: KeyboardEvent<HTMLElement>) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
  const chips = Array.from(
    e.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-chip]")
  );
  const i = chips.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  const step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
  chips[(i + step + chips.length) % chips.length]?.focus();
}

function cyclePerson(mark: CellMark, person: PersonId): CellMark {
  if (mark.in.includes(person)) {
    return { ...mark, in: mark.in.filter((p) => p !== person), out: [...mark.out, person] };
  }
  if (mark.out.includes(person)) {
    return { ...mark, out: mark.out.filter((p) => p !== person) };
  }
  return { ...mark, in: [...mark.in, person] };
}

export function CellMarkPicker({
  view,
  place,
  title,
  mark,
  merged,
  onChange,
}: {
  view: RoomPublicView;
  place?: PlaceId;
  title: string;
  mark: CellMark;
  merged: MergedCell;
  onChange: (mark: CellMark) => void;
}) {
  const known = new Map(merged.people.map((p) => [p.person, p.sources]));
  const factCount = merged.count?.sources.includes("public") ? merged.count.value : null;

  return (
    <div className="space-y-3 text-[var(--ink-deep)]" onKeyDown={rovingKeys}>
      <p className="flex items-center gap-2 font-display text-lg sm:text-base">
        {place && <PlaceGlyph id={place} className="h-5 w-5 sm:h-4 sm:w-4" />}
        {title}
      </p>

      <div>
        <p className="mb-1.5 text-[11px] text-[var(--ink-deep)]/60">
          谁在这里 · 点一次标「在」，再点标「不在」
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {view.scenario.people.map((p) => {
            const state = mark.in.includes(p.id) ? "in" : mark.out.includes(p.id) ? "out" : "none";
            const facts = (known.get(p.id) ?? []).filter((s) => s !== "inference");
            return (
              <button
                key={p.id}
                type="button"
                data-chip
                aria-pressed={state !== "none"}
                aria-label={`${p.name}：${state === "in" ? "在" : state === "out" ? "不在" : "未标"}`}
                onClick={() => onChange(cyclePerson(mark, p.id))}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-sm border px-1.5 py-1 text-left text-xs transition-colors sm:min-h-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--amber)]",
                  state === "in" &&
                    "border-[var(--mark-inference)] bg-[var(--mark-inference)]/15",
                  state === "out" && "border-[var(--ink-deep)]/30 bg-[var(--ink-deep)]/5",
                  state === "none" && "border-[var(--ink-deep)]/15 hover:border-[var(--ink-deep)]/35"
                )}
              >
                <GlyphToken
                  size="sm"
                  sources={state === "in" ? [...facts, "inference"] : facts}
                  dim={state === "out"}
                >
                  {p.letter}
                </GlyphToken>
                <span className={cn("truncate", state === "out" && "line-through opacity-50")}>
                  {p.name}
                </span>
                <span className="ml-auto text-[10px] text-[var(--ink-deep)]/55">
                  {state === "in" ? "在" : state === "out" ? "不在" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] text-[var(--ink-deep)]/60">
          人数{factCount != null ? ` · 已知 ${factCount} 人` : ""}
        </p>
        <div className="flex gap-1">
          {COUNTS.map((n) => {
            const on = mark.count === n;
            return (
              <button
                key={n}
                type="button"
                data-chip
                aria-pressed={on}
                aria-label={`推理 ${n} 人`}
                onClick={() => onChange({ ...mark, count: on ? null : n })}
                className={cn(
                  "h-11 flex-1 rounded-sm border font-mono text-sm transition-colors sm:h-8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--amber)]",
                  on
                    ? "border-[var(--mark-inference)] bg-[var(--mark-inference)] text-[var(--parchment)]"
                    : "border-[var(--ink-deep)]/15 hover:border-[var(--ink-deep)]/35",
                  factCount === n && !on && "border-[var(--mark-public)] text-[var(--mark-public)]"
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {(merged.people.length > 0 || merged.count) && (
        <div className="space-y-0.5 border-t border-[var(--ink-deep)]/10 pt-2 text-[11px] text-[var(--ink-deep)]/70">
          {merged.count && (
            <p>
              {merged.count.value} 人 · {sourcesLabel(merged.count.sources)}
              {merged.count.inferred != null && `（推 ${merged.count.inferred}）`}
            </p>
          )}
          {merged.people.map((p) => (
            <p key={p.person}>
              {p.person} · {sourcesLabel(p.sources)}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-[var(--ink-deep)]/10 pt-2">
        <span className={cn("text-[11px]", merged.conflict ? "text-[var(--mark-conflict)]" : "text-transparent")}>
          推理与线索冲突
        </span>
        <button
          type="button"
          onClick={() => onChange({ in: [], out: [], count: null })}
          className="-my-2 min-h-11 px-1 text-xs text-[var(--ink-deep)]/60 underline-offset-4 hover:underline sm:min-h-0"
        >
          清空此格
        </button>
      </div>
    </div>
  );
}

export function VisitPicker({
  value,
  factCount,
  onChange,
}: {
  value: number | null;
  factCount: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex w-full gap-1" onKeyDown={rovingKeys}>
      {COUNTS.map((n) => {
        const on = value === n;
        return (
          <button
            key={n}
            type="button"
            data-chip
            aria-pressed={on}
            aria-label={`推理 ${n} 次`}
            onClick={() => onChange(on ? null : n)}
            className={cn(
              "h-11 flex-1 rounded-sm border font-mono text-sm text-[var(--ink-deep)] sm:h-8 sm:w-8 sm:flex-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--amber)]",
              on
                ? "border-[var(--mark-inference)] bg-[var(--mark-inference)] text-[var(--parchment)]"
                : "border-[var(--ink-deep)]/15 hover:border-[var(--ink-deep)]/35",
              factCount === n && !on && "border-[var(--mark-public)] text-[var(--mark-public)]"
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
