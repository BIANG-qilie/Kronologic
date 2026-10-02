"use client";

import type { RoomPublicView } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import type { PlaceId } from "@/lib/game/types";
import { PlaceGlyph } from "./place-glyph";

export function CaseLog({ view }: { view: RoomPublicView }) {
  const place = (id: string) => view.scenario.places.find((p) => p.id === id)?.name ?? id;
  const person = (id: string) => view.scenario.people.find((p) => p.id === id);
  const tag = (id: string) => {
    const p = person(id);
    return p ? `${p.name}（${p.letter}）` : id;
  };
  const entries = [...view.queryLog].reverse();

  return (
    <aside aria-label="线索记录">
      <p className="mb-4 flex items-baseline justify-between text-[11px] tracking-[0.32em] text-[var(--ink-muted)]">
        <span>线索记录</span>
        <span className="font-mono tracking-normal tabular">{view.queryLog.length}</span>
      </p>
      {entries.length === 0 ? (
        <p className="border-l border-[var(--ink-faint)] pl-4 text-sm leading-relaxed text-[var(--ink-muted)]">
          还没人提问。先问人多的房间，线索更多。
        </p>
      ) : (
        <ol className="space-y-px">
          {entries.map((q, i) => {
            const count = /^x?(\d+)$/i.exec(q.sharedLabel)?.[1];
            const mine = view.you?.privateClues.find((c) => c.queryId === q.id);
            const priv = mine?.privateLabel && mine.privateLabel !== "—" ? mine.privateLabel : null;
            const who = q.personId ? person(q.personId) : null;
            return (
              <li
                key={q.id}
                className={cn(
                  "group relative grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-2 py-2.5 pl-1 pr-1 transition-colors",
                  i === 0 && "animate-fade-up"
                )}
              >
                <span className="font-display text-sm italic text-[var(--ink-faint)] tabular group-hover:text-[var(--amber-dim)]">
                  {view.queryLog.length - i}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center truncate text-sm text-[var(--ink)]">
                    <PlaceGlyph id={q.placeId as PlaceId} className="mr-1.5 h-3.5 w-3.5 text-[var(--ink-muted)]" />
                    {place(q.placeId)}
                    <span className="mx-1.5 text-[var(--ink-faint)]">×</span>
                    {q.kind === "place_time" ? `时间 ${q.timeId}` : who ? tag(who.id) : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-muted/80">
                    {q.askerNickname}
                    {q.askAgain && <span className="ml-2 text-[var(--ink-muted)]">白窗为空 · 不计次</span>}
                    {priv && (
                      <span className="ml-2 text-[#f3e6c8]">
                        白窗 · {q.kind === "place_time" ? `其中有 ${tag(priv)}` : `其中一次在时间 ${priv}`}
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className={cn(
                    "font-mono text-sm tabular",
                    count === "0" ? "text-[var(--ink-muted)]" : "text-[var(--green-win)]"
                  )}
                >
                  {count != null ? `${count}${q.kind === "place_time" ? " 人" : " 次"}` : q.sharedLabel}
                </span>
                <span className="absolute inset-x-0 bottom-0 h-px bg-ink-faint/50" />
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
