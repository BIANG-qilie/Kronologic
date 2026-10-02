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
          {askAgain ? "再问一次" : "还没轮到你"}
        </p>
        <p className="max-w-xs text-sm leading-relaxed text-[var(--ink-muted)]">
          {askAgain
            ? "上一问答案是 0，提问者可以续问，等他问完。"
            : "趁这会儿去桌面上推一推，问到你时这里会亮起来。"}
        </p>
      </div>
    );
  }

  const placeName = scenario.places.find((p) => p.id === placeId)?.name;
  const personName = scenario.people.find((p) => p.id === personId)?.name;
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

  return (
    <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
      <div className="space-y-8">
        {askAgain && (
          <p className="animate-fade-up rounded-[3px] bg-[var(--green-win)]/10 px-4 py-2.5 text-sm text-[var(--green-win)]">
            上一问的答案是 0，可以再问一次。
          </p>
        )}
        <Step n={1} title="问什么">
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(
              [
                ["place_time", "地点 × 时间", "那一刻房里有几个人"],
                ["place_person", "地点 × 人物", "这人去过那里几次"],
              ] as const
            ).map(([k, label, hint]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(chip(kind === k), "px-4 py-3 text-left")}
              >
                <span className="block font-display text-lg">{label}</span>
                <span className={cn("mt-0.5 block text-xs", kind === k ? "text-[var(--curtain)]/70" : "text-[var(--ink-muted)]")}>
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

      <div className="space-y-8 lg:sticky lg:top-24 lg:self-start">
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
          <Step n={3} title="哪个人">
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
              {scenario.people.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={personId === p.id}
                  onClick={() => setPersonId(p.id)}
                  className={cn(chip(personId === p.id), "px-3 py-2.5 text-left")}
                >
                  <span className="font-mono text-base font-semibold">{p.letter}</span>
                  <span className={cn("ml-2 text-sm", personId === p.id ? "text-[var(--curtain)]/80" : "text-[var(--ink-muted)]")}>
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </Step>
        )}

        <div className="border-t border-[var(--ink-faint)]/60 pt-6">
          <p className="min-h-[2.5rem] font-display text-2xl leading-snug text-[var(--ink-muted)]" aria-live="polite">
            {placeName ? <span className="text-[var(--ink)]">{placeName}</span> : "某个房间"}
            <span className="mx-2 text-[var(--ink-faint)]">×</span>
            {kind === "place_time" ? (
              timeId ? <span className="text-[var(--ink)]">时间 {timeId}</span> : "某个时间"
            ) : personName ? (
              <span className="text-[var(--ink)]">{personName}</span>
            ) : (
              "某个人"
            )}
          </p>
          <Button className="group mt-5 w-full" size="lg" disabled={busy || !ready} onClick={submit}>
            {busy ? "灯在亮…" : "提问"}
            {!busy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
