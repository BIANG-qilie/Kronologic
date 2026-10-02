"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import type { RoomPublicView } from "@/lib/game/types";
import { apiJson } from "@/hooks/use-room";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SEATS = 4;

export function RoomLobby({
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
  const [copied, setCopied] = useState(false);

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const data = await apiJson<{ view: RoomPublicView }>(`/api/rooms/${view.code}`, {
        method: "POST",
        body: JSON.stringify({ action: "start", token }),
      });
      onRefresh(data.view);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "开局失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(view.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the code stays visible to read out */
    }
  }

  const seats = Array.from({ length: SEATS }, (_, i) => view.players[i] ?? null);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-atmosphere" aria-hidden />
      <div className="relative mx-auto grid min-h-[100dvh] max-w-5xl content-center gap-12 px-5 pb-32 pt-12 sm:px-8 md:grid-cols-2 md:gap-16 md:py-14">
        <section>
          <p className="rise text-[11px] tracking-[0.42em] text-[var(--amber)]" style={{ ["--i" as string]: 0 }}>
            房间码
          </p>
          <button
            type="button"
            onClick={copy}
            className="rise group mt-4 flex items-center gap-4 text-left"
            style={{ ["--i" as string]: 1 }}
            aria-label={`复制房间码 ${view.code}`}
          >
            <span className="font-mono text-[clamp(2.75rem,9vw,4.5rem)] font-medium leading-none tracking-[0.18em] text-[var(--ink)]">
              {view.code}
            </span>
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                copied
                  ? "bg-[var(--green-win)] text-[var(--curtain)]"
                  : "text-[var(--ink-muted)] shadow-[inset_0_0_0_1px_var(--ink-faint)] group-hover:text-[var(--amber)] group-hover:shadow-[inset_0_0_0_1px_var(--amber)]"
              )}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </span>
          </button>
          <p className="rise mt-3 h-5 text-sm text-[var(--ink-muted)]" style={{ ["--i" as string]: 2 }} aria-live="polite">
            {copied ? "已复制，发给同伴就能入座" : "点一下复制，发给同伴，最多 4 人"}
          </p>

          <div className="rise mt-12 border-l border-[var(--amber)]/40 pl-5" style={{ ["--i" as string]: 3 }}>
            <p className="flex items-baseline gap-3 text-[11px] tracking-[0.32em] text-[var(--amber)]">
              {view.scenario.tier && (
                <span className="font-display text-base tracking-[0.12em]">{view.scenario.tier}</span>
              )}
              {view.scenario.greedyMin != null && (
                <span className="tracking-[0.2em] text-[var(--ink-muted)]">最少 {view.scenario.greedyMin} 问</span>
              )}
            </p>
            <h1 className="mt-2 font-display text-4xl text-[var(--ink)] sm:text-5xl">{view.scenario.title}</h1>
            <p className="mt-4 max-w-sm text-sm leading-[1.9] text-[var(--ink-muted)]">{view.scenario.synopsis}</p>
          </div>
        </section>

        <section className="md:pt-8">
          <p className="rise mb-4 flex items-baseline justify-between text-[11px] tracking-[0.32em] text-[var(--ink-muted)]" style={{ ["--i" as string]: 2 }}>
            <span>在座</span>
            <span className="font-mono tracking-normal tabular">
              {view.players.length} / {SEATS}
            </span>
          </p>
          <ul className="grid grid-cols-2 gap-3">
            {seats.map((p, i) => (
              <li
                key={p?.id ?? `empty-${i}`}
                className={cn(
                  "rise relative flex aspect-[4/3] flex-col justify-between rounded-[3px] p-4 transition-colors",
                  p
                    ? "bg-[var(--stage)] shadow-[inset_0_0_0_1px_var(--ink-faint)]"
                    : "border border-dashed border-[var(--ink-faint)]/80"
                )}
                style={{ ["--i" as string]: 3 + i }}
              >
                <span className="font-display text-sm italic text-[var(--ink-faint)]">0{i + 1}</span>
                {p ? (
                  <div>
                    <p className="truncate font-display text-xl text-[var(--ink)]">{p.nickname}</p>
                    <p className="mt-1 flex items-center gap-2 text-[11px] text-[var(--ink-muted)]">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          p.connected
                            ? "bg-[var(--green-win)] shadow-[0_0_6px_rgba(111,191,138,0.9)]"
                            : "bg-[var(--ink-faint)]"
                        )}
                      />
                      {[p.isHost && "房主", p.id === view.you?.playerId && "你", !p.connected && "离线"]
                        .filter(Boolean)
                        .join(" · ") || "已入座"}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--ink-muted)]/60">空座</p>
                )}
              </li>
            ))}
          </ul>

          <div
            className="rise fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[var(--curtain)] via-[var(--curtain)]/95 to-transparent px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 md:static md:mt-8 md:bg-none md:p-0"
            style={{ ["--i" as string]: 7 }}
          >
            {err && (
              <p role="alert" className="mb-3 text-sm text-[#e07a5f]">
                {err}
              </p>
            )}
            {you?.isHost ? (
              <Button className="group w-full" size="lg" disabled={busy} onClick={start}>
                {busy ? "封存案件中…" : view.players.length === 1 ? "开始调查 · 单人" : `开始调查 · ${view.players.length} 人`}
                {!busy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
              </Button>
            ) : (
              <p className="flex items-center justify-center gap-2 py-3 text-sm text-[var(--ink-muted)]">
                <span className="animate-pulse-soft h-1.5 w-1.5 rounded-full bg-[var(--amber)]" />
                等房主开局…
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
