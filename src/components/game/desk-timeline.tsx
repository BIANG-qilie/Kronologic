"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PlaceId,
  PersonId,
  RoomPublicView,
  TimeId,
} from "@/lib/game/types";
import {
  parseNotes,
  serializeNotes,
  type NotesPayloadV2,
} from "@/lib/game/notes-format";
import {
  cellHasConflict,
  projectFacts,
  visitHasConflict,
} from "@/lib/game/project-facts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TIMES: TimeId[] = [1, 2, 3, 4, 5, 6];
const PLACE_ORDER: PlaceId[] = [
  "porch",
  "hall",
  "stage",
  "dress",
  "gallery",
  "prop",
];

type LayerFlags = {
  public: boolean;
  private: boolean;
  inference: boolean;
};

export function DeskTimeline({
  view,
  onSaveNotes,
}: {
  view: RoomPublicView;
  onSaveNotes: (text: string) => Promise<void>;
}) {
  const people = view.scenario.people.map((p) => p.id);
  const places = view.scenario.places.map((p) => p.id) as PlaceId[];

  const facts = useMemo(
    () =>
      projectFacts({
        opening: view.scenario.opening,
        places,
        people,
        queryLog: view.queryLog,
        privateClues: view.you?.privateClues ?? null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view.scenario.opening, view.queryLog, view.you?.privateClues, view.scenario.id]
  );

  const [payload, setPayload] = useState<NotesPayloadV2>(() =>
    parseNotes(view.you?.notes, people, places)
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [activeTime, setActiveTime] = useState<TimeId>(1);
  const [layers, setLayers] = useState<LayerFlags>({
    public: true,
    private: true,
    inference: true,
  });
  const [wide, setWide] = useState(false);

  useEffect(() => {
    setPayload(parseNotes(view.you?.notes, people, places));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.you?.notes, view.scenario.id]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const placeName = useMemo(() => {
    const m = new Map(view.scenario.places.map((p) => [p.id, p.name]));
    return (id: string) => m.get(id as PlaceId) ?? id;
  }, [view.scenario.places]);

  async function save() {
    setSaving(true);
    try {
      await onSaveNotes(serializeNotes(payload));
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  function setCell(time: TimeId, place: PlaceId, value: string) {
    setPayload((prev) => ({
      ...prev,
      inference: {
        ...prev.inference,
        cells: {
          ...prev.inference.cells,
          [String(time)]: {
            ...(prev.inference.cells[String(time)] ?? {}),
            [place]: value,
          },
        },
      },
    }));
  }

  function setVisit(person: PersonId, place: PlaceId, value: string) {
    setPayload((prev) => ({
      ...prev,
      inference: {
        ...prev.inference,
        visits: {
          ...prev.inference.visits,
          [person]: {
            ...(prev.inference.visits[person] ?? {}),
            [place]: value,
          },
        },
      },
    }));
  }

  function TimeMap({
    time,
    compact,
  }: {
    time: TimeId;
    compact?: boolean;
  }) {
    return (
      <div
        className={cn(
          "rounded-sm border border-[var(--ink-faint)] bg-[var(--stage)]/50 p-2",
          !compact && "p-3"
        )}
      >
        <p
          className={cn(
            "mb-2 font-mono text-[var(--amber)]",
            compact ? "text-[10px]" : "text-xs"
          )}
        >
          时间 {time}
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {PLACE_ORDER.map((placeId) => {
            const cellFact = facts.cells[String(time)]?.[placeId];
            const inference =
              payload.inference.cells[String(time)]?.[placeId] ?? "";
            const conflict =
              !!cellFact &&
              cellHasConflict(cellFact.public, cellFact.private, inference);
            return (
              <div
                key={placeId}
                className={cn(
                  "relative rounded-sm border bg-[var(--parchment)] p-1.5 text-[var(--ink-deep)]",
                  conflict
                    ? "border-destructive/70"
                    : "border-[var(--ink-faint)]"
                )}
              >
                {conflict && (
                  <span
                    className="absolute -right-1 -top-1 rounded-sm bg-destructive px-1 text-[9px] text-white"
                    title="事实与推理冲突"
                  >
                    !
                  </span>
                )}
                <p className="mb-0.5 truncate text-[9px] text-[var(--ink-muted)]">
                  {placeName(placeId)}
                </p>
                {layers.public && cellFact && (
                  <div className="mb-0.5 space-y-0.5 border-b border-[var(--ink-deep)]/15 pb-0.5 font-mono text-[10px] leading-tight text-[var(--ink-deep)]">
                    {cellFact.public.count != null && (
                      <div className="font-semibold">
                        x{cellFact.public.count}
                      </div>
                    )}
                    {cellFact.public.letters.length > 0 && (
                      <div className="tracking-wide">
                        {cellFact.public.letters.join("")}
                      </div>
                    )}
                  </div>
                )}
                {layers.private &&
                  cellFact &&
                  cellFact.private.amongLetters.length > 0 && (
                    <div className="mb-0.5 font-mono text-[10px] italic text-[var(--ink-muted)]">
                      其中有 {cellFact.private.amongLetters.join("、")}
                    </div>
                  )}
                {layers.inference && (
                  <input
                    value={inference}
                    onChange={(e) =>
                      setCell(time, placeId, e.target.value.slice(0, 12))
                    }
                    placeholder="推理"
                    className="w-full bg-transparent font-mono text-xs outline-none placeholder:text-[var(--ink-muted)]/50"
                    aria-label={`时间${time} ${placeName(placeId)} 推理`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--ink-muted)]">图层</span>
        {(
          [
            ["public", "公有"],
            ["private", "私有"],
            ["inference", "推理"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() =>
              setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
            }
            className={cn(
              "rounded-sm border px-2 py-1 text-xs",
              layers[key]
                ? "border-[var(--amber)] bg-[var(--amber)]/15 text-[var(--ink)]"
                : "border-[var(--ink-faint)] text-[var(--ink-muted)]"
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-[var(--ink-muted)]">
          公有实线 / 私有仅本座 / 推理可改 · 冲突标 !
        </span>
      </div>

      {!wide && (
        <div className="flex gap-1">
          {TIMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTime(t)}
              className={cn(
                "h-9 flex-1 rounded-sm border font-mono text-sm",
                activeTime === t
                  ? "border-[var(--amber)] bg-[var(--amber)]/15"
                  : "border-[var(--ink-faint)] text-[var(--ink-muted)]"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {wide ? (
        <div className="space-y-3">
          <div className="flex gap-1">
            {TIMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTime(t)}
                className={cn(
                  "h-8 flex-1 rounded-sm border font-mono text-xs",
                  activeTime === t
                    ? "border-[var(--amber)] bg-[var(--amber)]/15"
                    : "border-[var(--ink-faint)] text-[var(--ink-muted)]"
                )}
              >
                T{t}
              </button>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <TimeMap time={activeTime} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TIMES.filter((t) => t !== activeTime).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTime(t)}
                  className="text-left"
                >
                  <TimeMap time={t} compact />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <TimeMap time={activeTime} />
      )}

      <div>
        <p className="mb-2 text-sm text-[var(--ink-muted)]">到访次数</p>
        <div className="overflow-x-auto rounded-sm border border-[var(--ink-faint)]">
          <table className="w-full min-w-[520px] border-collapse text-xs text-[var(--ink)]">
            <thead>
              <tr className="bg-[var(--stage)]">
                <th className="border-b border-[var(--ink-faint)] px-2 py-2 text-left">
                  人物
                </th>
                {PLACE_ORDER.map((pid) => (
                  <th
                    key={pid}
                    className="border-b border-[var(--ink-faint)] px-1 py-2"
                  >
                    {placeName(pid)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.scenario.people.map((person) => (
                <tr key={person.id}>
                  <td className="border-b border-[var(--ink-faint)]/40 px-2 py-1 font-mono">
                    {person.letter}
                  </td>
                  {PLACE_ORDER.map((pid) => {
                    const visitFact = facts.visits[person.id]?.[pid];
                    const inference =
                      payload.inference.visits[person.id]?.[pid] ?? "";
                    const conflict =
                      !!visitFact &&
                      visitHasConflict(visitFact.public, inference);
                    return (
                      <td
                        key={pid}
                        className={cn(
                          "relative border-b border-[var(--ink-faint)]/40 px-1 py-1 align-top",
                          conflict && "bg-destructive/10"
                        )}
                      >
                        {conflict && (
                          <span className="absolute right-0 top-0 text-[9px] text-destructive">
                            !
                          </span>
                        )}
                        {layers.public && visitFact?.public.count != null && (
                          <div className="font-mono text-[10px] text-[var(--green-win)]">
                            x{visitFact.public.count}
                          </div>
                        )}
                        {layers.private &&
                          visitFact &&
                          visitFact.private.amongTimes.length > 0 && (
                            <div className="text-[9px] italic text-[var(--ink-muted)]">
                              其中一次是 T
                              {visitFact.private.amongTimes.join("/")}
                            </div>
                          )}
                        {layers.inference && (
                          <input
                            value={inference}
                            onChange={(e) =>
                              setVisit(
                                person.id,
                                pid,
                                e.target.value.replace(/[^\d]/g, "").slice(0, 1)
                              )
                            }
                            className="mt-0.5 h-7 w-full rounded-sm border border-[var(--ink-faint)] bg-[var(--parchment)] text-center font-mono text-[var(--ink-deep)] outline-none focus:border-[var(--amber)]"
                            inputMode="numeric"
                            aria-label={`${person.name} 访问 ${placeName(pid)}`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <textarea
        value={payload.free}
        onChange={(e) =>
          setPayload((prev) => ({ ...prev, free: e.target.value }))
        }
        placeholder="自由笔记（可选）"
        className="min-h-[72px] w-full resize-y rounded-sm border border-[var(--ink-faint)] bg-[var(--parchment)] p-3 font-mono text-sm text-[var(--ink-deep)] placeholder:text-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--ink-muted)]">
          {savedAt
            ? `推理已同步 ${new Date(savedAt).toLocaleTimeString()}`
            : "只保存推理层；公有/私有每次从日志重算"}
        </span>
        <Button size="sm" variant="secondary" disabled={saving} onClick={save}>
          {saving ? "保存中…" : "保存推理"}
        </Button>
      </div>
    </div>
  );
}
