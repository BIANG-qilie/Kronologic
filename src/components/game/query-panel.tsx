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
import { Label } from "@/components/ui/label";
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
      <div className="rounded-sm border border-[var(--ink-faint)] bg-[var(--stage)]/50 p-4 text-sm text-[var(--ink-muted)]">
        {askAgain
          ? "再问一次——等待提问者续问。"
          : "等待当前调查员提问。"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {askAgain && (
        <p className="animate-fade-up text-sm text-[var(--amber)]">
          再问一次。
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-sm border px-3 py-2 text-sm transition-colors",
            kind === "place_time"
              ? "border-[var(--amber)] bg-[var(--amber)]/10 text-[var(--ink)]"
              : "border-[var(--ink-faint)] text-[var(--ink-muted)]"
          )}
          onClick={() => setKind("place_time")}
        >
          地点 × 时间
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-sm border px-3 py-2 text-sm transition-colors",
            kind === "place_person"
              ? "border-[var(--amber)] bg-[var(--amber)]/10 text-[var(--ink)]"
              : "border-[var(--ink-faint)] text-[var(--ink-muted)]"
          )}
          onClick={() => setKind("place_person")}
        >
          地点 × 人物
        </button>
      </div>

      <div>
        <Label className="mb-2 block text-[var(--ink-muted)]">选择地点</Label>
        <BoardMap
          scenario={scenario}
          selected={placeId}
          highlight={flash}
          onSelect={setPlaceId}
        />
      </div>

      {kind === "place_time" ? (
        <div>
          <Label className="mb-2 block text-[var(--ink-muted)]">选择时间</Label>
          <div className="grid grid-cols-6 gap-2">
            {([1, 2, 3, 4, 5, 6] as TimeId[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeId(t)}
                className={cn(
                  "h-10 rounded-sm border font-mono text-sm",
                  timeId === t
                    ? "border-[var(--amber)] bg-[var(--amber)]/15"
                    : "border-[var(--ink-faint)]"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <Label className="mb-2 block text-[var(--ink-muted)]">选择人物</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {scenario.people.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPersonId(p.id)}
                className={cn(
                  "rounded-sm border px-2 py-2 text-sm",
                  personId === p.id
                    ? "border-[var(--amber)] bg-[var(--amber)]/15"
                    : "border-[var(--ink-faint)]"
                )}
              >
                <span className="font-mono font-semibold">{p.letter}</span>
                <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Button
        className="w-full"
        disabled={
          busy ||
          !placeId ||
          (kind === "place_time" ? !timeId : !personId)
        }
        onClick={submit}
      >
        确认提问
      </Button>
    </div>
  );
}
