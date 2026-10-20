"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Lamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/account/account-menu";
import { AuthDialog } from "@/components/account/auth-dialog";
import { useAccount } from "@/hooks/use-account";
import {
  DETECTIVE_CASES,
  DETECTIVE_DIFFICULTIES,
  DETECTIVE_MIN_GAMES,
  type DetectiveBoard,
  type DetectiveStats,
} from "@/lib/game/detective";
import { cn } from "@/lib/utils";

type Board =
  | { status: "loading" }
  | { status: "error"; message: string }
  | ({ status: "ready"; enabled: boolean } & DetectiveBoard);

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const avg = (v: number) => v.toFixed(1);

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "min-h-10 shrink-0 rounded-[3px] px-3.5 text-sm transition-[background-color,box-shadow,color] duration-200",
        on
          ? "bg-[var(--amber)] text-[var(--curtain)] shadow-[0_8px_24px_-12px_rgba(212,161,90,0.8)]"
          : "text-[var(--ink-muted)] shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:text-[var(--ink)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" | "white" }) {
  return (
    <span className="flex flex-col items-start sm:items-end">
      <span
        className={cn(
          "font-mono text-sm tabular sm:text-base",
          tone === "green" ? "text-[var(--green-win)]" : tone === "white" ? "text-[#f3e6c8]" : "text-[var(--ink)]"
        )}
      >
        {value}
      </span>
      <span className="text-[10px] tracking-[0.12em] text-[var(--ink-muted)] sm:hidden">{label}</span>
    </span>
  );
}

function Row({ s, rank, mine }: { s: DetectiveStats; rank: number | null; mine: boolean }) {
  return (
    <li
      className={cn(
        "grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-2 border-b border-ink-faint/50 py-3 sm:grid-cols-[3rem_minmax(0,1fr)_4rem_5rem_5rem_5rem_5rem] sm:gap-x-3",
        mine && "bg-amber/[0.07] shadow-[inset_2px_0_0_var(--amber)]"
      )}
    >
      <span
        className={cn(
          "pl-1 font-display text-xl tabular sm:text-2xl",
          rank === 1 ? "text-[var(--amber)]" : rank && rank <= 3 ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"
        )}
      >
        {rank ?? "—"}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[var(--ink)]">{s.username}</span>
        <span className="block font-mono text-[11px] text-[var(--ink-muted)] tabular">
          {s.wins}/{s.games} 胜
        </span>
      </span>
      <span className="hidden text-right font-mono text-sm text-[var(--ink-muted)] tabular sm:block">{s.games}</span>
      <span className="col-start-2 mt-2 grid grid-cols-4 gap-x-2 sm:contents">
        <Stat label="胜率" value={pct(s.winRate)} />
        <Stat label="均绿窗" value={avg(s.avgGreen)} tone="green" />
        <Stat label="均白窗" value={avg(s.avgWhite)} tone="white" />
        <Stat label="均问数" value={avg(s.avgQueries)} />
      </span>
    </li>
  );
}

export function DetectiveLeaderboard({
  initialCase = "all",
  initialDifficulty = "all",
}: {
  initialCase?: string;
  initialDifficulty?: string;
}) {
  const account = useAccount();
  const [caseId, setCaseId] = useState(initialCase);
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [board, setBoard] = useState<Board>({ status: "loading" });
  const [authOpen, setAuthOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const viewerId = account.status === "ready" ? (account.user?.id ?? null) : undefined;

  useEffect(() => {
    const qs = `?case=${caseId}&difficulty=${difficulty}`;
    window.history.replaceState(null, "", `/leaderboard/detective${qs}`);
    let cancelled = false;
    setBoard({ status: "loading" });
    fetch(`/api/detective/leaderboard${qs}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "探案榜暂时读不出来");
        if (!cancelled) setBoard({ status: "ready", ...data });
      })
      .catch((e) => {
        if (!cancelled) setBoard({ status: "error", message: e instanceof Error ? e.message : "探案榜暂时读不出来" });
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, difficulty, retry, viewerId]);

  const loggedIn = account.status === "ready" && !!account.user;
  const me = board.status === "ready" ? board.me : null;

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-atmosphere" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-[-28vh] h-[70vh] w-[110vw] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(212,161,90,0.12),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
        <nav className="flex items-center justify-between py-3.5 text-[11px] tracking-[0.32em] text-[var(--ink-muted)]">
          <Link
            href="/?mode=detective"
            className="-ml-2 flex min-h-11 items-center px-2 font-display text-base tracking-[0.2em] text-[var(--ink)] transition-colors hover:text-[var(--amber)]"
            aria-label="灯序 · 回大厅"
          >
            灯<span className="text-[var(--amber)]">序</span>
          </Link>
          <AccountMenu />
        </nav>

        <header className="pt-4 md:pt-8">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href="/leaderboard"
              className="inline-flex min-h-10 items-center rounded-[3px] px-3 text-[var(--ink-muted)] shadow-[inset_0_0_0_1px_var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
            >
              关卡榜
            </Link>
            <span className="inline-flex min-h-10 items-center rounded-[3px] bg-amber/15 px-3 text-[var(--amber)] shadow-[inset_0_0_0_1px_var(--amber-dim)]" aria-current="page">
              探案榜
            </span>
          </div>
          <p className="mt-6 text-[11px] tracking-[0.42em] text-[var(--amber)]">探案模式 · 随机案件与地图</p>
          <h1 className="mt-3 font-display text-[clamp(2.6rem,9vw,4.5rem)] font-black leading-[0.95] text-[var(--ink)]">探案排行榜</h1>
          <p className="mt-4 max-w-2xl text-sm leading-[1.9] text-[var(--ink-muted)]">
            排序依次看：<span className="text-[var(--ink)]">平均胜率</span>高者在前；同胜率比
            <span className="text-[var(--green-win)]">平均绿窗</span>少、再比平均问数少、再比
            <span className="text-[#f3e6c8]">平均白窗</span>少，最后局数多者在前。
          </p>
        </header>

        <section className="mt-7 space-y-3" aria-label="筛选">
          <div className="flex items-center gap-3">
            <span className="w-8 shrink-0 text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">案件</span>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="radiogroup" aria-label="案件">
              <Chip on={caseId === "all"} onClick={() => setCaseId("all")}>
                全部
              </Chip>
              {DETECTIVE_CASES.map((c) => (
                <Chip key={c.id} on={caseId === c.id} onClick={() => setCaseId(c.id)}>
                  《{c.title}》
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-8 shrink-0 text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">难度</span>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="radiogroup" aria-label="难度">
              <Chip on={difficulty === "all"} onClick={() => setDifficulty("all")}>
                全部
              </Chip>
              {DETECTIVE_DIFFICULTIES.map((d) => (
                <Chip key={d.id} on={difficulty === d.id} onClick={() => setDifficulty(d.id)}>
                  {d.label}
                </Chip>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 flex-1" aria-live="polite">
          <div className="hidden grid-cols-[3rem_minmax(0,1fr)_4rem_5rem_5rem_5rem_5rem] gap-x-3 border-b border-ink-faint/70 pb-2 text-[11px] tracking-[0.18em] text-[var(--ink-muted)] sm:grid">
            <span className="pl-1">名次</span>
            <span>侦探</span>
            <span className="text-right">局数</span>
            <span className="text-right">胜率</span>
            <span className="text-right text-green-win/90">均绿窗</span>
            <span className="text-right">均白窗</span>
            <span className="text-right">均问数</span>
          </div>

          {board.status === "loading" ? (
            <ul aria-label="正在读取" className="pt-1">
              {Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="h-[3.75rem] animate-pulse-soft border-b border-ink-faint/40" />
              ))}
            </ul>
          ) : board.status === "error" ? (
            <div className="py-16 text-center">
              <p role="alert" className="text-sm text-[#e07a5f]">
                {board.message}
              </p>
              <Button variant="secondary" className="mt-4 h-11" onClick={() => setRetry((n) => n + 1)}>
                再试一次
              </Button>
            </div>
          ) : !board.enabled ? (
            <p className="py-16 text-center text-sm text-[var(--ink-muted)]">这台服务器没有开放账号，暂无探案榜。</p>
          ) : board.ranked.length === 0 ? (
            <div className="grid place-items-center py-16 text-center">
              <Lamp className="h-6 w-6 text-[var(--amber)]" aria-hidden />
              <p className="mt-4 font-display text-xl text-[var(--ink)]">这张榜还空着</p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--ink-muted)]">
                满 {DETECTIVE_MIN_GAMES} 局的侦探才会出现在这里。抽一出戏，第一个挂上去。
              </p>
              <Button asChild className="group mt-5 h-11">
                <Link href="/?mode=detective">
                  出发探案
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          ) : (
            <ol>
              {board.ranked.map((r) => (
                <Row key={r.userId} s={r} rank={r.rank} mine={loggedIn && me?.userId === r.userId} />
              ))}
            </ol>
          )}
        </section>

        <div className="sticky bottom-0 z-20 -mx-5 mt-8 bg-gradient-to-t from-[var(--curtain)] via-[var(--curtain)]/95 to-transparent px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6 sm:-mx-8 sm:px-8">
          <div className="ticket-edge parchment-wash relative px-4 py-3.5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)]">
            <div className="pointer-events-none absolute inset-y-2 left-0 right-0 border-y border-dashed border-ink-faint/55" aria-hidden />
            <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="text-[11px] tracking-[0.24em] text-[var(--amber)]">我的探案</p>
              {!loggedIn ? (
                <>
                  <p className="text-sm text-[var(--ink-muted)]">登录后可看自己的胜率与名次</p>
                  <Button size="sm" className="h-11 min-w-[6rem]" onClick={() => setAuthOpen(true)}>
                    去登录
                  </Button>
                </>
              ) : me ? (
                <>
                  <p className="font-display text-xl text-[var(--ink)]">
                    {me.rank ? (
                      <>
                        第 <span className="text-[var(--amber)] tabular">{me.rank}</span> 名
                      </>
                    ) : (
                      <span className="text-base text-[var(--ink-muted)]">
                        再打 {DETECTIVE_MIN_GAMES - me.games} 局即可上榜
                      </span>
                    )}
                  </p>
                  <p className="w-full font-mono text-xs text-[var(--ink-muted)] tabular">
                    {me.games} 局 · 胜率 {pct(me.winRate)} · 绿窗 {avg(me.avgGreen)} · 白窗 {avg(me.avgWhite)} · 问数{" "}
                    {avg(me.avgQueries)}
                  </p>
                </>
              ) : board.status === "ready" ? (
                <>
                  <p className="text-sm text-[var(--ink-muted)]">这组筛选下你还没有探案记录</p>
                  <Button asChild variant="secondary" size="sm" className="h-11">
                    <Link href="/?mode=detective">去探案</Link>
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </main>
  );
}
