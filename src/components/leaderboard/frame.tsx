"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Lamp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BoardMode = "level" | "detective";

const SEARCH_KEY: Record<BoardMode, string> = {
  level: "lx-lb-level",
  detective: "lx-lb-detective",
};

export function boardPath(mode: BoardMode): string {
  return mode === "level" ? "/leaderboard" : "/leaderboard/detective";
}

function rememberSearch(mode: BoardMode, search: string) {
  try {
    sessionStorage.setItem(SEARCH_KEY[mode], search);
  } catch {
    /* private mode */
  }
}

function recallSearch(mode: BoardMode): string {
  try {
    return sessionStorage.getItem(SEARCH_KEY[mode]) ?? "";
  } catch {
    return "";
  }
}

function hrefFor(mode: BoardMode, search: string): string {
  const path = boardPath(mode);
  return search ? `${path}?${search}` : path;
}

/** Each board keeps its own query. The other side is restored from the last visit. */
export function useBoardHrefs(mode: BoardMode, search: string) {
  const peer: BoardMode = mode === "level" ? "detective" : "level";
  const [peerHref, setPeerHref] = useState(boardPath(peer));

  useLayoutEffect(() => {
    rememberSearch(mode, search);
    const next = `${boardPath(mode)}?${search}`;
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(null, "", next);
    }
    setPeerHref(hrefFor(peer, recallSearch(peer)));
  }, [mode, peer, search]);

  return {
    levelHref: mode === "level" ? hrefFor("level", search) : peerHref,
    detectiveHref: mode === "detective" ? hrefFor("detective", search) : peerHref,
  };
}

export function BoardShell({ menu, children }: { menu?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-atmosphere" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-[-28vh] h-[70vh] w-[110vw] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(212,161,90,0.12),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-screen w-full min-w-0 max-w-5xl flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
        <nav className="flex items-center justify-between py-3.5 text-[11px] tracking-[0.32em] text-[var(--ink-muted)]">
          <Link
            href="/"
            className="-ml-2 flex min-h-11 items-center px-2 font-display text-base tracking-[0.2em] text-[var(--ink)] transition-colors hover:text-[var(--amber)]"
            aria-label="灯序 · 回大厅"
          >
            灯<span className="text-[var(--amber)]">序</span>
          </Link>
          {menu}
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

function ModeLink({
  href,
  active,
  bordered,
  children,
}: {
  href: string;
  active: boolean;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 min-w-0 items-center justify-center px-2 text-sm tracking-wide transition-colors duration-200",
        bordered && "border-l border-ink-faint/70",
        active
          ? "bg-[var(--amber)] text-[var(--curtain)]"
          : "bg-stage/60 text-[var(--ink-muted)] hover:text-[var(--ink)]"
      )}
    >
      {children}
    </Link>
  );
}

export function BoardHeader({
  mode,
  search,
  lede,
}: {
  mode: BoardMode;
  search: string;
  lede: React.ReactNode;
}) {
  const { levelHref, detectiveHref } = useBoardHrefs(mode, search);
  return (
    <header className="pt-2 md:pt-6">
        <nav aria-label="榜单" className="rise" style={{ ["--i" as string]: 0 }}>
          <div className="grid w-full max-w-sm grid-cols-2 overflow-hidden rounded-[3px] shadow-[inset_0_0_0_1px_var(--ink-faint)]">
            <ModeLink href={levelHref} active={mode === "level"}>
              关卡榜
            </ModeLink>
            <ModeLink href={detectiveHref} active={mode === "detective"} bordered>
              探案榜
            </ModeLink>
          </div>
        </nav>
        <div className="rise mt-6 flex items-center gap-3" style={{ ["--i" as string]: 1 }}>
          <p className="text-[11px] tracking-[0.42em] text-[var(--amber)]">星河榜</p>
          <LampRow />
        </div>
        <h1
          className="rise mt-3 font-display text-[clamp(2.75rem,10vw,4.75rem)] font-black leading-[0.92] text-[var(--ink)]"
          style={{ ["--i" as string]: 2 }}
        >
          排行榜
        </h1>
        <p
          className="rise mt-3 max-w-lg text-sm leading-[1.75] text-[var(--ink-muted)]"
          style={{ ["--i" as string]: 3 }}
        >
          {lede}
        </p>
      </header>
  );
}

export function BoardChip({
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

export function FilterBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2.5 text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">{label}</p>
      <div
        className="scroll-fade-x-start -mx-1 flex min-w-0 gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  maxWidth = "max-w-md",
}: {
  label: string;
  value: T;
  options: { value: T; label: string; aria: string }[];
  onChange: (value: T) => void;
  maxWidth?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2.5 text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">{label}</p>
      <div
        className={cn(
          "grid w-full overflow-hidden rounded-[3px] shadow-[inset_0_0_0_1px_var(--ink-faint)]",
          maxWidth
        )}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        role="tablist"
        aria-label={label}
      >
        {options.map((opt, i) => {
          const active = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              aria-pressed={active}
              aria-label={opt.aria}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex h-11 min-w-0 items-center justify-center px-1 text-sm tracking-wide transition-colors duration-200",
                i > 0 && "border-l border-ink-faint/70",
                active
                  ? "bg-[var(--amber)] text-[var(--curtain)]"
                  : "bg-stage/60 text-[var(--ink-muted)] hover:text-[var(--ink)]"
              )}
            >
              <span className="truncate">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BoardFilters({ children }: { children: React.ReactNode }) {
  return (
    <div className="rise mt-8 space-y-5" style={{ ["--i" as string]: 4 }}>
      {children}
    </div>
  );
}

export function BoardTicket({
  title,
  aside,
  children,
}: {
  title: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rise ticket-edge parchment-wash relative mt-8 min-w-0 flex-1 px-4 py-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:px-6" style={{ ["--i" as string]: 5 }}>
      <div className="pointer-events-none absolute inset-y-3 left-0 right-0 border-y border-dashed border-ink-faint/65" aria-hidden />
      <div className="relative mb-4 flex items-baseline justify-between gap-3">
        <h2 className="min-w-0 font-display text-xl text-[var(--ink)]">{title}</h2>
        {aside ? <p className="shrink-0 text-[11px] tracking-[0.16em] text-[var(--ink-muted)]">{aside}</p> : null}
      </div>
      <div className="relative min-h-[14rem] min-w-0">{children}</div>
    </section>
  );
}

export function BoardTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 overflow-x-auto overscroll-x-contain">
      <table className="w-full table-fixed border-collapse text-left">{children}</table>
    </div>
  );
}

export function BoardHead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">{children}</tr>
    </thead>
  );
}

export function BoardRow({ mine, children }: { mine: boolean; children: React.ReactNode }) {
  return (
    <tr
      className={cn(
        "border-t border-ink-faint/40 transition-colors duration-200",
        mine ? "bg-amber/[0.12]" : "hover:bg-white/[0.025]"
      )}
    >
      {children}
    </tr>
  );
}

export function RankCell({ rank }: { rank: number }) {
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
            "h-1.5 w-1.5 shrink-0 rounded-full",
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
  return (
    <span className="inline-block min-w-[1.75rem] pl-[1.125rem] font-display text-xl tabular text-[var(--ink-muted)]">
      {rank}
    </span>
  );
}

export function RankTd({ rank, mine }: { rank: number; mine: boolean }) {
  return (
    <td className="relative w-14 py-3.5 pr-2">
      {mine && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--amber)]" aria-hidden />}
      <RankCell rank={rank} />
    </td>
  );
}

export function NameTd({
  name,
  mine,
  meta,
}: {
  name: string;
  mine: boolean;
  meta?: React.ReactNode;
}) {
  return (
    <td className="overflow-hidden py-3.5 pr-3 text-[var(--ink)]">
      <span className={cn("block truncate", mine && "font-medium")}>{name}</span>
      {mine && <span className="text-[10px] tracking-[0.18em] text-[var(--amber)]">你</span>}
      {meta ? (
        <div className="mt-0.5 font-mono text-[11px] leading-snug text-[var(--ink-muted)] tabular sm:hidden">{meta}</div>
      ) : null}
    </td>
  );
}

export function MetricTd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("w-[4.75rem] py-3.5 pr-0 text-right font-mono tabular text-[var(--amber)] sm:pr-3", className)}>
      {children}
    </td>
  );
}

export function ExtraTd({
  children,
  className,
  align = "right",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <td
      className={cn(
        "hidden py-3.5 text-xs tabular text-[var(--ink-muted)] sm:table-cell",
        align === "right" ? "pr-3 text-right font-mono" : "text-left",
        className
      )}
    >
      {children}
    </td>
  );
}

export function EmptyBoard({
  hint,
  detail,
  href,
  action,
}: {
  hint: string;
  detail: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <LampRow className="opacity-80" />
      <p className="mt-5 font-display text-xl text-[var(--ink)]">{hint}</p>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--ink-muted)]">{detail}</p>
      <Button asChild className="group mt-7" size="lg">
        <Link href={href}>
          {action}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </Button>
    </div>
  );
}

export function BoardSkeleton() {
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

export function BoardLoading() {
  return (
    <div className="grid place-items-center py-32" role="status">
      <Lamp className="animate-pulse-soft h-6 w-6 text-[var(--amber)]" aria-hidden />
      <p className="mt-4 text-sm tracking-[0.2em] text-[var(--ink-muted)]">正在翻榜单</p>
    </div>
  );
}

export function BoardClosed() {
  return (
    <section className="mx-auto max-w-md py-24 text-center">
      <Trophy className="mx-auto h-8 w-8 text-[var(--ink-muted)]" aria-hidden />
      <p className="mt-4 font-display text-3xl text-[var(--ink)]">排行榜未开放</p>
      <p className="mt-3 text-sm text-[var(--ink-muted)]">这台服务器没有接数据库，榜单不会保存。游客照样可以开局。</p>
      <Button asChild className="mt-8 h-11">
        <Link href="/">回大厅</Link>
      </Button>
    </section>
  );
}

export function BoardError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <p role="alert" className="text-sm text-[var(--ink-muted)]">
        {message}
      </p>
      {onRetry ? (
        <Button variant="secondary" className="mt-4 h-11" onClick={onRetry}>
          再试一次
        </Button>
      ) : null}
    </div>
  );
}

export function MeDock({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-5 mt-8 bg-gradient-to-t from-[var(--curtain)] via-[var(--curtain)]/95 to-transparent px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6 sm:-mx-8 sm:px-8">
      <div className="ticket-edge parchment-wash relative px-4 py-3.5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)]">
        <div className="pointer-events-none absolute inset-y-2 left-0 right-0 border-y border-dashed border-ink-faint/55" aria-hidden />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

export function MePending() {
  return (
    <div>
      <p className="text-[11px] tracking-[0.24em] text-[var(--amber)]">我的名次</p>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">正在对你的名次</p>
    </div>
  );
}

export function MeGuest({ onLogin, hint }: { onLogin: () => void; hint: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[11px] tracking-[0.24em] text-[var(--amber)]">我的名次</p>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">{hint}</p>
      </div>
      <Button size="sm" className="h-11 min-w-[6rem]" onClick={onLogin}>
        去登录
      </Button>
    </div>
  );
}

export function MeRanked({
  rank,
  detail,
  extra,
}: {
  rank: number;
  detail?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p className="text-[11px] tracking-[0.24em] text-[var(--amber)]">我的名次</p>
      <p className="font-display text-2xl text-[var(--ink)]">
        第 <span className="text-[var(--amber)] tabular">{rank}</span> 名
        {detail}
      </p>
      {extra}
    </div>
  );
}

export function MeAbsent({ hint, href, action }: { hint: string; href: string; action: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-[var(--ink-muted)]">{hint}</p>
      <Button asChild variant="secondary" size="sm" className="h-11">
        <Link href={href}>{action}</Link>
      </Button>
    </div>
  );
}
