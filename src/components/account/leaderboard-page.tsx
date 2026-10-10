"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lamp, Trophy } from "lucide-react";
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
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-atmosphere" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-8">
        <nav className="flex items-center justify-between py-3.5 text-[11px] tracking-[0.32em] text-[var(--ink-muted)]">
          <Link
            href="/"
            className="-ml-2 flex min-h-11 items-center px-2 font-display text-base tracking-[0.2em] text-[var(--ink)] hover:text-[var(--amber)]"
            aria-label="灯序 · 回大厅"
          >
            灯序
          </Link>
          <AccountMenu />
        </nav>
        {children}
      </div>
    </main>
  );
}

function Chip({
  active,
  onClick,
  children,
  ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "flex h-11 shrink-0 items-center justify-center rounded-[3px] px-3.5 text-sm tracking-wide transition-colors",
        active
          ? "bg-[var(--amber)] text-[var(--curtain)] shadow-[0_10px_24px_-14px_rgba(212,161,90,0.9)]"
          : "bg-stage/70 text-[var(--ink-muted)] shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:text-[var(--ink)]"
      )}
    >
      {children}
    </button>
  );
}

function RankCell({ rank }: { rank: number }) {
  const medal =
    rank === 1 ? "text-[var(--amber)]" : rank === 2 ? "text-[#c9d1cc]" : rank === 3 ? "text-[#c27c4e]" : "text-[var(--ink-muted)]";
  return <span className={cn("font-display text-xl tabular", medal)}>{rank}</span>;
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
    return <p className="py-16 text-center text-sm text-[var(--ink-muted)]">这张榜还空着，去做第一名吧。</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[18rem] border-collapse text-left">
        <thead>
          <tr className="text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
            <th className="pb-3 pr-3 font-normal">名次</th>
            <th className="pb-3 pr-3 font-normal">称呼</th>
            <th className="pb-3 pr-3 font-normal">得分</th>
            {multi && <th className="hidden pb-3 font-normal sm:table-cell">提问 / 绿窗 / 白窗</th>}
            <th className="pb-3 font-normal">达成</th>
          </tr>
        </thead>
        <tbody>
          {top.map((row) => {
            const mine = highlightUserId != null && row.userId === highlightUserId;
            return (
              <tr
                key={`${row.userId}-${row.playedAt}`}
                className={cn(
                  "border-t border-ink-faint/50",
                  mine && "bg-amber/10"
                )}
              >
                <td className="py-3 pr-3">
                  <RankCell rank={row.rank} />
                </td>
                <td className="py-3 pr-3 text-[var(--ink)]">{row.username}</td>
                <td className="py-3 pr-3 font-mono text-[var(--amber)] tabular">{row.score}</td>
                {multi && (
                  <td className="hidden py-3 font-mono text-xs text-[var(--ink-muted)] tabular sm:table-cell">
                    {row.ownQueries} / {row.greenCount} / {row.ownWhiteCount}
                  </td>
                )}
                <td className="py-3 text-xs text-[var(--ink-muted)]">{timeFmt.format(new Date(row.playedAt))}</td>
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
    return <p className="py-16 text-center text-sm text-[var(--ink-muted)]">这张总榜还空着。</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[18rem] border-collapse text-left">
        <thead>
          <tr className="text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
            <th className="pb-3 pr-3 font-normal">名次</th>
            <th className="pb-3 pr-3 font-normal">称呼</th>
            <th className="pb-3 pr-3 font-normal">通关</th>
            <th className="pb-3 pr-3 font-normal">得分和</th>
            <th className="pb-3 font-normal">最近首通</th>
          </tr>
        </thead>
        <tbody>
          {top.map((row) => {
            const mine = highlightUserId != null && row.userId === highlightUserId;
            return (
              <tr key={row.userId} className={cn("border-t border-ink-faint/50", mine && "bg-amber/10")}>
                <td className="py-3 pr-3">
                  <RankCell rank={row.rank} />
                </td>
                <td className="py-3 pr-3 text-[var(--ink)]">{row.username}</td>
                <td className="py-3 pr-3 font-mono text-[var(--ink)] tabular">{row.clears}</td>
                <td className="py-3 pr-3 font-mono text-[var(--amber)] tabular">{row.scoreSum}</td>
                <td className="py-3 text-xs text-[var(--ink-muted)]">{timeFmt.format(new Date(row.lastPlayedAt))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
    <div className="sticky bottom-0 mt-auto border-t border-ink-faint/70 bg-[var(--curtain)]/95 px-1 py-3 backdrop-blur-sm">
      <div className="ticket-edge relative bg-stage/90 px-4 py-3.5 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.9)]">
        <div className="pointer-events-none absolute inset-y-2 left-0 right-0 border-y border-dashed border-ink-faint/60" aria-hidden />
        {!loggedIn ? (
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--ink-muted)]">登录后可看自己的名次</p>
            <Button size="sm" className="h-11 min-w-[5.5rem]" onClick={onLogin}>
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
          <p className="relative text-sm text-[var(--ink-muted)]">这张榜上还没有你的首通成绩</p>
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
      <header className="pt-4 md:pt-8">
        <p className="rise text-[11px] tracking-[0.42em] text-[var(--amber)]" style={{ ["--i" as string]: 0 }}>
          星河榜
        </p>
        <h1
          className="rise mt-2 font-display text-[clamp(2.5rem,9vw,4.5rem)] font-black leading-[0.95] text-[var(--ink)]"
          style={{ ["--i" as string]: 1 }}
        >
          排行榜
        </h1>
        <p className="rise mt-3 max-w-lg text-sm leading-relaxed text-[var(--ink-muted)]" style={{ ["--i" as string]: 2 }}>
          只记各关首次通关。单人比提问；多人比提问 + 绿窗 + 本人白窗。越少越前。
        </p>
      </header>

      <div className="rise mt-8 space-y-3" style={{ ["--i" as string]: 3 }}>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="关卡">
          {LEVEL_TABS.map((tab) => (
            <Chip
              key={String(tab)}
              active={level === tab}
              onClick={() => setLevel(tab)}
              ariaLabel={tab === "all" ? "总榜" : levelLabel(tab)}
            >
              {tab === "all" ? "总榜" : `${tab}`}
            </Chip>
          ))}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="人数">
          {PLAYERS.map((n) => (
            <Chip key={n} active={players === n} onClick={() => setPlayers(n)} ariaLabel={`${n} 人榜`}>
              {n} 人
            </Chip>
          ))}
        </div>
      </div>

      <section className="rise ticket-edge relative mt-6 flex-1 bg-stage/80 px-4 py-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:px-6" style={{ ["--i" as string]: 4 }}>
        <div className="pointer-events-none absolute inset-y-3 left-0 right-0 border-y border-dashed border-ink-faint/70" aria-hidden />
        <div className="relative mb-4 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl text-[var(--ink)]">
            {level === "all" ? "总榜" : levelLabel(level)}
            <span className="ml-2 text-sm text-[var(--ink-muted)]">· {players} 人通关</span>
          </h2>
          <p className="text-[11px] text-[var(--ink-muted)]">前 20</p>
        </div>
        <div className="relative min-h-[12rem]">
          {board.status === "loading" && (
            <div className="grid place-items-center py-16" role="status">
              <Lamp className="animate-pulse-soft h-5 w-5 text-[var(--amber)]" aria-hidden />
            </div>
          )}
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
