"use client";

import { useState } from "react";
import { ArrowRight, Check, Lightbulb } from "lucide-react";
import type { ScenarioPublic } from "@/lib/game/types";
import { judgeAnswer, MAX_HINTS, type SubmitFeedback } from "@/lib/game/tutorial-script";
import { AnswerChoices, type ChoiceState } from "@/components/game/submit-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QuestionState = {
  misses: number;
  marks: Record<string, ChoiceState>;
  feedback: SubmitFeedback | null;
  settled: boolean;
};

const fresh = (): QuestionState => ({ misses: 0, marks: {}, feedback: null, settled: false });

/**
 * Answers are checked one question at a time: a right pick lights green, a
 * wrong one gets a hint (two at most), and the third miss shows the answer.
 */
export function TutorialSubmit({
  scenario,
  answers,
  onDone,
}: {
  scenario: ScenarioPublic;
  answers: Record<string, string>;
  onDone: (misses: number) => void;
}) {
  const questions = scenario.winQuestions;
  const [state, setState] = useState<QuestionState[]>(() => questions.map(fresh));
  const current = state.findIndex((s) => !s.settled);
  const totalMisses = state.reduce((n, s) => n + s.misses, 0);
  const allDone = current === -1;

  function pick(qi: number, value: string) {
    const q = questions[qi];
    const s = state[qi];
    if (s.settled || s.marks[value]) return;
    const fb = judgeAnswer(q.id, answers[q.id], value, s.misses, totalMisses);
    const next: QuestionState =
      fb.type === "correct"
        ? { ...s, marks: { ...s.marks, [value]: "correct" }, feedback: fb, settled: true }
        : fb.type === "hint"
          ? { ...s, misses: s.misses + 1, marks: { ...s.marks, [value]: "wrong" }, feedback: fb }
          : {
              ...s,
              misses: s.misses + 1,
              marks: { ...s.marks, [value]: "wrong", [answers[q.id]]: "correct" },
              feedback: fb,
              settled: true,
            };
    setState((prev) => prev.map((x, i) => (i === qi ? next : x)));
  }

  return (
    <div className="space-y-6">
      {questions.map((q, qi) => {
        const s = state[qi];
        const locked = !allDone && qi > current;
        return (
          <fieldset key={q.id} className={cn("transition-opacity", locked && "opacity-35")} disabled={locked}>
            <legend className="mb-2.5 flex w-full items-baseline gap-3">
              <span className="font-display text-sm italic text-[var(--amber)]">0{qi + 1}</span>
              <span className="text-sm text-[var(--ink)]">{q.prompt}</span>
              {locked && <span className="ml-auto text-[11px] text-[var(--ink-muted)]">先答上一题</span>}
              {s.settled && s.feedback?.type === "correct" && (
                <Check className="ml-auto h-4 w-4 text-[var(--green-win)]" aria-label="答对" />
              )}
            </legend>
            <AnswerChoices
              scenario={scenario}
              question={q}
              value={undefined}
              marks={s.marks}
              disabled={locked || s.settled}
              onPick={(v) => pick(qi, v)}
            />
            {s.feedback && (
              <p
                role="status"
                className={cn(
                  "animate-fade-up mt-3 flex gap-2 rounded-[3px] px-3 py-2.5 text-sm leading-relaxed",
                  s.feedback.type === "correct" && "bg-green-win/12 text-[var(--green-win)]",
                  s.feedback.type === "hint" && "bg-amber/12 text-[var(--amber)]",
                  s.feedback.type === "reveal" && "bg-[var(--stage)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--ink-faint)]"
                )}
              >
                {s.feedback.type === "hint" && <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
                <span>
                  {s.feedback.text}
                  {s.feedback.type === "hint" && (
                    <span className="mt-0.5 block text-[11px] opacity-80">
                      {s.feedback.left > 0
                        ? `提示 ${MAX_HINTS - s.feedback.left}/${MAX_HINTS}`
                        : `提示 ${MAX_HINTS}/${MAX_HINTS} · 之后再错，会直接给出答案`}
                    </span>
                  )}
                </span>
              </p>
            )}
          </fieldset>
        );
      })}
      <Button
        className="group w-full"
        size="lg"
        disabled={!allDone}
        onClick={() => onDone(totalMisses)}
      >
        {allDone ? "结案" : "两题都答完才能结案"}
        {allDone && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
      </Button>
    </div>
  );
}
