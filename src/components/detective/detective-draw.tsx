"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlotReel, type ReelItem } from "./slot-reel";
import {
  DETECTIVE_CASES,
  DETECTIVE_DIFFICULTIES,
  DETECTIVE_NODE_MAX,
  DETECTIVE_NODE_MIN,
  type ExpertUnlock,
} from "@/lib/game/detective";
import type { CustomDifficultyId } from "@/lib/game/types";
import { useMedia } from "@/hooks/use-media";
import { clearSession, saveSession } from "@/hooks/use-room";
import { cn } from "@/lib/utils";

export type DetectiveDraw = {
  caseId: string;
  caseTitle: string;
  nodeCount: number;
  oneWayCount: number;
  stayCount: number;
  difficulty: CustomDifficultyId;
  seed: string;
};

type DrawResponse = { code: string; token: string; playerId: string; draw: DetectiveDraw };

type Stage =
  | { kind: "pick" }
  | { kind: "drawing"; difficulty: CustomDifficultyId }
  | { kind: "landed"; difficulty: CustomDifficultyId; data: DrawResponse }
  | { kind: "error"; difficulty: CustomDifficultyId; message: string; auth: boolean };

const CASE_ITEMS: ReelItem[] = [
  ...DETECTIVE_CASES.map((c) => ({ main: `《${c.title}》`, sub: `${c.venue} · ${c.year}` })),
  { main: "？", sub: "待揭幕" },
];
const NODE_ITEMS: ReelItem[] = Array.from({ length: DETECTIVE_NODE_MAX - DETECTIVE_NODE_MIN + 1 }, (_, i) => ({
  main: `${DETECTIVE_NODE_MIN + i} 间`,
  sub: "地点",
}));
const TRICK_ITEMS: ReelItem[] = [
  { main: "全双向", sub: "不可停留" },
  { main: "单向 1", sub: "不可停留" },
  { main: "全双向", sub: "停留 2" },
  { main: "单向 2", sub: "停留 1" },
  { main: "单向 3", sub: "停留 3" },
];

export function trickItem(d: Pick<DetectiveDraw, "oneWayCount" | "stayCount">): ReelItem {
  return {
    main: d.oneWayCount ? `单向 ${d.oneWayCount}` : "全双向",
    sub: d.stayCount ? `停留 ${d.stayCount}` : "不可停留",
  };
}

function Bulbs({ count, className, offset = 0 }: { count: number; className?: string; offset?: number }) {
  return (
    <div className={cn("flex justify-between", className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="marquee-bulb" style={{ ["--b" as string]: (i + offset) % 3 }} />
      ))}
    </div>
  );
}

const AUTO_ENTER_MS = 1600;

export function DetectiveDrawStage({
  username,
  onClose,
  onNeedLogin,
}: {
  username: string;
  onClose: () => void;
  onNeedLogin: () => void;
}) {
  const router = useRouter();
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const [stage, setStage] = useState<Stage>({ kind: "pick" });
  const [stopped, setStopped] = useState(0);
  const [unlock, setUnlock] = useState<ExpertUnlock | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/detective", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && d?.expert && setUnlock(d.expert))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  const abortRef = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    abortRef.current?.abort();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function draw(difficulty: CustomDifficultyId) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStopped(0);
    setStage({ kind: "drawing", difficulty });
    const minSpin = new Promise((r) => setTimeout(r, reduced ? 0 : 1400));
    try {
      const res = await fetch("/api/detective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStage({
          kind: "error",
          difficulty,
          auth: res.status === 401,
          message: data.error || "抽签出了岔子，再抽一次",
        });
        return;
      }
      await minSpin;
      if (ctrl.signal.aborted) return;
      clearSession();
      saveSession({ code: data.code, token: data.token, playerId: data.playerId });
      setStage({ kind: "landed", difficulty, data: data as DrawResponse });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setStage({ kind: "error", difficulty, auth: false, message: "网络不稳，再抽一次" });
    }
  }

  const landed = stage.kind === "landed" ? stage.data : null;
  const allStopped = landed && stopped >= 3;
  const diff = "difficulty" in stage ? DETECTIVE_DIFFICULTIES.find((d) => d.id === stage.difficulty) : null;

  useEffect(() => {
    if (!allStopped || !landed) return;
    const t = window.setTimeout(() => router.push(`/play/${landed.code}`), AUTO_ENTER_MS);
    return () => window.clearTimeout(t);
  }, [allStopped, landed, router]);

  const spinning = stage.kind === "drawing";
  const live = spinning || (landed && !allStopped);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detective-draw-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(8,12,10,0.86)] px-3 py-6 outline-none backdrop-blur-[3px] animate-fade-up"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_30%,rgba(212,161,90,0.18),transparent)]" aria-hidden />
      <div className="relative w-full max-w-[38rem]">
        <button
          type="button"
          onClick={close}
          className="absolute -top-1 right-0 z-10 grid h-11 w-11 place-items-center rounded-full text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          aria-label="关闭抽签"
        >
          <X className="h-5 w-5" />
        </button>

        <p className="text-center text-[10px] tracking-[0.5em] text-amber/80">星河音乐厅 · 今夜加演</p>

        <div
          className={cn(
            "relative mt-8 rounded-[6px] border border-[#6b4a1e] bg-[linear-gradient(180deg,#2a1c0d,#1b130a)] p-3 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95),inset_0_0_0_3px_#3a2812,inset_0_0_0_4px_rgba(212,161,90,0.35)] sm:p-4",
            live ? "marquee-live" : "marquee-lit"
          )}
        >
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-t-[999px] border border-b-0 border-[#6b4a1e] bg-[#2a1c0d] px-6 pb-1 pt-2 sm:px-9">
            <h2 id="detective-draw-title" className="font-display text-lg tracking-[0.5em] text-[#ffe2a3] [text-shadow:0_0_12px_rgba(255,200,110,0.6)] sm:text-xl">
              探案抽签
            </h2>
          </div>

          <Bulbs count={16} className="px-1" />
          <div className="flex gap-2 py-2">
            <div className="flex flex-col justify-between py-1" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="marquee-bulb" style={{ ["--b" as string]: (i + 1) % 3 }} />
              ))}
            </div>

            <div className="min-w-0 flex-1 rounded-[3px] bg-[#120c06] px-2.5 py-3 shadow-[inset_0_0_24px_rgba(0,0,0,0.9)] sm:px-4 sm:py-4">
              {stage.kind === "pick" ? (
                <div>
                  <p className="text-center font-display text-lg text-[#f3e6c8] sm:text-xl">挑选本场的命运门票</p>
                  <p className="mt-1 text-center text-xs text-[#b39b74]">持票人「{username}」</p>
                  <div className="mt-4 grid grid-cols-2 gap-2.5" role="group" aria-label="难度">
                    {DETECTIVE_DIFFICULTIES.map((d, i) => {
                      const expert = d.id === "expert";
                      const locked = expert && !unlock?.unlocked;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          disabled={locked}
                          aria-describedby={locked ? "expert-lock" : undefined}
                          onClick={() => draw(d.id)}
                          className={cn(
                            "ticket-stub group relative flex min-h-[5.5rem] flex-col items-center justify-center px-3 py-2.5 text-center transition-transform duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe2a3]",
                            locked ? "cursor-not-allowed opacity-55 grayscale-[0.6]" : "hover:-translate-y-0.5 active:scale-[0.97]"
                          )}
                        >
                          <span className="flex items-center gap-1 font-mono text-[9px] tracking-[0.3em] text-[#8f5418]">
                            {locked && <Lock className="h-2.5 w-2.5" aria-hidden />}
                            ADMIT · {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="mt-0.5 font-display text-2xl leading-tight">{d.label}</span>
                          {locked ? (
                            <span id="expert-lock" className="mt-0.5 text-[11px] text-[#6b5332]">
                              {unlock
                                ? `烧脑场再拿 ${unlock.remaining} 枚金放大镜`
                                : "正在查验票根…"}
                            </span>
                          ) : (
                            <span className="mt-0.5 text-[11px] text-[#6b5332]">
                              {expert ? "你大可以试试" : `最少 ${d.min}–${d.max} 问 · ${d.compare}`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex gap-1.5 sm:gap-3">
                    <SlotReel
                      label="案件"
                      items={CASE_ITEMS}
                      final={landed ? { main: `《${landed.draw.caseTitle}》`, sub: "今夜上演" } : null}
                      spinning={spinning}
                      stopDelay={0}
                      speed={0.42}
                      reduced={reduced}
                      onStopped={() => setStopped((n) => n + 1)}
                    />
                    <SlotReel
                      label="地点"
                      items={NODE_ITEMS}
                      final={landed ? { main: `${landed.draw.nodeCount} 间`, sub: "地点" } : null}
                      spinning={spinning}
                      stopDelay={420}
                      speed={0.36}
                      reduced={reduced}
                      onStopped={() => setStopped((n) => n + 1)}
                    />
                    <SlotReel
                      label="机关"
                      items={TRICK_ITEMS}
                      final={landed ? trickItem(landed.draw) : null}
                      spinning={spinning}
                      stopDelay={840}
                      speed={0.3}
                      reduced={reduced}
                      onStopped={() => setStopped((n) => n + 1)}
                    />
                  </div>

                  <div className="mt-4 min-h-[5.5rem] text-center" aria-live="polite">
                    {stage.kind === "drawing" && (
                      <p className="pt-3 text-sm text-[#b39b74]">
                        <span className="text-[#f3e6c8]">{diff?.label}</span> 场 · 正在排演案情，推理机验算每一种可能…
                      </p>
                    )}
                    {landed && !allStopped && <p className="pt-3 text-sm text-[#b39b74]">落定中…</p>}
                    {landed && allStopped && (
                      <div className="animate-fade-up">
                        <p className="text-sm text-[#f3e6c8]">
                          《{landed.draw.caseTitle}》· {landed.draw.nodeCount} 个地点 · {diff?.label}
                          <span className="ml-2 font-mono text-[11px] text-[#8f7a58]">#{landed.draw.seed}</span>
                        </p>
                        <p className="mt-1 text-xs text-[#b39b74]">
                          {username} 侦探，入场。房间码 <span className="font-mono tracking-[0.2em] text-[#ffe2a3]">{landed.code}</span>
                        </p>
                        <Button className="group mt-3 h-11" onClick={() => router.push(`/play/${landed.code}`)}>
                          进入开房
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </div>
                    )}
                    {stage.kind === "error" && (
                      <div className="animate-fade-up">
                        <p role="alert" className="pt-1 text-sm text-[#f0a48d]">
                          {stage.message}
                        </p>
                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                          {stage.auth ? (
                            <Button className="h-11" onClick={onNeedLogin}>
                              登录 / 注册
                            </Button>
                          ) : (
                            <Button className="h-11" onClick={() => draw(stage.difficulty)}>
                              <RotateCcw className="h-4 w-4" />
                              再抽一次
                            </Button>
                          )}
                          <Button variant="ghost" className="h-11 text-[#d7c9a8]" onClick={() => setStage({ kind: "pick" })}>
                            换难度
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between py-1" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="marquee-bulb" style={{ ["--b" as string]: (i + 2) % 3 }} />
              ))}
            </div>
          </div>
          <Bulbs count={16} className="px-1" offset={1} />
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-[var(--ink-muted)]">
          选择探案难度，本案为随机地图随机案件。在场玩家都需登录才可游玩。
        </p>
      </div>
    </div>,
    document.body
  );
}
