import { Award } from "lucide-react";
import type { SeatRecord } from "@/lib/account/types";
import { achievementByCode } from "@/lib/game/achievements";

/** Results-screen line for a signed-in seat: first clear or best, plus anything newly unlocked. */
export function SeatRecordLine({ record }: { record: SeatRecord | null }) {
  if (!record || record.status === "failed") return null;

  if (record.status === "pending") {
    return (
      <p className="animate-pulse-soft text-sm text-[var(--ink-muted)]" aria-live="polite">
        正在记入战绩…
      </p>
    );
  }

  const won = record.result === "win";
  const headline = won
    ? record.isFirstClear
      ? "首次通关"
      : record.bestQueries != null
        ? `最佳 ${record.bestQueries} 问`
        : "通关"
    : "已记入战绩";

  return (
    <div className="space-y-3" aria-live="polite">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={won ? "font-display text-xl text-[var(--amber)]" : "text-sm text-[var(--ink-muted)]"}>
          {headline}
        </span>
        {won && (
          <span className="font-mono text-xs text-[var(--ink-muted)] tabular">
            本局 {record.queriesUsed} 问
          </span>
        )}
      </p>
      {record.newAchievements.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="新解锁的成就">
          {record.newAchievements.map((code, i) => {
            const a = achievementByCode(code);
            if (!a) return null;
            return (
              <li
                key={code}
                className="rise flex items-center gap-2.5 rounded-[3px] bg-amber/10 py-1.5 pl-2 pr-3 shadow-[inset_0_0_0_1px_var(--amber-dim)]"
                style={{ ["--i" as string]: 8 + i }}
              >
                <Award className="h-4 w-4 shrink-0 text-[var(--amber)]" aria-hidden />
                <span className="text-sm text-[var(--ink)]">
                  <span className="mr-1.5 text-[10px] tracking-[0.2em] text-[var(--amber)]">新成就</span>
                  {a.title}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
