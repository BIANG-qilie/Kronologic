"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { PROLOGUE } from "@/lib/game/prologue";
import { timesOf } from "@/lib/game/board";
import { parseNotes, serializeNotes, emptyNotesV3 } from "@/lib/game/notes-format";
import { resolvePlacePerson, resolvePlaceTime } from "@/lib/game/query";
import {
  askAnchor,
  askFocus,
  beatAt,
  beatDone,
  FIRST_BEAT,
  nextBeat,
  TUTORIAL_STEPS,
  type AskDraft,
  type Beat,
  type BeatRef,
  type TutorialTab,
} from "@/lib/game/tutorial-script";
import type { PrivateClue, QueryLogEntry, QueryTarget, RoomPublicView } from "@/lib/game/types";
import { DeskTimeline } from "@/components/game/desk-timeline";
import { QueryPanel } from "@/components/game/query-panel";
import { CaseLog } from "@/components/game/case-log";
import { RulesSheet } from "@/components/game/rules-sheet";
import { PlaceGlyph } from "@/components/game/place-glyph";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CoachOverlay } from "./coach-overlay";
import { TutorialSubmit } from "./tutorial-submit";
import { TutorialDebrief } from "./tutorial-debrief";

const scenario = PROLOGUE.public;
const sealed = PROLOGUE.sealed;
const people = scenario.people.map((p) => p.id);
const places = scenario.places.map((p) => p.id);
const times = timesOf(scenario);

type Game = { queryLog: QueryLogEntry[]; privateClues: PrivateClue[]; notes: string };

const EMPTY: Game = { queryLog: [], privateClues: [], notes: serializeNotes(emptyNotesV3(people, places, times)) };

const placeName = (id: string) => scenario.places.find((p) => p.id === id)?.name ?? id;
const personTag = (id: string) => {
  const p = scenario.people.find((x) => x.id === id);
  return p ? `${p.name}（${p.letter}）` : id;
};

function tabOf(beat: Beat): TutorialTab {
  if (beat.kind === "ask") return "ask";
  if (beat.kind === "read") return beat.tab;
  return "desk";
}

function askHint(ask: QueryTarget, draft: AskDraft | null): string {
  switch (askFocus(ask, draft)) {
    case "kind":
      return `先选「${ask.kind === "place_time" ? "房间 × 时间" : "房间 × 人物"}」。`;
    case "place":
      return `点「${placeName(ask.placeId)}」。`;
    case "detail":
      return ask.kind === "place_time" ? `再选时间 ${ask.timeId}。` : `再选 ${personTag(ask.personId!)}。`;
    case "send":
      return "点「提问」。";
  }
}

function CoachCard({
  stepIndex,
  text,
  hint,
  cta,
  onNext,
  onBack,
  onSkip,
}: {
  stepIndex: number;
  text: string;
  hint?: string;
  cta?: string;
  onNext?: () => void;
  onBack?: () => void;
  onSkip: () => void;
}) {
  const step = TUTORIAL_STEPS[stepIndex];
  return (
    <div className="animate-fade-up rounded-[6px] bg-[var(--parchment)] px-4 pb-3 pt-3.5 text-[var(--ink-deep)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-2">
        <p className="text-[11px] tracking-[0.18em] text-ink-deep/70">
          第 {stepIndex + 1} 步 / {TUTORIAL_STEPS.length} · <span className="font-semibold text-[var(--ink-deep)]">{step.title}</span>
        </p>
        <span className="ml-auto flex gap-1" aria-hidden>
          {TUTORIAL_STEPS.map((s, i) => (
            <span
              key={s.id}
              className={cn("h-1 w-3 rounded-full", i < stepIndex ? "bg-amber-dim" : i === stepIndex ? "bg-[var(--ink-deep)]" : "bg-ink-deep/20")}
            />
          ))}
        </span>
      </div>
      <p className="mt-2 text-[15px] leading-[1.7]">{text}</p>
      {hint && <p className="mt-1 text-sm font-medium text-[var(--amber-dim)]">{hint}</p>}
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          className="-ml-2 flex min-h-11 items-center gap-1 px-2 text-xs text-ink-deep/70 hover:text-[var(--ink-deep)] disabled:opacity-30"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          上一步
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="flex min-h-11 items-center px-2 text-xs text-ink-deep/70 hover:text-[var(--ink-deep)]"
        >
          跳过教程
        </button>
        {onNext && (
          <Button size="sm" className="group ml-auto h-10 px-4" onClick={onNext}>
            {cta ?? "下一步"}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function CaseFile({ text, onStart, onSkip }: { text: string; onStart: () => void; onSkip: () => void }) {
  const opening = Object.entries(scenario.opening) as [string, string][];
  return (
    <div className="animate-fade-up max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[6px] bg-[var(--parchment)] px-5 pb-4 pt-5 text-[var(--ink-deep)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)]">
      <p className="text-[11px] tracking-[0.32em] text-ink-deep/65">值班笔记 · {scenario.subtitle}</p>
      <h2 className="mt-1.5 font-display text-3xl">{scenario.title}</h2>
      <p className="mt-3 text-[15px] leading-[1.75]">{text}</p>
      <dl className="mt-4 space-y-2.5 border-t border-dashed border-ink-deep/25 pt-3 text-sm">
        <div className="flex gap-3">
          <dt className="w-10 shrink-0 text-ink-deep/60">人物</dt>
          <dd className="flex flex-wrap gap-x-3 gap-y-1">
            {scenario.people.map((p) => (
              <span key={p.id}>
                <b className="font-mono">{p.letter}</b> {p.name}
                {p.id === "P" && <span className="text-ink-deep/60"> · 道具师</span>}
              </span>
            ))}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-10 shrink-0 text-ink-deep/60">房间</dt>
          <dd className="flex flex-wrap items-center gap-1.5">
            {scenario.layout![0].map((id, i) => (
              <span key={id} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="h-px w-4 bg-ink-deep/50" aria-hidden />}
                <PlaceGlyph id={id} className="h-4 w-4" />
                {placeName(id)}
              </span>
            ))}
            <span className="sr-only">正厅连着舞台，舞台连着妆室</span>
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-10 shrink-0 text-ink-deep/60">时间 1</dt>
          <dd>
            {opening.map(([p, place]) => `${p} 在${placeName(place)}`).join("，")}。三个时刻，一直标到时间 3。
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-10 shrink-0 text-ink-deep/60">要查</dt>
          <dd>谁、在时间几。地点已经知道：妆室。</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center">
        <button
          type="button"
          onClick={onSkip}
          className="-ml-2 flex min-h-11 items-center px-2 text-xs text-ink-deep/70 hover:text-[var(--ink-deep)]"
        >
          跳过教程
        </button>
        <Button className="group ml-auto" onClick={onStart}>
          开始调查
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>
    </div>
  );
}

export function TutorialClient() {
  const router = useRouter();
  const [game, setGame] = useState<Game>(EMPTY);
  const [ref, setRef] = useState<BeatRef>(FIRST_BEAT);
  const [epoch, setEpoch] = useState(0);
  const [draft, setDraft] = useState<AskDraft | null>(null);
  const [phase, setPhase] = useState<"play" | "debrief">("play");
  const [misses, setMisses] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(true);
  const [freeTab, setFreeTab] = useState<TutorialTab>("desk");
  const snapshots = useRef<Record<number, Game>>({ 0: EMPTY });

  const beat = beatAt(ref);
  const progress = useMemo(
    () => ({ queryLog: game.queryLog, notes: parseNotes(game.notes, people, places, times) }),
    [game.queryLog, game.notes]
  );

  const goTo = useCallback(
    (next: BeatRef) => {
      if (next.beat === 0) snapshots.current[next.step] = game;
      setRef(next);
      setDraft(null);
    },
    [game]
  );

  useEffect(() => {
    if (phase !== "play" || !beatDone(beat, progress)) return;
    const next = nextBeat(ref);
    if (!next) return;
    const id = window.setTimeout(() => goTo(next), beat.kind === "mark" ? 650 : 120);
    return () => window.clearTimeout(id);
  }, [beat, progress, ref, phase, goTo]);

  function back() {
    const step = Math.max(0, ref.step - 1);
    setGame(snapshots.current[step] ?? EMPTY);
    setRef({ step, beat: 0 });
    setDraft(null);
    setSubmitOpen(true);
    setEpoch((e) => e + 1);
  }

  function skip() {
    router.push("/");
  }

  function replay() {
    snapshots.current = { 0: EMPTY };
    setGame(EMPTY);
    setRef(FIRST_BEAT);
    setMisses(0);
    setSubmitOpen(true);
    setPhase("play");
    setEpoch((e) => e + 1);
    window.scrollTo({ top: 0 });
  }

  const ask = useCallback(async (input: QueryTarget) => {
    const result =
      input.kind === "place_time"
        ? resolvePlaceTime(sealed, input.placeId, input.timeId!)
        : resolvePlacePerson(sealed, input.placeId, input.personId!);
    setGame((g) => {
      const id = `q${g.queryLog.length + 1}`;
      const entry: QueryLogEntry = {
        id,
        askerId: "you",
        askerNickname: "你",
        kind: input.kind,
        placeId: input.placeId,
        timeId: input.timeId,
        personId: input.personId,
        sharedLabel: result.shared.sharedLabel,
        askAgain: result.shared.askAgain,
        at: Date.now(),
      };
      const clue: PrivateClue = { queryId: id, privateLabel: result.private.privateLabel, ...input };
      return { ...g, queryLog: [...g.queryLog, entry], privateClues: [...g.privateClues, clue] };
    });
  }, []);

  const saveNotes = useCallback(async (text: string) => {
    setGame((g) => (g.notes === text ? g : { ...g, notes: text }));
  }, []);

  const queryCount = game.queryLog.filter((q) => !q.askAgain).length;
  const view: RoomPublicView = useMemo(
    () => ({
      code: "PROLOG",
      phase: "playing",
      scenarioId: scenario.id,
      scenario,
      players: [{ id: "you", nickname: "你", seat: 0, eliminated: false, connected: true, isHost: true, queryCount }],
      currentTurnPlayerId: "you",
      queryLog: game.queryLog,
      queryCountTotal: queryCount,
      submitWindowEndsAt: null,
      winners: [],
      revealAnswers: null,
      revealTrajectory: null,
      revealVictimId: null,
      soloRating: null,
      you: {
        playerId: "you",
        privateClues: game.privateClues,
        notes: game.notes,
        canAct: true,
        canSubmit: false,
        eliminated: false,
        record: null,
      },
    }),
    [game, queryCount]
  );

  if (phase === "debrief") {
    return (
      <div className="relative min-h-screen">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] bg-atmosphere" aria-hidden />
        <TutorialHeader />
        <TutorialDebrief key={epoch} misses={misses} onReplay={replay} />
      </div>
    );
  }

  const submitting = beat.kind === "submit";
  const tab = submitting ? freeTab : tabOf(beat);
  const lastAskAgain = !!game.queryLog[game.queryLog.length - 1]?.askAgain;
  const focusTime = beat.kind === "read" ? beat.focusTime : beat.kind === "mark" ? beat.cell.time : undefined;

  let overlay: React.ReactNode = null;
  if (beat.kind === "read" && ref.step === 0) {
    overlay = <CoachOverlay center card={<CaseFile text={beat.text} onStart={() => goTo(nextBeat(ref)!)} onSkip={skip} />} />;
  } else if (beat.kind === "read") {
    overlay = (
      <CoachOverlay
        target={beat.target}
        card={
          <CoachCard
            stepIndex={ref.step}
            text={beat.text}
            cta={beat.cta}
            onNext={() => goTo(nextBeat(ref)!)}
            onBack={ref.step > 0 ? back : undefined}
            onSkip={skip}
          />
        }
      />
    );
  } else if (beat.kind === "ask") {
    overlay = (
      <CoachOverlay
        target={askAnchor(beat.ask, askFocus(beat.ask, draft))}
        card={
          <CoachCard
            stepIndex={ref.step}
            text={beat.text}
            hint={askHint(beat.ask, draft)}
            onBack={back}
            onSkip={skip}
          />
        }
      />
    );
  } else if (beat.kind === "mark") {
    overlay = (
      <CoachOverlay
        target={`cell-${beat.cell.time}-${beat.cell.place}`}
        prefer="top"
        card={<CoachCard stepIndex={ref.step} text={beat.text} onBack={back} onSkip={skip} />}
      />
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] bg-atmosphere" aria-hidden />
      <TutorialHeader queryCount={queryCount} />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-4 px-3 pb-28 pt-5 md:px-6">
        <div role="tablist" className="flex w-full justify-start gap-6 border-b border-ink-faint/60">
          {(
            [
              ["desk", "桌面"],
              ["ask", "提问"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              disabled={!submitting}
              onClick={() => setFreeTab(value)}
              className={cn(
                "relative -mb-px min-h-11 border-b-2 px-0 pb-2 pt-1 font-display text-lg transition-colors disabled:cursor-default",
                tab === value ? "border-[var(--amber)] text-[var(--ink)]" : "border-transparent text-[var(--ink-muted)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "desk" ? (
          <div className="grid gap-10 pt-1 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
            <div className="min-w-0">
              <DeskTimeline
                key={epoch}
                view={view}
                onSaveNotes={saveNotes}
                allowedTargets={{ cells: beat.kind === "mark" ? [beat.cell] : [] }}
                focusTime={focusTime}
              />
            </div>
            <div className="lg:sticky lg:top-24 lg:self-start">
              <CaseLog view={view} />
            </div>
          </div>
        ) : (
          <div className="pt-1">
            <QueryPanel
              key={`${epoch}-${ref.step}-${ref.beat}`}
              scenario={scenario}
              canAct
              askAgain={lastAskAgain}
              busy={false}
              onAsk={ask}
              allowedTargets={beat.kind === "ask" ? [beat.ask] : []}
              onDraftChange={setDraft}
            />
          </div>
        )}
      </div>

      {overlay}

      {submitting && (
        <>
          {!submitOpen && (
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-faint/60 bg-curtain/92 px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
              <div className="mx-auto flex max-w-xl items-center gap-3">
                <p className="flex-1 text-sm text-[var(--ink-muted)]">看完线索，回来交卷。</p>
                <Button onClick={() => setSubmitOpen(true)}>交卷</Button>
              </div>
            </div>
          )}
          <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
            <DialogContent
              sheet
              className="overflow-y-auto overscroll-contain border-0 bg-[var(--curtain)] px-5 pt-7 text-[var(--ink)] shadow-[0_0_0_1px_var(--ink-faint),0_40px_120px_-30px_rgba(0,0,0,0.9)] sm:max-h-[92vh] sm:max-w-xl sm:p-8"
            >
              <DialogHeader className="text-left">
                <p className="text-[11px] tracking-[0.18em] text-[var(--ink-muted)]">
                  第 6 步 / 6 · <span className="text-[var(--ink)]">交卷</span>
                </p>
                <DialogTitle className="font-display text-3xl">交卷</DialogTitle>
                <DialogDescription className="leading-relaxed text-[var(--ink-muted)]">
                  {beat.text}关掉这张卡可以回桌面再看一眼线索。
                </DialogDescription>
              </DialogHeader>
              <TutorialSubmit
                key={epoch}
                scenario={scenario}
                answers={sealed.answers}
                onDone={(n) => {
                  setMisses(n);
                  setPhase("debrief");
                  window.scrollTo({ top: 0 });
                }}
              />
              <div className="-mb-2 flex items-center border-t border-ink-faint/60 pt-1">
                <button
                  type="button"
                  onClick={back}
                  className="-ml-2 flex min-h-11 items-center gap-1 px-2 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  上一步
                </button>
                <button
                  type="button"
                  onClick={skip}
                  className="flex min-h-11 items-center px-2 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  跳过教程
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function TutorialHeader({ queryCount }: { queryCount?: number }) {
  return (
    <header data-coach-top className="sticky top-0 z-[47] border-b border-ink-faint/60 bg-curtain/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 md:px-6 md:py-3">
        <Link
          href="/"
          className="-ml-2 flex min-h-11 items-center px-2 font-display text-base tracking-[0.2em] text-[var(--ink)] hover:text-[var(--amber)]"
          aria-label="灯序 · 回大厅"
        >
          灯序
        </Link>
        <span className="hidden h-4 w-px bg-[var(--ink-faint)] sm:block" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm text-[var(--ink)] sm:text-base">{scenario.title}</p>
          <p className="text-[11px] text-[var(--ink-muted)]">
            {scenario.tier} · 单人 · 本地
            {queryCount != null && (
              <>
                {" "}
                · 已问 <span className="tabular">{queryCount}</span>
              </>
            )}
          </p>
        </div>
        <RulesSheet />
        <Link
          href="/"
          className="-mr-2 flex min-h-11 items-center gap-1 px-2 text-xs text-[var(--ink-muted)] hover:text-[var(--amber)]"
        >
          <X className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">离开</span>
        </Link>
      </div>
    </header>
  );
}
