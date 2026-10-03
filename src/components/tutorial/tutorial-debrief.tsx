"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Award, RotateCcw } from "lucide-react";
import { PROLOGUE } from "@/lib/game/prologue";
import { DEBRIEF } from "@/lib/game/tutorial-script";
import { markPrologueDone } from "@/lib/game/tutorial-progress";
import { useAccount } from "@/hooks/use-account";
import type { TutorialCompleteResponse } from "@/lib/account/types";
import { Replay } from "@/components/game/end-screen";
import { Button } from "@/components/ui/button";

type Saved = "pending" | "guest" | "new" | "had" | "failed";

function useRecordCompletion(): Saved {
  const account = useAccount();
  const [saved, setSaved] = useState<Saved>("pending");
  const sent = useRef(false);

  useEffect(() => {
    markPrologueDone();
  }, []);

  useEffect(() => {
    if (account.status !== "ready" || sent.current) return;
    sent.current = true;
    if (!account.user) {
      setSaved("guest");
      return;
    }
    fetch("/api/tutorial/complete", { method: "POST" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const body = (await r.json()) as TutorialCompleteResponse;
        setSaved(!body.saved ? "guest" : body.newlyUnlocked ? "new" : "had");
      })
      .catch(() => setSaved("failed"));
  }, [account]);

  return saved;
}

const SAVED_LINE: Record<Exclude<Saved, "pending">, string> = {
  new: "解锁成就「开场白」，已记进账号。",
  had: "成就「开场白」早已记在账号里。",
  guest: "已记在这台设备上。登录后再走一遍序幕，就能把成就「开场白」记进账号。",
  failed: "成就这次没记上，稍后再走一遍序幕即可补上。",
};

export function TutorialDebrief({ misses, onReplay }: { misses: number; onReplay: () => void }) {
  const saved = useRecordCompletion();
  const { answers } = PROLOGUE.sealed;

  return (
    <main className="relative mx-auto max-w-3xl px-5 pb-[max(3rem,env(safe-area-inset-bottom))] pt-8 sm:px-8 sm:pt-12">
      <p className="rise text-[11px] tracking-[0.42em] text-[var(--amber)]" style={{ ["--i" as string]: 0 }}>
        结案 · 第 0 关 · 序幕
      </p>
      <h1
        className="rise mt-4 font-display text-[clamp(2rem,7vw,3.25rem)] leading-[1.15] text-[var(--ink)]"
        style={{ ["--i" as string]: 1 }}
      >
        {DEBRIEF.verdict}
      </h1>
      <p className="rise mt-3 text-sm text-[var(--ink-muted)]" style={{ ["--i" as string]: 2 }}>
        {misses === 0 ? "一次没错，直接结案。" : `交卷时错了 ${misses} 次，提示把你带了回来。正式关卡只有一次机会。`}
      </p>

      <section className="mt-8" aria-label="整晚回放">
        <p className="rise mb-3 text-[11px] tracking-[0.32em] text-[var(--ink-muted)]" style={{ ["--i" as string]: 3 }}>
          三个时刻回放
        </p>
        <Replay
          view={{ scenario: PROLOGUE.public }}
          trajectory={PROLOGUE.sealed.trajectory}
          crime={{ time: Number(answers.when), place: "dress" }}
          culprit={answers.who}
          victim={null}
        />
      </section>

      <p
        role="status"
        className="rise mt-6 flex min-h-6 items-start gap-2 text-sm text-[var(--ink)]"
        style={{ ["--i" as string]: 9 }}
      >
        <Award className="mt-0.5 h-4 w-4 shrink-0 text-[var(--amber)]" aria-hidden />
        {saved === "pending" ? <span className="text-[var(--ink-muted)]">正在记下…</span> : SAVED_LINE[saved]}
      </p>

      <section className="mt-10" aria-labelledby="recap-h">
        <h2 id="recap-h" className="mb-4 font-display text-2xl text-[var(--ink)]">
          三条规则，带进第 1 关
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {DEBRIEF.recap.map((r, i) => (
            <li
              key={r.title}
              className="rise rounded-[3px] bg-[var(--stage)] p-4 shadow-[inset_0_0_0_1px_var(--ink-faint)]"
              style={{ ["--i" as string]: 10 + i }}
            >
              <span className="font-display text-sm italic text-[var(--amber)]">0{i + 1}</span>
              <p className="mt-1 font-display text-lg text-[var(--ink)]">{r.title}</p>
              <p className="mt-1.5 text-sm leading-[1.8] text-[var(--ink-muted)]">{r.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-10 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button asChild size="lg" className="group sm:min-w-[14rem]">
          <Link href="/?level=1">
            进入第 1 关
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
        <Button variant="ghost" size="lg" onClick={onReplay}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          再走一遍
        </Button>
      </div>
    </main>
  );
}
