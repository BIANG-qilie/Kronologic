"use client";

import { useEffect, useState } from "react";
import type {
  PlaceId,
  PersonId,
  QueryKind,
  ScenarioPublic,
  TimeId,
} from "@/lib/game/types";
import { BoardMap } from "./board-map";
import { PlaceGlyph } from "./place-glyph";
import { Button } from "@/components/ui/button";
import { ArrowRight, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

export function QueryPanel({
  scenario,
  canAct,
  askAgain,
  busy,
  onAsk,
}: {
  scenario: ScenarioPublic;
  canAct: boolean;
  askAgain: boolean;
  busy: boolean;
  onAsk: (input: {
    kind: QueryKind;
    placeId: PlaceId;
    timeId?: TimeId;
    personId?: PersonId;
  }) => Promise<void>;
}) {
  const [kind, setKind] = useState<QueryKind>("place_time");
  const [placeId, setPlaceId] = useState<PlaceId | null>(null);
  const [timeId, setTimeId] = useState<TimeId | null>(null);
  const [personId, setPersonId] = useState<PersonId | null>(null);
  const [flash, setFlash] = useState<PlaceId | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(t);
  }, [flash]);

  async function submit() {
    if (!placeId || !canAct) return;
    if (kind === "place_time" && !timeId) return;
    if (kind === "place_person" && !personId) return;
    setFlash(placeId);
    await onAsk({
      kind,
      placeId,
      timeId: timeId ?? undefined,
      personId: personId ?? undefined,
    });
    setPlaceId(null);
    setTimeId(null);
    setPersonId(null);
  }

  if (!canAct) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-[3px] px-6 py-20 text-center shadow-[inset_0_0_0_1px_var(--ink-faint)]">
        <Hourglass className="animate-pulse-soft h-6 w-6 text-[var(--amber)]" aria-hidden />
        <p className="font-display text-2xl text-[var(--ink)]">
          {askAgain ? "提问者再问一次" : "还没轮到你"}
        </p>
        <p className="max-w-xs text-sm leading-relaxed text-[var(--ink-muted)]">
          {askAgain
            ? "上一问白窗没有内容，不计次。"
            : "先去桌面推理，轮到你时这里会亮起。"}
        </p>
      </div>
    );
  }

  const placeName = scenario.places.find((p) => p.id === placeId)?.name;
  const person = scenario.people.find((p) => p.id === personId);
  const personName = person ? `${person.name}（${person.letter}）` : null;
  const ready = !!placeId && (kind === "place_time" ? !!timeId : !!personId);

  const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
    <section>
      <p className="mb-3 flex items-baseline gap-3">
        <span className="font-display text-sm italic text-[var(--amber)]">0{n}</span>
        <span className="text-[11px] tracking-[0.28em] text-[var(--ink-muted)]">{title}</span>
      </p>
      {children}
    </section>
  );

  const chip = (on: boolean) =>
    cn(
      "rounded-[3px] transition-all duration-200",
      on
        ? "bg-[var(--amber)] text-[var(--curtain)] shadow-[0_10px_24px_-12px_rgba(212,161,90,0.9)]"
        : "text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
    );

  const summary = (
    <>
      <p
        className="flex min-h-[2rem] items-center gap-2 font-display text-xl leading-snug text-[var(--ink-muted)] lg:min-h-[2.5rem] lg:text-2xl"
        aria-live="polite"
      >
        {placeId ? (
          <span className="inline-flex items-center gap-1.5 text-[var(--ink)]">
            <PlaceGlyph id={placeId} className="h-5 w-5 text-[var(--amber)]" />
            {placeName}
          </span>
        ) : (
          "某个房间"
        )}
        <span className="text-[var(--ink-faint)]">×</span>
        {kind === "place_time" ? (
          timeId ? <span className="text-[var(--ink)]">时间 {timeId}</span> : "某个时间"
        ) : personName ? (
          <span className="text-[var(--ink)]">{personName}</span>
        ) : (
          "某个人物"
        )}
      </p>
      <Button className="group mt-3 w-full lg:mt-5" size="lg" disabled={busy || !ready} onClick={submit}>
        {busy ? "灯在亮…" : ready ? "提问" : placeId ? (kind === "place_time" ? "再选一个时间" : "再选一个人物") : "先选一个房间"}
        {!busy && ready && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
      </Button>
    </>
  );

  return (
    <div className="grid gap-6 pb-36 sm:gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-14 lg:pb-0">
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-faint/60 bg-curtain/92 px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto max-w-xl">{summary}</div>
      </div>
      <div className="space-y-6 sm:space-y-8">
        {askAgain && (
          <p className="animate-fade-up rounded-[3px] bg-green-win/10 px-4 py-2.5 text-sm text-[var(--green-win)]">
            上一问白窗没有内容，不计次，再问一次。
          </p>
        )}
        <Step n={1} title="提问方式">
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(
              [
                ["place_time", "房间 × 时间", "绿窗：几人 · 白窗：一个人"],
                ["place_person", "房间 × 人物", "绿窗：几次 · 白窗：一个时间"],
              ] as const
            ).map(([k, label, hint]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(chip(kind === k), "min-h-[4.25rem] px-3 py-3 text-left sm:px-4")}
              >
                <span className="block font-display text-base sm:text-lg">{label}</span>
                <span className={cn("mt-0.5 block text-xs", kind === k ? "text-curtain/70" : "text-[var(--ink-muted)]")}>
                  {hint}
                </span>
              </button>
            ))}
          </div>
        </Step>

        <Step n={2} title="哪个房间">
          <BoardMap scenario={scenario} selected={placeId} highlight={flash} onSelect={setPlaceId} />
        </Step>
      </div>

      <div className="space-y-6 sm:space-y-8 lg:sticky lg:top-24 lg:self-start">
        {kind === "place_time" ? (
          <Step n={3} title="哪个时间">
            <div className="grid grid-cols-6 gap-1.5" role="radiogroup">
              {([1, 2, 3, 4, 5, 6] as TimeId[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={timeId === t}
                  onClick={() => setTimeId(t)}
                  className={cn(chip(timeId === t), "h-14 font-display text-2xl tabular")}
                >
                  {t}
                </button>
              ))}
            </div>
          </Step>
        ) : (
          <Step n={3} title="哪个人物">
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
              {scenario.people.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={personId === p.id}
                  onClick={() => setPersonId(p.id)}
                  className={cn(chip(personId === p.id), "flex min-h-12 items-center px-3 py-2 text-left")}
                >
                  <span className="font-mono text-base font-semibold">{p.letter}</span>
                  <span className={cn("ml-2 truncate text-sm", personId === p.id ? "text-curtain/80" : "text-[var(--ink-muted)]")}>
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </Step>
        )}

        <div className="hidden border-t border-ink-faint/60 pt-6 lg:block">{summary}</div>
      </div>
    </div>
  );
}
