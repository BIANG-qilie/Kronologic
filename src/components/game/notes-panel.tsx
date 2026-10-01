"use client";

/**
 * Notes UI lives on the desk timeline (`DeskTimeline`).
 * This module re-exports the v2 notes JSON helpers used for persistence.
 */
export {
  parseNotes,
  serializeNotes,
  emptyNotesV2,
  type NotesPayloadV2,
  type NotesPayloadV2 as NotesPayload,
  type NotesInference,
} from "@/lib/game/notes-format";

export { DeskTimeline as NotesPanel } from "@/components/game/desk-timeline";
