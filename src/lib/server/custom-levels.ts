import { NextResponse } from "next/server";
import {
  CustomLevelAborted,
  CustomLevelError,
  customLevelId,
  generateCustomLevelAsync,
  type GenerateCustomOptions,
} from "@/lib/game/custom-level";
import type { CustomLevelRequest, ScenarioBundle } from "@/lib/game/types";

const CACHE_LIMIT = 64;

/** One search shared by every caller asking for the same level. */
type Job = {
  promise: Promise<ScenarioBundle>;
  controller: AbortController;
  waiters: number;
};

declare global {
  var __lampCustomLevels: Map<string, ScenarioBundle> | undefined;
  var __lampCustomJobs: Map<string, Job> | undefined;
}

function cache(): Map<string, ScenarioBundle> {
  globalThis.__lampCustomLevels ??= new Map();
  return globalThis.__lampCustomLevels;
}

function jobs(): Map<string, Job> {
  globalThis.__lampCustomJobs ??= new Map();
  return globalThis.__lampCustomJobs;
}

function remember(bundle: ScenarioBundle) {
  const c = cache();
  c.delete(bundle.public.id);
  c.set(bundle.public.id, bundle);
  while (c.size > CACHE_LIMIT) c.delete(c.keys().next().value!);
}

function startJob(id: string, req: CustomLevelRequest, opts: Omit<GenerateCustomOptions, "signal">): Job {
  const controller = new AbortController();
  const job: Job = {
    controller,
    waiters: 0,
    promise: generateCustomLevelAsync(req, { ...opts, signal: controller.signal })
      .then(({ bundle }) => {
        if (controller.signal.aborted) throw new CustomLevelAborted();
        remember(bundle);
        return bundle;
      })
      .finally(() => {
        if (jobs().get(id) === job) jobs().delete(id);
      }),
  };
  // Nobody may be listening once every waiter has left.
  job.promise.catch(() => {});
  jobs().set(id, job);
  return job;
}

/**
 * Generated level for a request. Deterministic, so a cache miss (restart,
 * eviction) just regenerates the same level; concurrent asks share one search.
 * `signal` lets a caller leave; the search itself stops only once every
 * caller waiting on it has left, and an abandoned search never fills the cache.
 */
export function ensureCustomLevel(
  req: CustomLevelRequest,
  signal?: AbortSignal,
  opts: Omit<GenerateCustomOptions, "signal"> = {}
): Promise<ScenarioBundle> {
  const id = customLevelId(req);
  const hit = cache().get(id);
  if (hit) return Promise.resolve(hit);
  if (signal?.aborted) return Promise.reject(new CustomLevelAborted());

  const job = jobs().get(id) ?? startJob(id, req, opts);
  job.waiters++;

  return new Promise<ScenarioBundle>((resolve, reject) => {
    let done = false;
    const leave = () => {
      if (done) return;
      done = true;
      job.waiters--;
      if (job.waiters === 0) {
        job.controller.abort();
        if (jobs().get(id) === job) jobs().delete(id);
      }
      reject(new CustomLevelAborted());
    };
    signal?.addEventListener("abort", leave, { once: true });
    job.promise.then(
      (bundle) => {
        if (done) return;
        done = true;
        job.waiters--;
        signal?.removeEventListener("abort", leave);
        resolve(bundle);
      },
      (e) => {
        if (done) return;
        done = true;
        job.waiters--;
        signal?.removeEventListener("abort", leave);
        reject(e);
      }
    );
  });
}

/** For tests and diagnostics. */
export function customLevelCacheHas(id: string): boolean {
  return cache().has(id);
}
export function customLevelJobCount(): number {
  return jobs().size;
}

/** JSON error for the custom-level routes: field + whether a retry could help. */
export function customLevelErrorResponse(e: unknown) {
  if (e instanceof CustomLevelAborted) {
    // The client is gone; 499 mirrors the nginx "client closed request" code.
    return NextResponse.json({ error: e.message, field: null, retryable: false }, { status: 499 });
  }
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
