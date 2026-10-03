"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Award, Lamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-account";
import { ACHIEVEMENTS } from "@/lib/game/achievements";
import { levelLabel } from "@/lib/game/levels";
import type { Profile, ProfileRecord } from "@/lib/account/types";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./account-menu";
import { AuthDialog } from "./auth-dialog";

const RESULT_LABEL: Record<ProfileRecord["result"], string> = {
  win: "破案",
  lose: "被抢先",
  eliminated: "出局",
};

const dateFmt = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" });
const fullDateFmt = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" });
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
      <div className="relative mx-auto max-w-5xl px-5 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-8">
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

function Notice({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <section className="rise mx-auto max-w-md py-24 text-center" style={{ ["--i" as string]: 1 }}>
      <p className="font-display text-3xl text-[var(--ink)]">{title}</p>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">{body}</p>
      <div className="mt-8 flex justify-center gap-2">{action}</div>
    </section>
  );
}

export function RecordsPage() {
  const account = useAccount();
  const userId = account.status === "ready" ? account.user?.id ?? null : null;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (userId == null) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setErr(null);
    fetch("/api/me/records", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "战绩暂时读不出来，稍后再试");
        if (!cancelled) setProfile(data.profile);
      })
      .catch((e) => !cancelled && setErr(e instanceof Error ? e.message : "战绩暂时读不出来，稍后再试"));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (account.status === "loading" || (userId != null && !profile && !err)) {
    return (
      <Shell>
        <div className="grid place-items-center py-32" role="status">
          <Lamp className="animate-pulse-soft h-6 w-6 text-[var(--amber)]" aria-hidden />
          <p className="mt-4 text-sm tracking-[0.2em] text-[var(--ink-muted)]">正在翻档案</p>
        </div>
      </Shell>
    );
  }

  if (!account.enabled) {
    return (
      <Shell>
        <Notice
          title="账号功能还没开放"
          body="这台服务器没有接数据库，战绩不会保存。游客照样可以开局。"
          action={
            <Button asChild>
              <Link href="/">回大厅</Link>
            </Button>
          }
        />
      </Shell>
    );
  }

  if (!account.user) {
    return (
      <Shell>
        <Notice
          title="登录后才有档案"
          body="登录后打完的每一局，都会记下提问数、首通日期和成就。"
          action={
            <>
              <Button onClick={() => setAuthOpen(true)}>登录或注册</Button>
              <Button asChild variant="ghost">
                <Link href="/">先去玩</Link>
              </Button>
            </>
          }
        />
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </Shell>
    );
  }

  if (err || !profile) {
    return (
      <Shell>
        <Notice
          title="档案没翻出来"
          body={err ?? "战绩暂时读不出来，稍后再试"}
          action={<Button onClick={() => window.location.reload()}>再试一次</Button>}
        />
      </Shell>
    );
  }

  const { totals } = profile;
  const rate = totals.games ? Math.round((totals.wins / totals.games) * 100) : null;
  const unlocked = new Map(profile.achievements.map((a) => [a.code, a.unlockedAt]));

  return (
    <Shell>
      <header className="pt-6 md:pt-10">
        <p className="rise text-[11px] tracking-[0.42em] text-[var(--amber)]" style={{ ["--i" as string]: 0 }}>
          常客档案
        </p>
        <h1
          className="rise mt-3 break-all font-display text-[clamp(2.75rem,10vw,5.5rem)] font-black leading-[0.95] text-[var(--ink)]"
          style={{ ["--i" as string]: 1 }}
        >
          {profile.user.username}
        </h1>
        <p className="rise mt-3 text-xs text-[var(--ink-muted)]" style={{ ["--i" as string]: 2 }}>
          {fullDateFmt.format(new Date(profile.user.createdAt))} 登记入场
        </p>
      </header>

      <dl
        className="rise ticket-edge relative mt-8 grid grid-cols-3 bg-stage/80 px-2 py-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:px-6"
        style={{ ["--i" as string]: 3 }}
      >
        <div className="pointer-events-none absolute inset-y-3 left-0 right-0 border-y border-dashed border-ink-faint/70" aria-hidden />
        {[
          ["总局数", String(totals.games), null],
          ["胜率", rate == null ? "—" : `${rate}`, rate == null ? null : "%"],
          ["通关", String(totals.cleared), `/${totals.levels}`],
        ].map(([label, value, unit], i) => (
          <div key={label} className={cn("relative px-2 text-center", i > 0 && "border-l border-dashed border-ink-faint/70")}>
            <dt className="text-[11px] tracking-[0.24em] text-[var(--ink-muted)]">{label}</dt>
            <dd className="mt-1.5 font-display text-3xl text-[var(--ink)] tabular sm:text-4xl">
              {value}
              {unit && <span className="ml-0.5 text-base text-[var(--ink-muted)]">{unit}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <section className="mt-12" aria-labelledby="levels-h">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 id="levels-h" className="font-display text-2xl text-[var(--ink)]">
            十五关
          </h2>
          <p className="text-[11px] text-[var(--ink-muted)]">最佳提问数 · 首通日期</p>
        </div>
        <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
          {profile.levels.map((l, i) => {
            const done = l.bestQueries != null;
            const perfect = done && l.bestQueries! <= l.minQueries;
            return (
              <li key={l.level} className="rise" style={{ ["--i" as string]: 4 + Math.floor(i / 5) }}>
                <Link
                  href={`/?level=${l.level}`}
                  aria-label={`${levelLabel(l.level)}，${done ? `最佳 ${l.bestQueries} 问` : "未通关"}，去玩`}
                  className={cn(
                    "flex h-[4.75rem] flex-col justify-between rounded-[3px] px-2.5 py-2 transition-[box-shadow,transform] duration-200 active:scale-[0.97]",
                    done
                      ? "bg-stage/70 shadow-[inset_0_0_0_1px_rgba(111,191,138,0.45)] hover:shadow-[inset_0_0_0_1px_var(--amber)]"
                      : "shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
                  )}
                >
                  <span className="flex items-baseline justify-between">
                    <span className={cn("font-display text-xl leading-none tabular", done ? "text-[var(--ink)]" : "text-[var(--ink-muted)]")}>
                      {l.level}
                    </span>
                    <span className="font-mono text-[10px] text-ink-muted/70 tabular">≥{l.minQueries}</span>
                  </span>
                  {done ? (
                    <span className="flex items-baseline justify-between gap-1">
                      <span className={cn("font-mono text-sm tabular", perfect ? "text-[var(--amber)]" : "text-[var(--green-win)]")}>
                        {l.bestQueries} 问
                      </span>
                      <span className="text-[10px] text-[var(--ink-muted)] tabular">
                        {dateFmt.format(new Date(l.firstClearAt!))}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-ink-muted/60">未通关</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-12" aria-labelledby="ach-h">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 id="ach-h" className="font-display text-2xl text-[var(--ink)]">
            成就墙
          </h2>
          <p className="font-mono text-[11px] text-[var(--ink-muted)] tabular">
            {unlocked.size}/{ACHIEVEMENTS.length}
          </p>
        </div>
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {ACHIEVEMENTS.map((a) => {
            const at = unlocked.get(a.code);
            return (
              <li
                key={a.code}
                className={cn(
                  "flex items-start gap-3 rounded-[3px] px-3 py-3",
                  at
                    ? "bg-amber/10 shadow-[inset_0_0_0_1px_var(--amber-dim)]"
                    : "bg-black/20 shadow-[inset_0_0_0_1px_rgba(58,74,66,0.6)]"
                )}
              >
                <Award
                  className={cn("mt-0.5 h-5 w-5 shrink-0", at ? "text-[var(--amber)]" : "text-[var(--ink-faint)]")}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className={cn("font-display text-base", at ? "text-[var(--ink)]" : "text-ink-muted/60")}>
                    {a.title}
                    <span className="sr-only">{at ? "，已解锁" : "，未解锁"}</span>
                  </p>
                  <p className={cn("mt-0.5 text-xs leading-relaxed", at ? "text-[var(--ink-muted)]" : "text-ink-muted/45")}>
                    {a.description}
                  </p>
                  {at && <p className="mt-1 text-[10px] text-amber/80 tabular">{dateFmt.format(new Date(at))} 解锁</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="recent-h">
        <h2 id="recent-h" className="mb-4 font-display text-2xl text-[var(--ink)]">
          最近 20 局
        </h2>
        {profile.recent.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-4 border-y border-ink-faint/60 py-6">
            <p className="text-sm text-[var(--ink-muted)]">还没有记在账号上的对局。登录状态下打完一局，这里就会出现。</p>
            <Button asChild className="group">
              <Link href="/">
                去开一局
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        ) : (
          <ol className="divide-y divide-ink-faint/50 border-y border-ink-faint/60">
            {profile.recent.map((r) => (
              <li key={r.id} className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-x-3 py-3 sm:grid-cols-[4.5rem_1fr_auto_auto] sm:gap-x-6">
                <span className="font-display text-lg text-[var(--ink)] tabular">
                  <span className="sr-only">第 </span>
                  {r.level}
                  <span className="ml-0.5 text-xs text-[var(--ink-muted)]">关</span>
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "text-sm",
                      r.result === "win" ? "text-[var(--green-win)]" : r.result === "eliminated" ? "text-[#e07a5f]" : "text-[var(--ink-muted)]"
                    )}
                  >
                    {RESULT_LABEL[r.result]}
                  </span>
                  {r.isFirstClear && (
                    <span className="ml-2 rounded-full bg-amber/15 px-1.5 py-0.5 text-[10px] text-[var(--amber)]">首通</span>
                  )}
                  <span className="mt-0.5 block text-[11px] text-[var(--ink-muted)] sm:hidden">
                    {r.mode === "solo" ? "单人" : "多人"} · {timeFmt.format(new Date(r.playedAt))}
                  </span>
                </span>
                <span className="hidden text-xs text-[var(--ink-muted)] sm:block">
                  {r.mode === "solo" ? "单人" : "多人"} · {timeFmt.format(new Date(r.playedAt))}
                </span>
                <span className="text-right font-mono text-xs text-[var(--ink-muted)] tabular">
                  <span className="text-[var(--ink)]">{r.queriesUsed}</span> 问
                  <span className="text-ink-muted/60"> / 最少 {r.minQueries}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Shell>
  );
}
