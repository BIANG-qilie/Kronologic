"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { MeResponse, PublicUser } from "@/lib/account/types";

export type AccountState =
  | { status: "loading" }
  | ({ status: "ready" } & MeResponse);

const LOADING: AccountState = { status: "loading" };
let state: AccountState = LOADING;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: AccountState) {
  state = next;
  for (const fn of listeners) fn();
}

export function refreshAccount(): Promise<void> {
  inflight ??= fetch("/api/auth/me", { cache: "no-store" })
    .then((r) => r.json() as Promise<MeResponse>)
    .then((me) => set({ status: "ready", ...me }))
    .catch(() => set({ status: "ready", enabled: false, user: null, clearedLevels: [] }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "网络不稳，请重试");
  return data as T;
}

export async function signIn(kind: "login" | "register", username: string, password: string) {
  const { user } = await post<{ user: PublicUser }>(`/api/auth/${kind}`, { username, password });
  await refreshAccount();
  return user;
}

export async function signOut() {
  await post("/api/auth/logout");
  await refreshAccount();
}

export function useAccount(): AccountState {
  const snap = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
    () => LOADING
  );
  useEffect(() => {
    if (state.status === "loading") void refreshAccount();
  }, []);
  return snap;
}
