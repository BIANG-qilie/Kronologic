"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Dices, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
import { AuthDialog } from "@/components/account/auth-dialog";
import { DETECTIVE_CASES, DETECTIVE_MIN_GAMES, DETECTIVE_NODE_MAX, DETECTIVE_NODE_MIN } from "@/lib/game/detective";
import { DetectiveDrawStage } from "./detective-draw";

/** Home-page body for detective mode: sign-in gate, then the draw. */
export function DetectivePanel() {
  const account = useAccount();
  const [authOpen, setAuthOpen] = useState(false);
  const [authKind, setAuthKind] = useState<"login" | "register">("login");
  const [drawing, setDrawing] = useState(false);
  const user = account.status === "ready" ? account.user : null;
  const disabled = account.status === "ready" && !account.enabled;

  const openAuth = (kind: "login" | "register") => {
    setAuthKind(kind);
    setAuthOpen(true);
  };

  const ticketsAsked = useRef<boolean | null>(null);
  useEffect(() => {
    if (ticketsAsked.current == null) {
      const url = new URL(window.location.href);
      ticketsAsked.current = url.searchParams.get("tickets") === "1";
      if (ticketsAsked.current) {
        url.searchParams.delete("tickets");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    }
    if (!ticketsAsked.current || account.status !== "ready") return;
    ticketsAsked.current = false;
    if (user) setDrawing(true);
    else if (account.enabled) openAuth("login");
  }, [account, user]);

  return (
    <div className="relative">
      <p className="text-[11px] tracking-[0.32em] text-[var(--amber)]">探案模式 · 随机开演</p>
      <h3 className="mt-2 font-display text-[1.7rem] leading-tight text-[var(--ink)]">今晚演哪一出，抽了才知道</h3>
      <p className="mt-2 text-sm leading-[1.8] text-[var(--ink-muted)]">
        你选难度，其余交给幕后。灯一灭，戏就开场。
      </p>

      <dl className="mt-4 grid grid-cols-3 border-y border-dashed border-ink-faint/80 py-2.5 text-center">
        {[
          ["剧目", `${DETECTIVE_CASES.length} 出`],
          ["地点", `${DETECTIVE_NODE_MIN}–${DETECTIVE_NODE_MAX}`],
          ["上榜", `≥${DETECTIVE_MIN_GAMES} 局`],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[10px] tracking-[0.3em] text-[var(--ink-muted)]">{k}</dt>
            <dd className="mt-0.5 font-display text-lg text-[var(--ink)] tabular">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5">
        {account.status === "loading" ? (
          <div className="h-12 animate-pulse-soft rounded-[3px] bg-ink-faint/40" role="status" aria-label="正在确认账号" />
        ) : disabled ? (
          <p className="text-sm text-[#e07a5f]">这台服务器没有开放账号，探案模式暂时不能玩。</p>
        ) : user ? (
          <>
            <Button size="lg" className="group w-full" onClick={() => setDrawing(true)}>
              <Dices className="h-4 w-4" />
              出发探案
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <p className="mt-2 text-center text-xs text-[var(--ink-muted)]">
              以「<span className="text-[var(--ink)]">{user.username}</span>」入场，抽完直接开房
            </p>
          </>
        ) : (
          <div className="rounded-[3px] border border-amber/30 bg-amber/[0.06] p-3.5">
            <p className="text-sm text-[var(--ink)]">探案模式要登录才能玩</p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)]">战绩会按账号累计，用于探案排行榜。</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button className="h-11" onClick={() => openAuth("login")}>
                登录
              </Button>
              <Button variant="secondary" className="h-11" onClick={() => openAuth("register")}>
                注册
              </Button>
            </div>
          </div>
        )}
      </div>

      <Link
        href="/leaderboard/detective"
        className="group mt-4 flex items-center gap-3 rounded-[3px] border border-dashed border-amber/35 px-3.5 py-2.5 transition-colors hover:border-amber/70 hover:bg-amber/[0.06]"
      >
        <Trophy className="h-4 w-4 shrink-0 text-[var(--amber)]" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-[var(--ink)]">探案排行榜</span>
          <span className="block text-[11px] text-[var(--ink-muted)]">按案件、难度看谁胜率最高、用的线索最少</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-[var(--amber)] transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>

      <AuthDialog key={authKind} open={authOpen} onOpenChange={setAuthOpen} initialKind={authKind} />
      {drawing && user && (
        <DetectiveDrawStage
          username={user.username}
          onClose={() => setDrawing(false)}
          onNeedLogin={() => {
            setDrawing(false);
            openAuth("login");
          }}
        />
      )}
    </div>
  );
}
