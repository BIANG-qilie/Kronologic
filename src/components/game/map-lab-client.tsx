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
  layoutForNodeCount,
  placeLabelForGeneratedId,
  type GeneratedMap,
} from "@/lib/game/map-generator";
import { FloorPlan, planAspect } from "./floor-plan";
import { MapPassage, StayMark } from "./map-passage";
import { edgeKindBetween } from "@/lib/game/map-generator";
import { cn } from "@/lib/utils";

function buildMap(seed: string, nodeCount: number): { map: GeneratedMap | null; error: string | null } {
  try {
    return { map: generateRandomMap(seed, { nodeCount }), error: null };
  } catch (e) {
    return { map: null, error: e instanceof Error ? e.message : String(e) };
  }
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

  const layout = useMemo(
    () => (map ? layoutForNodeCount(map.placeIds) : []),
    [map]
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
    <div className="grain min-h-dvh bg-[var(--curtain)] text-[var(--ink)]">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <div>
          <p className="text-[11px] tracking-[0.32em] text-[var(--amber)]">内部验收</p>
          <h1 className="font-display text-2xl sm:text-3xl">随机地图实验室</h1>
        </div>
        <Link
          href="/"
          className="text-sm text-[var(--ink-muted)] underline-offset-4 hover:text-[var(--amber)] hover:underline"
        >
          回大厅
        </Link>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 pb-16 sm:px-6">
        <section className="grid gap-4 rounded-[3px] border border-ink-faint/50 bg-[var(--stage)]/60 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end sm:p-5">
          <div className="space-y-2">
            <Label htmlFor="map-seed" className="text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
              种子
            </Label>
            <Input
              id="map-seed"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              className="border-ink-faint/60 bg-[var(--curtain)] font-mono text-sm"
            />
          </div>

          <div className="space-y-2 sm:w-36">
            <Label htmlFor="map-nodes" className="text-[11px] tracking-[0.2em] text-[var(--ink-muted)]">
              节点数（{MAP_NODE_COUNT_MIN}–{MAP_NODE_COUNT_MAX}）
            </Label>
            <Input
              id="map-nodes"
              type="number"
              min={MAP_NODE_COUNT_MIN}
              max={MAP_NODE_COUNT_MAX}
              step={1}
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
                "border-ink-faint/60 bg-[var(--curtain)] font-mono text-sm",
                !nodesValid && "border-[var(--mark-conflict)]"
              )}
            />
            {!nodesValid && (
              <p className="text-xs text-[var(--mark-conflict)]">
                请输入 {MAP_NODE_COUNT_MIN}–{MAP_NODE_COUNT_MAX} 的整数
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => apply()} disabled={!nodesValid}>
              按种子生成
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => apply({ newSeed: true })}
              disabled={!nodesValid}
            >
              换种子
            </Button>
          </div>
        </section>

        {error && (
          <p className="rounded-[3px] border border-[var(--mark-conflict)]/40 bg-[var(--mark-conflict)]/10 px-4 py-3 text-sm text-[var(--parchment)]">
            {error}
          </p>
        )}

        {map && (
          <>
            <section className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl">平面图</h2>
                <p className="font-mono text-xs text-[var(--ink-muted)]">
                  n={map.nodeCount} · 停留 {map.stayIds.length} · 单向 {map.directedEdges.length} · 步数校验{" "}
                  {map.steps}
                </p>
              </div>

              <div
                className="relative w-full rounded-[3px] border border-ink-faint/40 bg-[var(--curtain)] p-3 sm:p-4"
                style={{ aspectRatio: planAspect(layout) }}
                data-testid="map-lab-plan"
              >
                <FloorPlan
                  layout={layout}
                  gap="12px"
                  className="absolute inset-3 grid sm:inset-4"
                  room={(id, i) => {
                    const stay = map.stayIds.includes(id);
                    return (
                      <div
                        className="relative flex flex-col justify-between rounded-[3px] bg-[var(--stage)] p-2.5 shadow-[inset_0_0_0_1px_var(--ink-faint)] sm:p-3.5"
                        data-place={id}
                        data-stay={stay ? "1" : "0"}
                      >
                        <span className="flex items-start justify-between gap-1">
                          <span className="font-display text-xs italic text-[var(--ink-faint)]">
                            0{i + 1}
                          </span>
                          {stay && <StayMark />}
                        </span>
                        <span className="font-display text-base leading-none text-[var(--ink)] sm:text-xl">
                          {placeLabelForGeneratedId(id)}
                        </span>
                      </div>
                    );
                  }}
                  door={(a, b, dir) => (
                    <MapPassage
                      kind={edgeKindBetween(map.matrix, map.placeIds, a, b)}
                      dir={dir}
                      tone="stage"
                    />
                  )}
                />
              </div>

              <div className="flex flex-wrap gap-4 text-[11px] text-[var(--ink-muted)]">
                <span className="inline-flex items-center gap-2">
                  <span className="h-[3px] w-6 rounded-full bg-[var(--ink-faint)]" />
                  双向通道
                </span>
                <span className="inline-flex items-center gap-2">
                  <svg viewBox="0 0 12 12" className="h-3.5 w-3.5 text-[var(--ink-faint)]" aria-hidden>
                    <path
                      d="M2 2 L10 6 L2 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  单向通道（箭头指向可走方向）
                </span>
                <span className="inline-flex items-center gap-2">
                  <StayMark />
                </span>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[3px] border border-ink-faint/40 bg-[var(--stage)]/40 p-4">
                <h3 className="font-display text-lg">可停留格</h3>
                <ul className="mt-2 space-y-1 text-sm text-[var(--ink-muted)]">
                  {map.stayIds.length === 0 && <li>无</li>}
                  {map.stayIds.map((id) => (
                    <li key={id} className="font-mono">
                      {id} · {placeLabelForGeneratedId(id)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[3px] border border-ink-faint/40 bg-[var(--stage)]/40 p-4">
                <h3 className="font-display text-lg">单向边</h3>
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-sm text-[var(--ink-muted)]">
                  {map.directedEdges.length === 0 && <li>无</li>}
                  {map.directedEdges.map((e) => (
                    <li key={`${e.from}->${e.to}`} className="font-mono">
                      {placeLabelForGeneratedId(e.from)} → {placeLabelForGeneratedId(e.to)}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
