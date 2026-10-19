"use client";

import { ScrollText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  caseBriefEyebrow,
  caseBriefObjectives,
} from "@/lib/game/case-brief";
import type { ScenarioPublic } from "@/lib/game/types";
import { cn } from "@/lib/utils";

/** Header button that reopens the case brief during play (sheet on phone, dialog on desktop). */
export function CaseBriefSheet({
  scenario,
  className,
}: {
  scenario: Pick<
    ScenarioPublic,
    "id" | "level" | "title" | "subtitle" | "synopsis" | "tier" | "winQuestions"
  >;
  className?: string;
}) {
  const eyebrow = caseBriefEyebrow(scenario);
  const objectives = caseBriefObjectives(scenario);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-11 shrink-0 items-center gap-1.5 px-2 text-xs tracking-[0.2em] text-[var(--ink-muted)] transition-colors hover:text-[var(--amber)]",
            className,
          )}
        >
          <ScrollText className="h-4 w-4" aria-hidden />
          <span className="max-[400px]:sr-only">案子</span>
        </button>
      </DialogTrigger>
      <DialogContent
        sheet
        className="overflow-y-auto overscroll-contain border-0 bg-[var(--curtain)] px-5 pt-7 text-[var(--ink)] shadow-[0_0_0_1px_var(--ink-faint),0_40px_120px_-30px_rgba(0,0,0,0.9)] sm:max-h-[92vh] sm:max-w-xl sm:p-8"
      >
        <DialogHeader className="text-left">
          <p className="text-[11px] tracking-[0.32em] text-[var(--amber)]">
            {eyebrow}
          </p>
          <DialogTitle className="mt-2 font-display text-3xl">
            {scenario.title}
          </DialogTitle>
          {(scenario.tier || scenario.subtitle) && (
            <DialogDescription className="text-[var(--ink-muted)]">
              {scenario.tier ?? scenario.subtitle}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="border-l border-amber/40 pl-5">
          <p className="whitespace-pre-line text-sm leading-[1.9] text-[var(--ink-muted)]">
            {scenario.synopsis}
          </p>
        </div>

        {objectives.length > 0 && (
          <div className="border-t border-ink-faint/60 pt-4">
            <p className="text-[11px] tracking-[0.28em] text-[var(--amber)]">
              要查出
            </p>
            <ol className="mt-3 space-y-2">
              {objectives.map((prompt, i) => (
                <li
                  key={prompt}
                  className="grid grid-cols-[2rem_1fr] items-baseline gap-x-2 text-sm text-[var(--ink)]"
                >
                  <span className="font-display text-sm italic text-[var(--amber)]">
                    0{i + 1}
                  </span>
                  <span>{prompt}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
