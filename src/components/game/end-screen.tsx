"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { PersonId, PlaceId, RoomPublicView } from "@/lib/game/types";
import { clearSession } from "@/hooks/use-room";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { levelLabel } from "@/lib/game/levels";
import { markLevelCleared } from "@/lib/game/progress";
import { PlaceGlyph } from "./place-glyph";
import { SeatRecordLine } from "@/components/account/seat-record";

const PLACE_ORDER: PlaceId[] = ["porch", "hall", "stage", "dress", "gallery", "prop"];
const TIMES = [1, 2, 3, 4, 5, 6];
const LAST_LEVEL = 15;

const MEDAL = {
  gold: { label: "金放大镜", color: "#e3b866", glow: "rgba(227,184,102,0.55)" },
  silver: { label: "银放大镜", color: "#c9d1cc", glow: "rgba(201,209,204,0.45)" },
  copper: { label: "铜放大镜", color: "#c27c4e", glow: "rgba(194,124,78,0.45)" },
} as const;

function Replay({
  view,
  trajectory,
  crime,
  culprit,
  victim,
}: {
  view: RoomPublicView;
  trajectory: Record<PersonId, Record<string, PlaceId>>;
  crime: { time: number; place: PlaceId } | null;
  culprit: string | null;
  victim: PersonId | null;
}) {
  const placeName = (id: PlaceId) => view.scenario.places.find((p) => p.id === id)?.name ?? id;
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {TIMES.map((t, i) => {
        const isCrime = crime?.time === t;
        return (
          <li
            key={t}
            className={cn(
              "rise rounded-[3px] p-2 transition-colors",
              isCrime
                ? "bg-[var(--parchment)] text-[var(--ink-deep)] shadow-[0_0_0_1px_var(--amber),0_20px_60px_-20px_rgba(212,161,90,0.8)]"
                : "bg-[var(--stage)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--ink-faint)]"
            )}
            style={{ ["--i" as string]: 6 + i }}
          >
            <p className="mb-1.5 flex items-baseline justify-between px-0.5">
              <span className="font-display text-lg italic leading-none">{t}</span>
              {isCrime && <span className="text-[10px] tracking-[0.2em] text-[var(--amber-dim)]">案发</span>}
            </p>
            <div className="grid grid-cols-3 gap-1">
              {PLACE_ORDER.map((place) => {
                const here = view.scenario.people.filter((p) => trajectory[p.id]?.[String(t)] === place);
                const hot = isCrime && crime?.place === place;
                return (
                  <div
                    key={place}
                    title={placeName(place)}
                    className={cn(
                      "flex aspect-[5/4] flex-wrap content-center items-center justify-center gap-x-0.5 rounded-[2px] font-mono text-[11px] font-semibold leading-tight",
                      hot
                        ? "bg-[var(--amber)] text-[var(--curtain)] shadow-[0_0_24px_rgba(212,161,90,0.7)]"
                        : isCrime
                          ? "shadow-[inset_0_0_0_1px_rgba(26,36,32,0.25)]"
                          : "bg-curtain/60 shadow-[inset_0_0_0_1px_var(--ink-faint)]"
                    )}
                  >
                    {here.length === 0 && (
                      <PlaceGlyph
                        id={place}
                        className={cn("h-3 w-3", isCrime ? "text-ink-deep/30" : "text-[var(--ink-faint)]")}
                      />
                    )}
                    {here.map((p) => (
                      <span
                        key={p.id}
                        className={cn(
                          "px-px",
                          !isCrime && "text-[var(--ink-muted)]",
                          (p.id === culprit || p.id === victim) && !hot && !isCrime && "text-[var(--ink)]",
                          hot && "text-[13px]"
                        )}
                      >
                        {p.letter}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function EndScreen({ view }: { view: RoomPublicView }) {
  const isSolo = view.players.length === 1;
  const isWin = view.phase === "reveal";
  const youWon = !!view.you && view.winners.includes(view.you.playerId);
  const [showAnswers, setShowAnswers] = useState(!(isSolo && !isWin));

  useEffect(() => {
    if (!(isSolo && !isWin)) return;
    const t = setTimeout(() => setShowAnswers(true), 1600);
    return () => clearTimeout(t);
  }, [isSolo, isWin]);

  const level = view.scenario.level ?? null;
  useEffect(() => {
    if (youWon && level != null) markLevelCleared(level);
  }, [youWon, level]);
  const nextLevel = level != null && level < LAST_LEVEL ? level + 1 : null;

  const answers = view.revealAnswers ?? {};
  const q = (kind: "person" | "place" | "time") =>
    view.scenario.winQuestions.find((x) => x.kind === kind)?.id;
  const culpritId = q("person") ? answers[q("person")!] : null;
  const placeId = q("place") ? (answers[q("place")!] as PlaceId) : null;
  const time = q("time") ? Number(answers[q("time")!]) : null;
  const culprit = view.scenario.people.find((p) => p.id === culpritId);
  const victim = view.scenario.people.find((p) => p.id === view.revealVictimId);
  const place = view.scenario.places.find((p) => p.id === placeId);
  const medal = view.soloRating ? MEDAL[view.soloRating] : null;
  const winners = view.players.filter((p) => view.winners.includes(p.id));

  const kicker = isWin ? (youWon ? "你破了案" : "有人先破了案") : isSolo ? "答错了" : "全员出局";
  const tag = (p: { name: string; letter: string }) => `${p.name}（${p.letter}）`;
  const title = isWin ? "真相" : "幕落";

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-atmosphere" aria-hidden />
      <div className="pointer-events-none fixed inset-0 z-40 flex" aria-hidden>
        <div className="curtain-left h-full w-1/2 bg-[linear-gradient(90deg,#0b100e,#17221d_85%,#0b100e)]" />
        <div className="curtain-right h-full w-1/2 bg-[linear-gradient(270deg,#0b100e,#17221d_85%,#0b100e)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 pb-[max(3.5rem,env(safe-area-inset-bottom))] pt-14 sm:px-8 md:py-20">
        <p
          className={cn("rise text-xs tracking-[0.42em]", isWin ? "text-[var(--amber)]" : "text-[#e07a5f]")}
          style={{ ["--i" as string]: 4 }}
        >
          {level != null && <span className="mr-3 text-[var(--ink-muted)]">{levelLabel(level)}</span>}
          {kicker}
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-8">
          <h1
            className="rise font-display text-[clamp(4.5rem,14vw,9rem)] font-black leading-[0.9] text-[var(--ink)]"
            style={{ ["--i" as string]: 5 }}
          >
            {title}
          </h1>
          {medal && (
            <div className="rise flex items-center gap-4" style={{ ["--i" as string]: 7 }}>
              <span
                className="flex h-20 w-20 items-center justify-center rounded-full"
                style={{
                  background: `radial-gradient(circle at 35% 30%, #fff8, transparent 45%), ${medal.color}`,
                  boxShadow: `0 0 40px 4px ${medal.glow}, inset 0 -6px 12px rgba(0,0,0,0.25)`,
                }}
              >
                <Search className="h-8 w-8 text-[var(--curtain)]" strokeWidth={2.4} />
              </span>
              <div>
                <p className="font-display text-2xl text-[var(--ink)]">{medal.label}</p>
                <p className="font-mono text-sm text-[var(--ink-muted)] tabular">
                  {view.players[0]?.queryCount ?? 0} 问破案
                </p>
              </div>
            </div>
          )}
        </div>

        {view.you?.record && (
          <div className="rise mt-6" style={{ ["--i" as string]: 7 }}>
            <SeatRecordLine record={view.you.record} />
          </div>
        )}

        {isSolo && !isWin && !showAnswers && (
          <p className="animate-fade-up mt-8 text-lg text-[var(--ink-muted)]">灯快亮了……</p>
        )}

        {showAnswers && culprit && place && time && (
          <p
            className="rise mt-8 max-w-3xl text-balance font-display text-2xl leading-[1.6] text-[var(--ink-muted)] sm:text-3xl"
            style={{ ["--i" as string]: 6 }}
          >
            <span className="whitespace-nowrap">
              时间 <span className="text-[var(--ink)]">{time}</span>，
            </span>
            <span className="whitespace-nowrap text-[var(--amber)]">{tag(culprit)}</span>
            在
            <span className="whitespace-nowrap text-[var(--ink)]">{place.name}</span>
            {victim ? (
              <>
                与<span className="whitespace-nowrap text-[var(--ink)]">{tag(victim)}</span>独处。
              </>
            ) : (
              "下了手。"
            )}
          </p>
        )}

        {showAnswers && view.revealTrajectory && (
          <section className="mt-12" aria-label="整晚回放">
            <p className="rise mb-4 text-[11px] tracking-[0.32em] text-[var(--ink-muted)]" style={{ ["--i" as string]: 6 }}>
              整晚回放
            </p>
            <Replay
              view={view}
              trajectory={view.revealTrajectory}
              crime={placeId && time ? { time, place: placeId } : null}
              culprit={culpritId}
              victim={view.revealVictimId}
            />
            <div className="rise mt-4 flex items-center gap-3" style={{ ["--i" as string]: 12 }}>
              <span className="text-[11px] text-ink-muted/70">房间位置</span>
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[2px] bg-ink-faint/60 text-[11px] text-[var(--ink-muted)]">
                {PLACE_ORDER.map((id) => (
                  <span key={id} className="flex items-center gap-1 bg-[var(--curtain)] px-2 py-1">
                    <PlaceGlyph id={id} className="h-3.5 w-3.5" />
                    {view.scenario.places.find((p) => p.id === id)?.name}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        <div
          className="rise mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-ink-faint/60 pt-6"
          style={{ ["--i" as string]: 13 }}
        >
          <p className="text-sm text-[var(--ink-muted)]">
            {winners.length > 0 ? `破案：${winners.map((p) => p.nickname).join("、")}` : "这一晚没人答对"}
            <span className="mx-2 text-[var(--ink-faint)]">/</span>
            全场共问 {view.queryCountTotal} 次
          </p>
          <Button
            size="lg"
            className="group"
            onClick={() => {
              clearSession();
              const target = isWin ? nextLevel : level;
              window.location.href = target ? `/?level=${target}` : "/";
            }}
          >
            {isWin ? (nextLevel ? `下一关 · ${levelLabel(nextLevel)}` : "回大厅") : "再试一次"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </main>
  );
}
