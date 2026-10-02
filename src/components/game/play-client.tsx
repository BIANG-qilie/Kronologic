"use client";

import { useEffect, useState } from "react";
import type { RoomPublicView } from "@/lib/game/types";
import {
  apiJson,
  clearSession,
  loadSession,
  saveSession,
  useRoomStream,
  type Session,
} from "@/hooks/use-room";
import { QueryPanel } from "@/components/game/query-panel";
import { SubmitDialog } from "@/components/game/submit-dialog";
import { DeskTimeline } from "@/components/game/desk-timeline";
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
          {busy
            ? "封存案件…"
            : view.players.length === 1
              ? "独自开查"
              : "开始调查"}
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
  const isSolo = view.players.length === 1;
  const isFail = view.phase === "all_eliminated";
  const [showAnswers, setShowAnswers] = useState(!(isSolo && isFail));

  useEffect(() => {
    if (!(isSolo && isFail)) return;
    const t = setTimeout(() => setShowAnswers(true), 1600);
    return () => clearTimeout(t);
  }, [isSolo, isFail]);

  useEffect(() => {
    if (view.phase !== "reveal") return;
    const tier = view.scenario.greedyMin;
    if (tier == null) return;
    try {
      const key = "lampxu-night-tea-cleared-tier";
      const prev = Number(localStorage.getItem(key) ?? "0");
      if (tier > prev) localStorage.setItem(key, String(tier));
    } catch {
      /* ignore */
    }
  }, [view.phase, view.scenario.greedyMin]);

  const ratingLabel =
    view.soloRating === "gold"
      ? "金放大镜"
      : view.soloRating === "silver"
        ? "银放大镜"
        : view.soloRating === "copper"
          ? "铜放大镜"
          : null;

  const title =
    view.phase === "reveal"
      ? "真相揭晓"
      : isSolo
        ? "答错淘汰"
        : "全员淘汰";

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-12 text-center">
      <h1 className="font-display text-4xl text-[var(--ink)]">{title}</h1>
      {isSolo && isFail && !showAnswers && (
        <p className="animate-fade-up text-[var(--ink-muted)]">
          答错。答案即将显示…
        </p>
      )}
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
          单人：{ratingLabel} · {view.players[0]?.queryCount ?? 0} 问
        </p>
      )}
      {showAnswers && view.revealAnswers && (
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
  const [bootstrapped, setBootstrapped] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const stored = loadSession();
    if (initialCode && initialToken) {
      const s = {
        code: initialCode.toUpperCase(),
        token: initialToken,
        playerId: "",
      };
      setSession(s);
      saveSession(s);
    } else if (
      stored &&
      (!initialCode ||
        stored.code.toUpperCase() === initialCode.toUpperCase())
    ) {
      setSession(stored);
    } else {
      setSession(null);
    }
    setBootstrapped(true);
  }, [initialCode, initialToken]);

  const { view, setView, connected } = useRoomStream(
    bootstrapped ? session?.code ?? null : null,
    bootstrapped ? session?.token ?? null : null
  );
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("desk");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (view?.you?.playerId && session) {
      const next = {
        code: view.code,
        token: session.token,
        playerId: view.you.playerId,
      };
      saveSession(next);
      setSession(next);
    }
  }, [view?.you?.playerId, view?.code, session?.token]);

  if (!bootstrapped) {
    return (
      <div className="px-4 py-20 text-center text-[var(--ink-muted)]">
        连接房间{initialCode ? ` ${initialCode.toUpperCase()}` : ""}…
      </div>
    );
  }

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
      <Lobby view={view} token={session.token} onRefresh={setView} />
    );
  }

  if (view.phase === "reveal" || view.phase === "all_eliminated") {
    return <EndScreen view={view} />;
  }

  const turnPlayer = view.players.find(
    (p) => p.id === view.currentTurnPlayerId
  );
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
      setTab("desk");
      requestAnimationFrame(() => {
        document
          .getElementById("reveal-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
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
                ? "animate-pulse-soft bg-[var(--amber)]/20 text-[var(--amber)]"
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
          你已淘汰。等待他人结束本场。
        </div>
      )}

      {err && <p className="text-sm text-destructive">{err}</p>}

      <Tabs value={tab} onValueChange={setTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-2 bg-[var(--stage)]">
          <TabsTrigger value="desk">桌面</TabsTrigger>
          <TabsTrigger value="ask">提问</TabsTrigger>
        </TabsList>

        <TabsContent value="desk" className="space-y-4 pt-4">
          <div id="reveal-panel" className="scroll-mt-4" />
          <div className="flex flex-wrap justify-center gap-2 text-xs text-[var(--ink-muted)]">
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
          <DeskTimeline
            view={view}
            onSaveNotes={async (text) => {
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

        <TabsContent value="ask" className="pt-4">
          <QueryPanel
            scenario={view.scenario}
            canAct={!!view.you?.canAct}
            askAgain={!!lastAskAgain && !!view.you?.canAct}
            busy={busy}
            onAsk={ask}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
