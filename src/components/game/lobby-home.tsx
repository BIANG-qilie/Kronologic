"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Check } from "lucide-react";
import { LampMatrix } from "@/components/game/lamp-matrix";
import { levelLabel, suggestLevel, type LevelInfo } from "@/lib/game/levels";
import { loadClearedLevels } from "@/lib/game/progress";
import { cn } from "@/lib/utils";
import { useAccount } from "@/hooks/use-account";
import { AccountMenu } from "@/components/account/account-menu";
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
  levels: LevelInfo[];
  total: number;
  selection: string;
};

const NICK_MISSING = "先填一个称呼";

export function LobbyHome() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [family, setFamily] = useState<FamilyMeta | null>(null);
  const [level, setLevel] = useState<number>(1);
  const [mode, setMode] = useState<"create" | "join">("create");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [resume, setResume] = useState<ReturnType<typeof loadSession>>(null);
  const [localCleared, setLocalCleared] = useState<Set<number>>(() => new Set());
  const account = useAccount();
  const user = account.status === "ready" ? account.user : null;
  const accountCleared = account.status === "ready" && account.user ? account.clearedLevels : null;
  const cleared = useMemo(
    () => (accountCleared ? new Set(accountCleared) : localCleared),
    [accountCleared, localCleared]
  );
  const levelPicked = useRef(false);
  const nicknameTouched = useRef(false);

  useEffect(() => {
    setResume(loadSession());
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((d) => {
        if (!d.family) return;
        setFamily(d.family);
        setLocalCleared(loadClearedLevels(d.family.levels ?? []));
        const asked = Number(new URLSearchParams(window.location.search).get("level"));
        if ((d.family.levels ?? []).some((l: LevelInfo) => l.level === asked)) {
          levelPicked.current = true;
          setLevel(asked);
        }
      })
      .catch(() => setLoadErr(true));
  }, []);

  useEffect(() => {
    if (!family || account.status === "loading" || levelPicked.current) return;
    setLevel(suggestLevel(family.levels ?? [], cleared));
  }, [family, account.status, cleared]);

  useEffect(() => {
    if (user && !nicknameTouched.current) setNickname(user.username);
  }, [user]);

  const levels = useMemo(() => family?.levels ?? [], [family]);
  const tiers = family?.tiers ?? [];
  const selected = levels.find((l) => l.level === level) ?? null;

  function requireNickname(): boolean {
    if (nickname.trim()) return true;
    setErr(NICK_MISSING);
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
        body: JSON.stringify({ nickname, level }),
      });
      saveSession({
        code: data.code,
        token: data.token,
        playerId: data.playerId,
      });
      router.push(`/play/${data.code}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "新建游戏失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!requireNickname()) return;
    if (joinCode.trim().length !== 6) {
      setErr("房间码是 6 位字母或数字");
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
      setErr(e instanceof Error ? e.message : "加入失败，请重试");
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
    } catch {
      clearSession();
      setResume(null);
      setErr("上一局已经结束，新建一局吧");
    } finally {
      setBusy(false);
    }
  }

  const action = mode === "create" ? create : join;

  const segment = (value: "create" | "join", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => {
        setMode(value);
        setErr(null);
      }}
      className={cn(
        "relative h-11 flex-1 font-display text-lg transition-colors duration-200",
        mode === value ? "text-[var(--ink)]" : "text-ink-muted/70 hover:text-[var(--ink)]"
      )}
    >
      {label}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-6 -bottom-px h-px origin-center bg-[var(--amber)] transition-transform duration-300",
          mode === value ? "scale-x-100" : "scale-x-0"
        )}
      />
    </button>
  );

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-atmosphere" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-[-30vh] h-[90vh] w-[120vw] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(212,161,90,0.16),transparent)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <nav className="flex items-center justify-between py-3.5 text-[11px] tracking-[0.32em] text-[var(--ink-muted)]">
          <span className="rise font-display text-base tracking-[0.2em] text-[var(--ink)]" style={{ ["--i" as string]: 0 }}>
            灯序
          </span>
          <div className="rise flex items-center gap-6" style={{ ["--i" as string]: 1 }}>
            <span className="hidden sm:inline">星河音乐厅 · 1925 · 散场之后</span>
            <AccountMenu />
          </div>
        </nav>

        {resume && (
          <div className="rise mb-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-y border-amber/25 py-2" style={{ ["--i" as string]: 1 }}>
            <p className="text-sm text-[var(--ink-muted)]">
              上一局还没散场
              <span className="ml-2 font-mono tracking-[0.2em] text-[var(--ink)]">{resume.code}</span>
            </p>
            <div className="-mr-2 flex">
              <Button size="sm" className="h-11 sm:h-9" onClick={reconnect} disabled={busy}>
                回到房间
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-11 sm:h-9"
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

        <section className="grid gap-12 pb-16 pt-4 md:grid-cols-12 md:gap-8 md:pb-24 md:pt-10">
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
              className="rise mt-8 max-w-[26rem] text-lg leading-[1.85] text-[var(--ink-muted)] md:text-xl"
              style={{ ["--i" as string]: 3 }}
            >
              <span className="block text-[var(--ink)]">六时，六地，六人。</span>
              <span className="block">
                <span className="text-[var(--green-win)]">绿窗</span>亮给全场，
                <span className="text-[#f3e6c8]">白窗</span>只亮给你。
              </span>
              <span className="block">抢先拼出案发那一刻。</span>
            </p>

            <div
              className="rise ticket-edge relative mt-10 max-w-md bg-stage/80 px-5 pb-6 pt-3 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-sm sm:px-7 sm:pb-7"
              style={{ ["--i" as string]: 4 }}
            >
              <div className="pointer-events-none absolute inset-y-4 left-0 right-0 border-y border-dashed border-ink-faint/70" aria-hidden />
              <div className="relative">
                <div className="mb-5 flex border-b border-ink-faint/70" role="tablist" aria-label="新建或加入">
                  {segment("create", "新建游戏")}
                  {segment("join", "加入游戏")}
                </div>

                <div className="space-y-6">
                  <div className="space-y-1">
                    <Label htmlFor="nick" className="text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
                      你的称呼
                    </Label>
                    <Input
                      id="nick"
                      value={nickname}
                      maxLength={16}
                      placeholder="比如：夜班侦探"
                      autoComplete="nickname"
                      enterKeyHint="go"
                      aria-invalid={err === NICK_MISSING}
                      onKeyDown={(e) => e.key === "Enter" && action()}
                      onChange={(e) => {
                        nicknameTouched.current = true;
                        setNickname(e.target.value);
                        if (err === NICK_MISSING) setErr(null);
                      }}
                      className="h-12 rounded-none border-0 border-b border-[var(--ink-faint)] bg-transparent px-0 text-lg shadow-none transition-colors placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--amber)] focus-visible:outline-none focus-visible:ring-0 aria-[invalid=true]:border-[#e07a5f]"
                    />
                  </div>

                  {mode === "create" ? (
                    <fieldset>
                      <legend className="mb-3 flex w-full items-baseline justify-between text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
                        <span>关卡选择</span>
                        {selected && (
                          <span className="tracking-normal text-[var(--ink)] tabular" aria-live="polite">
                            {levelLabel(selected.level)}
                            <span className="text-[var(--ink-muted)]"> · 最少 {selected.greedyMin} 问</span>
                          </span>
                        )}
                      </legend>
                      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="关卡">
                        {levels.length === 0
                          ? Array.from({ length: 15 }, (_, i) => (
                              <span
                                key={i}
                                className={cn(
                                  "h-12 rounded-[3px] shadow-[inset_0_0_0_1px_var(--ink-faint)]",
                                  !loadErr && "animate-pulse-soft"
                                )}
                              />
                            ))
                          : levels.map((l) => {
                              const on = l.level === level;
                              const done = cleared.has(l.level);
                              const rung = Math.max(0, tiers.indexOf(l.greedyMin)) + 1;
                              return (
                                <button
                                  key={l.level}
                                  type="button"
                                  role="radio"
                                  aria-checked={on}
                                  aria-label={`${levelLabel(l.level)}，最少 ${l.greedyMin} 问${done ? "，已通关" : ""}`}
                                  onClick={() => {
                                    levelPicked.current = true;
                                    setLevel(l.level);
                                  }}
                                  className={cn(
                                    "relative flex h-12 flex-col items-center justify-center rounded-[3px] font-display text-lg leading-none tabular transition-[background-color,box-shadow,color,transform] duration-200 active:scale-[0.96]",
                                    on
                                      ? "bg-[var(--amber)] text-[var(--curtain)] shadow-[0_8px_24px_-10px_rgba(212,161,90,0.8)]"
                                      : done
                                        ? "text-[var(--ink)] shadow-[inset_0_0_0_1px_rgba(111,191,138,0.45)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
                                        : "text-[var(--ink-muted)] shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:text-[var(--ink)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
                                  )}
                                >
                                  {l.level}
                                  <span className="mt-1.5 flex h-1 items-end gap-[3px]" aria-hidden>
                                    {Array.from({ length: 5 }, (_, i) => (
                                      <span
                                        key={i}
                                        className={cn(
                                          "w-[3px] rounded-[1px]",
                                          i < rung
                                            ? on
                                              ? "bg-curtain/70"
                                              : "bg-amber/80"
                                            : on
                                              ? "bg-curtain/20"
                                              : "bg-[var(--ink-faint)]"
                                        )}
                                        style={{ height: `${2 + i}px` }}
                                      />
                                    ))}
                                  </span>
                                  {done && (
                                    <Check
                                      className={cn(
                                        "absolute right-1 top-1 h-3 w-3",
                                        on ? "text-curtain/70" : "text-[var(--green-win)]"
                                      )}
                                      aria-hidden
                                    />
                                  )}
                                </button>
                              );
                            })}
                      </div>
                      <p className="mt-3 flex items-baseline justify-between gap-3 text-[11px] leading-relaxed text-ink-muted/80">
                        {loadErr ? (
                          <span className="text-[#e07a5f]">关卡没加载出来，刷新页面再试</span>
                        ) : (
                          <span>关卡难度递进，以最少提问次数为判断依据</span>
                        )}
                        {cleared.size > 0 && (
                          <span className="shrink-0 font-mono text-green-win/90 tabular">
                            {user ? "账号" : ""}已通关 {cleared.size}/{levels.length || 15}
                          </span>
                        )}
                      </p>
                    </fieldset>
                  ) : (
                    <div className="space-y-1">
                      <Label htmlFor="code" className="text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
                        房间码
                      </Label>
                      <Input
                        id="code"
                        value={joinCode}
                        maxLength={6}
                        placeholder="6 位，向房主要"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        enterKeyHint="go"
                        onKeyDown={(e) => e.key === "Enter" && action()}
                        className="h-12 rounded-none border-0 border-b border-[var(--ink-faint)] bg-transparent px-0 font-mono text-2xl uppercase tracking-[0.5em] shadow-none placeholder:font-sans placeholder:text-base placeholder:normal-case placeholder:tracking-normal placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--amber)] focus-visible:outline-none focus-visible:ring-0"
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                      />
                    </div>
                  )}

                  {err && (
                    <p role="alert" className="animate-fade-up -mt-2 text-sm text-[#e07a5f]">
                      {err}
                    </p>
                  )}

                  <div>
                    <Button className="group w-full" size="lg" disabled={busy || (mode === "create" && !selected)} onClick={action}>
                      {busy
                        ? "稍等…"
                        : mode === "create"
                          ? `新建游戏 · ${levelLabel(level)}`
                          : "入座"}
                      {!busy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                    </Button>
                    {resume && mode === "create" && (
                      <p className="mt-2 text-center text-xs text-[var(--ink-muted)]">
                        新建游戏会放弃房间 {resume.code}
                      </p>
                    )}
                  </div>
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
                  绿窗 · 全场可见
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#f3e6c8] shadow-[0_0_8px_rgba(243,230,200,0.7)]" />
                  白窗 · 只给你
                </span>
              </div>
            </div>

            <div className="rise mt-12 border-l border-amber/40 pl-5 md:ml-12" style={{ ["--i" as string]: 5 }}>
              <p className="text-[11px] tracking-[0.32em] text-[var(--amber)]">今晚的案子</p>
              <h2 className="mt-2 font-display text-3xl text-[var(--ink)]">
                {family?.title ?? "夜茶的毒"}
              </h2>
              <p className="mt-3 max-w-sm whitespace-pre-line text-sm leading-[1.9] text-[var(--ink-muted)]">
                {family?.synopsis ?? "　"}
              </p>
            </div>
          </aside>
        </section>

        <section className="border-t border-ink-faint/60 py-14 md:py-20" aria-labelledby="how">
          <h2 id="how" className="sr-only">
            怎么玩
          </h2>
          <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              [
                "提问一间房",
                "配一个时间，绿窗公布房里几人，白窗私下告诉你其中一位；配一个人物，绿窗公布此人来过几次，白窗告诉你其中一次的时间。白窗没有内容时不计次，再问一次。",
              ],
              [
                "落笔推理",
                "在羊皮纸上标出每个时刻谁在哪、有几人。绿窗、白窗、推理三层叠在同一张图上；已有绿窗或白窗线索的格子，推理标记不可再改。",
              ],
              [
                "抢先交卷",
                "答出谁、何时、何地。答错即出局；有人交卷后，其余人还有 12 秒同时交卷。",
              ],
            ].map(([title, body], i) => (
              <li key={title} className="group">
                <span className="font-display text-5xl italic text-[var(--ink-faint)] transition-colors duration-500 group-hover:text-[var(--amber)]">
                  0{i + 1}
                </span>
                <p className="mt-3 font-display text-xl text-[var(--ink)]">{title}</p>
                <p className="mt-2 max-w-sm text-sm leading-[1.9] text-[var(--ink-muted)]">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="flex flex-col gap-4 border-t border-ink-faint/60 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 text-[11px] text-ink-muted/80 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6">
          <div className="space-y-1.5">
            <p className="font-display text-sm tracking-[0.18em] text-[var(--ink)]">
              BY BIANG
            </p>
            <p className="max-w-md leading-[1.7] text-ink-muted/75">
              规则启发自桌游{" "}
              <span className="text-[var(--ink-muted)]">Kronologic</span>
              ，非商业致敬作品。
            </p>
            <p>
              <a
                href="https://github.com/BIANG-qilie/Kronologic"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-amber/90 underline-offset-4 transition-colors hover:text-[var(--amber)] hover:underline"
              >
                GitHub · BIANG-qilie/Kronologic
              </a>
            </p>
          </div>
          <div className="flex flex-col gap-1 sm:items-end">
            <span>
              1–4 人 · 凭房间码入座 · 无需注册
              {account.status === "ready" && account.enabled && "，登录可记战绩"}
            </span>
            <span className="font-display italic text-ink-muted/70">灯序 · 时间推理</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
