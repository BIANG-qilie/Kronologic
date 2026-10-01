"use client";

import { useEffect, useState } from "react";
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

export function LobbyHome() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [scenarios, setScenarios] = useState<ScenarioPublic[]>([]);
  const [scenarioId, setScenarioId] = useState("harbor-missing-score");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resume, setResume] = useState<ReturnType<typeof loadSession>>(null);

  useEffect(() => {
    setResume(loadSession());
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((d) => {
        setScenarios(d.scenarios ?? []);
        if (d.scenarios?.[0]?.id) setScenarioId(d.scenarios[0].id);
      })
      .catch(() => undefined);
  }, []);

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const data = await apiJson<{
        code: string;
        token: string;
        playerId: string;
        view: RoomPublicView;
      }>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ nickname, scenarioId }),
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
    setBusy(true);
    setErr(null);
    try {
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
      setErr(e instanceof Error ? e.message : "重连失败");
    } finally {
      setBusy(false);
    }
  }

  const selected = scenarios.find((s) => s.id === scenarioId);

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
            六时、六地、六人。绿窗共享，白窗独见。在港湾剧院的灯光里，抢先拼出真相。
          </p>
        </header>

        {resume && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[var(--amber)]/30 bg-[var(--stage)]/70 px-4 py-3">
            <p className="text-sm text-[var(--ink-muted)]">
              检测到未结束的房间 <span className="font-mono text-[var(--ink)]">{resume.code}</span>
            </p>
            <Button size="sm" onClick={reconnect} disabled={busy}>
              继续调查
            </Button>
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
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            {mode === "create" ? (
              <div className="space-y-2">
                <Label htmlFor="scene">调查</Label>
                <select
                  id="scene"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={scenarioId}
                  onChange={(e) => setScenarioId(e.target.value)}
                >
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} · {s.subtitle}
                    </option>
                  ))}
                </select>
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
              disabled={busy || !nickname.trim() || (mode === "join" && joinCode.length < 4)}
              onClick={mode === "create" ? create : join}
            >
              {busy ? "请稍候…" : mode === "create" ? "开一间房" : "进入房间"}
            </Button>
            <p className="text-xs text-[var(--ink-muted)]">
              v1 无需账号：房间码 + 昵称 + 本机重连令牌。账号与战绩留待 v2。
            </p>
          </section>

          <aside className="rounded-sm border border-[var(--ink-faint)] bg-[var(--stage)]/50 p-5">
            {selected ? (
              <>
                <p className="text-xs uppercase tracking-[0.25em] text-[var(--amber)]">
                  本案
                </p>
                <h2 className="mt-2 font-display text-3xl text-[var(--ink)]">
                  {selected.title}
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  {selected.subtitle}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-[var(--ink-muted)]">
                  {selected.synopsis}
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
