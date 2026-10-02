"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Crosshair } from "lucide-react";
import type {
  PlaceId,
  PersonId,
  RoomPublicView,
  TimeId,
} from "@/lib/game/types";
import {
  emptyCellMark,
  parseNotes,
  serializeNotes,
  type CellMark,
  type NotesPayloadV3,
  type SuspectBoard as Board,
} from "@/lib/game/notes-format";
import {
  cellHasFacts,
  mergeCellMarks,
  projectFacts,
  visitHasFacts,
  sourcesLabel,
  visitHasConflict,
  type FactProjection,
  type LayerVisibility,
  type MarkSource,
  type MergedCell,
} from "@/lib/game/project-facts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CellMarkPicker, VisitPicker } from "./cell-mark-picker";
import { GlyphToken, SOURCE_COLOR, SourceGlyph } from "./source-glyph";
import { SuspectBoard } from "./suspect-board";

const TIMES: TimeId[] = [1, 2, 3, 4, 5, 6];
const PLACE_ORDER: PlaceId[] = ["porch", "hall", "stage", "dress", "gallery", "prop"];

const LAYER_NAME: Record<MarkSource, string> = {
  public: "公有",
  private: "私有",
  inference: "推理",
};

type CellKey = { time: TimeId; place: PlaceId };

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
  const privateClue = view.you?.privateClues.find((c) => c.queryId === latest.id);
  const q =
    latest.kind === "place_time"
      ? `${placeLabel(view, latest.placeId)} × 时间 ${latest.timeId}`
      : `${placeLabel(view, latest.placeId)} × ${personLabel(view, latest.personId!)}`;

  return (
    <div className="mb-4 border-b border-[var(--ink-deep)]/15 pb-3 text-[var(--ink-deep)]">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
        <span className="font-mono font-semibold text-[var(--mark-public)]">
          {(() => {
            const n = /^x?(\d+)$/i.exec(latest.sharedLabel)?.[1];
            return n != null ? `${n} ${latest.kind === "place_time" ? "人" : "次"}` : latest.sharedLabel;
          })()}
        </span>
        <span className="text-[var(--ink-deep)]/80">{q}</span>
        {privateClue && privateClue.privateLabel && privateClue.privateLabel !== "—" && (
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

function useEdges(view: RoomPublicView) {
  return useMemo(() => {
    const seen = new Set<string>();
    for (const [a, neighbors] of Object.entries(view.scenario.adjacency) as [PlaceId, PlaceId[]][]) {
      for (const b of neighbors) seen.add([a, b].sort().join("-"));
    }
    return (a: PlaceId, b: PlaceId) => seen.has([a, b].sort().join("-"));
  }, [view.scenario.adjacency]);
}

/** 5×3 track: room / door / room / door / room, rows joined by vertical doors. */
function FloorGrid({
  linked,
  compact,
  room,
}: {
  linked: (a: PlaceId, b: PlaceId) => boolean;
  compact?: boolean;
  room: (place: PlaceId) => ReactNode;
}) {
  const gap = compact ? "5px" : "16px";
  const door = (a: PlaceId, b: PlaceId, dir: "h" | "v") =>
    linked(a, b) ? (
      <div className="flex items-center justify-center self-stretch">
        <div
          className={cn(
            "rounded-full",
            dir === "h" ? (compact ? "h-px w-full" : "h-2 w-full rounded-sm") : compact ? "h-full w-px" : "h-full w-2 rounded-sm"
          )}
          style={{ backgroundColor: "var(--ink-deep)", opacity: compact ? 0.5 : 0.65 }}
        />
      </div>
    ) : (
      <div />
    );
  return (
    <div
      className="absolute inset-0 grid h-full w-full"
      style={{
        gridTemplateColumns: `1fr ${gap} 1fr ${gap} 1fr`,
        gridTemplateRows: `1fr ${gap} 1fr`,
        padding: compact ? "2px" : "6px",
      }}
    >
      {room("porch")}
      {door("porch", "hall", "h")}
      {room("hall")}
      {door("hall", "stage", "h")}
      {room("stage")}

      {door("porch", "dress", "v")}
      <div />
      {door("hall", "gallery", "v")}
      <div />
      {door("stage", "prop", "v")}

      {room("dress")}
      {door("dress", "gallery", "h")}
      {room("gallery")}
      {door("gallery", "prop", "h")}
      {room("prop")}
    </div>
  );
}

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

function cellMarkOf(payload: NotesPayloadV3, time: TimeId, place: PlaceId): CellMark {
  return payload.inference.cells[String(time)]?.[place] ?? emptyCellMark();
}

function RoomCell({
  view,
  time,
  place,
  merged,
  mark,
  board,
  open,
  canEdit,
  locked,
  onOpenChange,
  onChange,
}: {
  view: RoomPublicView;
  time: TimeId;
  place: PlaceId;
  merged: MergedCell;
  mark: CellMark;
  board: Board;
  open: boolean;
  canEdit: boolean;
  locked: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (mark: CellMark) => void;
}) {
  const name = placeLabel(view, place);
  const placeVerdict = board.places[place];
  const count = merged.count;

  return (
    <Popover open={open} onOpenChange={(o) => canEdit && onOpenChange(o)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`时间${time} ${name}`}
          aria-disabled={!canEdit}
          title={locked ? "已有公开或私有信息，这一格不再标推理" : undefined}
          className={cn(
            "relative z-10 flex h-full min-h-0 flex-col items-center overflow-hidden rounded-sm border bg-[var(--parchment)] px-1.5 py-1.5 transition-colors sm:px-2 sm:py-2",
            canEdit ? "cursor-pointer hover:border-[var(--ink-deep)]/45" : "cursor-default",
            open ? "border-[var(--amber)]" : "border-[var(--ink-deep)]/25",
            placeVerdict === "target" && "border-2 border-[var(--amber-dim)] bg-[#dcc596]",
            placeVerdict === "excluded" && "opacity-45"
          )}
        >
          {merged.conflict && (
            <span
              className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--mark-conflict)]"
              title="推理与事实冲突"
            />
          )}
          {count && (
            <Tip
              label={
                count.inferred != null
                  ? `${count.value} 人 · 公（推 ${count.inferred}）`
                  : `${count.value} 人 · ${sourcesLabel(count.sources)}`
              }
            >
              <span className="absolute left-1 top-1">
                <GlyphToken sources={count.sources} size="sm" conflict={count.inferred != null}>
                  {count.value}
                </GlyphToken>
              </span>
            </Tip>
          )}
          <span className="mb-1 flex w-full items-center justify-center gap-1 text-[11px] text-[var(--ink-deep)]">
            {placeVerdict === "target" && <Crosshair className="h-3 w-3 text-[var(--amber-dim)]" aria-hidden />}
            <span className={cn(placeVerdict === "excluded" && "line-through")}>{name}</span>
          </span>
          <div className="flex min-h-[2rem] flex-wrap items-center justify-center gap-1">
            {merged.people.map((p) => {
              const v = board.people[p.person];
              return (
                <Tip key={p.person} label={`${p.person} · ${sourcesLabel(p.sources)}`}>
                  <span>
                    <GlyphToken
                      sources={p.sources}
                      dim={v === "excluded"}
                      emphasis={v === "target"}
                    >
                      {p.person}
                    </GlyphToken>
                  </span>
                </Tip>
              );
            })}
          </div>
          {merged.absent.length > 0 && (
            <Tip label={`推 · 不在 ${merged.absent.join("、")}`}>
              <span className="mt-auto font-mono text-[10px] tracking-wider text-[var(--mark-inference)]/80 line-through">
                {merged.absent.join(" ")}
              </span>
            </Tip>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="w-[min(20rem,calc(100vw-2rem))] border-[var(--ink-deep)]/25 bg-[var(--parchment)] p-3"
      >
        <CellMarkPicker
          view={view}
          title={`时间 ${time} · ${name}`}
          mark={mark}
          merged={merged}
          onChange={onChange}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Film-strip room: one count plus up to three letters, no labels. */
function MiniRoom({ merged, verdict }: { merged: MergedCell; verdict?: "target" | "excluded" }) {
  const hasPublic =
    merged.count?.sources.includes("public") || merged.people.some((p) => p.sources.includes("public"));
  const hasAny = merged.count != null || merged.people.length > 0;
  const shown = merged.people.slice(0, 3);
  const extra = merged.people.length - shown.length;
  return (
    <div
      className={cn(
        "relative z-10 flex min-h-0 flex-col items-center justify-center gap-px rounded-[2px] border",
        hasPublic
          ? "border-[var(--ink-deep)]/35 bg-[#c5b38c]"
          : hasAny
            ? "border-[var(--ink-deep)]/25 bg-[#cebf9b]"
            : "border-[var(--ink-deep)]/15 bg-[var(--parchment)]",
        verdict === "excluded" && "opacity-40",
        verdict === "target" && "border-[var(--amber-dim)] shadow-[inset_0_0_0_1px_var(--amber-dim)]"
      )}
    >
      {merged.conflict && (
        <span className="absolute right-px top-px h-1 w-1 rounded-full bg-[var(--mark-conflict)]" />
      )}
      {merged.count && (
        <span
          className={cn(
            "font-mono text-[11px] font-bold leading-none",
            merged.count.sources.includes("public")
              ? "text-[var(--mark-public)]"
              : "text-[var(--mark-inference)]",
            merged.count.inferred != null && "text-[var(--mark-conflict)]"
          )}
        >
          {merged.count.value}
        </span>
      )}
      {shown.length > 0 && (
        <span className="flex items-center font-mono text-[10px] font-bold leading-none">
          {shown.map((p) => (
            <span
              key={p.person}
              className={cn(
                "px-px",
                p.sources.includes("inference") && !p.sources.includes("public") && "underline decoration-dotted"
              )}
              style={{ color: SOURCE_COLOR[p.sources[0]] }}
            >
              {p.person}
            </span>
          ))}
          {extra > 0 && <span className="text-[8px] text-[var(--ink-deep)]/60">+{extra}</span>}
        </span>
      )}
    </div>
  );
}

function FilmFrame({
  time,
  active,
  verdict,
  linked,
  mergedFor,
  board,
  onSelect,
}: {
  time: TimeId;
  active: boolean;
  verdict?: "target" | "excluded";
  linked: (a: PlaceId, b: PlaceId) => boolean;
  mergedFor: (time: TimeId, place: PlaceId) => MergedCell;
  board: Board;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`时间 ${time}`}
      aria-current={active}
      className={cn(
        "relative rounded-sm border bg-[var(--parchment)] p-1 text-left transition-all",
        active
          ? "border-[var(--amber)] shadow-[0_0_0_1px_var(--amber)]"
          : "border-[var(--ink-deep)]/20 hover:border-[var(--ink-deep)]/45",
        verdict === "excluded" && "opacity-40 grayscale",
        verdict === "target" && "border-double border-[3px] border-[var(--amber-dim)] bg-[#dcc596]"
      )}
    >
      <div className="mb-0.5 flex items-center justify-between px-0.5">
        <span
          className={cn(
            "font-display text-sm leading-none",
            active ? "text-[var(--ink-deep)]" : "text-[var(--ink-deep)]/65",
            verdict === "excluded" && "line-through"
          )}
        >
          {time}
        </span>
        {verdict === "target" && <Crosshair className="h-3 w-3 text-[var(--amber-dim)]" aria-hidden />}
      </div>
      <div className="relative aspect-[3/2] w-full">
        <FloorGrid
          linked={linked}
          compact
          room={(place) => (
            <MiniRoom key={place} merged={mergedFor(time, place)} verdict={board.places[place]} />
          )}
        />
      </div>
    </button>
  );
}

function LayerToggle({
  source,
  on,
  onToggle,
}: {
  source: MarkSource;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <Tip label={`${LAYER_NAME[source]}${on ? "（点击隐藏）" : "（点击显示）"}`}>
      <button
        type="button"
        aria-pressed={on}
        aria-label={LAYER_NAME[source]}
        onClick={onToggle}
        className={cn(
          "flex h-7 items-center gap-1 rounded-sm border border-[var(--ink-deep)]/15 px-1.5 text-[11px] text-[var(--ink-deep)] transition-opacity",
          on ? "opacity-100" : "opacity-35"
        )}
      >
        <span className="relative h-4 w-4">
          <SourceGlyph sources={[source]} />
        </span>
        {LAYER_NAME[source].slice(0, 1)}
      </button>
    </Tip>
  );
}

export function DeskTimeline({
  view,
  onSaveNotes,
  onBoardChange,
}: {
  view: RoomPublicView;
  onSaveNotes: (text: string) => Promise<void>;
  onBoardChange?: (board: Board) => void;
}) {
  const people = view.scenario.people.map((p) => p.id);
  const places = view.scenario.places.map((p) => p.id) as PlaceId[];
  const linked = useEdges(view);

  const facts: FactProjection = useMemo(
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

  const [payload, setPayload] = useState<NotesPayloadV3>(() =>
    parseNotes(view.you?.notes, people, places)
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [activeTime, setActiveTime] = useState<TimeId>(1);
  const [layers, setLayers] = useState<LayerVisibility>({
    public: true,
    private: true,
    inference: true,
  });
  const [editing, setEditing] = useState<CellKey | null>(null);
  const [editingVisit, setEditingVisit] = useState<string | null>(null);
  const [visitsOpen, setVisitsOpen] = useState(false);
  const [marginOpen, setMarginOpen] = useState(false);

  useEffect(() => {
    setPayload(parseNotes(view.you?.notes, people, places));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.you?.notes, view.scenario.id]);

  useEffect(() => {
    onBoardChange?.(payload.board);
  }, [payload.board, onBoardChange]);

  const mergedFor = (time: TimeId, place: PlaceId): MergedCell => {
    const cell = facts.cells[String(time)]?.[place] ?? {
      public: { letters: [], sources: [] },
      private: { amongLetters: [], sources: [] },
    };
    return mergeCellMarks(cell, cellMarkOf(payload, time, place), layers);
  };

  async function save() {
    setSaving(true);
    try {
      await onSaveNotes(serializeNotes(payload));
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  function setCell(time: TimeId, place: PlaceId, mark: CellMark) {
    setPayload((prev) => ({
      ...prev,
      inference: {
        ...prev.inference,
        cells: {
          ...prev.inference.cells,
          [String(time)]: { ...(prev.inference.cells[String(time)] ?? {}), [place]: mark },
        },
      },
    }));
  }

  function setVisit(person: PersonId, place: PlaceId, value: number | null) {
    setPayload((prev) => ({
      ...prev,
      inference: {
        ...prev.inference,
        visits: {
          ...prev.inference.visits,
          [person]: { ...(prev.inference.visits[person] ?? {}), [place]: value },
        },
      },
    }));
  }

  const activeVerdict = payload.board.times[String(activeTime)];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto w-full max-w-3xl">
        <div className="relative rounded-sm border border-[var(--ink-deep)]/15 bg-[var(--parchment)] px-3 py-5 text-[var(--ink-deep)] shadow-[0_12px_40px_-20px_rgba(0,0,0,0.55)] sm:px-7 sm:py-7">
          <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-3xl tracking-tight text-[var(--ink-deep)] sm:text-4xl">
              <span className={cn(activeVerdict === "excluded" && "line-through opacity-50")}>
                时间 {activeTime}
              </span>
              {activeVerdict === "target" && (
                <Crosshair className="h-5 w-5 text-[var(--amber-dim)]" aria-label="目标时间" />
              )}
            </h2>
            <div className="flex gap-1">
              {(["public", "private", "inference"] as const).map((key) => (
                <LayerToggle
                  key={key}
                  source={key}
                  on={layers[key]}
                  onToggle={() => {
                    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
                    if (key === "inference") setEditing(null);
                  }}
                />
              ))}
            </div>
          </div>

          <LatestClueStrip view={view} />

          <SuspectBoard
            view={view}
            board={payload.board}
            onChange={(board) => setPayload((prev) => ({ ...prev, board }))}
          />

          <div className="-mx-1 mb-5 grid auto-cols-[6.75rem] grid-flow-col gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-6 sm:overflow-visible sm:px-0">
            {TIMES.map((t) => (
              <FilmFrame
                key={t}
                time={t}
                active={t === activeTime}
                verdict={payload.board.times[String(t)]}
                linked={linked}
                mergedFor={mergedFor}
                board={payload.board}
                onSelect={() => {
                  setActiveTime(t);
                  setEditing(null);
                }}
              />
            ))}
          </div>

          <div className="relative aspect-[3/2] max-h-[440px] w-full">
            <FloorGrid
              linked={linked}
              room={(place) => (
                <RoomCell
                  key={place}
                  view={view}
                  time={activeTime}
                  place={place}
                  merged={mergedFor(activeTime, place)}
                  mark={cellMarkOf(payload, activeTime, place)}
                  board={payload.board}
                  canEdit={layers.inference && !cellHasFacts(facts.cells[String(activeTime)]?.[place])}
                  locked={cellHasFacts(facts.cells[String(activeTime)]?.[place])}
                  open={editing?.time === activeTime && editing.place === place}
                  onOpenChange={(o) => setEditing(o ? { time: activeTime, place } : null)}
                  onChange={(mark) => setCell(activeTime, place, mark)}
                />
              )}
            />
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--ink-deep)]/55">
            {(["public", "private", "inference"] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span className="relative inline-block h-3 w-3">
                  <SourceGlyph sources={[s]} thin />
                </span>
                {LAYER_NAME[s]}
              </span>
            ))}
            <span>形状叠在一起表示多层一致，悬停查看来源</span>
          </p>

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
                      <th className="py-1 pr-2 text-left font-normal text-[var(--ink-deep)]/50">—</th>
                      {PLACE_ORDER.map((pid) => (
                        <th key={pid} className="px-0.5 py-1 text-center font-normal text-[var(--ink-deep)]/50">
                          {placeLabel(view, pid)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {view.scenario.people.map((person) => (
                      <tr key={person.id}>
                        <td className="py-1 pr-2 font-mono text-[var(--ink-deep)]">
                          {person.letter}
                          <span className="ml-1 text-[var(--ink-deep)]/45">{person.name}</span>
                        </td>
                        {PLACE_ORDER.map((pid) => {
                          const visitFact = facts.visits[person.id]?.[pid];
                          const inferred = payload.inference.visits[person.id]?.[pid] ?? null;
                          const pub = layers.public ? visitFact?.public.count ?? null : null;
                          const inf = layers.inference ? inferred : null;
                          const conflict =
                            layers.inference && !!visitFact && visitHasConflict(visitFact.public, inferred);
                          const sources: MarkSource[] = [];
                          if (pub != null) sources.push("public");
                          if (inf != null && (pub == null || inf === pub)) sources.push("inference");
                          const shown = pub ?? inf;
                          const key = `${person.id}-${pid}`;
                          const visitLocked = visitHasFacts(visitFact);
                          const among =
                            layers.private && visitFact ? visitFact.private.amongTimes : [];
                          return (
                            <td key={pid} className="relative px-0.5 py-1 text-center align-middle">
                              <Popover
                                open={editingVisit === key}
                                onOpenChange={(o) =>
                                  layers.inference && !visitLocked && setEditingVisit(o ? key : null)
                                }
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label={`${person.name} 到访 ${placeLabel(view, pid)}`}
                                    aria-disabled={visitLocked}
                                    title={visitLocked ? "已有公开或私有信息，这一格不再标推理" : undefined}
                                    className={cn(
                                      "mx-auto flex min-h-8 w-full flex-col items-center justify-center gap-0.5 rounded-sm",
                                      visitLocked ? "cursor-default" : "hover:bg-[var(--ink-deep)]/5"
                                    )}
                                  >
                                    {shown != null ? (
                                      <Tip
                                        label={
                                          conflict
                                            ? `${pub} 次 · 公（推 ${inferred}）`
                                            : `${shown} 次 · ${sourcesLabel(sources)}`
                                        }
                                      >
                                        <span>
                                          <GlyphToken sources={sources} size="sm" conflict={conflict}>
                                            {shown}
                                          </GlyphToken>
                                        </span>
                                      </Tip>
                                    ) : (
                                      <span className="h-1 w-1 rounded-full bg-[var(--ink-deep)]/15" />
                                    )}
                                    {among.length > 0 && (
                                      <Tip label={`私 · 其中一次在时间 ${among.join("、")}`}>
                                        <span className="inline-flex items-center gap-0.5 text-[9px] text-[var(--mark-private)]">
                                          <span className="relative inline-block h-2.5 w-2.5">
                                            <SourceGlyph sources={["private"]} thin />
                                          </span>
                                          {among.join("/")}
                                        </span>
                                      </Tip>
                                    )}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto border-[var(--ink-deep)]/25 bg-[var(--parchment)] p-2">
                                  <p className="mb-1.5 text-[11px] text-[var(--ink-deep)]/70">
                                    {person.name} 到访{placeLabel(view, pid)}几次
                                  </p>
                                  <VisitPicker
                                    value={inferred}
                                    factCount={visitFact?.public.count ?? null}
                                    onChange={(v) => {
                                      setVisit(person.id, pid, v);
                                      setEditingVisit(null);
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
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
                    onChange={(e) => setPayload((prev) => ({ ...prev, free: e.target.value }))}
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
    </TooltipProvider>
  );
}
