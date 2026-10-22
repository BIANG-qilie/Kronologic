"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/hooks/use-account";
import { LEADERBOARD_LEVELS, LEADERBOARD_TOP, type LeaderboardPlayerCount } from "@/lib/game/leaderboard";
import { levelLabel } from "@/lib/game/levels";
import type {
  LeaderboardEntryDto,
  LevelLeaderboardResponse,
  SummaryEntryDto,
  SummaryLeaderboardResponse,
} from "@/lib/account/leaderboard-types";
import { AccountMenu } from "./account-menu";
import { AuthDialog } from "./auth-dialog";
import {
  BoardChip,
  BoardClosed,
  BoardError,
  BoardFilters,
  BoardHead,
  BoardHeader,
  BoardLoading,
  BoardRow,
  BoardShell,
  BoardSkeleton,
  BoardTable,
  BoardTicket,
  EmptyBoard,
  ExtraTd,
  FilterBlock,
  MeAbsent,
  MeDock,
  MeGuest,
  MePending,
  MeRanked,
  MetricTd,
  NameTd,
  RankTd,
  Segmented,
} from "@/components/leaderboard/frame";

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

const LEDE = "只记各关首次通关。单人比提问；多人比提问 + 绿窗 + 本人白窗。越少越前。";

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
    return (
      <EmptyBoard
        hint="这张榜还空着"
        detail="登录后首次通关，成绩会落在对应人数与关卡的榜上。"
        href="/"
        action="去做第一名"
      />
    );
  }
  return (
    <BoardTable>
      <BoardHead>
        <th className="w-14 pb-3 pr-2 font-normal">名次</th>
        <th className="pb-3 pr-3 font-normal">称呼</th>
        <th className="w-[4.75rem] pb-3 pr-0 text-right font-normal sm:pr-3">得分</th>
        {multi && <th className="hidden w-[7.5rem] pb-3 pr-3 text-right font-normal sm:table-cell">提问 / 绿 / 白</th>}
        <th className="hidden w-[6.5rem] pb-3 font-normal sm:table-cell">达成</th>
      </BoardHead>
      <tbody>
        {top.map((row) => {
          const mine = highlightUserId != null && row.userId === highlightUserId;
          return (
            <BoardRow key={`${row.userId}-${row.playedAt}`} mine={mine}>
              <RankTd rank={row.rank} mine={mine} />
              <NameTd name={row.username} mine={mine} />
              <MetricTd>{row.score}</MetricTd>
              {multi && (
                <ExtraTd>
                  {row.ownQueries} / {row.greenCount} / {row.ownWhiteCount}
                </ExtraTd>
              )}
              <ExtraTd align="left">{timeFmt.format(new Date(row.playedAt))}</ExtraTd>
            </BoardRow>
          );
        })}
      </tbody>
    </BoardTable>
  );
}

function SummaryTable({ top, highlightUserId }: { top: SummaryEntryDto[]; highlightUserId: number | null }) {
  if (!top.length) {
    return (
      <EmptyBoard
        hint="这张总榜还空着"
        detail="登录后首次通关，成绩会落在对应人数与关卡的榜上。"
        href="/"
        action="去做第一名"
      />
    );
  }
  return (
    <BoardTable>
      <BoardHead>
        <th className="w-14 pb-3 pr-2 font-normal">名次</th>
        <th className="pb-3 pr-3 font-normal">称呼</th>
        <th className="w-16 pb-3 pr-3 text-right font-normal">通关</th>
        <th className="w-[4.75rem] pb-3 pr-0 text-right font-normal sm:pr-3">得分和</th>
        <th className="hidden w-[6.5rem] pb-3 font-normal sm:table-cell">最近首通</th>
      </BoardHead>
      <tbody>
        {top.map((row) => {
          const mine = highlightUserId != null && row.userId === highlightUserId;
          return (
            <BoardRow key={row.userId} mine={mine}>
              <RankTd rank={row.rank} mine={mine} />
              <NameTd name={row.username} mine={mine} />
              <td className="py-3.5 pr-3 text-right font-mono tabular text-[var(--ink)]">{row.clears}</td>
              <MetricTd>{row.scoreSum}</MetricTd>
              <ExtraTd align="left">{timeFmt.format(new Date(row.lastPlayedAt))}</ExtraTd>
            </BoardRow>
          );
        })}
      </tbody>
    </BoardTable>
  );
}

function MeBar({
  loggedIn,
  pending,
  meLevel,
  meSummary,
  players,
  onLogin,
}: {
  loggedIn: boolean;
  pending: boolean;
  meLevel: LeaderboardEntryDto | null;
  meSummary: SummaryEntryDto | null;
  players: LeaderboardPlayerCount;
  onLogin: () => void;
}) {
  let body: React.ReactNode;
  if (!loggedIn) {
    body = <MeGuest onLogin={onLogin} hint="登录后可看自己落在哪一格" />;
  } else if (pending) {
    body = <MePending />;
  } else if (meLevel) {
    body = (
      <MeRanked
        rank={meLevel.rank}
        detail={<span className="ml-3 font-mono text-base text-[var(--ink-muted)] tabular">得分 {meLevel.score}</span>}
        extra={
          players > 1 ? (
            <p className="w-full font-mono text-xs text-[var(--ink-muted)] tabular">
              提问 {meLevel.ownQueries} · 绿窗 {meLevel.greenCount} · 白窗 {meLevel.ownWhiteCount}
            </p>
          ) : null
        }
      />
    );
  } else if (meSummary) {
    body = (
      <MeRanked
        rank={meSummary.rank}
        detail={
          <span className="ml-3 font-mono text-base text-[var(--ink-muted)] tabular">
            {meSummary.clears} 关 · 得分和 {meSummary.scoreSum}
          </span>
        }
      />
    );
  } else {
    body = <MeAbsent hint="这张榜上还没有你的首通成绩" href="/" action="去通关" />;
  }
  return <MeDock>{body}</MeDock>;
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
  const search = level === "all" ? `level=all&players=${players}` : `level=${level}&players=${players}`;

  useEffect(() => {
    let cancelled = false;
    setBoard({ status: "loading" });
    fetch(`/api/leaderboard?${search}`, { cache: "no-store" })
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
  }, [level, search]);

  const menu = <AccountMenu />;
  const header = <BoardHeader mode="level" search={search} lede={LEDE} />;

  if (account.status === "loading") {
    return (
      <BoardShell menu={menu}>
        {header}
        <BoardLoading />
      </BoardShell>
    );
  }

  if (!account.enabled) {
    return (
      <BoardShell menu={menu}>
        {header}
        <BoardClosed />
      </BoardShell>
    );
  }

  const userId = account.user?.id ?? null;
  const meLevel = board.status === "ready" && board.kind === "level" ? board.data.me : null;
  const meSummary = board.status === "ready" && board.kind === "summary" ? board.data.me : null;

  return (
    <BoardShell menu={menu}>
      {header}
      <BoardFilters>
        <FilterBlock label="关卡">
          {LEVEL_TABS.map((tab) => (
            <BoardChip
              key={String(tab)}
              active={level === tab}
              onClick={() => setLevel(tab)}
              ariaLabel={tab === "all" ? "总榜" : levelLabel(tab)}
              square={tab !== "all"}
            >
              {tab === "all" ? "总榜" : `${tab}`}
            </BoardChip>
          ))}
        </FilterBlock>
        <Segmented
          label="人数"
          value={players}
          onChange={setPlayers}
          options={PLAYERS.map((n) => ({ value: n, label: `${n} 人`, aria: `${n} 人榜` }))}
        />
      </BoardFilters>

      <BoardTicket
        title={
          <>
            {level === "all" ? "总榜" : levelLabel(level)}
            <span className="ml-2 text-sm font-sans tracking-normal text-[var(--ink-muted)]">· {players} 人通关</span>
          </>
        }
        aside={`前 ${LEADERBOARD_TOP}`}
      >
        {board.status === "loading" && <BoardSkeleton />}
        {board.status === "error" && <BoardError message={board.message} />}
        {board.status === "ready" && board.kind === "level" && (
          <LevelTable top={board.data.top} players={players} highlightUserId={userId} />
        )}
        {board.status === "ready" && board.kind === "summary" && (
          <SummaryTable top={board.data.top} highlightUserId={userId} />
        )}
      </BoardTicket>

      <MeBar
        loggedIn={!!account.user}
        pending={board.status !== "ready"}
        meLevel={meLevel}
        meSummary={meSummary}
        players={players}
        onLogin={() => setAuthOpen(true)}
      />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </BoardShell>
  );
}
