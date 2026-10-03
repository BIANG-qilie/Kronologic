"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lamp } from "lucide-react";
import type { RoomPublicView } from "@/lib/game/types";
import {
  apiJson,
  loadSession,
  saveSession,
  useRoomStream,
  type Session,
} from "@/hooks/use-room";
import { QueryPanel } from "@/components/game/query-panel";
import { RoomLobby } from "@/components/game/room-lobby";
import { EndScreen } from "@/components/game/end-screen";
import { CaseLog } from "@/components/game/case-log";
import { SubmitDialog } from "@/components/game/submit-dialog";
import { DeskTimeline } from "@/components/game/desk-timeline";
import { RulesSheet } from "@/components/game/rules-sheet";
import type { SuspectBoard } from "@/lib/game/notes-format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PersonId, PlaceId, TimeId } from "@/lib/game/types";
import { cn } from "@/lib/utils";

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function StatusScreen({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center px-5">
      <div
        className="pointer-events-none absolute inset-0 bg-atmosphere"
        aria-hidden
      />
      <div className="relative text-center">{children}</div>
    </main>
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
      (!initialCode || stored.code.toUpperCase() === initialCode.toUpperCase())
    ) {
      setSession(stored);
    } else {
      setSession(null);
    }
    setBootstrapped(true);
  }, [initialCode, initialToken]);

  const { view, setView, connected } = useRoomStream(
    bootstrapped ? (session?.code ?? null) : null,
    bootstrapped ? (session?.token ?? null) : null,
  );
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("desk");
  const [err, setErr] = useState<string | null>(null);
  const [board, setBoard] = useState<SuspectBoard | null>(null);

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

  const now = useNow(view?.phase === "submit_window");

  if (!bootstrapped || (session && !view)) {
    const code = session?.code ?? initialCode?.toUpperCase();
    return (
      <StatusScreen>
        <Lamp
          className="animate-pulse-soft mx-auto h-6 w-6 text-[var(--amber)]"
          aria-hidden
        />
        <p className="mt-4 text-sm tracking-[0.2em] text-[var(--ink-muted)]">
          正在点灯{code ? ` · ${code}` : ""}
        </p>
      </StatusScreen>
    );
  }

  if (!session || !view) {
    return (
      <StatusScreen>
        <p className="font-display text-3xl text-[var(--ink)]">
          这间房不认得你
        </p>
        <p className="mt-3 text-sm text-[var(--ink-muted)]">
          房间可能已散场，或是在另一台设备上入座的。
        </p>
        <Button className="mt-8" onClick={() => (window.location.href = "/")}>
          回大厅
        </Button>
      </StatusScreen>
    );
  }

  if (view.phase === "lobby") {
    return <RoomLobby view={view} token={session.token} onRefresh={setView} />;
  }

  if (view.phase === "reveal" || view.phase === "all_eliminated") {
    return <EndScreen view={view} />;
  }

  const turnPlayer = view.players.find(
    (p) => p.id === view.currentTurnPlayerId,
  );
  const lastAskAgain = view.queryLog[view.queryLog.length - 1]?.askAgain;

  async function ask(input: {
    kind: "place_time" | "place_person";
    placeId: PlaceId;
    timeId?: TimeId;
    personId?: PersonId;
  }) {
    setBusy(true);
    setErr(null);
    try {
      const data = await apiJson<{ view: RoomPublicView }>(
        `/api/rooms/${view!.code}/query`,
        {
          method: "POST",
          body: JSON.stringify({ token: session!.token, ...input }),
        },
      );
      setView(data.view);
      setTab("desk");
      requestAnimationFrame(() => {
        document
          .getElementById("reveal-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "提问失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  const inWindow = view.phase === "submit_window";
  const secondsLeft =
    inWindow && view.submitWindowEndsAt
      ? Math.max(0, Math.ceil((view.submitWindowEndsAt - now) / 1000))
      : null;
  const yourTurn = !!view.you?.canAct;

  return (
    <div className="relative min-h-screen">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] bg-atmosphere"
        aria-hidden
      />
      <header className="sticky top-0 z-30 border-b border-ink-faint/60 bg-curtain/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
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
            <p className="truncate font-display text-sm text-[var(--ink)] sm:text-base">
              {view.scenario.title}
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  connected
                    ? "bg-[var(--green-win)]"
                    : "animate-pulse-soft bg-[var(--amber)]",
                )}
                title={connected ? "已同步" : "重连中"}
              />
              {view.scenario.tier ? `${view.scenario.tier} · ` : ""}
              <span className="font-mono tracking-[0.12em]">{view.code}</span> · 已问{" "}
              <span className="tabular">{view.queryCountTotal}</span>
            </p>
          </div>
          <span
            className={cn(
              "hidden rounded-full px-3 py-1 text-xs sm:inline-flex sm:items-center sm:gap-2",
              inWindow
                ? "bg-amber/15 text-[var(--amber)]"
                : yourTurn
                  ? "bg-green-win/12 text-[var(--green-win)]"
                  : "text-[var(--ink-muted)]",
            )}
            aria-live="polite"
          >
            {inWindow ? (
              <>
                同时交卷{" "}
                <span className="font-mono tabular">{secondsLeft ?? "—"}s</span>
              </>
            ) : yourTurn ? (
              "轮到你提问"
            ) : (
              `${turnPlayer?.nickname ?? "—"} 在提问`
            )}
          </span>
          <RulesSheet className="-mx-1 tracking-normal" />
          <SubmitDialog
            view={view}
            board={board}
            onSubmit={async (answers) => {
              const data = await apiJson<{ view: RoomPublicView }>(
                `/api/rooms/${view.code}/submit`,
                {
                  method: "POST",
                  body: JSON.stringify({ token: session.token, answers }),
                },
              );
              setView(data.view);
            }}
          />
        </div>
        {inWindow && view.submitWindowEndsAt && (
          <div className="h-px w-full bg-ink-faint/40">
            <div
              className="h-full bg-[var(--amber)] transition-[width] duration-200 ease-linear"
              style={{
                width: `${Math.min(100, ((secondsLeft ?? 0) / 12) * 100)}%`,
              }}
            />
          </div>
        )}
      </header>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-4 px-3 pb-16 pt-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ul className="flex flex-wrap gap-1.5" aria-label="在座">
            {view.players.map((p) => {
              const turn = p.id === view.currentTurnPlayerId && !inWindow;
              return (
                <li
                  key={p.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
                    turn
                      ? "bg-amber/15 text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--amber-dim)]"
                      : "text-[var(--ink-muted)] shadow-[inset_0_0_0_1px_var(--ink-faint)]",
                    p.eliminated && "opacity-40 line-through",
                  )}
                >
                  {turn && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--amber)]" />
                  )}
                  {p.nickname}
                  {p.id === view.you?.playerId && (
                    <span className="text-[var(--ink-muted)]">· 你</span>
                  )}
                  <span className="font-mono text-[10px] text-ink-muted/70 tabular">
                    {p.queryCount}
                  </span>
                </li>
              );
            })}
          </ul>
          <span
            className="text-xs text-[var(--ink-muted)] sm:hidden"
            aria-live="polite"
          >
            {inWindow
              ? `同时交卷 ${secondsLeft ?? "—"}s`
              : yourTurn
                ? "轮到你提问"
                : `${turnPlayer?.nickname ?? "—"} 在提问`}
          </span>
        </div>

        {view.you?.eliminated && (
          <div className="rounded-[3px] bg-[#e07a5f]/10 px-4 py-3 text-sm text-[#e07a5f] shadow-[inset_0_0_0_1px_rgba(224,122,95,0.35)]">
            你已出局。可以继续看桌面，等这一局结束。
          </div>
        )}

        {err && (
          <p role="alert" className="animate-fade-up text-sm text-[#e07a5f]">
            {err}
          </p>
        )}

        <Tabs value={tab} onValueChange={setTab} className="flex-1">
          <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b border-ink-faint/60 bg-transparent p-0">
            {[
              ["desk", "桌面", null],
              ["ask", "提问", yourTurn ? "轮到你" : null],
            ].map(([value, label, badge]) => (
              <TabsTrigger
                key={value}
                value={value!}
                className="relative -mb-px min-h-11 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2 pt-1 font-display text-lg text-[var(--ink-muted)] shadow-none transition-colors hover:text-[var(--ink)] data-[state=active]:border-[var(--amber)] data-[state=active]:bg-transparent data-[state=active]:text-[var(--ink)] data-[state=active]:shadow-none"
              >
                {label}
                {badge && (
                  <span className="ml-2 rounded-full bg-green-win/15 px-2 py-0.5 font-sans text-[10px] text-[var(--green-win)]">
                    {badge}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent
            value="desk"
            className="grid gap-10 pt-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10"
          >
            <div className="min-w-0">
              <div id="reveal-panel" className="scroll-mt-24" />
              <DeskTimeline
                view={view}
                onBoardChange={setBoard}
                onSaveNotes={async (text) => {
                  const data = await apiJson<{ view: RoomPublicView }>(
                    `/api/rooms/${view.code}/notes`,
                    {
                      method: "POST",
                      body: JSON.stringify({ token: session.token, text }),
                    },
                  );
                  setView(data.view);
                }}
              />
            </div>
            <div className="lg:sticky lg:top-24 lg:self-start">
              <CaseLog view={view} />
            </div>
          </TabsContent>

          <TabsContent value="ask" className="pt-5 sm:pt-6">
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
    </div>
  );
}
