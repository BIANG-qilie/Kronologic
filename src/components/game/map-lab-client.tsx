"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAP_DEFAULT_NODE_COUNT,
  MAP_NODE_COUNT_MAX,
  MAP_NODE_COUNT_MIN,
  generateRandomMap,
  placeLabelForGeneratedId,
  type GeneratedMap,
} from "@/lib/game/map-generator";
import { StayMark } from "./map-passage";
import { PolygonMap } from "./polygon-map";
import { cn } from "@/lib/utils";

function buildMap(seed: string, nodeCount: number): { map: GeneratedMap | null; error: string | null } {
  try {
    return { map: generateRandomMap(seed, { nodeCount }), error: null };
  } catch (e) {
    return { map: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function MatrixTable({ map }: { map: GeneratedMap }) {
  const labels = map.placeIds.map((id) => placeLabelForGeneratedId(id));
  return (
    <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
      <table
        className="w-full min-w-[280px] border-collapse font-mono text-[11px] sm:text-xs"
        data-testid="map-lab-matrix"
      >
        <caption className="sr-only">邻接矩阵：1 表示有向可达，对角为可停留</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-[1] bg-[var(--stage)] px-2 py-2 text-left font-normal text-[var(--ink-muted)]"
            >
              →
            </th>
            {labels.map((name, j) => (
              <th
                key={map.placeIds[j]}
                scope="col"
                className="px-1.5 py-2 text-center font-normal text-[var(--ink-muted)]"
                title={map.placeIds[j]}
              >
                <span className="block max-w-[2.75rem] truncate sm:max-w-none">{name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {map.matrix.map((row, i) => (
            <tr key={map.placeIds[i]} className="border-t border-ink-faint/25">
              <th
                scope="row"
                className="sticky left-0 z-[1] bg-[var(--stage)] px-2 py-1.5 text-left font-normal text-[var(--ink-muted)]"
                title={map.placeIds[i]}
              >
                <span className="block max-w-[3.5rem] truncate">{labels[i]}</span>
              </th>
              {row.map((cell, j) => {
                const stay = i === j && cell === 1;
                const directed = i !== j && cell === 1 && map.matrix[j][i] !== 1;
                const bi = i !== j && cell === 1 && map.matrix[j][i] === 1;
                return (
                  <td
                    key={`${i}-${j}`}
                    className={cn(
                      "px-1.5 py-1.5 text-center tabular-nums transition-colors duration-200 motion-reduce:transition-none",
                      stay && "bg-amber/18 text-[var(--amber)]",
                      directed && "bg-amber/10 text-[var(--amber)]",
                      bi && "bg-ink-faint/25 text-[var(--ink)]",
                      cell === 0 && "text-ink-faint/55"
                    )}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MapLabPlan({ map }: { map: GeneratedMap }) {
  return (
    <div
      className="animate-fade-up overflow-hidden rounded-[3px] border border-ink-faint/40 bg-[var(--curtain)]/90 p-2 shadow-[inset_0_1px_0_rgba(215,201,168,0.06)] sm:p-4"
      data-testid="map-lab-plan"
    >
      <PolygonMap
        placeIds={map.placeIds}
        matrix={map.matrix}
        stayIds={map.stayIds}
        labelOf={placeLabelForGeneratedId}
        markerPrefix={`map-lab-${map.nodeCount}`}
        className="bg-transparent"
      />
    </div>
  );
}

export function MapLabClient() {
  const [seed, setSeed] = useState("map-lab|demo");
  const [nodeCountInput, setNodeCountInput] = useState(String(MAP_DEFAULT_NODE_COUNT));
  const [appliedSeed, setAppliedSeed] = useState("map-lab|demo");
  const [appliedNodes, setAppliedNodes] = useState(MAP_DEFAULT_NODE_COUNT);
  const [tick, setTick] = useState(0);

  const parsedNodes = Number(nodeCountInput);
  const nodesValid =
    Number.isInteger(parsedNodes) &&
    parsedNodes >= MAP_NODE_COUNT_MIN &&
    parsedNodes <= MAP_NODE_COUNT_MAX;

  const { map, error } = useMemo(
    () => buildMap(appliedSeed, appliedNodes),
    // tick forces re-roll with a salted seed when user clicks refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appliedSeed, appliedNodes, tick]
  );

  const apply = (opts?: { newSeed?: boolean }) => {
    if (!nodesValid) return;
    const nextSeed = opts?.newSeed
      ? `map-lab|${Date.now().toString(36)}`
      : seed.trim() || "map-lab|demo";
    setSeed(nextSeed);
    setAppliedSeed(nextSeed);
    setAppliedNodes(parsedNodes);
    if (opts?.newSeed) setTick((t) => t + 1);
  };

  /** Re-generate when node count changes, keeping current seed. */
  const onNodeCountCommit = () => {
    if (!nodesValid) return;
    setAppliedNodes(parsedNodes);
    setAppliedSeed(seed.trim() || appliedSeed);
  };

  return (
    <div
      className="grain bg-atmosphere relative min-h-dvh overflow-x-hidden text-[var(--ink)]"
      style={{ colorScheme: "dark" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] bg-[radial-gradient(ellipse_70%_55%_at_50%_-8%,rgba(212,161,90,0.16),transparent_60%)]"
      />

      <header className="relative mx-auto flex max-w-5xl items-start justify-between gap-4 px-4 pb-2 pt-6 sm:px-6 sm:pt-8">
        <div className="min-w-0 rise" style={{ ["--i" as string]: 0 }}>
          <p className="font-display text-[11px] tracking-[0.38em] text-[var(--amber)] sm:text-xs">
            灯序 · 内部验收
          </p>
          <h1 className="mt-1.5 font-display text-[1.65rem] leading-tight tracking-wide text-[var(--parchment)] sm:text-4xl">
            随机地图实验室
          </h1>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-[var(--ink-muted)] sm:text-sm">
            种子驱动邻接矩阵：单向门洞与可停留锚点。
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex min-h-11 shrink-0 items-center px-1 text-sm text-[var(--ink-muted)] underline-offset-4 transition-colors hover:text-[var(--amber)] hover:underline"
        >
          回大厅
        </Link>
      </header>

      <main className="relative mx-auto max-w-5xl space-y-7 px-4 pb-20 pt-4 sm:space-y-9 sm:px-6">
        <section
          className="parchment-wash rise rounded-[3px] border border-ink-faint/45 p-4 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.85)] sm:p-5"
          style={{ ["--i" as string]: 1 }}
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_7.5rem_auto] sm:items-end">
            <div className="space-y-2">
              <Label
                htmlFor="map-seed"
                className="text-[11px] tracking-[0.22em] text-[var(--ink-muted)]"
              >
                种子
              </Label>
              <Input
                id="map-seed"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && apply()}
                autoComplete="off"
                spellCheck={false}
                className="map-lab-field h-11 rounded-[3px] border-ink-faint/55 bg-[var(--curtain)] font-mono text-sm text-[var(--ink)] shadow-[inset_0_1px_0_rgba(215,201,168,0.04)] placeholder:text-ink-muted/50"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="map-nodes"
                className="text-[11px] tracking-[0.22em] text-[var(--ink-muted)]"
              >
                节点（{MAP_NODE_COUNT_MIN}–{MAP_NODE_COUNT_MAX}）
              </Label>
              <Input
                id="map-nodes"
                type="number"
                min={MAP_NODE_COUNT_MIN}
                max={MAP_NODE_COUNT_MAX}
                step={1}
                inputMode="numeric"
                value={nodeCountInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setNodeCountInput(v);
                  const n = Number(v);
                  if (
                    Number.isInteger(n) &&
                    n >= MAP_NODE_COUNT_MIN &&
                    n <= MAP_NODE_COUNT_MAX
                  ) {
                    setAppliedNodes(n);
                    setAppliedSeed(seed.trim() || appliedSeed);
                  }
                }}
                onBlur={onNodeCountCommit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onNodeCountCommit();
                }}
                aria-invalid={!nodesValid}
                className={cn(
                  "map-lab-field h-11 rounded-[3px] border-ink-faint/55 bg-[var(--curtain)] font-mono text-sm text-[var(--ink)] shadow-[inset_0_1px_0_rgba(215,201,168,0.04)]",
                  !nodesValid && "border-[var(--mark-conflict)]"
                )}
              />
              {!nodesValid && (
                <p className="text-xs text-[var(--mark-conflict)]">
                  请输入 {MAP_NODE_COUNT_MIN}–{MAP_NODE_COUNT_MAX} 的整数
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 min-[420px]:flex-row sm:flex-col lg:flex-row">
              <Button
                type="button"
                size="lg"
                className="min-h-11 w-full lg:w-auto"
                onClick={() => apply()}
                disabled={!nodesValid}
              >
                按种子生成
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="min-h-11 w-full lg:w-auto"
                onClick={() => apply({ newSeed: true })}
                disabled={!nodesValid}
              >
                换种子
              </Button>
            </div>
          </div>
        </section>

        {error && (
          <p
            role="alert"
            className="animate-fade-up rounded-[3px] border border-[var(--mark-conflict)]/40 bg-[var(--mark-conflict)]/10 px-4 py-3 text-sm text-[var(--parchment)]"
          >
            {error}
          </p>
        )}

        {map && (
          <>
            <section className="space-y-4 rise" style={{ ["--i" as string]: 2 }}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl text-[var(--parchment)] sm:text-2xl">
                    平面图
                  </h2>
                  <p className="mt-1 text-xs text-[var(--ink-muted)] sm:text-sm">
                    节点均布于正多边形顶点；琥珀色箭头为单向，淡墨为双向；锚点可在原位停留。
                  </p>
                </div>
                <dl className="flex flex-wrap gap-2 font-mono text-[11px] text-[var(--ink-muted)] sm:text-xs">
                  {(
                    [
                      ["n", map.nodeCount],
                      ["停留", map.stayIds.length],
                      ["单向", map.directedEdges.length],
                      ["步数", map.steps],
                    ] as const
                  ).map(([k, v]) => (
                    <div
                      key={k}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-[2px] border border-ink-faint/40 bg-[var(--stage)]/70 px-2.5"
                    >
                      <dt className="text-ink-muted/80">{k}</dt>
                      <dd className="tabular text-[var(--amber)]">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <MapLabPlan
                key={`${appliedSeed}|${appliedNodes}|${tick}`}
                map={map}
              />

              <ul className="flex flex-wrap gap-x-5 gap-y-2.5 text-[11px] text-[var(--ink-muted)] sm:text-xs">
                <li className="inline-flex min-h-8 items-center gap-2">
                  <span className="h-[3px] w-7 rounded-full bg-[var(--ink-muted)]" aria-hidden />
                  双向边（淡墨）
                </li>
                <li className="inline-flex min-h-8 items-center gap-2">
                  <span
                    className="relative flex h-5 w-7 items-center justify-center"
                    aria-hidden
                  >
                    <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[var(--amber-dim)]" />
                    <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-[var(--curtain)] ring-1 ring-[var(--amber)]/35">
                      <svg viewBox="0 0 12 12" className="h-3 w-3 text-[var(--amber)]">
                        <path d="M1.5 1.5 L10.5 6 L1.5 10.5 Z" fill="currentColor" />
                      </svg>
                    </span>
                  </span>
                  单向（琥珀箭头）
                </li>
                <li className="inline-flex min-h-8 items-center gap-2">
                  <StayMark label="always" />
                </li>
              </ul>
            </section>

            <section
              className="grid gap-4 rise lg:grid-cols-[1.15fr_0.85fr]"
              style={{ ["--i" as string]: 3 }}
            >
              <div className="rounded-[3px] border border-ink-faint/40 bg-[var(--stage)]/55 p-4 sm:p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-lg text-[var(--parchment)] sm:text-xl">
                    邻接矩阵
                  </h3>
                  <p className="font-mono text-[10px] tracking-wider text-[var(--ink-muted)] sm:text-[11px]">
                    行→列 · 对角=停留
                  </p>
                </div>
                <div className="mt-3 rounded-[2px] border border-ink-faint/30 bg-[var(--curtain)]/40 p-1 sm:p-2">
                  <MatrixTable map={map} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-[3px] border border-ink-faint/40 bg-[var(--stage)]/40 p-4 sm:p-5">
                  <h3 className="font-display text-lg text-[var(--parchment)]">可停留格</h3>
                  <ul className="mt-3 space-y-2 text-sm text-[var(--ink-muted)]">
                    {map.stayIds.length === 0 && <li>无</li>}
                    {map.stayIds.map((id) => (
                      <li
                        key={id}
                        className="flex min-h-8 items-center gap-2 font-mono text-[13px]"
                      >
                        <StayMark compact className="shrink-0" />
                        <span>
                          {id}
                          <span className="text-ink-faint"> · </span>
                          {placeLabelForGeneratedId(id)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[3px] border border-ink-faint/40 bg-[var(--stage)]/40 p-4 sm:p-5">
                  <h3 className="font-display text-lg text-[var(--parchment)]">单向边</h3>
                  <ul className="mt-3 max-h-48 space-y-2 overflow-auto overscroll-contain text-sm text-[var(--ink-muted)]">
                    {map.directedEdges.length === 0 && <li>无</li>}
                    {map.directedEdges.map((e) => (
                      <li
                        key={`${e.from}->${e.to}`}
                        className="flex min-h-8 items-center gap-2 font-mono text-[13px]"
                      >
                        <svg
                          viewBox="0 0 12 12"
                          className="h-3.5 w-3.5 shrink-0 text-[var(--amber)]"
                          aria-hidden
                        >
                          <path d="M1.5 1.5 L10.5 6 L1.5 10.5 Z" fill="currentColor" />
                        </svg>
                        <span>
                          {placeLabelForGeneratedId(e.from)}
                          <span className="mx-1 text-[var(--amber-dim)]">→</span>
                          {placeLabelForGeneratedId(e.to)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
