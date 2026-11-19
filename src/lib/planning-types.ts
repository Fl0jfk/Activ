import type { WeekScheduleEntry } from "@/lib/schedule-week";

export type PlanningDiscipline = {
  id: string;
  name: string;
  active: boolean;
};

export type PlanningWeek = {
  /** Lundi de la semaine (YYYY-MM-DD). */
  startIso: string;
  label: string;
  entries: WeekScheduleEntry[];
};
