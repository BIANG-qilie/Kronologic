import { NextResponse } from "next/server";
import {
  CustomLevelError,
  customLevelId,
  generateCustomLevelAsync,
  type CustomLevelResult,
} from "@/lib/game/custom-level";
import type { CustomLevelRequest, ScenarioBundle } from "@/lib/game/types";

const CACHE_LIMIT = 64;

declare global {
  // eslint-disable-next-line no-var
  var __lampCustomLevels: Map<string, ScenarioBundle> | undefined;
  // eslint-disable-next-line no-var
  var __lampCustomInflight: Map<string, Promise<CustomLevelResult>> | undefined;
}

function cache(): Map<string, ScenarioBundle> {
  globalThis.__lampCustomLevels ??= new Map();
  return globalThis.__lampCustomLevels;
}

function inflight(): Map<string, Promise<CustomLevelResult>> {
  globalThis.__lampCustomInflight ??= new Map();
  return globalThis.__lampCustomInflight;
}

function remember(bundle: ScenarioBundle) {
  const c = cache();
  c.delete(bundle.public.id);
  c.set(bundle.public.id, bundle);
  while (c.size > CACHE_LIMIT) c.delete(c.keys().next().value!);
}

/**
 * Generated level for a request. Deterministic, so a cache miss (restart,
 * eviction) just regenerates the same level; concurrent asks share one search.
 */
export async function ensureCustomLevel(req: CustomLevelRequest): Promise<ScenarioBundle> {
  const id = customLevelId(req);
  const hit = cache().get(id);
  if (hit) return hit;

  let job = inflight().get(id);
  if (!job) {
    job = generateCustomLevelAsync(req);
    inflight().set(id, job);
  }
  try {
    const { bundle } = await job;
    remember(bundle);
    return bundle;
  } finally {
    inflight().delete(id);
  }
}

/** JSON error for the custom-level routes: field + whether a retry could help. */
export function customLevelErrorResponse(e: unknown) {
  if (e instanceof CustomLevelError) {
    return NextResponse.json(
      { error: e.message, field: e.field ?? null, retryable: e.retryable },
      { status: 422 }
    );
  }
  console.error("custom level: unexpected failure", e);
  return NextResponse.json(
    { error: "排演出了岔子，换个种子再试一次", field: null, retryable: true },
    { status: 500 }
  );
}
