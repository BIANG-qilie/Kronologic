"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScenarioPublic } from "@/lib/game/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-atmosphere" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-16">
        <header className="mb-12 space-y-4 text-center md:text-left">
          <p className="text-xs uppercase tracking-[0.42em] text-[var(--amber)]">
            非商业 · 原创调查
          </p>
          <h1 className="font-display text-6xl leading-none tracking-tight text-[var(--ink)] md:text-7xl">
            灯序
          </h1>
          <p className="max-w-md text-base leading-relaxed text-[var(--ink-muted)] md:text-lg">
            六时、六地、六人。绿窗共享，白窗独见。在星河音乐厅的灯光里，抢先拼出真相。
          </p>
        </header>

        {resume && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[var(--amber)]/30 bg-[var(--stage)]/70 px-4 py-3">
            <p className="text-sm text-[var(--ink-muted)]">
              检测到未结束的房间{" "}
              <span className="font-mono text-[var(--ink)]">{resume.code}</span>
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={reconnect} disabled={busy}>
                继续调查
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

        <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-start">
          <section className="space-y-5">
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 border-b-2 pb-2 text-sm transition-colors ${
                  mode === "create"
                    ? "border-[var(--amber)] text-[var(--ink)]"
                    : "border-transparent text-[var(--ink-muted)]"
                }`}
                onClick={() => setMode("create")}
              >
                创建房间
              </button>
              <button
                type="button"
                className={`flex-1 border-b-2 pb-2 text-sm transition-colors ${
                  mode === "join"
                    ? "border-[var(--amber)] text-[var(--ink)]"
                    : "border-transparent text-[var(--ink-muted)]"
                }`}
                onClick={() => setMode("join")}
              >
                加入房间
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nick">昵称</Label>
              <Input
                id="nick"
                value={nickname}
                maxLength={16}
                placeholder="今晚的调查员"
                onChange={(e) => {
                  setNickname(e.target.value);
                  if (err === "请填写昵称") setErr(null);
                }}
              />
            </div>

            {mode === "create" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>调查</Label>
                  <p className="font-display text-xl text-[var(--ink)]">
                    {family?.title ?? "夜茶的毒"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diff">难度（贪心最少提问）</Label>
                  <select
                    id="diff"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={greedyMin}
                    onChange={(e) => setGreedyMin(Number(e.target.value))}
                  >
                    {(family?.tiers ?? [5]).map((t) => (
                      <option key={t} value={t}>
                        {t} 问
                        {family?.perTier?.[t]
                          ? ` · 题库 ${family.perTier[t]} 局`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {nextTier != null && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0 text-[var(--amber)]"
                    onClick={() => setGreedyMin(nextTier)}
                  >
                    下一关：{nextTier} 问
                    {clearedTier > 0 ? `（已过 ${clearedTier} 问档）` : ""}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="code">房间码</Label>
                <Input
                  id="code"
                  value={joinCode}
                  maxLength={6}
                  placeholder="六位房间码"
                  className="font-mono uppercase tracking-[0.3em]"
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                />
              </div>
            )}

            {err && <p className="text-sm text-destructive">{err}</p>}

            <Button
              className="w-full"
              size="lg"
              disabled={busy}
              onClick={mode === "create" ? create : join}
            >
              {busy ? "请稍候…" : mode === "create" ? "开一间房" : "进入房间"}
            </Button>
            {resume && mode === "create" && (
              <p className="text-xs text-[var(--amber)]">
                开新房将放弃房间 {resume.code}
              </p>
            )}
            <p className="text-xs text-[var(--ink-muted)]">
              v1 无需账号：房间码 + 昵称 + 本机重连令牌。题库预生成，开房只选题。
            </p>
          </section>

          <aside className="rounded-sm border border-[var(--ink-faint)] bg-[var(--stage)]/50 p-5">
            {selected || family ? (
              <>
                <p className="text-xs uppercase tracking-[0.25em] text-[var(--amber)]">
                  本案
                </p>
                <h2 className="mt-2 font-display text-3xl text-[var(--ink)]">
                  {family?.title ?? selected?.title}
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  {selected?.subtitle ?? "星河音乐厅 · 1925"}
                </p>
                <p className="mt-2 font-mono text-xs text-[var(--amber)]">
                  难度 {greedyMin} 问
                  {selected?.seed ? ` · 种子 ${selected.seed}` : ""}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-[var(--ink-muted)]">
                  {family?.synopsis ?? selected?.synopsis}
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--ink-muted)]">加载调查…</p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
