import prologueJson from "@/data/tutorial/prologue.json";
import type { ScenarioBundle } from "./types";
import { assertValidBundle } from "./validate";

/**
 * 第 0 关 · 序幕. Lives outside the case bank: it never appears in the level
 * grid data, the solver calibration, or account level records.
 */
export const PROLOGUE: ScenarioBundle = prologueJson as ScenarioBundle;

assertValidBundle(PROLOGUE);

export const PROLOGUE_LEVEL = 0;
