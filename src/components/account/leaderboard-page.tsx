"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Lamp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
import { LEADERBOARD_LEVELS, type LeaderboardPlayerCount } from "@/lib/game/leaderboard";
import { levelLabel } from "@/lib/game/levels";
import type {
  LeaderboardEntryDto,
  LevelLeaderboardResponse,
  SummaryEntryDto,
  SummaryLeaderboardResponse,
} from "@/lib/account/leaderboard-types";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./account-menu";
import { AuthDialog } from "./auth-dialog";

type LevelTab = "all" | number;
type BoardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; enabled: boolean; kind: "level"; data: LevelLeaderboardResponse }
  | { status: "ready"; enabled: boolean; kind: "summary"; data: SummaryLeaderboardResponse };

const PLAYERS: LeaderboardPlayerCount[] = [1, 2, 3, 4];
const LEVEL_TABS: LevelTab[] = ["all", ...Array.from({ length: LEADERBOARD_LEVELS }, (_, i) => i + 1)];

const timeFmt = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function Shell({ children }: { children: React.ReactNode }) {
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
            href="/"
            className="-ml-2 flex min-h-11 items-center px-2 font-display text-base tracking-[0.2em] text-[var(--ink)] transition-colors hover:text-[var(--amber)]"
            aria-label="灯序 · 回大厅"
          >
            灯<span className="text-[var(--amber)]">序</span>
          </Link>
          <AccountMenu />
        </nav>
        {children}
      </div>
    </main>
  );
}

function LampRow({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i === 2 || i === 4
              ? "bg-[var(--amber)] shadow-[0_0_8px_rgba(212,161,90,0.75)]"
              : "bg-[var(--ink-faint)]"
          )}
        />
      ))}
    </span>
  );
}

function LevelChip({
  active,
  onClick,
  children,
  ariaLabel,
  square,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  square?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "flex h-11 shrink-0 items-center justify-center rounded-[3px] text-sm tracking-wide transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.97]",
        square ? "w-11 font-display text-base tabular" : "min-w-[3.25rem] px-3.5",
        active
          ? "bg-[var(--amber)] text-[var(--curtain)] shadow-[0_10px_24px_-14px_rgba(212,161,90,0.9)]"
          : "bg-stage/70 text-[var(--ink-muted)] shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:text-[var(--ink)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
      )}
    >
      {children}
    </button>
  );
}

function RankCell({ rank }: { rank: number }) {
  if (rank <= 3) {
    const glow =
      rank === 1
        ? "text-[var(--amber)] drop-shadow-[0_0_10px_rgba(212,161,90,0.55)]"
        : rank === 2
          ? "text-[#c9d1cc]"
          : "text-[#c27c4e]";
    return (
      <span className="relative inline-flex min-w-[1.75rem] items-center gap-1.5">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            rank === 1
              ? "bg-[var(--amber)] shadow-[0_0_8px_rgba(212,161,90,0.8)]"
              : rank === 2
                ? "bg-[#c9d1cc]"
                : "bg-[#c27c4e]"
          )}
          aria-hidden
        />
        <span className={cn("font-display text-2xl leading-none tabular", glow)}>{rank}</span>
      </span>
    );
  }
  return <span className="inline-block min-w-[1.75rem] pl-[1.125rem] font-display text-xl tabular text-[var(--ink-muted)]">{rank}</span>;
}

function EmptyBoard({ hint }: { hint: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <LampRow className="opacity-80" />
      <p className="mt-5 font-display text-xl text-[var(--ink)]">{hint}</p>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--ink-muted)]">
        登录后首次通关，成绩会落在对应人数与关卡的榜上。
      </p>
      <Button asChild className="group mt-7" size="lg">
        <Link href="/">
          去做第一名
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </Button>
    </div>
  );
}

function LevelTable({
  top,
  players,
  highlightUserId,
}: {
  top: LeaderboardEntryDto[];
  players: LeaderboardPlayerCount;
  highlightUserId: number | null;
}) {
  const multi = players > 1;
  if (!top.length) {
    return <EmptyBoard hint="这张榜还空着" />;
  }
  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="w-full min-w-[18rem] border-collapse text-left">
        <thead>
          <tr className="text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
            <th className="w-14 pb-3 pr-2 font-normal">名次</th>
            <th className="pb-3 pr-3 font-normal">称呼</th>
            <th className="pb-3 pr-3 text-right font-normal">得分</th>
            {multi && <th className="hidden pb-3 pr-3 text-right font-normal sm:table-cell">提问 / 绿 / 白</th>}
            <th className="hidden pb-3 text-right font-normal sm:table-cell sm:text-left">达成</th>
          </tr>
        </thead>
        <tbody>
          {top.map((row) => {
            const mine = highlightUserId != null && row.userId === highlightUserId;
            return (
              <tr
                key={`${row.userId}-${row.playedAt}`}
                className={cn(
                  "border-t border-ink-faint/40 transition-colors duration-200",
                  mine ? "bg-amber/[0.12]" : "hover:bg-white/[0.025]"
                )}
              >
                <td className="relative py-3.5 pr-2">
                  {mine && (
                    <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--amber)]" aria-hidden />
                  )}
                  <RankCell rank={row.rank} />
                </td>
                <td className={cn("min-w-0 py-3.5 pr-3", mine ? "font-medium text-[var(--ink)]" : "text-[var(--ink)]")}>
                  <span className="block truncate">{row.username}</span>
                  {mine && <span className="text-[10px] tracking-[0.18em] text-[var(--amber)]">你</span>}
                </td>
                <td className="py-3.5 pr-0 text-right font-mono text-[var(--amber)] tabular sm:pr-3">{row.score}</td>
                {multi && (
                  <td className="hidden py-3.5 pr-3 text-right font-mono text-xs text-[var(--ink-muted)] tabular sm:table-cell">
                    {row.ownQueries} / {row.greenCount} / {row.ownWhiteCount}
                  </td>
                )}
                <td className="hidden py-3.5 text-right text-xs text-[var(--ink-muted)] tabular sm:table-cell sm:text-left">
                  {timeFmt.format(new Date(row.playedAt))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SummaryTable({
  top,
  highlightUserId,
}: {
  top: SummaryEntryDto[];
  highlightUserId: number | null;
}) {
  if (!top.length) {
    return <EmptyBoard hint="这张总榜还空着" />;
  }
  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="w-full min-w-[18rem] border-collapse text-left">
        <thead>
          <tr className="text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
            <th className="w-14 pb-3 pr-2 font-normal">名次</th>
            <th className="pb-3 pr-3 font-normal">称呼</th>
            <th className="pb-3 pr-3 text-right font-normal">通关</th>
            <th className="pb-3 pr-0 text-right font-normal sm:pr-3">得分和</th>
            <th className="hidden pb-3 text-right font-normal sm:table-cell sm:text-left">最近首通</th>
          </tr>
        </thead>
        <tbody>
          {top.map((row) => {
            const mine = highlightUserId != null && row.userId === highlightUserId;
            return (
              <tr
                key={row.userId}
                className={cn(
                  "border-t border-ink-faint/40 transition-colors duration-200",
                  mine ? "bg-amber/[0.12]" : "hover:bg-white/[0.025]"
                )}
              >
                <td className="relative py-3.5 pr-2">
                  {mine && (
                    <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--amber)]" aria-hidden />
                  )}
                  <RankCell rank={row.rank} />
                </td>
                <td className={cn("min-w-0 py-3.5 pr-3", mine ? "font-medium text-[var(--ink)]" : "text-[var(--ink)]")}>
                  <span className="block truncate">{row.username}</span>
                  {mine && <span className="text-[10px] tracking-[0.18em] text-[var(--amber)]">你</span>}
                </td>
                <td className="py-3.5 pr-3 text-right font-mono text-[var(--ink)] tabular">{row.clears}</td>
                <td className="py-3.5 pr-0 text-right font-mono text-[var(--amber)] tabular sm:pr-3">{row.scoreSum}</td>
                <td className="hidden py-3.5 text-right text-xs text-[var(--ink-muted)] tabular sm:table-cell sm:text-left">
                  {timeFmt.format(new Date(row.lastPlayedAt))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="space-y-3 py-2" role="status" aria-label="正在翻榜单">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="flex h-12 items-center gap-3 border-t border-ink-faint/30 first:border-t-0"
          style={{ opacity: 1 - i * 0.12 }}
        >
          <span className="h-2 w-2 rounded-full bg-ink-faint/80" />
          <span className="h-3 w-8 rounded-sm bg-ink-faint/50" />
          <span className="h-3 flex-1 rounded-sm bg-ink-faint/35" />
          <span className="h-3 w-10 rounded-sm bg-ink-faint/45" />
        </div>
      ))}
    </div>
  );
}

function MeBar({
  loggedIn,
  meLevel,
  meSummary,
  players,
  onLogin,
}: {
  loggedIn: boolean;
  meLevel: LeaderboardEntryDto | null;
  meSummary: SummaryEntryDto | null;
  players: LeaderboardPlayerCount;
  onLogin: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-5 mt-8 bg-gradient-to-t from-[var(--curtain)] via-[var(--curtain)]/95 to-transparent px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6 sm:-mx-8 sm:px-8">
      <div className="ticket-edge parchment-wash relative px-4 py-3.5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)]">
        <div className="pointer-events-none absolute inset-y-2 left-0 right-0 border-y border-dashed border-ink-faint/55" aria-hidden />
        {!loggedIn ? (
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-[0.24em] text-[var(--amber)]">我的名次</p>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">登录后可看自己落在哪一格</p>
            </div>
            <Button size="sm" className="h-11 min-w-[6rem]" onClick={onLogin}>
              去登录
            </Button>
          </div>
        ) : meLevel ? (
          <div className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-[11px] tracking-[0.24em] text-[var(--amber)]">我的名次</p>
            <p className="font-display text-2xl text-[var(--ink)]">
              第 <span className="text-[var(--amber)] tabular">{meLevel.rank}</span> 名
              <span className="ml-3 font-mono text-base text-[var(--ink-muted)] tabular">得分 {meLevel.score}</span>
            </p>
            {players > 1 && (
              <p className="w-full font-mono text-xs text-[var(--ink-muted)] tabular">
                提问 {meLevel.ownQueries} · 绿窗 {meLevel.greenCount} · 白窗 {meLevel.ownWhiteCount}
              </p>
            )}
          </div>
        ) : meSummary ? (
          <div className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-[11px] tracking-[0.24em] text-[var(--amber)]">我的名次</p>
            <p className="font-display text-2xl text-[var(--ink)]">
              第 <span className="text-[var(--amber)] tabular">{meSummary.rank}</span> 名
              <span className="ml-3 font-mono text-base text-[var(--ink-muted)] tabular">
                {meSummary.clears} 关 · 得分和 {meSummary.scoreSum}
              </span>
            </p>
          </div>
        ) : (
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--ink-muted)]">这张榜上还没有你的首通成绩</p>
            <Button asChild variant="secondary" size="sm" className="h-11">
              <Link href="/">去通关</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function LeaderboardPage({
  initialLevel = "all",
  initialPlayers = 1,
}: {
  initialLevel?: LevelTab;
  initialPlayers?: LeaderboardPlayerCount;
}) {
  const account = useAccount();
  const [level, setLevel] = useState<LevelTab>(initialLevel);
  const [players, setPlayers] = useState<LeaderboardPlayerCount>(initialPlayers);
  const [board, setBoard] = useState<BoardState>({ status: "loading" });
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    const qs =
      level === "all"
        ? `?level=all&players=${players}`
        : `?level=${level}&players=${players}`;
    window.history.replaceState(null, "", `/leaderboard${qs}`);
  }, [level, players]);

  useEffect(() => {
    let cancelled = false;
    setBoard({ status: "loading" });
    const qs =
      level === "all"
        ? `/api/leaderboard?level=all&players=${players}`
        : `/api/leaderboard?level=${level}&players=${players}`;
    fetch(qs, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "排行榜暂时读不出来");
        if (cancelled) return;
        if (data.kind === "summary" || level === "all") {
          setBoard({ status: "ready", enabled: !!data.enabled, kind: "summary", data: data as SummaryLeaderboardResponse });
        } else {
          setBoard({ status: "ready", enabled: !!data.enabled, kind: "level", data: data as LevelLeaderboardResponse });
        }
      })
      .catch((e) => {
        if (!cancelled) setBoard({ status: "error", message: e instanceof Error ? e.message : "排行榜暂时读不出来" });
      });
    return () => {
      cancelled = true;
    };
  }, [level, players]);

  if (account.status === "loading") {
    return (
      <Shell>
        <div className="grid place-items-center py-32" role="status">
          <Lamp className="animate-pulse-soft h-6 w-6 text-[var(--amber)]" aria-hidden />
          <p className="mt-4 text-sm tracking-[0.2em] text-[var(--ink-muted)]">正在翻榜单</p>
        </div>
      </Shell>
    );
  }

  if (!account.enabled) {
    return (
      <Shell>
        <section className="mx-auto max-w-md py-24 text-center">
          <Trophy className="mx-auto h-8 w-8 text-[var(--ink-muted)]" aria-hidden />
          <p className="mt-4 font-display text-3xl text-[var(--ink)]">排行榜未开放</p>
          <p className="mt-3 text-sm text-[var(--ink-muted)]">这台服务器没有接数据库，榜单不会保存。游客照样可以开局。</p>
          <Button asChild className="mt-8">
            <Link href="/">回大厅</Link>
          </Button>
        </section>
      </Shell>
    );
  }

  const userId = account.user?.id ?? null;
  const meLevel = board.status === "ready" && board.kind === "level" ? board.data.me : null;
  const meSummary = board.status === "ready" && board.kind === "summary" ? board.data.me : null;

  return (
    <Shell>
      <header className="pt-2 md:pt-6">
        <div className="rise flex items-center gap-3" style={{ ["--i" as string]: 0 }}>
          <p className="text-[11px] tracking-[0.42em] text-[var(--amber)]">星河榜</p>
          <LampRow />
          <Link
            href="/leaderboard/detective"
            className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-[3px] px-3 text-sm text-[var(--ink-muted)] shadow-[inset_0_0_0_1px_var(--ink-faint)] transition-colors hover:text-[var(--ink)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
          >
            探案榜
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        <h1
          className="rise mt-3 font-display text-[clamp(2.75rem,10vw,4.75rem)] font-black leading-[0.92] text-[var(--ink)]"
          style={{ ["--i" as string]: 1 }}
        >
          排行榜
        </h1>
        <p
          className="rise mt-3 max-w-md text-sm leading-[1.75] text-[var(--ink-muted)]"
          style={{ ["--i" as string]: 2 }}
        >
          只记各关首次通关。单人比提问；多人比提问 + 绿窗 + 本人白窗。越少越前。
        </p>
      </header>

      <div className="rise mt-8 space-y-5" style={{ ["--i" as string]: 3 }}>
        <div>
          <p className="mb-2.5 text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">关卡</p>
          <div
            className="scroll-fade-x-start -mx-1 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="关卡"
          >
            {LEVEL_TABS.map((tab) => (
              <LevelChip
                key={String(tab)}
                active={level === tab}
                onClick={() => setLevel(tab)}
                ariaLabel={tab === "all" ? "总榜" : levelLabel(tab)}
                square={tab !== "all"}
              >
                {tab === "all" ? "总榜" : `${tab}`}
              </LevelChip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">人数</p>
          <div
            className="grid w-full max-w-md grid-cols-4 overflow-hidden rounded-[3px] shadow-[inset_0_0_0_1px_var(--ink-faint)]"
            role="tablist"
            aria-label="人数"
          >
            {PLAYERS.map((n, i) => {
              const active = players === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${n} 人榜`}
                  onClick={() => setPlayers(n)}
                  className={cn(
                    "flex h-11 items-center justify-center text-sm tracking-wide transition-colors duration-200",
                    i > 0 && "border-l border-ink-faint/70",
                    active
                      ? "bg-[var(--amber)] text-[var(--curtain)]"
                      : "bg-stage/60 text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  )}
                >
                  {n} 人
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section
        className="rise ticket-edge parchment-wash relative mt-8 flex-1 px-4 py-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:px-6"
        style={{ ["--i" as string]: 4 }}
      >
        <div className="pointer-events-none absolute inset-y-3 left-0 right-0 border-y border-dashed border-ink-faint/65" aria-hidden />
        <div className="relative mb-4 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl text-[var(--ink)]">
            {level === "all" ? "总榜" : levelLabel(level)}
            <span className="ml-2 text-sm font-sans tracking-normal text-[var(--ink-muted)]">· {players} 人通关</span>
          </h2>
          <p className="shrink-0 text-[11px] tracking-[0.16em] text-[var(--ink-muted)]">前 20</p>
        </div>
        <div className="relative min-h-[14rem]">
          {board.status === "loading" && <BoardSkeleton />}
          {board.status === "error" && (
            <p className="py-16 text-center text-sm text-[var(--ink-muted)]">{board.message}</p>
          )}
          {board.status === "ready" && board.kind === "level" && (
            <LevelTable top={board.data.top} players={players} highlightUserId={userId} />
          )}
          {board.status === "ready" && board.kind === "summary" && (
            <SummaryTable top={board.data.top} highlightUserId={userId} />
          )}
        </div>
      </section>

      <MeBar
        loggedIn={!!account.user}
        meLevel={meLevel}
        meSummary={meSummary}
        players={players}
        onLogin={() => setAuthOpen(true)}
      />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </Shell>
  );
}
