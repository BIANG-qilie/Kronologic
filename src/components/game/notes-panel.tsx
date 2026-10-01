"use client";

import { useEffect, useState } from "react";
import type { RoomPublicView } from "@/lib/game/types";
import { Button } from "@/components/ui/button";

export function NotesPanel({
  view,
  onSave,
}: {
  view: RoomPublicView;
  onSave: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState(view.you?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setText(view.you?.notes ?? "");
  }, [view.you?.notes]);

  async function save() {
    setSaving(true);
    try {
      await onSave(text);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
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
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-sm border border-[var(--ink-faint)] bg-[var(--parchment)] p-3 text-xs leading-relaxed text-[var(--ink-deep)]">
        <p className="mb-1 font-display text-sm">开场已知</p>
        <pre className="whitespace-pre-wrap font-mono">{openingLines}</pre>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"在此记录推断……\n例：时间3 正厅 x2；白窗见 M"}
        className="min-h-[220px] flex-1 resize-y rounded-sm border border-[var(--ink-faint)] bg-[var(--parchment)] p-3 font-mono text-sm text-[var(--ink-deep)] placeholder:text-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--ink-muted)]">
          {savedAt
            ? `已同步 ${new Date(savedAt).toLocaleTimeString()}`
            : "笔记仅自己可见，断线可恢复"}
        </span>
        <Button size="sm" variant="secondary" disabled={saving} onClick={save}>
          {saving ? "保存中…" : "保存笔记"}
        </Button>
      </div>
    </div>
  );
}
