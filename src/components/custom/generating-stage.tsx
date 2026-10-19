"use client";

import { useEffect, useRef } from "react";
import { Check, Dices, PencilLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomDifficultyId } from "@/lib/game/types";
import { cn } from "@/lib/utils";

const STAGES = [
  { title: "搭布景", detail: "按设置铺好地点与通道" },
  { title: "排行程", detail: "给六个人排一整晚的去处" },
  { title: "验算", detail: "推理机把每一种可能都走一遍" },
  { title: "定难度", detail: "数一数最少要问几次" },
  { title: "封存案件", detail: "确认答案唯一，开房" },
];

const BASE_SECONDS: Record<CustomDifficultyId, number> = {
  easy: 1.5,
  normal: 2.5,
  hard: 4.5,
  expert: 9,
};

/** Rough wait for a request, only to pace the progress bar. */
export function estimateSeconds(difficulty: CustomDifficultyId, nodeCount: number): number {
  return BASE_SECONDS[difficulty] * (1 + Math.max(0, nodeCount - 6) * 0.22);
}

/** Eases toward 94% on an estimate; only a finished search reaches the end. */
function progressAt(elapsed: number, estimate: number, done: boolean): number {
  if (done) return 1;
  return 0.94 * (1 - Math.exp(-elapsed / (estimate * 0.9)));
}

export type GeneratingStatus =
  | { kind: "running" }
  | { kind: "done" }
  | { kind: "error"; message: string; retryable: boolean };

export function GeneratingStage({
  caseTitle,
  bandLabel,
  difficulty,
  nodeCount,
  seed,
  elapsed,
  status,
  onCancel,
  onRetry,
  onEdit,
}: {
  caseTitle: string;
  bandLabel: string;
  difficulty: CustomDifficultyId;
  nodeCount: number;
  seed: string;
  /** Seconds since the request went out. */
  elapsed: number;
  status: GeneratingStatus;
  onCancel: () => void;
  onRetry: () => void;
  onEdit: () => void;
}) {
  const estimate = estimateSeconds(difficulty, nodeCount);
  const done = status.kind === "done";
  const failed = status.kind === "error";
  const p = progressAt(elapsed, estimate, done);
  const current = done ? STAGES.length : Math.min(STAGES.length - 1, Math.floor((p / 0.94) * STAGES.length));
  const primaryRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = failed ? onEdit : onCancel;
  });

  useEffect(() => {
    primaryRef.current?.focus();
  }, [failed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelRef.current();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  const secs = Math.floor(elapsed);
  const slow = elapsed > estimate * 2.2 && !done && !failed;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gen-title"
      aria-describedby="gen-status"
      className="animate-fade-up fixed inset-0 z-50 flex items-end justify-center bg-[rgba(8,12,10,0.78)] backdrop-blur-md sm:items-center sm:p-6"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[70vh] w-[110vw] -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(212,161,90,0.16),transparent)]"
        aria-hidden
      />
      <div className="parchment-wash relative w-full max-w-md overflow-hidden rounded-t-[6px] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95),inset_0_0_0_1px_rgba(212,161,90,0.22)] sm:rounded-[4px] sm:px-8 sm:pb-8 sm:pt-7">
        <div className="flex items-baseline justify-between gap-4 text-[11px] tracking-[0.32em]">
          <span className={failed ? "text-[#e07a5f]" : "text-[var(--amber)]"}>
            {failed ? "排演没成" : done ? "幕已拉开" : "排演中"}
          </span>
          <span className="font-mono tracking-[0.14em] text-[var(--ink-muted)]">种子 {seed}</span>
        </div>
        <h2 id="gen-title" className="mt-3 font-display text-[1.75rem] leading-tight text-[var(--ink)] sm:text-3xl">
          《{caseTitle}》
          <span className="ml-2 align-middle text-base text-[var(--ink-muted)]">
            {nodeCount} 处 · {bandLabel}
          </span>
        </h2>

        <div className="relative mt-6 h-[3px] overflow-hidden rounded-full bg-ink-faint/50" aria-hidden>
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out",
              failed ? "bg-[#e07a5f]" : "bg-[var(--amber)] shadow-[0_0_12px_rgba(212,161,90,0.8)]"
            )}
            style={{ width: `${Math.round(p * 1000) / 10}%` }}
          />
          {!failed && !done && (
            <div className="custom-progress absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-[rgba(255,240,210,0.55)] to-transparent" />
          )}
        </div>

        <ol className="mt-6 space-y-3.5" aria-label="排演步骤">
          {STAGES.map((s, i) => {
            const state = i < current ? "done" : i === current && !failed ? "now" : i === current && failed ? "fail" : "todo";
            return (
              <li key={s.title} className="flex items-start gap-3.5">
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors duration-500",
                    state === "done" && "bg-amber/20 text-[var(--amber)]",
                    state === "now" && "shadow-[inset_0_0_0_1.5px_var(--amber)]",
                    state === "fail" && "bg-[#e07a5f]/15 text-[#e07a5f]",
                    state === "todo" && "shadow-[inset_0_0_0_1px_var(--ink-faint)]"
                  )}
                >
                  {state === "done" && <Check className="h-3 w-3" strokeWidth={3} />}
                  {state === "now" && <span className="animate-pulse-soft h-2 w-2 rounded-full bg-[var(--amber)]" />}
                  {state === "fail" && <X className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-[15px] leading-5 transition-colors duration-500",
                      state === "todo" ? "text-[var(--ink-faint)]" : "text-[var(--ink)]"
                    )}
                  >
                    {s.title}
                  </span>
                  {(state === "now" || state === "fail") && (
                    <span className="animate-fade-up mt-0.5 block text-xs text-[var(--ink-muted)]">{s.detail}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>

        <p id="gen-status" aria-live="polite" className="mt-6 min-h-[2.5rem] text-xs leading-relaxed text-[var(--ink-muted)]">
          {failed ? (
            <span className="text-[#f0a48f]">{status.message}</span>
          ) : done ? (
            "案子封好了，正在带你入座…"
          ) : slow ? (
            <>
              这一出比较难排，已用 <span className="font-mono tabular text-[var(--ink)]">{secs}</span> 秒，最长约 30 秒。
              也可以取消，换个种子或降一档难度。
            </>
          ) : (
            <>
              已用 <span className="font-mono tabular text-[var(--ink)]">{secs}</span> 秒 · 这组设置通常 {Math.max(1, Math.round(estimate * 0.6))}–{Math.ceil(estimate * 2)} 秒。排出来的案子保证落在所选难度里。
            </>
          )}
        </p>

        <div className="mt-5 flex gap-2.5">
          {failed ? (
            <>
              <Button ref={primaryRef} variant="secondary" size="lg" className="flex-1 px-4" onClick={onEdit}>
                <PencilLine className="h-4 w-4" aria-hidden />
                返回修改
              </Button>
              {status.retryable && (
                <Button size="lg" className="flex-1 px-4" onClick={onRetry}>
                  <Dices className="h-4 w-4" aria-hidden />
                  换个种子再排
                </Button>
              )}
            </>
          ) : (
            <Button
              ref={primaryRef}
              variant="outline"
              size="lg"
              className="flex-1"
              disabled={done}
              onClick={onCancel}
            >
              取消
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
