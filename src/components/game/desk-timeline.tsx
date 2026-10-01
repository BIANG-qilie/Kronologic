"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  type FactProjection,
} from "@/lib/game/project-facts";
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

const LAYOUT: Record<PlaceId, { col: number; row: number }> = {
  porch: { col: 1, row: 1 },
  hall: { col: 2, row: 1 },
  stage: { col: 3, row: 1 },
  dress: { col: 1, row: 2 },
  gallery: { col: 2, row: 2 },
  prop: { col: 3, row: 2 },
};

type LayerFlags = {
  public: boolean;
  private: boolean;
  inference: boolean;
};

function placeLabel(view: RoomPublicView, id: string): string {
  return view.scenario.places.find((p) => p.id === id)?.name ?? id;
}

function personLabel(view: RoomPublicView, id: string): string {
  const p = view.scenario.people.find((x) => x.id === id);
  return p ? `${p.letter}·${p.name}` : id;
}

function LatestClueStrip({ view }: { view: RoomPublicView }) {
  const latest = view.queryLog[view.queryLog.length - 1];
  if (!latest) return null;
  const privateClue = view.you?.privateClues.find(
    (c) => c.queryId === latest.id
  );
  const q =
    latest.kind === "place_time"
      ? `${placeLabel(view, latest.placeId)} × 时间 ${latest.timeId}`
      : `${placeLabel(view, latest.placeId)} × ${personLabel(view, latest.personId!)}`;

  return (
    <div className="mb-4 border-b border-[var(--ink-deep)]/15 pb-3 text-[var(--ink-deep)]">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
        <span className="font-mono text-[var(--green-win)]">
          {latest.sharedLabel}
        </span>
        <span className="text-[var(--ink-deep)]/80">{q}</span>
        {privateClue &&
          privateClue.privateLabel &&
          privateClue.privateLabel !== "—" && (
            <span className="italic text-[var(--ink-deep)]/55">
              {latest.kind === "place_time"
                ? `其中有 ${privateClue.privateLabel}`
                : `其中一次 · ${privateClue.privateLabel}`}
            </span>
          )}
      </div>
    </div>
  );
}

function FloorPlan({
  view,
  time,
  compact,
  layers,
  facts,
  payload,
  editing,
  onEdit,
  onSetCell,
}: {
  view: RoomPublicView;
  time: TimeId;
  compact?: boolean;
  layers: LayerFlags;
  facts: FactProjection;
  payload: NotesPayloadV2;
  editing: { time: TimeId; place: PlaceId } | null;
  onEdit: (key: { time: TimeId; place: PlaceId } | null) => void;
  onSetCell: (time: TimeId, place: PlaceId, value: string) => void;
}) {
  const edges = useMemo(() => {
    const seen = new Set<string>();
    const list: [PlaceId, PlaceId][] = [];
    for (const [a, neighbors] of Object.entries(view.scenario.adjacency) as [
      PlaceId,
      PlaceId[],
    ][]) {
      for (const b of neighbors) {
        const key = [a, b].sort().join("-");
        if (seen.has(key)) continue;
        seen.add(key);
        list.push([a, b]);
      }
    }
    return list;
  }, [view.scenario.adjacency]);

  function center(id: PlaceId) {
    const { col, row } = LAYOUT[id];
    return { x: (col - 0.5) * (100 / 3), y: (row - 0.5) * 50 };
  }

  const placeName = (id: PlaceId) =>
    view.scenario.places.find((p) => p.id === id)?.name ?? id;

  return (
    <div
      className={cn(
        "relative w-full",
        compact ? "aspect-[3/2]" : "aspect-[3/2] max-h-[420px]"
      )}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        aria-hidden
      >
        {edges.map(([a, b]) => {
          const pa = center(a);
          const pb = center(b);
          return (
            <line
              key={`${a}-${b}`}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke="var(--ink-deep)"
              strokeOpacity={0.28}
              strokeWidth={compact ? 0.7 : 0.9}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-2 p-1 sm:gap-3 sm:p-2">
        {PLACE_ORDER.map((placeId) => {
          const cellFact = facts.cells[String(time)]?.[placeId];
          const inference =
            payload.inference.cells[String(time)]?.[placeId] ?? "";
          const conflict =
            !!cellFact &&
            cellHasConflict(cellFact.public, cellFact.private, inference);
          const isEditing =
            !compact &&
            editing?.time === time &&
            editing?.place === placeId;

          return (
            <button
              key={placeId}
              type="button"
              disabled={compact}
              onClick={() => {
                if (compact || !layers.inference) return;
                onEdit(isEditing ? null : { time, place: placeId });
              }}
              className={cn(
                "relative flex flex-col items-center justify-start overflow-hidden rounded-sm border border-[var(--ink-deep)]/20 bg-transparent text-left transition-colors",
                compact ? "px-1 py-1" : "px-2 py-2",
                !compact && "hover:border-[var(--ink-deep)]/35",
                isEditing && "border-[var(--amber)]/60"
              )}
            >
              {conflict && layers.inference && (
                <span
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--amber)]"
                  title="事实与推理冲突"
                />
              )}
              {layers.public && cellFact?.public.count != null && (
                <span
                  className={cn(
                    "absolute left-1 top-1 font-mono text-[var(--green-win)]",
                    compact ? "text-[8px]" : "text-[10px]"
                  )}
                >
                  x{cellFact.public.count}
                </span>
              )}
              <span
                className={cn(
                  "mb-1 w-full text-center text-[var(--ink-deep)]/70",
                  compact ? "text-[8px] leading-tight" : "text-[11px]"
                )}
              >
                {placeName(placeId)}
              </span>

              <div
                className={cn(
                  "flex flex-wrap items-center justify-center gap-0.5",
                  compact ? "min-h-[0.9rem]" : "min-h-[1.75rem]"
                )}
              >
                {layers.public &&
                  cellFact?.public.letters.map((letter) => (
                    <span
                      key={letter}
                      className={cn(
                        "inline-flex items-center justify-center rounded-full border border-[var(--amber)] font-mono text-[var(--ink-deep)]",
                        compact ? "h-4 w-4 text-[9px]" : "h-7 w-7 text-sm"
                      )}
                    >
                      {letter}
                    </span>
                  ))}
              </div>

              {layers.private &&
                cellFact &&
                cellFact.private.amongLetters.length > 0 && (
                  <p
                    className={cn(
                      "mt-1 w-full text-center italic leading-tight text-[var(--ink-deep)]/55",
                      compact ? "text-[7px]" : "text-[10px]"
                    )}
                  >
                    {compact
                      ? cellFact.private.amongLetters.join("")
                      : `其中有 ${cellFact.private.amongLetters.join("、")}`}
                  </p>
                )}

              {layers.inference && !compact && (
                <div className="mt-auto w-full pt-1">
                  {isEditing ? (
                    <RoomInferenceInput
                      value={inference}
                      autoFocus
                      onChange={(v) => onSetCell(time, placeId, v)}
                      onBlur={() => onEdit(null)}
                      ariaLabel={`时间${time} ${placeName(placeId)} 推理`}
                    />
                  ) : inference ? (
                    <p className="text-center font-mono text-xs tracking-wide text-[var(--ink-deep)]/75">
                      {inference}
                    </p>
                  ) : null}
                </div>
              )}
              {layers.inference && compact && inference ? (
                <p className="mt-0.5 font-mono text-[8px] text-[var(--ink-deep)]/65">
                  {inference}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoomInferenceInput({
  value,
  onChange,
  onBlur,
  autoFocus,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  autoFocus?: boolean;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, 12))}
      onBlur={onBlur}
      aria-label={ariaLabel}
      className="w-full bg-transparent text-center font-mono text-xs text-[var(--ink-deep)] outline-none"
    />
  );
}

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
  const [editing, setEditing] = useState<{
    time: TimeId;
    place: PlaceId;
  } | null>(null);
  const [visitsOpen, setVisitsOpen] = useState(false);
  const [marginOpen, setMarginOpen] = useState(false);

  useEffect(() => {
    setPayload(parseNotes(view.you?.notes, people, places));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.you?.notes, view.scenario.id]);

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

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="relative rounded-sm border border-[var(--ink-deep)]/15 bg-[var(--parchment)] px-4 py-5 text-[var(--ink-deep)] shadow-[0_12px_40px_-20px_rgba(0,0,0,0.55)] sm:px-7 sm:py-7">
        <div className="absolute right-3 top-3 flex gap-1.5 sm:right-4 sm:top-4">
          {(
            [
              ["public", "公"],
              ["private", "私"],
              ["inference", "推"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              title={
                key === "public" ? "公有" : key === "private" ? "私有" : "推理"
              }
              onClick={() =>
                setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
              }
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border border-[var(--amber)] font-display text-xs transition-opacity",
                layers[key] ? "opacity-100" : "opacity-35"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <h2 className="font-display text-3xl tracking-tight text-[var(--ink-deep)] sm:text-4xl">
          时间 {activeTime}
        </h2>

        <LatestClueStrip view={view} />

        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {TIMES.map((t) => {
            const active = t === activeTime;
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setActiveTime(t);
                  setEditing(null);
                }}
                className={cn(
                  "shrink-0 overflow-hidden rounded-sm border transition-all",
                  active
                    ? "w-[4.5rem] border-[var(--amber)] opacity-100 sm:w-24"
                    : "w-14 border-[var(--ink-deep)]/20 opacity-70 hover:opacity-90 sm:w-16"
                )}
              >
                <div className="bg-[var(--parchment)]/80 px-0.5 py-0.5">
                  <p className="text-center font-mono text-[9px] text-[var(--ink-deep)]/60">
                    {t}
                  </p>
                  <FloorPlan
                    view={view}
                    time={t}
                    compact
                    layers={layers}
                    facts={facts}
                    payload={payload}
                    editing={null}
                    onEdit={() => undefined}
                    onSetCell={() => undefined}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <FloorPlan
          view={view}
          time={activeTime}
          layers={layers}
          facts={facts}
          payload={payload}
          editing={editing}
          onEdit={setEditing}
          onSetCell={setCell}
        />

        <div className="mt-6 border-t border-[var(--ink-deep)]/12 pt-3">
          <button
            type="button"
            onClick={() => setVisitsOpen((v) => !v)}
            className="font-display text-sm tracking-wide text-[var(--ink-deep)]/70"
          >
            到访{visitsOpen ? " ▾" : ""}
          </button>
          {visitsOpen && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="py-1 pr-2 text-left font-normal text-[var(--ink-deep)]/50">
                      —
                    </th>
                    {PLACE_ORDER.map((pid) => (
                      <th
                        key={pid}
                        className="px-0.5 py-1 text-center font-normal text-[var(--ink-deep)]/50"
                      >
                        {placeName(pid)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {view.scenario.people.map((person) => (
                    <tr key={person.id}>
                      <td className="py-1 pr-2 font-mono text-[var(--ink-deep)]">
                        {person.letter}
                        <span className="ml-1 text-[var(--ink-deep)]/45">
                          {person.name}
                        </span>
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
                            className="relative px-0.5 py-1 text-center align-middle"
                          >
                            {conflict && (
                              <span className="absolute right-0 top-0 h-1 w-1 rounded-full bg-[var(--amber)]" />
                            )}
                            {layers.public &&
                              visitFact?.public.count != null && (
                                <div className="font-mono text-[10px] text-[var(--green-win)]">
                                  x{visitFact.public.count}
                                </div>
                              )}
                            {layers.private &&
                              visitFact &&
                              visitFact.private.amongTimes.length > 0 && (
                                <div className="text-[9px] italic text-[var(--ink-deep)]/50">
                                  其中一次 ·{" "}
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
                                    e.target.value
                                      .replace(/[^\d]/g, "")
                                      .slice(0, 1)
                                  )
                                }
                                className="mx-auto mt-0.5 block w-6 border-0 bg-transparent text-center font-mono text-xs text-[var(--ink-deep)] outline-none"
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
          )}
        </div>

        <div className="mt-5 border-t border-[var(--ink-deep)]/12 pt-2">
          {!marginOpen && !payload.free ? (
            <button
              type="button"
              onClick={() => setMarginOpen(true)}
              className="block w-full border-b border-[var(--ink-deep)]/20 py-2 text-left text-xs text-[var(--ink-deep)]/40"
            >
              旁注
            </button>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setMarginOpen((v) => !v)}
                className="mb-1 text-xs text-[var(--ink-deep)]/50"
              >
                旁注
              </button>
              {(marginOpen || !!payload.free) && (
                <textarea
                  value={payload.free}
                  onChange={(e) =>
                    setPayload((prev) => ({ ...prev, free: e.target.value }))
                  }
                  onBlur={() => {
                    if (!payload.free.trim()) setMarginOpen(false);
                  }}
                  rows={2}
                  className="w-full resize-none border-0 bg-transparent font-mono text-xs text-[var(--ink-deep)] outline-none"
                />
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-[10px] text-[var(--ink-deep)]/40">
            {savedAt ? `已记 ${new Date(savedAt).toLocaleTimeString()}` : ""}
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="font-display text-sm text-[var(--ink-deep)]/70 underline-offset-4 hover:underline disabled:opacity-50"
          >
            {saving ? "记下…" : "记下"}
          </button>
        </div>
      </div>
    </div>
  );
}
