"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SourceGlyph } from "./source-glyph";

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "提问",
    body: (
      <>
        选一个房间，再配一个时间或一个人物。
        <br />
        <b className="font-medium text-[var(--ink)]">房间 × 时间</b>：绿窗公布这一刻房里几人，白窗私下告诉你其中一位。
        <br />
        <b className="font-medium text-[var(--ink)]">房间 × 人物</b>：绿窗公布此人整晚来过几次，白窗私下告诉你其中一次的时间。
      </>
    ),
  },
  {
    title: "绿窗与白窗",
    body: (
      <>
        <span className="text-[var(--green-win)]">绿窗</span>亮给全场，
        <span className="text-[#f3e6c8]">白窗</span>只亮给提问的人。白窗没有内容时不计次，提问者马上再问一次。
      </>
    ),
  },
  {
    title: "移动",
    body: "每到下一个时间，每个人都必须走进一间相邻的房间：不能原地不动，也不能隔着房间跳过去。门在地图上画成连线。",
  },
  {
    title: "记笔记",
    body: (
      <span className="block space-y-1.5">
        {(
          [
            ["public", "圆圈", "绿窗线索"],
            ["private", "方框", "白窗线索"],
            ["inference", "菱形", "你自己的推理"],
          ] as const
        ).map(([s, shape, meaning]) => (
          <span key={s} className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-[var(--parchment)]">
              <span className="relative inline-block h-4 w-4">
                <SourceGlyph sources={[s]} />
              </span>
            </span>
            {shape}：{meaning}
          </span>
        ))}
        <span className="block">点开一格，点一下人物标「在」，再点一下标「不在」。已有线索的格子不能再改。</span>
      </span>
    ),
  },
  {
    title: "交卷",
    body: "答出本案要问的谁、何时、何地。只有一次机会，答错出局；有人交卷后，其余人还有 12 秒同时交卷。",
  },
];

/** Header button with the rules on one card; available in every level. */
export function RulesSheet({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-11 items-center gap-1.5 px-2 text-xs tracking-[0.2em] text-[var(--ink-muted)] transition-colors hover:text-[var(--amber)]",
            className
          )}
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          规则
        </button>
      </DialogTrigger>
      <DialogContent
        sheet
        className="overflow-y-auto overscroll-contain border-0 bg-[var(--curtain)] px-5 pt-7 text-[var(--ink)] shadow-[0_0_0_1px_var(--ink-faint),0_40px_120px_-30px_rgba(0,0,0,0.9)] sm:max-h-[92vh] sm:max-w-xl sm:p-8"
      >
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-3xl">规则卡</DialogTitle>
          <DialogDescription className="text-[var(--ink-muted)]">一桩发生在几个时刻里的案子，抢先拼出案发那一刻。</DialogDescription>
        </DialogHeader>
        <dl className="space-y-5 py-1">
          {SECTIONS.map((s, i) => (
            <div key={s.title} className="grid grid-cols-[2rem_1fr] gap-x-2">
              <dt className="col-span-2 mb-1 flex items-baseline gap-3">
                <span className="w-6 font-display text-sm italic text-[var(--amber)]">0{i + 1}</span>
                <span className="font-display text-lg">{s.title}</span>
              </dt>
              <dd className="col-start-2 text-sm leading-[1.85] text-[var(--ink-muted)]">{s.body}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-ink-faint/60 pt-4 text-sm text-[var(--ink-muted)]">
          第一次玩？
          <Link href="/tutorial" className="ml-1 text-[var(--amber)] underline-offset-4 hover:underline">
            走一遍序幕（约 3 分钟）
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
