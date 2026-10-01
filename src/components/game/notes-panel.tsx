"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlaceId, PersonId, RoomPublicView, TimeId } from "@/lib/game/types";
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

export type NotesPayload = {
  version: 1;
  /** cells[time][placeId] = free text (letters / x2 / …) */
  cells: Record<string, Record<string, string>>;
  /** visits[personId][placeId] = count text */
  visits: Record<string, Record<string, string>>;
  free: string;
};

function emptyPayload(
  people: PersonId[],
  places: PlaceId[]
): NotesPayload {
  const cells: NotesPayload["cells"] = {};
  for (const t of TIMES) {
    cells[String(t)] = {};
    for (const p of places) cells[String(t)][p] = "";
  }
  const visits: NotesPayload["visits"] = {};
  for (const person of people) {
    visits[person] = {};
    for (const p of places) visits[person][p] = "";
  }
  return { version: 1, cells, visits, free: "" };
}

export function parseNotes(
  raw: string | undefined,
  people: PersonId[],
  places: PlaceId[]
): NotesPayload {
  const base = emptyPayload(people, places);
  if (!raw?.trim()) return base;
  try {
    const parsed = JSON.parse(raw) as NotesPayload;
    if (parsed?.version === 1 && parsed.cells && parsed.visits) {
      return {
        version: 1,
        cells: { ...base.cells, ...parsed.cells },
        visits: { ...base.visits, ...parsed.visits },
        free: parsed.free ?? "",
      };
    }
  } catch {
    /* legacy plain text */
  }
  return { ...base, free: raw };
}

export function serializeNotes(payload: NotesPayload): string {
  return JSON.stringify(payload);
}

export function NotesPanel({
  view,
  onSave,
}: {
  view: RoomPublicView;
  onSave: (text: string) => Promise<void>;
}) {
  const people = view.scenario.people.map((p) => p.id);
  const places = view.scenario.places.map((p) => p.id) as PlaceId[];

  const [payload, setPayload] = useState<NotesPayload>(() =>
    parseNotes(view.you?.notes, people, places)
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [activeTime, setActiveTime] = useState<TimeId>(1);

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
      await onSave(serializeNotes(payload));
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  function setCell(time: TimeId, place: PlaceId, value: string) {
    setPayload((prev) => ({
      ...prev,
      cells: {
        ...prev.cells,
        [String(time)]: {
          ...(prev.cells[String(time)] ?? {}),
          [place]: value,
        },
      },
    }));
  }

  function setVisit(person: PersonId, place: PlaceId, value: string) {
    setPayload((prev) => ({
      ...prev,
      visits: {
        ...prev.visits,
        [person]: {
          ...(prev.visits[person] ?? {}),
          [place]: value,
        },
      },
    }));
  }

  const openingLines = view.scenario.people
    .map((p) => {
      const place = view.scenario.places.find(
        (x) => x.id === view.scenario.opening[p.id]
      );
      return `${p.letter} ${p.name} @ 时间1 · ${place?.name ?? "?"}`;
    })
    .join("\n");

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-sm border border-[var(--ink-faint)] bg-[var(--parchment)] p-3 text-xs leading-relaxed text-[var(--ink-deep)]">
        <p className="mb-1 font-display text-sm">开场已知</p>
        <pre className="whitespace-pre-wrap font-mono">{openingLines}</pre>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--ink-muted)]">小时光地图（自己填）</p>
          <div className="flex gap-1">
            {TIMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTime(t)}
                className={cn(
                  "h-8 w-8 rounded-sm border font-mono text-sm",
                  activeTime === t
                    ? "border-[var(--amber)] bg-[var(--amber)]/15 text-[var(--ink)]"
                    : "border-[var(--ink-faint)] text-[var(--ink-muted)]"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PLACE_ORDER.map((placeId) => (
            <label
              key={placeId}
              className="rounded-sm border border-[var(--ink-faint)] bg-[var(--parchment)] p-2 text-[var(--ink-deep)]"
            >
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">
                {placeName(placeId)}
              </span>
              <input
                value={payload.cells[String(activeTime)]?.[placeId] ?? ""}
                onChange={(e) =>
                  setCell(activeTime, placeId, e.target.value.slice(0, 12))
                }
                placeholder="字母 / x2"
                className="w-full bg-transparent font-mono text-sm outline-none placeholder:text-[var(--ink-muted)]/60"
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-[var(--ink-muted)]">
          到访次数（人物 × 地点，自己填）
        </p>
        <div className="overflow-x-auto rounded-sm border border-[var(--ink-faint)]">
          <table className="w-full min-w-[480px] border-collapse text-xs text-[var(--ink)]">
            <thead>
              <tr className="bg-[var(--stage)]">
                <th className="border-b border-[var(--ink-faint)] px-2 py-2 text-left font-medium">
                  人物
                </th>
                {PLACE_ORDER.map((pid) => (
                  <th
                    key={pid}
                    className="border-b border-[var(--ink-faint)] px-1 py-2 font-medium"
                  >
                    {placeName(pid)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.scenario.people.map((person) => (
                <tr key={person.id}>
                  <td className="border-b border-[var(--ink-faint)]/50 px-2 py-1 font-mono">
                    {person.letter}
                    <span className="ml-1 text-[var(--ink-muted)]">
                      {person.name}
                    </span>
                  </td>
                  {PLACE_ORDER.map((pid) => (
                    <td
                      key={pid}
                      className="border-b border-[var(--ink-faint)]/50 px-1 py-1"
                    >
                      <input
                        value={payload.visits[person.id]?.[pid] ?? ""}
                        onChange={(e) =>
                          setVisit(
                            person.id,
                            pid,
                            e.target.value.replace(/[^\d]/g, "").slice(0, 1)
                          )
                        }
                        className="h-8 w-full rounded-sm border border-[var(--ink-faint)] bg-[var(--parchment)] text-center font-mono text-[var(--ink-deep)] outline-none focus:border-[var(--amber)]"
                        inputMode="numeric"
                        aria-label={`${person.name} 访问 ${placeName(pid)}`}
                      />
                    </td>
                  ))}
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
        placeholder="补充自由笔记（可选）"
        className="min-h-[96px] resize-y rounded-sm border border-[var(--ink-faint)] bg-[var(--parchment)] p-3 font-mono text-sm text-[var(--ink-deep)] placeholder:text-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--ink-muted)]">
          {savedAt
            ? `已同步 ${new Date(savedAt).toLocaleTimeString()}`
            : "格子由你填写；仅自己可见，断线可恢复"}
        </span>
        <Button size="sm" variant="secondary" disabled={saving} onClick={save}>
          {saving ? "保存中…" : "保存笔记"}
        </Button>
      </div>
    </div>
  );
}
