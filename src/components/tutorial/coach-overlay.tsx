"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 6;
const GAP = 12;

function visibleAnchor(key: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tutorial="${key}"]`);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** Height of fixed bars at the bottom (e.g. the phone ask bar) the card must stay above. */
function bottomInset(): number {
  let inset = 0;
  for (const el of document.querySelectorAll<HTMLElement>("[data-coach-avoid]")) {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.bottom >= window.innerHeight - 1) inset = Math.max(inset, window.innerHeight - r.top);
  }
  return inset;
}

/** Bottom edge of headers that stay usable above the mask (e.g. 规则, 离开). */
function topInset(): number {
  let inset = 0;
  for (const el of document.querySelectorAll<HTMLElement>("[data-coach-top]")) {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.top <= 1) inset = Math.max(inset, r.bottom);
  }
  return inset;
}

/** Top edge of the highest open Radix dialog or popover, or null when none is open. */
function openLayerTop(): number | null {
  let top: number | null = null;
  for (const el of document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"]')) {
    const r = el.getBoundingClientRect();
    if (r.height > 0) top = Math.min(top ?? Infinity, r.top);
  }
  return top;
}

function sameRect(a: Rect | null, b: Rect | null) {
  return a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);
}

/**
 * Dims everything except one `data-tutorial` anchor and keeps a short card on
 * screen. Clicks outside the anchor are swallowed by the mask. Dialogs and
 * popovers (z-50) sit above the mask so pickers opened from the anchor work.
 */
export function CoachOverlay({
  target,
  prefer = "auto",
  card,
  center,
}: {
  /** `data-tutorial` key to cut out; omit to dim the whole page. */
  target?: string;
  prefer?: "auto" | "top" | "bottom";
  card: ReactNode;
  /** Centre the card (opening case file). */
  center?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [inset, setInset] = useState(0);
  const [top, setTop] = useState(0);
  const [layerTop, setLayerTop] = useState<number | null>(null);
  const [vh, setVh] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!target) return;
    let tries = 0;
    const id = window.setInterval(() => {
      const el = visibleAnchor(target);
      tries++;
      if (el || tries > 20) {
        window.clearInterval(id);
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [target]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = target ? visibleAnchor(target) : null;
      const r = el?.getBoundingClientRect();
      const next = r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      setRect((prev) => (sameRect(prev, next) ? prev : next));
      setInset(bottomInset());
      setTop(topInset());
      setLayerTop(openLayerTop());
      setVh(window.innerHeight);
      if (cardRef.current) setCardH(cardRef.current.offsetHeight);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  if (!mounted) return null;

  const sheet = layerTop != null;

  const hole = rect && !sheet
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  let place: "top" | "bottom" = "bottom";
  if (sheet) place = "top";
  else if (hole) {
    const above = hole.top - top - GAP;
    const below = vh - inset - (hole.top + hole.height) - GAP;
    const fitsAbove = above >= cardH + GAP;
    const fitsBelow = below >= cardH + GAP;
    if (prefer === "top" && fitsAbove) place = "top";
    else if (prefer === "bottom" && fitsBelow) place = "bottom";
    else if (fitsBelow !== fitsAbove) place = fitsBelow ? "bottom" : "top";
    else place = below >= above ? "bottom" : "top";
  }

  const cardTop = center ? (vh - cardH) / 2 : place === "top" ? top + GAP : vh - inset - GAP - cardH;
  const covered = layerTop != null && cardTop + cardH > layerTop - 4;

  const mask = "fixed z-[45] bg-black/70 transition-[top,left,width,height] duration-200 motion-reduce:transition-none";

  return createPortal(
    <>
      {!sheet &&
        (hole ? (
          <>
            <div className={mask} style={{ top: 0, left: 0, right: 0, height: Math.max(0, hole.top) }} />
            <div className={mask} style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }} />
            <div className={mask} style={{ top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height }} />
            <div className={mask} style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height }} />
            <div
              aria-hidden
              className="pointer-events-none fixed z-[46] rounded-[6px] shadow-[0_0_0_2px_var(--amber),0_0_28px_4px_rgba(212,161,90,0.45)] motion-safe:animate-pulse-soft"
              style={hole}
            />
          </>
        ) : (
          <div className={cn(mask, "inset-0")} />
        ))}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-live="polite"
        className={cn(
          "fixed inset-x-3 z-[60] mx-auto max-w-md transition-opacity duration-150",
          center && "top-1/2 -translate-y-1/2",
          covered && "pointer-events-none opacity-0"
        )}
        aria-hidden={covered || undefined}
        style={
          center
            ? undefined
            : place === "bottom"
              ? { bottom: `max(${inset + GAP}px, env(safe-area-inset-bottom))` }
              : { top: top + GAP }
        }
      >
        {card}
      </div>
    </>,
    document.body
  );
}
