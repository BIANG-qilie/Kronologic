"use client";

import { useSyncExternalStore } from "react";

export function useMedia(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue
  );
}

/** Below Tailwind's `sm` breakpoint. */
export function usePhone(): boolean {
  return useMedia("(max-width: 639px)");
}
