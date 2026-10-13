import type { ScenarioPublic } from "./types";

/** Eyebrow copy matching the lobby: prologue vs tonight's case. */
export function caseBriefEyebrow(
  scenario: Pick<ScenarioPublic, "id" | "level">,
): string {
  if (scenario.level === 0 || scenario.id.startsWith("prologue")) {
    return "序幕的案子";
  }
  return "今晚的案子";
}

/** One-line list of what the case asks the player to find. */
export function caseBriefObjectives(
  scenario: Pick<ScenarioPublic, "winQuestions">,
): string[] {
  return scenario.winQuestions.map((q) => q.prompt);
}
