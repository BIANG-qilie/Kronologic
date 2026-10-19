"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Dices, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RulesSheet } from "@/components/game/rules-sheet";
import { AccountMenu } from "@/components/account/account-menu";
import { useAccount } from "@/hooks/use-account";
import { clearSession, loadSession, saveSession } from "@/hooks/use-room";
import { CUSTOM_CASES, DEFAULT_CUSTOM_CASE_ID, getCustomCase } from "@/lib/game/custom-cases";
import {
  CUSTOM_DIFFICULTIES,
  CUSTOM_NODE_DEFAULT,
  CUSTOM_NODE_MAX,
  CUSTOM_NODE_MIN,
  CustomLevelError,
  buildCustomMap,
  customInputFromQuery,
  customRequestToQuery,
  oneWayCountMax,
  parseCustomRequest,
  randomSeed,
  type CustomLevelInput,
  type CustomMap,
} from "@/lib/game/custom-level";
import type { CustomDifficultyId, CustomLevelRequest } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { CustomMapPreview, MapLegend } from "./custom-map-preview";
import { GeneratingStage, type GeneratingStatus } from "./generating-stage";

type Form = {
  caseId: string;
  nodeCount: number;
  oneWay: boolean;
  oneWayCount: string;
  stay: boolean;
  stayCount: string;
  difficulty: CustomDifficultyId;
  seed: string;
};

const DEFAULT_FORM: Form = {
  caseId: DEFAULT_CUSTOM_CASE_ID,
  nodeCount: CUSTOM_NODE_DEFAULT,
  oneWay: true,
  oneWayCount: "",
  stay: true,
  stayCount: "",
  difficulty: "normal",
  seed: "",
};

const NICK_MISSING = "先填一个称呼";

type Failure = { message: string; field: keyof CustomLevelRequest | null; retryable: boolean };

function formFromRequest(req: CustomLevelRequest): Form {
  return {
    caseId: req.caseId,
    nodeCount: req.nodeCount,
    oneWay: req.oneWay,
    oneWayCount: req.oneWayCount == null ? "" : String(req.oneWayCount),
    stay: req.stay,
    stayCount: req.stayCount == null ? "" : String(req.stayCount),
    difficulty: req.difficulty,
    seed: req.seed,
  };
}

/** A broken shared link keeps what it can, so the form can point at the bad field. */
function looseForm(input: CustomLevelInput): Form {
  const n = Number(input.nodeCount);
  const difficulty = CUSTOM_DIFFICULTIES.find((d) => d.id === input.difficulty)?.id;
  return {
    caseId: getCustomCase(String(input.caseId)) ? String(input.caseId) : DEFAULT_FORM.caseId,
    nodeCount: Number.isInteger(n) ? Math.min(CUSTOM_NODE_MAX, Math.max(CUSTOM_NODE_MIN, n)) : CUSTOM_NODE_DEFAULT,
    oneWay: input.oneWay === true,
    oneWayCount: input.oneWayCount == null ? "" : String(input.oneWayCount).replace(/[^0-9]/g, "").slice(0, 2),
    stay: input.stay === true,
    stayCount: input.stayCount == null ? "" : String(input.stayCount).replace(/[^0-9]/g, "").slice(0, 2),
    difficulty: difficulty ?? DEFAULT_FORM.difficulty,
    seed: typeof input.seed === "string" && input.seed.trim() ? input.seed.trim().slice(0, 32) : randomSeed(),
  };
}

/** Pure preview: parse the form and lay the map the server will start from. */
function previewOf(form: Form): { req: CustomLevelRequest | null; map: CustomMap | null; error: Failure | null } {
  if (!form.seed) return { req: null, map: null, error: null };
  let req: CustomLevelRequest;
  try {
    req = parseCustomRequest(form);
  } catch (e) {
    const err = e instanceof CustomLevelError ? e : new CustomLevelError("设置有误");
    return { req: null, map: null, error: { message: err.message, field: err.field ?? null, retryable: err.retryable } };
  }
  try {
    return { req, map: buildCustomMap(req), error: null };
  } catch (e) {
    const err = e instanceof CustomLevelError ? e : new CustomLevelError("这张图排不出来");
    return { req, map: null, error: { message: err.message, field: err.field ?? null, retryable: err.retryable } };
  }
}

function Section({
  index,
  title,
  aside,
  className,
  children,
  style,
}: {
  index: string;
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section className={cn("rise border-t border-ink-faint/60 pt-6", className)} style={style}>
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="flex items-baseline gap-3">
          <span className="font-display text-sm italic text-[var(--amber-dim)]">{index}</span>
          <span className="font-display text-xl text-[var(--ink)] sm:text-2xl">{title}</span>
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex min-h-11 w-full items-center gap-4 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-[var(--ink)]">{label}</span>
        <span className="block text-xs leading-relaxed text-[var(--ink-muted)]">{hint}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300",
          checked
            ? "bg-[var(--amber)]"
            : "bg-[var(--stage)] shadow-[inset_0_0_0_1px_var(--ink-faint)] group-hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
        )}
      >
        <span
          className={cn(
            "absolute left-1 top-1 h-5 w-5 rounded-full transition-transform duration-300",
            checked ? "translate-x-5 bg-[var(--curtain)]" : "translate-x-0 bg-[var(--ink-muted)]"
          )}
          style={{ transitionTimingFunction: "cubic-bezier(0.3, 1.4, 0.5, 1)" }}
        />
      </span>
    </button>
  );
}

function CountField({
  id,
  value,
  onChange,
  max,
  resolved,
  unit,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  /** What a blank field rolled to, for the hint. */
  resolved: number | null;
  unit: string;
  invalid: boolean;
}) {
  const n = value === "" ? null : Number(value);
  const step = (d: number) => {
    const base = n ?? resolved ?? 1;
    const next = Math.min(max, Math.max(1, base + d));
    onChange(String(next));
  };
  return (
    <div className="animate-fade-up mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 pl-0.5">
      <div
        className={cn(
          "flex h-11 items-center rounded-[3px] shadow-[inset_0_0_0_1px_var(--ink-faint)] focus-within:shadow-[inset_0_0_0_1px_var(--amber)]",
          invalid && "shadow-[inset_0_0_0_1px_#e07a5f]"
        )}
      >
        <button
          type="button"
          aria-label={`减少${unit}`}
          onClick={() => step(-1)}
          disabled={n !== null && n <= 1}
          className="flex h-11 w-11 items-center justify-center text-[var(--ink-muted)] transition-colors hover:text-[var(--amber)] disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          id={id}
          inputMode="numeric"
          value={value}
          placeholder="随机"
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
          className="h-11 w-14 bg-transparent text-center font-mono text-base text-[var(--ink)] tabular outline-none placeholder:font-sans placeholder:text-sm placeholder:text-[var(--ink-faint)]"
        />
        <button
          type="button"
          aria-label={`增加${unit}`}
          onClick={() => step(1)}
          disabled={n !== null && n >= max}
          className="flex h-11 w-11 items-center justify-center text-[var(--ink-muted)] transition-colors hover:text-[var(--amber)] disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-[var(--ink-muted)]" aria-live="polite">
        {value === "" ? (
          resolved != null ? (
            <>
              留空随机，这次是 <span className="font-mono text-[var(--amber)] tabular">{resolved}</span> {unit}
            </>
          ) : (
            "留空随机"
          )
        ) : (
          <>
            可填 1–{max}
            <button
              type="button"
              onClick={() => onChange("")}
              className="ml-2 inline-flex min-h-11 items-center gap-1 px-1 text-[var(--amber)] underline-offset-4 hover:underline"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              改回随机
            </button>
          </>
        )}
      </p>
    </div>
  );
}

export function CustomLevelClient() {
  const router = useRouter();
  const account = useAccount();
  const user = account.status === "ready" ? account.user : null;
  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [ready, setReady] = useState(false);
  const [nickname, setNickname] = useState("");
  const [gen, setGen] = useState<{ req: CustomLevelRequest; status: GeneratingStatus } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const busy = !!gen && gen.status.kind !== "error";
  const running = gen?.status.kind === "running";
  const [failure, setFailure] = useState<Failure | null>(null);
  const [resume, setResume] = useState<ReturnType<typeof loadSession>>(null);
  const nicknameTouched = useRef(false);

  useEffect(() => {
    setResume(loadSession());
    const input = customInputFromQuery(window.location.search);
    try {
      const req = parseCustomRequest(input);
      setForm(window.location.search ? formFromRequest(req) : { ...DEFAULT_FORM, seed: randomSeed() });
    } catch {
      setForm(looseForm(input));
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (user && !nicknameTouched.current) setNickname(user.username);
  }, [user]);

  const preview = useMemo(() => previewOf(form), [form]);

  useEffect(() => {
    if (!ready || !preview.req) return;
    window.history.replaceState(null, "", `/custom?${customRequestToQuery(preview.req)}`);
  }, [ready, preview.req]);

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    setElapsed(0);
    const t = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => window.clearInterval(t);
  }, [running, gen?.req]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const caseDef = getCustomCase(form.caseId) ?? CUSTOM_CASES[0];
  const band = CUSTOM_DIFFICULTIES.find((d) => d.id === form.difficulty) ?? CUSTOM_DIFFICULTIES[1];
  const places = caseDef.places.slice(0, form.nodeCount);
  const fieldError = (f: keyof CustomLevelRequest) =>
    preview.error?.field === f && !preview.map ? preview.error.message : null;

  function patch(p: Partial<Form>) {
    setForm((f) => ({ ...f, ...p }));
    setFailure(null);
  }

  async function submit(override?: Form) {
    const current = override ?? form;
    const { req, map, error } = previewOf(current);
    if (!nickname.trim()) {
      setFailure({ message: NICK_MISSING, field: null, retryable: false });
      document.getElementById("custom-nick")?.focus();
      return;
    }
    if (!req || !map) {
      setFailure(error ?? { message: "设置有误", field: null, retryable: true });
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setGen({ req, status: { kind: "running" } });
    setFailure(null);
    const fail = (f: Failure) => {
      setFailure(f);
      setGen({ req, status: { kind: "error", message: f.message, retryable: f.retryable } });
    };
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, custom: req }),
        signal: ac.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (ac.signal.aborted) return;
      if (!res.ok) {
        fail({
          message: data.error ?? "排演出了岔子，再试一次",
          field: data.field ?? null,
          retryable: data.retryable ?? true,
        });
        return;
      }
      if (resume) clearSession();
      saveSession({ code: data.code, token: data.token, playerId: data.playerId });
      setGen({ req, status: { kind: "done" } });
      router.push(`/play/${data.code}`);
    } catch {
      if (ac.signal.aborted) return;
      fail({ message: "网络断了一下，再试一次", field: null, retryable: true });
    }
  }

  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setGen(null);
  }

  function reroll() {
    const next = { ...form, seed: randomSeed() };
    setForm(next);
    setFailure(null);
    return next;
  }

  const nodeOptions = Array.from(
    { length: CUSTOM_NODE_MAX - CUSTOM_NODE_MIN + 1 },
    (_, i) => CUSTOM_NODE_MIN + i
  );
  const ctaBlocked = busy || !ready || !preview.map;

  return (
    <main className="relative min-h-screen overflow-x-clip">
      <div className="pointer-events-none absolute inset-0 bg-atmosphere" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-[-35vh] h-[80vh] w-[120vw] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(212,161,90,0.12),transparent)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-5 pb-48 max-[380px]:px-4 sm:px-8 md:pb-24">
        <nav className="flex items-center justify-between py-3.5 text-[11px] tracking-[0.32em] text-[var(--ink-muted)]">
          <Link
            href="/"
            className="rise -ml-2 inline-flex min-h-11 items-center gap-2 px-2 font-display text-base tracking-[0.2em] text-[var(--ink)] transition-colors hover:text-[var(--amber)]"
            style={{ ["--i" as string]: 0 }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            灯序
          </Link>
          <div className="rise flex items-center gap-4 sm:gap-6" style={{ ["--i" as string]: 1 }}>
            <RulesSheet className="tracking-[0.24em]" />
            <AccountMenu />
          </div>
        </nav>

        <header className="pb-10 pt-6 md:pb-14 md:pt-10">
          <p className="rise text-[11px] tracking-[0.42em] text-[var(--amber)]" style={{ ["--i" as string]: 1 }}>
            自定义关卡
          </p>
          <h1
            className="rise mt-4 font-display text-[clamp(3rem,11vw,6.5rem)] font-black leading-[0.92] tracking-[-0.01em] text-[var(--ink)]"
            style={{ ["--i" as string]: 2 }}
          >
            排一出<span className="text-[var(--amber)]">新戏</span>
          </h1>
          <p
            className="rise mt-5 max-w-xl text-base leading-[1.9] text-[var(--ink-muted)] md:text-lg"
            style={{ ["--i" as string]: 3 }}
          >
            挑案件、定地图、选难度，灯序当场排出一整晚。同样的设置加同一个种子，永远是同一局，发给朋友就能对同一出戏。
          </p>
        </header>

        <div className="grid gap-x-12 gap-y-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Section index="01" title="案件" className="md:col-start-1" style={{ ["--i" as string]: 3 }}>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="案件">
              {CUSTOM_CASES.map((c) => {
                const on = c.id === form.caseId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => patch({ caseId: c.id })}
                    className={cn(
                      "relative rounded-[3px] p-4 text-left transition-[box-shadow,background-color] duration-300",
                      on
                        ? "bg-amber/[0.08] shadow-[inset_0_0_0_1px_var(--amber)]"
                        : "bg-[var(--stage)] shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
                    )}
                  >
                    <span className="block text-[10px] tracking-[0.28em] text-[var(--amber)]">
                      {c.venue} · {c.year}
                    </span>
                    <span className="mt-1.5 block font-display text-2xl text-[var(--ink)]">{c.title}</span>
                    <span className="mt-2 block text-xs leading-relaxed text-[var(--ink-muted)]">{c.blurb}</span>
                    <span className="mt-3 block text-[11px] text-ink-muted/80">
                      {c.people.length} 人 · 最多 {c.places.length} 处地点
                    </span>
                  </button>
                );
              })}
              <div className="flex flex-col justify-center rounded-[3px] border border-dashed border-ink-faint/80 p-4 text-left">
                <span className="text-[10px] tracking-[0.28em] text-ink-muted/70">敬请期待</span>
                <span className="mt-1.5 font-display text-lg text-ink-muted/80">下一桩案子 · 还在排练</span>
              </div>
            </div>
          </Section>

          <Section
            index="02"
            title="地图"
            className="md:col-start-1"
            style={{ ["--i" as string]: 4 }}
            aside={<span className="text-[11px] text-[var(--ink-muted)]">{form.nodeCount} 处地点</span>}
          >
            <fieldset>
              <legend className="mb-3 text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">地点数</legend>
              <div className="grid grid-cols-7 gap-1.5 max-[380px]:gap-0.5" role="radiogroup" aria-label="地点数">
                {nodeOptions.map((n) => {
                  const on = n === form.nodeCount;
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${n} 处地点${n === CUSTOM_NODE_DEFAULT ? "（默认）" : ""}`}
                      onClick={() => patch({ nodeCount: n })}
                      className={cn(
                        "relative flex h-12 items-center justify-center rounded-[3px] font-display text-lg tabular transition-[background-color,box-shadow,color,transform] duration-200 active:scale-[0.96]",
                        on
                          ? "bg-[var(--amber)] text-[var(--curtain)] shadow-[0_8px_24px_-10px_rgba(212,161,90,0.8)]"
                          : "text-[var(--ink-muted)] shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:text-[var(--ink)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
                      )}
                    >
                      {n}
                      {n === CUSTOM_NODE_DEFAULT && (
                        <span
                          aria-hidden
                          className={cn(
                            "absolute bottom-1.5 h-1 w-1 rounded-full",
                            on ? "bg-curtain/60" : "bg-amber/70"
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              {fieldError("nodeCount") && (
                <p role="alert" className="mt-2 text-sm text-[#e07a5f]">{fieldError("nodeCount")}</p>
              )}
            </fieldset>

            <div className="mt-6 divide-y divide-ink-faint/50">
              <div className="pb-4">
                <Switch
                  checked={form.oneWay}
                  onChange={(v) => patch({ oneWay: v })}
                  label="单向通道"
                  hint="有些门只能朝一个方向走，路线更难猜"
                />
                {form.oneWay && (
                  <CountField
                    id="custom-oneway"
                    value={form.oneWayCount}
                    onChange={(v) => patch({ oneWayCount: v })}
                    max={oneWayCountMax(form.nodeCount)}
                    resolved={preview.map?.oneWayCount ?? null}
                    unit="条"
                    invalid={!!fieldError("oneWayCount")}
                  />
                )}
              </div>
              <div className="pt-4">
                <Switch
                  checked={form.stay}
                  onChange={(v) => patch({ stay: v })}
                  label="可停留地点"
                  hint="在这些房间，人可以连着几个时刻不挪窝"
                />
                {form.stay && (
                  <CountField
                    id="custom-stay"
                    value={form.stayCount}
                    onChange={(v) => patch({ stayCount: v })}
                    max={form.nodeCount}
                    resolved={preview.map?.stayCount ?? null}
                    unit="处"
                    invalid={!!fieldError("stayCount")}
                  />
                )}
              </div>
            </div>
            {(fieldError("oneWayCount") || fieldError("stayCount")) && (
              <p role="alert" className="mt-3 text-sm text-[#e07a5f]">
                {fieldError("oneWayCount") ?? fieldError("stayCount")}
              </p>
            )}

            <div className="mt-6 space-y-1">
              <Label htmlFor="custom-seed" className="text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
                种子
              </Label>
              <div className="flex items-end gap-2">
                <Input
                  id="custom-seed"
                  value={form.seed}
                  maxLength={32}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={!!fieldError("seed")}
                  placeholder="任意文字"
                  onChange={(e) => patch({ seed: e.target.value.trim() })}
                  className="h-12 flex-1 rounded-none border-0 border-b border-[var(--ink-faint)] bg-transparent px-0 font-mono text-lg tracking-[0.18em] shadow-none placeholder:font-sans placeholder:tracking-normal placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--amber)] focus-visible:outline-none focus-visible:ring-0 aria-[invalid=true]:border-[#e07a5f]"
                />
                <Button type="button" variant="outline" className="h-11 shrink-0" onClick={reroll}>
                  <Dices className="h-4 w-4" aria-hidden />
                  换一个
                </Button>
              </div>
              <p className={cn("pt-1 text-xs", fieldError("seed") ? "text-[#e07a5f]" : "text-[var(--ink-muted)]")}>
                {fieldError("seed") ?? "同一组设置 + 同一个种子 = 同一局"}
              </p>
            </div>
          </Section>

          <aside
            className="rise md:sticky md:top-6 md:col-start-2 md:row-span-5 md:row-start-1 md:self-start"
            style={{ ["--i" as string]: 5 }}
            aria-label="地图预览"
          >
            <div className="flex items-baseline justify-between gap-3 border-t border-ink-faint/60 pt-6">
              <p className="text-[11px] tracking-[0.32em] text-[var(--amber)]">预览 · {caseDef.venue}</p>
              {preview.map && (
                <p className="text-[11px] text-[var(--ink-muted)] tabular">
                  单向 {preview.map.oneWayCount} · 停留 {preview.map.stayCount}
                </p>
              )}
            </div>
            <div className="relative mt-4">
              {preview.map ? (
                <CustomMapPreview
                  key={`${preview.req?.seed}-${form.nodeCount}`}
                  places={places}
                  matrix={preview.map.matrix}
                  stayIds={preview.map.stayIds}
                  className="animate-fade-up"
                />
              ) : (
                <div className="flex aspect-[1/1.04] min-h-[300px] flex-col items-center justify-center rounded-[3px] border border-dashed border-ink-faint/80 px-8 text-center sm:min-h-0">
                  {!ready ? (
                    <span className="animate-pulse-soft text-sm text-[var(--ink-muted)]">摆布景…</span>
                  ) : (
                    <>
                      <p className="font-display text-xl text-[var(--ink)]">
                        {preview.req ? "这张图排不出来" : "设置还差一点"}
                      </p>
                      <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--ink-muted)]">
                        {preview.error?.message ?? "先填一个种子"}
                      </p>
                      {preview.error?.retryable && (
                        <Button variant="outline" className="mt-5" onClick={reroll}>
                          <Dices className="h-4 w-4" aria-hidden />
                          换个种子
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <MapLegend className="mt-4" />
            <p className="mt-3 text-[11px] leading-relaxed text-ink-muted/75">
              点一间房，看它通向哪里。这是排演起点；若这张图排不出所选难度，会顺着同一种子换一张图，开房后以房间里的地图为准。
            </p>
          </aside>

          <Section
            index="03"
            title="难度"
            className="md:col-start-1"
            style={{ ["--i" as string]: 6 }}
            aside={<span className="text-[11px] text-[var(--ink-muted)]">以最少提问次数衡量</span>}
          >
            <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="难度">
              {CUSTOM_DIFFICULTIES.map((d, i) => {
                const on = d.id === form.difficulty;
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => patch({ difficulty: d.id })}
                    className={cn(
                      "group relative flex flex-col rounded-[3px] p-3.5 text-left transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.98] sm:p-4",
                      on
                        ? "bg-[var(--amber)] text-[var(--curtain)] shadow-[0_12px_30px_-14px_rgba(212,161,90,0.9)]"
                        : "bg-[var(--stage)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--ink-faint)] hover:shadow-[inset_0_0_0_1px_var(--amber-dim)]"
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-display text-xl sm:text-2xl">{d.label}</span>
                      <span className="flex h-3 items-end gap-[3px]" aria-hidden>
                        {Array.from({ length: 4 }, (_, r) => (
                          <span
                            key={r}
                            className={cn(
                              "w-[3px] rounded-[1px]",
                              r <= i
                                ? on
                                  ? "bg-curtain/75"
                                  : "bg-amber/80"
                                : on
                                  ? "bg-curtain/20"
                                  : "bg-[var(--ink-faint)]"
                            )}
                            style={{ height: `${4 + r * 3}px` }}
                          />
                        ))}
                      </span>
                    </span>
                    <span className={cn("mt-2 font-mono text-xs tabular", on ? "text-curtain/80" : "text-[var(--amber)]")}>
                      最少 {d.min}–{d.max} 问
                    </span>
                    <span className={cn("mt-0.5 text-[11px]", on ? "text-curtain/70" : "text-[var(--ink-muted)]")}>
                      {d.compare}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-muted/80">
              和第 1–15 关同一把尺：推理机每次挑最有用的问题，最少要问几次才能锁定唯一答案。排出来的案子一定落在所选区间里。
            </p>
          </Section>

          <Section index="04" title="入座" className="md:col-start-1" style={{ ["--i" as string]: 7 }}>
            <div className="space-y-1">
              <Label htmlFor="custom-nick" className="text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
                你的称呼
              </Label>
              <Input
                id="custom-nick"
                value={nickname}
                maxLength={16}
                placeholder="比如：夜班侦探"
                autoComplete="nickname"
                enterKeyHint="go"
                aria-invalid={failure?.message === NICK_MISSING}
                onKeyDown={(e) => e.key === "Enter" && !ctaBlocked && submit()}
                onChange={(e) => {
                  nicknameTouched.current = true;
                  setNickname(e.target.value);
                  if (failure?.message === NICK_MISSING) setFailure(null);
                }}
                className="h-12 rounded-none border-0 border-b border-[var(--ink-faint)] bg-transparent px-0 text-lg shadow-none transition-colors placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--amber)] focus-visible:outline-none focus-visible:ring-0 aria-[invalid=true]:border-[#e07a5f]"
              />
            </div>
            <p className="mt-4 border-l-2 border-amber/40 pl-3 text-xs leading-relaxed text-[var(--ink-muted)]">
              自定义关卡是练习场：不计入排行榜、首通与战绩。开房后照常凭房间码邀人入座，单人、多人都能玩。
            </p>
          </Section>

          <div
            className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[var(--curtain)] via-curtain/95 to-transparent px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 md:static md:col-start-1 md:bg-none md:p-0"
          >
            {failure && (
              <div
                role="alert"
                className="animate-fade-up mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[3px] bg-[#e07a5f]/10 px-3.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(224,122,95,0.45)]"
              >
                <p className="min-w-0 flex-1 text-sm text-[#f0a48f]">{failure.message}</p>
                {failure.retryable && failure.message !== NICK_MISSING && (
                  <button
                    type="button"
                    onClick={() => submit(reroll())}
                    className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm text-[var(--amber)] underline-offset-4 hover:underline"
                  >
                    <Dices className="h-4 w-4" aria-hidden />
                    换个种子再排
                  </button>
                )}
              </div>
            )}
            <Button
              className={cn("group relative w-full overflow-hidden", busy && "disabled:opacity-100")}
              size="lg"
              disabled={ctaBlocked}
              onClick={() => submit()}
              aria-busy={busy}
            >
              {busy ? (
                <span>排演中…</span>
              ) : (
                <>
                  <span className="truncate">排演并开房 · {caseDef.title} · {band.label}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
            <p className="mt-2 text-center text-xs text-[var(--ink-muted)] md:text-left">
              {resume
                  ? `开房会放弃房间 ${resume.code}`
                  : "不计排行榜与战绩"}
            </p>
          </div>
        </div>
      </div>
      {gen && (
        <GeneratingStage
          caseTitle={getCustomCase(gen.req.caseId)?.title ?? caseDef.title}
          bandLabel={CUSTOM_DIFFICULTIES.find((d) => d.id === gen.req.difficulty)?.label ?? band.label}
          difficulty={gen.req.difficulty}
          nodeCount={gen.req.nodeCount}
          seed={gen.req.seed}
          elapsed={elapsed}
          status={gen.status}
          onCancel={cancel}
          onRetry={() => submit(reroll())}
          onEdit={() => setGen(null)}
        />
      )}
    </main>
  );
}
