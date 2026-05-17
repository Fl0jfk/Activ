import type { TrialSlot } from "@/lib/club-data";

export type TrialSlotSummary = Pick<
  TrialSlot,
  "id" | "disciplineId" | "title" | "startsAt" | "capacity"
>;

export type { TrialSlotListItem } from "@/lib/trial-slots";
