"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomPublicView } from "@/lib/game/types";

const STORAGE_KEY = "lampxu-session";

export interface Session {
  code: string;
  token: string;
  playerId: string;
}

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(s: Session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useRoomStream(code: string | null, token: string | null) {
  const [view, setView] = useState<RoomPublicView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const applyView = useCallback((v: RoomPublicView) => {
    setView(v);
    setError(null);
  }, []);

  useEffect(() => {
    if (!code || !token) return;

    let cancelled = false;
    const url = `/api/rooms/${code}/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      if (!cancelled) setConnected(true);
    };
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.view) applyView(data.view);
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      if (!cancelled) {
        setConnected(false);
      }
    };

    return () => {
      cancelled = true;
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [code, token, applyView]);

  return { view, setView: applyView, error, setError, connected };
}

export async function apiJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data as T;
}
