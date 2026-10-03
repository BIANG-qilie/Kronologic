type Bucket = { hits: number[] };

declare global {
  // eslint-disable-next-line no-var
  var __kronoRate: Map<string, Bucket> | undefined;
}

function buckets() {
  globalThis.__kronoRate ??= new Map();
  return globalThis.__kronoRate;
}

/** Sliding window, in-memory: fine for a single Railway replica. */
export function isLimited(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const b = buckets().get(key);
  if (!b) return false;
  b.hits = b.hits.filter((t) => now - t < windowMs);
  return b.hits.length >= limit;
}

export function recordHit(key: string, now = Date.now()) {
  const map = buckets();
  const b = map.get(key) ?? { hits: [] };
  b.hits.push(now);
  map.set(key, b);
  if (map.size > 5000) {
    for (const [k, v] of map) {
      if (!v.hits.length || now - v.hits[v.hits.length - 1] > 60 * 60 * 1000) map.delete(k);
    }
  }
}

export function clearHits(key: string) {
  buckets().delete(key);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}
