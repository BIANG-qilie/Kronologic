import { migrateClearedTier, type LevelInfo } from "./levels";

const LEVELS_KEY = "lampxu-night-tea-cleared-levels";
const LEGACY_TIER_KEY = "lampxu-night-tea-cleared-tier";

export function loadClearedLevels(levels: readonly LevelInfo[]): Set<number> {
  try {
    const raw = localStorage.getItem(LEVELS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.filter((n) => Number.isInteger(n)));
    }
    const legacy = Number(localStorage.getItem(LEGACY_TIER_KEY) ?? "0");
    const migrated = migrateClearedTier(levels, legacy);
    if (migrated.length) localStorage.setItem(LEVELS_KEY, JSON.stringify(migrated));
    return new Set(migrated);
  } catch {
    return new Set();
  }
}

export function markLevelCleared(level: number) {
  try {
    const raw = localStorage.getItem(LEVELS_KEY);
    const arr: number[] = raw ? JSON.parse(raw) : [];
    if (!arr.includes(level)) arr.push(level);
    localStorage.setItem(LEVELS_KEY, JSON.stringify(arr.sort((a, b) => a - b)));
  } catch {
    /* private mode */
  }
}
