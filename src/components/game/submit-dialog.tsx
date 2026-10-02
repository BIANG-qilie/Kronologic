"use client";

import { useState } from "react";
import type { RoomPublicView } from "@/lib/game/types";
import { soleTarget, type SuspectBoard } from "@/lib/game/notes-format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const BOARD_ROW = { person: "people", place: "places", time: "times" } as const;

export function SubmitDialog({
  view,
  board,
  onSubmit,
}: {
  view: RoomPublicView;
  board?: SuspectBoard | null;
  onSubmit: (answers: Record<string, string>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(0);

  if (!view.you?.canSubmit) return null;

  function openWithPrefill(next: boolean) {
    if (next && board) {
      const filled = { ...answers };
      let n = 0;
      for (const q of view.scenario.winQuestions) {
        const sameKind = view.scenario.winQuestions.filter((x) => x.kind === q.kind);
        if (filled[q.id] || sameKind.length !== 1) continue;
        const target = soleTarget(board[BOARD_ROW[q.kind]]);
        if (target) {
          filled[q.id] = target;
          n++;
        }
      }
      setAnswers(filled);
      setPrefilled(n);
    }
    setOpen(next);
  }

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

  const options = (kind: "person" | "place" | "time") =>
    kind === "person"
      ? view.scenario.people.map((p) => ({ value: p.id, label: p.name, mark: p.letter }))
      : kind === "place"
        ? view.scenario.places.map((p) => ({ value: p.id, label: p.name, mark: null }))
        : [1, 2, 3, 4, 5, 6].map((t) => ({ value: String(t), label: `时间 ${t}`, mark: null }));
  const complete = view.scenario.winQuestions.every((q) => !!answers[q.id]);

  return (
    <Dialog open={open} onOpenChange={openWithPrefill}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 px-4">
          交卷
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-0 bg-[var(--curtain)] p-6 text-[var(--ink)] shadow-[0_0_0_1px_var(--ink-faint),0_40px_120px_-30px_rgba(0,0,0,0.9)] sm:max-w-xl sm:p-8">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-3xl">交卷</DialogTitle>
          <DialogDescription className="leading-relaxed text-[var(--ink-muted)]">
            答错就出局，没有第二次。有人交卷后，其余人还有 12 秒。
            {prefilled > 0 && `已按嫌疑板上的目标填好 ${prefilled} 项。`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-2">
          {view.scenario.winQuestions.map((q, qi) => (
            <fieldset key={q.id}>
              <legend className="mb-2.5 flex items-baseline gap-3">
                <span className="font-display text-sm italic text-[var(--amber)]">0{qi + 1}</span>
                <span className="text-sm text-[var(--ink)]">{q.prompt}</span>
              </legend>
              <div className={cn("grid gap-1.5", q.kind === "time" ? "grid-cols-6" : "grid-cols-3")} role="radiogroup">
                {options(q.kind).map((o) => {
                  const on = answers[q.id] === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={o.label}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.value }))}
                      className={cn(
                        "flex h-11 items-center justify-center gap-1.5 rounded-[3px] text-sm transition-all duration-200",
                        on
                          ? "bg-[var(--amber)] text-[var(--curtain)] shadow-[0_10px_24px_-12px_rgba(212,161,90,0.9)]"
                          : "text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
                      )}
                    >
                      {o.mark && <span className="font-mono font-semibold">{o.mark}</span>}
                      <span className={cn(q.kind === "time" && "font-display text-lg")}>
                        {q.kind === "time" ? o.value : o.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          {err && <p className="text-sm text-[#e07a5f]">{err}</p>}
          <Button className="w-full" size="lg" disabled={busy || !complete} onClick={go}>
            {busy ? "封卷中…" : complete ? "确认交卷 · 不能反悔" : "每一项都选好才能交"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
