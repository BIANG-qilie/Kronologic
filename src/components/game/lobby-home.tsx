"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScenarioPublic } from "@/lib/game/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Check } from "lucide-react";
import { LampMatrix } from "@/components/game/lamp-matrix";
import { cn } from "@/lib/utils";
import {
  apiJson,
  loadSession,
  saveSession,
  clearSession,
} from "@/hooks/use-room";
import type { RoomPublicView } from "@/lib/game/types";

type FamilyMeta = {
  family: string;
  title: string;
  synopsis: string;
  tiers: number[];
  perTier: Record<number, number>;
  total: number;
  selection: string;
};

const PROGRESS_KEY = "lampxu-night-tea-cleared-tier";

function loadClearedTier(): number {
  try {
    const v = Number(localStorage.getItem(PROGRESS_KEY) ?? "0");
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export function LobbyHome() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [scenarios, setScenarios] = useState<ScenarioPublic[]>([]);
  const [family, setFamily] = useState<FamilyMeta | null>(null);
  const [greedyMin, setGreedyMin] = useState<number>(5);
  const [mode, setMode] = useState<"create" | "join">("create");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resume, setResume] = useState<ReturnType<typeof loadSession>>(null);
  const [clearedTier, setClearedTier] = useState(0);

  useEffect(() => {
    setResume(loadSession());
    setClearedTier(loadClearedTier());
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((d) => {
        setScenarios(d.scenarios ?? []);
        if (d.family) setFamily(d.family);
        const tiers: number[] = d.family?.tiers ?? [];
        if (tiers.length) setGreedyMin(tiers[0]);
      })
      .catch(() => undefined);
  }, []);

  const selected = useMemo(() => {
    return (
      scenarios.find((s) => s.greedyMin === greedyMin) ?? scenarios[0] ?? null
    );
  }, [scenarios, greedyMin]);

  const nextTier = useMemo(() => {
    if (!family?.tiers.length) return null;
    const next = family.tiers.find((t) => t > clearedTier);
    return next ?? null;
  }, [family, clearedTier]);

  function requireNickname(): boolean {
    if (nickname.trim()) return true;
    setErr("请填写昵称");
    return false;
  }

  async function create() {
    if (!requireNickname()) return;
    setBusy(true);
    setErr(null);
    try {
      if (resume) {
        clearSession();
        setResume(null);
      }
      const data = await apiJson<{
        code: string;
        token: string;
        playerId: string;
        view: RoomPublicView;
      }>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ nickname, greedyMin }),
      });
      saveSession({
        code: data.code,
        token: data.token,
        playerId: data.playerId,
      });
      router.push(`/play/${data.code}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!requireNickname()) return;
    if (joinCode.trim().length < 4) {
      setErr("请输入有效房间码");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (resume) {
        clearSession();
        setResume(null);
      }
      const code = joinCode.trim().toUpperCase();
      const data = await apiJson<{
        code: string;
        token: string;
        playerId: string;
      }>(`/api/rooms/${code}`, {
        method: "POST",
        body: JSON.stringify({ action: "join", nickname }),
      });
      saveSession({
        code: data.code,
        token: data.token,
        playerId: data.playerId,
      });
      router.push(`/play/${data.code}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加入失败");
    } finally {
      setBusy(false);
    }
  }

  async function reconnect() {
    if (!resume) return;
    setBusy(true);
    setErr(null);
    try {
      await apiJson(`/api/rooms/${resume.code}`, {
        method: "POST",
        body: JSON.stringify({ action: "reconnect", token: resume.token }),
      });
      router.push(`/play/${resume.code}`);
    } catch (e) {
      clearSession();
      setResume(null);
      setErr(
        e instanceof Error
          ? `上一局已失效：${e.message}`
          : "上一局已失效，请重新开房"
      );
    } finally {
      setBusy(false);
    }
  }

  const tiers = family?.tiers ?? [5];
  const action = mode === "create" ? create : join;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-atmosphere" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-[-30vh] h-[90vh] w-[120vw] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(212,161,90,0.16),transparent)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <nav className="flex items-center justify-between py-6 text-[11px] tracking-[0.32em] text-[var(--ink-muted)]">
          <span className="rise font-display text-base tracking-[0.2em] text-[var(--ink)]" style={{ ["--i" as string]: 0 }}>
            灯序
          </span>
          <span className="rise hidden sm:inline" style={{ ["--i" as string]: 1 }}>
            星河音乐厅 · 一九二五 · 散场之后
          </span>
        </nav>

        {resume && (
          <div className="rise mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--amber)]/25 py-3" style={{ ["--i" as string]: 1 }}>
            <p className="text-sm text-[var(--ink-muted)]">
              还有一间房没散场：
              <span className="ml-1 font-mono tracking-[0.2em] text-[var(--ink)]">{resume.code}</span>
            </p>
            <div className="flex gap-1">
              <Button size="sm" onClick={reconnect} disabled={busy}>
                回到房间
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  clearSession();
                  setResume(null);
                }}
              >
                放弃
              </Button>
            </div>
          </div>
        )}

        <section className="grid gap-12 pb-16 pt-6 md:grid-cols-12 md:gap-8 md:pb-24 md:pt-10">
          <div className="md:col-span-7">
            <p className="rise text-[11px] tracking-[0.42em] text-[var(--amber)]" style={{ ["--i" as string]: 1 }}>
              一桩发生在六个时刻里的案子
            </p>
            <h1
              className="rise mt-5 font-display text-[clamp(5.5rem,17vw,11.5rem)] font-black leading-[0.86] tracking-[-0.02em] text-[var(--ink)]"
              style={{ ["--i" as string]: 2 }}
            >
              灯<span className="text-[var(--amber)]">序</span>
            </h1>
            <p
              className="rise mt-8 max-w-[26rem] text-balance text-lg leading-[1.85] text-[var(--ink-muted)] md:text-xl"
              style={{ ["--i" as string]: 3 }}
            >
              <span className="block">六时、六地、六人。</span>
              <span className="block">
                <span className="text-[var(--green-win)]">绿窗</span>所有人共见，
                <span className="text-[#f3e6c8]">白窗</span>只照给你。
              </span>
              <span className="block">谁先拼出那一刻，谁就赢。</span>
            </p>

            <div
              className="rise ticket-edge relative mt-10 max-w-md bg-[var(--stage)]/80 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-sm sm:p-7"
              style={{ ["--i" as string]: 4 }}
            >
              <div className="pointer-events-none absolute inset-y-4 left-0 right-0 border-y border-dashed border-[var(--ink-faint)]/70" aria-hidden />
              <div className="relative">
                <div className="mb-6 flex items-baseline justify-between">
                  <p className="font-display text-xl text-[var(--ink)]">
                    {mode === "create" ? "开一间房" : "入座"}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === "create" ? "join" : "create");
                      setErr(null);
                    }}
                    className="group inline-flex items-center gap-1 text-xs text-[var(--ink-muted)] transition-colors hover:text-[var(--amber)]"
                  >
                    {mode === "create" ? "有房间码？" : "自己开房"}
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="nick" className="text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
                      你的名字
                    </Label>
                    <Input
                      id="nick"
                      value={nickname}
                      maxLength={16}
                      placeholder="今晚的调查员"
                      autoComplete="nickname"
                      onKeyDown={(e) => e.key === "Enter" && action()}
                      onChange={(e) => {
                        setNickname(e.target.value);
                        if (err === "请填写昵称") setErr(null);
                      }}
                      className="h-12 rounded-none border-0 border-b border-[var(--ink-faint)] bg-transparent px-0 text-lg shadow-none transition-colors placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--amber)] focus-visible:outline-none focus-visible:ring-0"
                    />
                  </div>

                  {mode === "create" ? (
                    <fieldset className="space-y-2.5">
                      <legend className="mb-2.5 flex w-full items-baseline justify-between text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
                        <span>难度</span>
                        <span className="tracking-normal text-[var(--ink-muted)]/70">至少要问几次才能破案</span>
                      </legend>
                      <div className="flex gap-1.5" role="radiogroup">
                        {tiers.map((t) => {
                          const on = t === greedyMin;
                          const cleared = t <= clearedTier;
                          return (
                            <button
                              key={t}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              aria-label={`${t} 问${cleared ? "，已通关" : ""}`}
                              onClick={() => setGreedyMin(t)}
                              className={cn(
                                "relative h-12 flex-1 rounded-[3px] font-display text-lg tabular transition-all duration-200",
                                on
                                  ? "bg-[var(--amber)] text-[var(--curtain)] shadow-[0_8px_24px_-10px_rgba(212,161,90,0.8)]"
                                  : "text-[var(--ink-muted)] shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:text-[var(--ink)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
                              )}
                            >
                              {t}
                              {cleared && (
                                <Check
                                  className={cn(
                                    "absolute right-1 top-1 h-3 w-3",
                                    on ? "text-[var(--curtain)]/70" : "text-[var(--green-win)]"
                                  )}
                                  aria-hidden
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {nextTier != null && nextTier !== greedyMin && (
                        <button
                          type="button"
                          className="text-xs text-[var(--amber)] underline-offset-4 hover:underline"
                          onClick={() => setGreedyMin(nextTier)}
                        >
                          接着闯：{nextTier} 问
                        </button>
                      )}
                    </fieldset>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="code" className="text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
                        房间码
                      </Label>
                      <Input
                        id="code"
                        value={joinCode}
                        maxLength={6}
                        placeholder="六位"
                        autoComplete="off"
                        onKeyDown={(e) => e.key === "Enter" && action()}
                        className="h-12 rounded-none border-0 border-b border-[var(--ink-faint)] bg-transparent px-0 font-mono text-2xl uppercase tracking-[0.5em] shadow-none placeholder:text-base placeholder:tracking-[0.2em] placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--amber)] focus-visible:outline-none focus-visible:ring-0"
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      />
                    </div>
                  )}

                  {err && (
                    <p role="alert" className="animate-fade-up text-sm text-[#e07a5f]">
                      {err}
                    </p>
                  )}

                  <Button className="group w-full" size="lg" disabled={busy} onClick={action}>
                    {busy ? "请稍候…" : mode === "create" ? `开房 · ${greedyMin} 问` : "进入房间"}
                    {!busy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                  </Button>
                  {resume && mode === "create" && (
                    <p className="-mt-2 text-center text-xs text-[var(--ink-muted)]">
                      开新房会放弃房间 {resume.code}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="md:col-span-5 md:pt-24">
            <div className="rise relative" style={{ ["--i" as string]: 3 }}>
              <LampMatrix className="mx-auto max-w-[22rem] md:max-w-none" />
              <div className="mt-6 flex items-center justify-center gap-5 text-[11px] text-[var(--ink-muted)] md:justify-start md:pl-12">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--green-win)] shadow-[0_0_8px_rgba(111,191,138,0.8)]" />
                  绿窗 · 公开
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#f3e6c8] shadow-[0_0_8px_rgba(243,230,200,0.7)]" />
                  白窗 · 只给你
                </span>
              </div>
            </div>

            <div className="rise mt-12 border-l border-[var(--amber)]/40 pl-5 md:ml-12" style={{ ["--i" as string]: 5 }}>
              <p className="text-[11px] tracking-[0.32em] text-[var(--amber)]">今晚的案子</p>
              <h2 className="mt-2 font-display text-3xl text-[var(--ink)]">
                {family?.title ?? selected?.title ?? "夜茶的毒"}
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-[1.9] text-[var(--ink-muted)]">
                {family?.synopsis ?? selected?.synopsis ?? "　"}
              </p>
            </div>
          </aside>
        </section>

        <section className="border-t border-[var(--ink-faint)]/60 py-14 md:py-20" aria-labelledby="how">
          <h2 id="how" className="sr-only">
            怎么玩
          </h2>
          <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              ["问一个地点和时间", "绿窗告诉所有人那里有几个人；白窗只悄悄告诉你其中一位是谁。"],
              ["在羊皮纸上推", "把人物、人数一格格点上去。公开、私有、推理三层叠在同一张图上。"],
              ["抢先交卷", "答出谁、在哪、何时。答错即出局；有人交卷后，其余人还有 12 秒同时交卷。"],
            ].map(([title, body], i) => (
              <li key={title} className="group">
                <span className="font-display text-5xl italic text-[var(--ink-faint)] transition-colors duration-500 group-hover:text-[var(--amber)]">
                  0{i + 1}
                </span>
                <p className="mt-3 font-display text-xl text-[var(--ink)]">{title}</p>
                <p className="mt-2 max-w-xs text-sm leading-[1.9] text-[var(--ink-muted)]">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="flex flex-col gap-4 border-t border-[var(--ink-faint)]/60 py-8 text-[11px] text-[var(--ink-muted)]/80 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6">
          <div className="space-y-1.5">
            <p className="font-display text-sm tracking-[0.18em] text-[var(--ink)]">
              BY BIANG
            </p>
            <p className="max-w-md leading-[1.7] text-[var(--ink-muted)]/75">
              规则与节奏启发自桌游{" "}
              <span className="text-[var(--ink-muted)]">Kronologic</span>
              ，此为非商业致敬之作。
            </p>
            <p>
              <a
                href="https://github.com/BIANG-qilie/Kronologic"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[var(--amber)]/90 underline-offset-4 transition-colors hover:text-[var(--amber)] hover:underline"
              >
                GitHub · BIANG-qilie/Kronologic
              </a>
            </p>
          </div>
          <div className="flex flex-col gap-1 sm:items-end">
            <span>1–4 人 · 房间码开局 · 无需注册</span>
            <span className="font-display italic text-[var(--ink-muted)]/70">灯序 · 时间推理</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
