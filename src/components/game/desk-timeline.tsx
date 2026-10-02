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
            <span className="rounded-sm bg-[var(--stage)] px-1.5 py-0.5 text-[var(--parchment)]">
              {latest.kind === "place_time"
                ? `私 · 其中有 ${privateClue.privateLabel}`
                : `私 · 其中一次 ${privateClue.privateLabel}`}
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
  const edgeSet = useMemo(() => {
    const seen = new Set<string>();
    for (const [a, neighbors] of Object.entries(view.scenario.adjacency) as [
      PlaceId,
      PlaceId[],
    ][]) {
      for (const b of neighbors) {
        seen.add([a, b].sort().join("-"));
      }
    }
    return seen;
  }, [view.scenario.adjacency]);

  const placeName = (id: PlaceId) =>
    view.scenario.places.find((p) => p.id === id)?.name ?? id;

  const linked = (a: PlaceId, b: PlaceId) =>
    edgeSet.has([a, b].sort().join("-"));

  /** 5×3 track: room / door / room / door / room */
  function HDoor({ a, b }: { a: PlaceId; b: PlaceId }) {
    if (!linked(a, b)) return <div />;
    return (
      <div className="flex items-center justify-center self-stretch">
        <div
          title="通道"
          className={cn("w-full rounded-sm", compact ? "h-1" : "h-2")}
          style={{ backgroundColor: "var(--ink-deep)", opacity: 0.65 }}
        />
      </div>
    );
  }

  function VDoor({ a, b }: { a: PlaceId; b: PlaceId }) {
    if (!linked(a, b)) return <div />;
    return (
      <div className="flex items-center justify-center self-stretch">
        <div
          title="通道"
          className={cn("h-full rounded-sm", compact ? "w-1" : "w-2")}
          style={{ backgroundColor: "var(--ink-deep)", opacity: 0.65 }}
        />
      </div>
    );
  }

  function RoomCell({ placeId }: { placeId: PlaceId }) {
    const cellFact = facts.cells[String(time)]?.[placeId];
    const inference =
      payload.inference.cells[String(time)]?.[placeId] ?? "";
    const conflict =
      !!cellFact &&
      cellHasConflict(cellFact.public, cellFact.private, inference);
    const isEditing =
      !compact && editing?.time === time && editing?.place === placeId;

    const roomClass = cn(
      "relative z-10 flex h-full min-h-0 flex-col items-center justify-start rounded-sm border border-[var(--ink-deep)]/25 bg-[var(--parchment)] text-left",
      compact ? "overflow-visible px-0.5 py-0.5" : "overflow-hidden px-2 py-2",
      !compact &&
        "cursor-pointer transition-colors hover:border-[var(--ink-deep)]/45",
      isEditing && "border-[var(--amber)]/70"
    );

    const hasPublicCount = layers.public && cellFact?.public.count != null;
    const publicLetters =
      layers.public && cellFact ? cellFact.public.letters : [];
    const privateLetters =
      layers.private && cellFact ? cellFact.private.amongLetters : [];

    const inner = compact ? (
      <>
        {hasPublicCount && (
          <span className="rounded-[1px] bg-[var(--green-win)] px-0.5 font-mono text-[9px] font-bold leading-none text-[var(--curtain)]">
            {cellFact!.public.count}
          </span>
        )}
        <div className="mt-0.5 flex flex-wrap items-center justify-center gap-px">
          {publicLetters.map((letter) => (
            <span
              key={letter}
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--amber)] font-mono text-[8px] font-semibold leading-none text-[var(--ink-deep)]"
            >
              {letter}
            </span>
          ))}
          {privateLetters.map((letter) => (
            <span
              key={`p-${letter}`}
              className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-[1px] bg-[var(--stage)] px-0.5 font-mono text-[7px] font-semibold leading-none text-[var(--parchment)]"
              title={`私 · 其中有 ${letter}`}
            >
              {letter}
            </span>
          ))}
        </div>
        {!hasPublicCount &&
          publicLetters.length === 0 &&
          privateLetters.length === 0 && (
            <span className="mt-1 block h-1 w-1 rounded-full bg-[var(--ink-deep)]/15" />
          )}
      </>
    ) : (
      <>
        {conflict && layers.inference && (
          <span
            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--amber)]"
            title="事实与推理冲突"
          />
        )}
        {hasPublicCount && (
          <span className="absolute left-1 top-1 rounded-sm bg-[var(--green-win)] px-1 font-mono text-[12px] font-semibold leading-none text-[var(--curtain)]">
            {cellFact!.public.count} 人
          </span>
        )}
        <span className="mb-1 w-full text-center text-[11px] text-[var(--ink-deep)]">
          {placeName(placeId)}
        </span>
        <div className="flex min-h-[1.75rem] flex-wrap items-center justify-center gap-0.5">
          {publicLetters.map((letter) => (
            <span
              key={letter}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--amber)] bg-[var(--parchment)] font-mono text-sm text-[var(--ink-deep)]"
            >
              {letter}
            </span>
          ))}
        </div>
        {privateLetters.length > 0 && (
          <p className="mt-1 w-full truncate rounded-sm bg-[var(--stage)] px-1 py-0.5 text-center text-[11px] leading-tight text-[var(--parchment)]">
            {`私 · 其中有 ${privateLetters.join("、")}`}
          </p>
        )}
        {layers.inference && (
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
              <p className="text-center font-mono text-xs tracking-wide text-[var(--ink-deep)]">
                {inference}
              </p>
            ) : null}
          </div>
        )}
      </>
    );

    if (compact) {
      return <div className={roomClass}>{inner}</div>;
    }
    return (
      <button
        type="button"
        onClick={() => {
          if (!layers.inference) return;
          onEdit(isEditing ? null : { time, place: placeId });
        }}
        className={roomClass}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full",
        compact ? "aspect-[3/2]" : "aspect-[3/2] max-h-[420px]"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 grid h-full w-full",
          compact ? "p-0.5" : "p-1 sm:p-1.5"
        )}
        style={{
          gridTemplateColumns: `1fr ${compact ? "8px" : "16px"} 1fr ${compact ? "8px" : "16px"} 1fr`,
          gridTemplateRows: `1fr ${compact ? "8px" : "16px"} 1fr`,
        }}
      >
        <RoomCell placeId="porch" />
        <HDoor a="porch" b="hall" />
        <RoomCell placeId="hall" />
        <HDoor a="hall" b="stage" />
        <RoomCell placeId="stage" />

        <VDoor a="porch" b="dress" />
        <div />
        <VDoor a="hall" b="gallery" />
        <div />
        <VDoor a="stage" b="prop" />

        <RoomCell placeId="dress" />
        <HDoor a="dress" b="gallery" />
        <RoomCell placeId="gallery" />
        <HDoor a="gallery" b="prop" />
        <RoomCell placeId="prop" />
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
                  "shrink-0 rounded-sm border transition-all",
                  active
                    ? "w-[5.75rem] border-[var(--amber)] opacity-100 sm:w-28"
                    : "w-[4.75rem] border-[var(--ink-deep)]/20 opacity-80 hover:opacity-100 sm:w-[5.5rem]"
                )}
              >
                <div className="overflow-hidden bg-[var(--parchment)]/80 px-0.5 py-0.5">
                  <p className="text-center font-mono text-[10px] font-semibold text-[var(--ink-deep)]/70">
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
                            {layers.private &&
                              visitFact &&
                              visitFact.private.amongTimes.length > 0 && (
                                <div className="rounded-sm bg-[var(--stage)] px-0.5 text-[9px] text-[var(--parchment)]">
                                  私 · 其中一次{" "}
                                  {visitFact.private.amongTimes.join("/")}
                                </div>
                              )}
                            {layers.public &&
                              visitFact?.public.count != null && (
                                <div className="font-mono text-[12px] font-semibold text-[var(--green-win)]">
                                  {visitFact.public.count} 人
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
