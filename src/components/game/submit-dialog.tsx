"use client";

import { useState } from "react";
import type { RoomPublicView, ScenarioPublic, WinQuestion } from "@/lib/game/types";
import { timesOf } from "@/lib/game/board";
import { soleTarget, type SuspectBoard } from "@/lib/game/notes-format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlaceId } from "@/lib/game/types";
import { PlaceGlyph } from "./place-glyph";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const BOARD_ROW = { person: "people", place: "places", time: "times" } as const;

export type ChoiceState = "correct" | "wrong";

/** One answer question as a row of chips; `marks` tints chips already judged. */
export function AnswerChoices({
  scenario,
  question,
  value,
  onPick,
  marks,
  disabled,
}: {
  scenario: ScenarioPublic;
  question: WinQuestion;
  value: string | undefined;
  onPick: (value: string) => void;
  marks?: Record<string, ChoiceState>;
  disabled?: boolean;
}) {
  const kind = question.kind;
  const times = timesOf(scenario);
  const options =
    kind === "person"
      ? scenario.people.map((p) => ({ value: p.id, label: p.name, aria: `${p.name}（${p.letter}）`, mark: p.letter }))
      : kind === "place"
        ? scenario.places.map((p) => ({ value: p.id, label: p.name, aria: p.name, mark: null }))
        : times.map((t) => ({ value: String(t), label: `时间 ${t}`, aria: `时间 ${t}`, mark: null }));
  return (
    <div
      className={cn("grid gap-1.5", kind === "time" && times.length === 6 ? "grid-cols-6" : "grid-cols-3")}
      role="radiogroup"
      aria-label={question.prompt}
    >
      {options.map((o) => {
        const on = value === o.value;
        const judged = marks?.[o.value];
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.aria}
            disabled={disabled}
            onClick={() => onPick(o.value)}
            className={cn(
              "flex h-12 items-center justify-center gap-1.5 rounded-[3px] text-sm transition-all duration-200 active:scale-[0.97] disabled:active:scale-100 sm:h-11",
              judged === "correct"
                ? "bg-[var(--green-win)] text-[var(--curtain)] shadow-[0_10px_24px_-12px_rgba(111,191,138,0.9)]"
                : judged === "wrong"
                  ? "text-[var(--ink-muted)] line-through opacity-50 shadow-[inset_0_0_0_1px_rgba(224,122,95,0.5)]"
                  : on
                    ? "bg-[var(--amber)] text-[var(--curtain)] shadow-[0_10px_24px_-12px_rgba(212,161,90,0.9)]"
                    : "text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
            )}
          >
            {o.mark && <span className="font-mono font-semibold">{o.mark}</span>}
            {kind === "place" && <PlaceGlyph id={o.value as PlaceId} className="h-4 w-4 opacity-80" />}
            <span className={cn(kind === "time" && "font-display text-lg")}>{kind === "time" ? o.value : o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

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
      setErr(e instanceof Error ? e.message : "交卷失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  const complete = view.scenario.winQuestions.every((q) => !!answers[q.id]);

  return (
    <Dialog open={open} onOpenChange={openWithPrefill}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-11 px-5 sm:h-9 sm:px-4">
          交卷
        </Button>
      </DialogTrigger>
      <DialogContent
        sheet
        className="overflow-y-auto overscroll-contain border-0 bg-[var(--curtain)] px-5 pt-7 text-[var(--ink)] shadow-[0_0_0_1px_var(--ink-faint),0_40px_120px_-30px_rgba(0,0,0,0.9)] sm:max-h-[92vh] sm:max-w-xl sm:p-8"
      >
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-3xl">交卷</DialogTitle>
          <DialogDescription className="leading-relaxed text-[var(--ink-muted)]">
            答错即出局，只有一次机会。有人交卷后，其余人还有 12 秒同时交卷。
            {prefilled > 0 && (
              <span className="mt-1 block text-[var(--amber)]">已按嫌疑板上的目标填好 {prefilled} 项。</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-2">
          {view.scenario.winQuestions.map((q, qi) => (
            <fieldset key={q.id}>
              <legend className="mb-2.5 flex items-baseline gap-3">
                <span className="font-display text-sm italic text-[var(--amber)]">0{qi + 1}</span>
                <span className="text-sm text-[var(--ink)]">{q.prompt}</span>
              </legend>
              <AnswerChoices
                scenario={view.scenario}
                question={q}
                value={answers[q.id]}
                onPick={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
              />
            </fieldset>
          ))}
          {err && (
            <p role="alert" className="text-sm text-[#e07a5f]">
              {err}
            </p>
          )}
          <Button className="w-full" size="lg" disabled={busy || !complete} onClick={go}>
            {busy ? "封卷中…" : complete ? "确认交卷 · 不能反悔" : `还差 ${view.scenario.winQuestions.filter((q) => !answers[q.id]).length} 项`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
