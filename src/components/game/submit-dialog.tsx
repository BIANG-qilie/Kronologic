"use client";

import { useState } from "react";
import type { RoomPublicView } from "@/lib/game/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SubmitDialog({
  view,
  onSubmit,
}: {
  view: RoomPublicView;
  onSubmit: (answers: Record<string, string>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!view.you?.canSubmit) return null;

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(answers);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "交卷失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">交卷</Button>
      </DialogTrigger>
      <DialogContent className="border-[var(--ink-faint)] bg-[var(--curtain)] text-[var(--ink)]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">提交答案</DialogTitle>
          <DialogDescription className="text-[var(--ink-muted)]">
            提交后进入 12 秒同时交卷窗。答错即淘汰。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {view.scenario.winQuestions.map((q) => (
            <div key={q.id} className="space-y-2">
              <Label>{q.prompt}</Label>
              {q.kind === "person" ? (
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                  }
                >
                  <option value="">选择人物</option>
                  {view.scenario.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.letter} · {p.name}
                    </option>
                  ))}
                </select>
              ) : q.kind === "place" ? (
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                  }
                >
                  <option value="">选择地点</option>
                  {view.scenario.places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                  }
                >
                  <option value="">选择时间</option>
                  {[1, 2, 3, 4, 5, 6].map((t) => (
                    <option key={t} value={String(t)}>
                      时间 {t}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button className="w-full" disabled={busy} onClick={go}>
            {busy ? "提交中…" : "确认交卷（不可悔）"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
