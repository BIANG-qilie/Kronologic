"use client";

import { useEffect, useMemo, useState } from "react";
import type { RoomPublicView } from "@/lib/game/types";
import {
  apiJson,
  clearSession,
  loadSession,
  saveSession,
  useRoomStream,
} from "@/hooks/use-room";
import { QueryPanel } from "@/components/game/query-panel";
import { NotesPanel } from "@/components/game/notes-panel";
import { SubmitDialog } from "@/components/game/submit-dialog";
import { BoardMap } from "@/components/game/board-map";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

function placeName(view: RoomPublicView, id: string) {
  return view.scenario.places.find((p) => p.id === id)?.name ?? id;
}
function personName(view: RoomPublicView, id: string) {
  const p = view.scenario.people.find((x) => x.id === id);
  return p ? `${p.letter}·${p.name}` : id;
}

function QueryLog({ view }: { view: RoomPublicView }) {
  const latest = view.queryLog[view.queryLog.length - 1];
  return (
    <div className="space-y-3">
      {latest && (
        <div
          key={latest.id}
          className="animate-reveal-green rounded-sm border border-[var(--green-win)]/40 bg-[var(--green-win)]/10 px-4 py-3"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--green-win)]">
            绿窗 · 全桌共享
          </p>
          <p className="mt-1 font-display text-xl text-[var(--ink)]">
            {latest.kind === "place_time"
              ? `${placeName(view, latest.placeId)} × 时间 ${latest.timeId}`
              : `${placeName(view, latest.placeId)} × ${personName(view, latest.personId!)}`}
            <span className="ml-3 font-mono text-[var(--green-win)]">
              {latest.sharedLabel}
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {latest.askerNickname} 提问
            {latest.askAgain ? " · 再问一次" : ""}
          </p>
        </div>
      )}
      <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-[var(--ink-muted)]">
        {[...view.queryLog].reverse().map((q) => (
          <li key={q.id} className="flex justify-between gap-2 border-b border-[var(--ink-faint)]/40 py-1">
            <span>
              {q.askerNickname} ·{" "}
              {q.kind === "place_time"
                ? `${placeName(view, q.placeId)}×T${q.timeId}`
                : `${placeName(view, q.placeId)}×${q.personId}`}
            </span>
            <span className="font-mono text-[var(--ink)]">{q.sharedLabel}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrivateClues({ view }: { view: RoomPublicView }) {
  const clues = view.you?.privateClues ?? [];
  const latest = clues[clues.length - 1];
  return (
    <div className="space-y-2">
      {latest && (
        <div className="animate-reveal-white rounded-sm border border-[var(--ink-faint)] bg-[var(--parchment)] px-4 py-3 text-[var(--ink-deep)]">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            白窗 · 仅你可见
          </p>
          <p className="mt-1 font-display text-xl">
            {latest.privateLabel}
          </p>
        </div>
      )}
      {clues.length === 0 && (
        <p className="text-sm text-[var(--ink-muted)]">尚无私密线索</p>
      )}
      <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-[var(--ink-muted)]">
        {[...clues].reverse().map((c) => (
          <li key={c.queryId} className="font-mono">
            {c.kind === "place_time"
              ? `${c.placeId}×T${c.timeId}`
              : `${c.placeId}×${c.personId}`}{" "}
            → {c.privateLabel}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Lobby({
  view,
  token,
  onRefresh,
}: {
  view: RoomPublicView;
  token: string;
  onRefresh: (v: RoomPublicView) => void;
}) {
  const you = view.players.find((p) => p.id === view.you?.playerId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const data = await apiJson<{ view: RoomPublicView }>(
        `/api/rooms/${view.code}`,
        {
          method: "POST",
          body: JSON.stringify({ action: "start", token }),
        }
      );
      onRefresh(data.view);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "开局失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
      <header className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--amber)]">
          房间 {view.code}
        </p>
        <h1 className="font-display text-4xl text-[var(--ink)]">
          {view.scenario.title}
        </h1>
        <p className="text-[var(--ink-muted)]">{view.scenario.subtitle}</p>
      </header>
      <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
        {view.scenario.synopsis}
      </p>
      <div className="rounded-sm border border-[var(--ink-faint)] bg-[var(--stage)]/60 p-4">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          在座 {view.players.length}/4
        </p>
        <ul className="space-y-2">
          {view.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between text-sm"
            >
              <span>
                {p.nickname}
                {p.isHost ? " · 房主" : ""}
                {p.id === view.you?.playerId ? " · 你" : ""}
              </span>
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  p.connected ? "bg-[var(--green-win)]" : "bg-[var(--ink-faint)]"
                )}
              />
            </li>
          ))}
        </ul>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {you?.isHost ? (
        <Button className="w-full" disabled={busy} onClick={start}>
          {busy ? "封存案件…" : view.players.length === 1 ? "独自开查" : "开始调查"}
        </Button>
      ) : (
        <p className="text-center text-sm text-[var(--ink-muted)]">
          等待房主开局…
        </p>
      )}
    </div>
  );
}

function EndScreen({ view }: { view: RoomPublicView }) {
  const ratingLabel =
    view.soloRating === "gold"
      ? "金放大镜"
      : view.soloRating === "silver"
        ? "银放大镜"
        : view.soloRating === "copper"
          ? "铜放大镜"
          : null;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-12 text-center">
      <h1 className="font-display text-4xl text-[var(--ink)]">
        {view.phase === "reveal" ? "真相揭晓" : "全员淘汰"}
      </h1>
      {view.phase === "reveal" && (
        <p className="text-[var(--ink-muted)]">
          胜者：
          {view.players
            .filter((p) => view.winners.includes(p.id))
            .map((p) => p.nickname)
            .join("、")}
        </p>
      )}
      {ratingLabel && (
        <p className="text-[var(--amber)]">
          单人评级：{ratingLabel}（{view.players[0]?.queryCount ?? 0} 问）
        </p>
      )}
      {view.revealAnswers && (
        <div className="animate-fade-up rounded-sm border border-[var(--amber)]/40 bg-[var(--stage)] p-4 text-left">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--amber)]">
            答案摘要
          </p>
          <ul className="space-y-2 text-sm">
            {view.scenario.winQuestions.map((q) => (
              <li key={q.id}>
                <span className="text-[var(--ink-muted)]">{q.prompt}</span>
                <br />
                <span className="font-mono text-[var(--ink)]">
                  {q.kind === "person"
                    ? personName(view, view.revealAnswers![q.id])
                    : q.kind === "place"
                      ? placeName(view, view.revealAnswers![q.id])
                      : `时间 ${view.revealAnswers![q.id]}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button
        variant="secondary"
        onClick={() => {
          clearSession();
          window.location.href = "/";
        }}
      >
        返回大厅
      </Button>
    </div>
  );
}

export function PlayClient({
  initialCode,
  initialToken,
}: {
  initialCode?: string;
  initialToken?: string;
}) {
  const session = useMemo(() => {
    const stored = loadSession();
    if (initialCode && initialToken) {
      return {
        code: initialCode.toUpperCase(),
        token: initialToken,
        playerId: "",
      };
    }
    if (
      stored &&
      (!initialCode ||
        stored.code.toUpperCase() === initialCode.toUpperCase())
    ) {
      return stored;
    }
    return null;
  }, [initialCode, initialToken]);

  const { view, setView, connected } = useRoomStream(
    session?.code ?? null,
    session?.token ?? null
  );
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("desk");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    // ensure session persisted when coming from URL
    if (initialCode && initialToken) {
      saveSession({
        code: initialCode,
        token: initialToken,
        playerId: view?.you?.playerId ?? "",
      });
    }
  }, [session, initialCode, initialToken, view?.you?.playerId]);

  useEffect(() => {
    if (view?.you?.playerId && session) {
      saveSession({
        code: view.code,
        token: session.token,
        playerId: view.you.playerId,
      });
    }
  }, [view?.you?.playerId, view?.code, session]);

  if (!session) {
    return (
      <div className="px-4 py-20 text-center">
        <p className="text-[var(--ink-muted)]">没有有效会话。</p>
        <Button className="mt-4" onClick={() => (window.location.href = "/")}>
          回大厅
        </Button>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="px-4 py-20 text-center text-[var(--ink-muted)]">
        连接房间 {session.code}…
      </div>
    );
  }

  if (view.phase === "lobby") {
    return (
      <Lobby
        view={view}
        token={session.token}
        onRefresh={setView}
      />
    );
  }

  if (view.phase === "reveal" || view.phase === "all_eliminated") {
    return <EndScreen view={view} />;
  }

  const turnPlayer = view.players.find((p) => p.id === view.currentTurnPlayerId);
  const lastAskAgain = view.queryLog[view.queryLog.length - 1]?.askAgain;

  async function ask(input: {
    kind: "place_time" | "place_person";
    placeId: import("@/lib/game/types").PlaceId;
    timeId?: import("@/lib/game/types").TimeId;
    personId?: import("@/lib/game/types").PersonId;
  }) {
    setBusy(true);
    setErr(null);
    try {
      const data = await apiJson<{ view: RoomPublicView }>(
        `/api/rooms/${view!.code}/query`,
        {
          method: "POST",
          body: JSON.stringify({ token: session!.token, ...input }),
        }
      );
      setView(data.view);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "提问失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-3 py-4 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--ink-faint)] pb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--amber)]">
            灯序 · {view.code}
            <span className="ml-2 text-[var(--ink-muted)]">
              {connected ? "已同步" : "重连中"}
            </span>
          </p>
          <h1 className="font-display text-2xl text-[var(--ink)] md:text-3xl">
            {view.scenario.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={cn(
              "rounded-sm px-2 py-1",
              view.phase === "submit_window"
                ? "bg-[var(--amber)]/20 text-[var(--amber)] animate-pulse-soft"
                : "text-[var(--ink-muted)]"
            )}
          >
            {view.phase === "submit_window"
              ? "同时交卷窗"
              : `回合 · ${turnPlayer?.nickname ?? "—"}`}
          </span>
          <span className="text-[var(--ink-muted)]">
            提问 {view.queryCountTotal}
          </span>
          <SubmitDialog
            view={view}
            onSubmit={async (answers) => {
              const data = await apiJson<{ view: RoomPublicView }>(
                `/api/rooms/${view.code}/submit`,
                {
                  method: "POST",
                  body: JSON.stringify({ token: session.token, answers }),
                }
              );
              setView(data.view);
            }}
          />
        </div>
      </header>

      {view.you?.eliminated && (
        <div className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          你已淘汰——不能再提问或交卷。答案不会广播，请等待他人结束。
        </div>
      )}

      {err && <p className="text-sm text-destructive">{err}</p>}

      <Tabs value={tab} onValueChange={setTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-3 bg-[var(--stage)]">
          <TabsTrigger value="desk">桌面</TabsTrigger>
          <TabsTrigger value="ask">提问</TabsTrigger>
          <TabsTrigger value="notes">笔记</TabsTrigger>
        </TabsList>

        <TabsContent value="desk" className="space-y-4 pt-4">
          <BoardMap scenario={view.scenario} />
          <div className="grid gap-4 md:grid-cols-2">
            <QueryLog view={view} />
            <PrivateClues view={view} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--ink-muted)]">
            {view.players.map((p) => (
              <span
                key={p.id}
                className={cn(
                  "rounded-sm border border-[var(--ink-faint)] px-2 py-1",
                  p.eliminated && "opacity-40 line-through",
                  p.id === view.currentTurnPlayerId &&
                    "border-[var(--amber)] text-[var(--ink)]"
                )}
              >
                {p.nickname}
                {p.id === view.you?.playerId ? "（你）" : ""}
              </span>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ask" className="pt-4">
          <QueryPanel
            scenario={view.scenario}
            canAct={!!view.you?.canAct}
            askAgain={!!lastAskAgain && !!view.you?.canAct}
            busy={busy}
            onAsk={ask}
          />
        </TabsContent>

        <TabsContent value="notes" className="pt-4">
          <NotesPanel
            view={view}
            onSave={async (text) => {
              const data = await apiJson<{ view: RoomPublicView }>(
                `/api/rooms/${view.code}/notes`,
                {
                  method: "POST",
                  body: JSON.stringify({ token: session.token, text }),
                }
              );
              setView(data.view);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
