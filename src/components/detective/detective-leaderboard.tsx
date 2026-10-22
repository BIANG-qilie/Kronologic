"use client";

import { useEffect, useState } from "react";
import { AccountMenu } from "@/components/account/account-menu";
import { AuthDialog } from "@/components/account/auth-dialog";
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
import { useAccount } from "@/hooks/use-account";
import {
  DETECTIVE_CASES,
  DETECTIVE_DIFFICULTIES,
  DETECTIVE_MIN_GAMES,
  DETECTIVE_TOP,
  type DetectiveBoard,
  type DetectiveStats,
} from "@/lib/game/detective";

type Board =
  | { status: "loading" }
  | { status: "error"; message: string }
  | ({ status: "ready"; enabled: boolean } & DetectiveBoard);

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const avg = (v: number) => v.toFixed(1);

const LEDE = (
  <>
    排序依次看：<span className="text-[var(--ink)]">平均胜率</span>高者在前；同胜率比
    <span className="text-[var(--green-win)]">平均绿窗</span>少、再比平均问数少、再比
    <span className="text-[#f3e6c8]">平均白窗</span>少，最后局数多者在前。
  </>
);

function caseTitle(caseId: string): string {
  if (caseId === "all") return "全部案件";
  const found = DETECTIVE_CASES.find((c) => c.id === caseId);
  return found ? `《${found.title}》` : "全部案件";
}

function difficultyLabel(id: string): string {
  if (id === "all") return "全部难度";
  return DETECTIVE_DIFFICULTIES.find((d) => d.id === id)?.label ?? "全部难度";
}

function StatsTable({
  rows,
  highlightUserId,
}: {
  rows: (DetectiveStats & { rank: number })[];
  highlightUserId: number | null;
}) {
  return (
    <BoardTable>
      <BoardHead>
        <th className="w-14 pb-3 pr-2 font-normal">名次</th>
        <th className="pb-3 pr-3 font-normal">侦探</th>
        <th className="w-[4.75rem] pb-3 pr-0 text-right font-normal sm:pr-3">胜率</th>
        <th className="hidden w-16 pb-3 pr-3 text-right font-normal text-green-win/90 sm:table-cell">均绿窗</th>
        <th className="hidden w-16 pb-3 pr-3 text-right font-normal sm:table-cell">均问数</th>
        <th className="hidden w-16 pb-3 pr-3 text-right font-normal sm:table-cell">均白窗</th>
        <th className="hidden w-14 pb-3 text-right font-normal sm:table-cell">局数</th>
      </BoardHead>
      <tbody>
        {rows.map((row) => {
          const mine = highlightUserId != null && row.userId === highlightUserId;
          return (
            <BoardRow key={row.userId} mine={mine}>
              <RankTd rank={row.rank} mine={mine} />
              <NameTd
                name={row.username}
                mine={mine}
                meta={`${row.wins}/${row.games} 胜 · 绿 ${avg(row.avgGreen)} · 问 ${avg(row.avgQueries)} · 白 ${avg(row.avgWhite)}`}
              />
              <MetricTd>{pct(row.winRate)}</MetricTd>
              <ExtraTd className="text-[var(--green-win)]">{avg(row.avgGreen)}</ExtraTd>
              <ExtraTd>{avg(row.avgQueries)}</ExtraTd>
              <ExtraTd className="text-[#f3e6c8]">{avg(row.avgWhite)}</ExtraTd>
              <ExtraTd className="pr-0 sm:pr-0">{row.games}</ExtraTd>
            </BoardRow>
          );
        })}
      </tbody>
    </BoardTable>
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
  const search = `case=${encodeURIComponent(caseId)}&difficulty=${encodeURIComponent(difficulty)}`;

  useEffect(() => {
    let cancelled = false;
    setBoard({ status: "loading" });
    fetch(`/api/detective/leaderboard?${search}`, { cache: "no-store" })
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
  }, [search, retry, viewerId]);

  const menu = <AccountMenu />;
  const header = <BoardHeader mode="detective" search={search} lede={LEDE} />;
  const loggedIn = account.status === "ready" && !!account.user;
  const me = board.status === "ready" ? board.me : null;
  const userId = account.status === "ready" ? (account.user?.id ?? null) : null;

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

  return (
    <BoardShell menu={menu}>
      {header}
      <BoardFilters>
        <FilterBlock label="案件">
          <BoardChip active={caseId === "all"} onClick={() => setCaseId("all")} ariaLabel="全部案件">
            全部
          </BoardChip>
          {DETECTIVE_CASES.map((c) => (
            <BoardChip key={c.id} active={caseId === c.id} onClick={() => setCaseId(c.id)} ariaLabel={c.title}>
              《{c.title}》
            </BoardChip>
          ))}
        </FilterBlock>
        <Segmented
          label="难度"
          value={difficulty}
          onChange={setDifficulty}
          maxWidth="max-w-lg"
          options={[
            { value: "all", label: "全部", aria: "全部难度" },
            ...DETECTIVE_DIFFICULTIES.map((d) => ({ value: d.id, label: d.label, aria: d.label })),
          ]}
        />
      </BoardFilters>

      <BoardTicket
        title={
          <>
            {caseTitle(caseId)}
            <span className="ml-2 text-sm font-sans tracking-normal text-[var(--ink-muted)]">· {difficultyLabel(difficulty)}</span>
          </>
        }
        aside={`前 ${DETECTIVE_TOP}`}
      >
        {board.status === "loading" ? (
          <BoardSkeleton />
        ) : board.status === "error" ? (
          <BoardError message={board.message} onRetry={() => setRetry((n) => n + 1)} />
        ) : !board.enabled ? (
          <p className="py-16 text-center text-sm text-[var(--ink-muted)]">这台服务器没有开放账号，暂无探案榜。</p>
        ) : board.ranked.length === 0 ? (
          <EmptyBoard
            hint="这张榜还空着"
            detail={`满 ${DETECTIVE_MIN_GAMES} 局的侦探才会出现在这里。抽一出戏，第一个挂上去。`}
            href="/?mode=detective"
            action="出发探案"
          />
        ) : (
          <StatsTable rows={board.ranked} highlightUserId={userId} />
        )}
      </BoardTicket>

      <MeDock>
        {!loggedIn ? (
          <MeGuest onLogin={() => setAuthOpen(true)} hint="登录后可看自己的胜率与名次" />
        ) : board.status !== "ready" ? (
          <MePending />
        ) : me?.rank ? (
          <MeRanked
            rank={me.rank}
            detail={
              <span className="ml-3 font-mono text-base text-[var(--ink-muted)] tabular">胜率 {pct(me.winRate)}</span>
            }
            extra={
              <p className="w-full font-mono text-xs text-[var(--ink-muted)] tabular">
                {me.games} 局 · 绿窗 {avg(me.avgGreen)} · 问数 {avg(me.avgQueries)} · 白窗 {avg(me.avgWhite)}
              </p>
            }
          />
        ) : me && !me.rank ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-[11px] tracking-[0.24em] text-[var(--amber)]">我的名次</p>
            <p className="font-display text-xl text-[var(--ink-muted)]">
              再打 {DETECTIVE_MIN_GAMES - me.games} 局即可上榜
            </p>
            <p className="w-full font-mono text-xs text-[var(--ink-muted)] tabular">
              {me.games} 局 · 胜率 {pct(me.winRate)} · 绿窗 {avg(me.avgGreen)} · 白窗 {avg(me.avgWhite)} · 问数{" "}
              {avg(me.avgQueries)}
            </p>
          </div>
        ) : (
          <MeAbsent hint="这组筛选下你还没有探案记录" href="/?mode=detective" action="去探案" />
        )}
      </MeDock>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </BoardShell>
  );
}
