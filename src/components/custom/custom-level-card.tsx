"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import type { ScenarioPublic } from "@/lib/game/types";
import { customRequestToQuery, getCustomDifficulty } from "@/lib/game/custom-level";
import { getCustomCase } from "@/lib/game/custom-cases";
import { cn } from "@/lib/utils";
import { CustomMapPreview, MapLegend } from "./custom-map-preview";

/** Lobby block for a custom room: the settings, the map and a share link. */
export function CustomLevelCard({
  scenario,
  className,
}: {
  scenario: ScenarioPublic;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const custom = scenario.custom;
  if (!custom) return null;
  const req = custom.request;
  const band = getCustomDifficulty(req.difficulty);
  const caseDef = getCustomCase(req.caseId);
  const rolled = (fixed: number | null) => (fixed == null ? " · 随机" : "");

  const facts: [string, string][] = [
    ["案件", caseDef?.title ?? scenario.title],
    ["地点", `${req.nodeCount} 处`],
    ["单向", req.oneWay ? `${custom.oneWayCount} 条${rolled(req.oneWayCount)}` : "关"],
    ["停留", req.stay ? `${custom.stayCount} 处${rolled(req.stayCount)}` : "关"],
    ["难度", band ? `${band.label} · 最少 ${scenario.greedyMin ?? band.min} 问` : req.difficulty],
    ["种子", req.seed],
  ];

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/custom?${customRequestToQuery(req)}`
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the seed is on screen */
    }
  }

  return (
    <div className={cn("border-l border-amber/40 pl-5", className)}>
      <p className="text-[11px] tracking-[0.32em] text-[var(--amber)]">自定义关卡</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[10px] tracking-[0.24em] text-ink-muted/80">{k}</dt>
            <dd
              className={cn(
                "mt-0.5 truncate text-sm text-[var(--ink)]",
                k === "种子" && "font-mono tracking-[0.14em]"
              )}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <CustomMapPreview
        places={scenario.places}
        matrix={custom.matrix}
        stayIds={custom.stayIds}
        className="mt-6 max-w-md"
      />
      <MapLegend className="mt-3" />
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={copyLink}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-[3px] px-3 text-sm transition-colors",
            copied
              ? "text-[var(--green-win)] shadow-[inset_0_0_0_1px_rgba(111,191,138,0.5)]"
              : "text-[var(--amber)] shadow-[inset_0_0_0_1px_var(--amber-dim)] hover:bg-amber/10"
          )}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
          {copied ? "已复制" : "复制关卡链接"}
        </button>
        <p className="text-[11px] text-ink-muted/80">自定义关卡不计入排行榜、首通与战绩。</p>
      </div>
    </div>
  );
}
