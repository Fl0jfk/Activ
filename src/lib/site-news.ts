import type { SiteNewsItem } from "@/lib/site-data-types";

export const ASSOCIATION_GENERAL_NEWS = "";

export const NEWS_KIND_OPTIONS = [
  { value: "tournoi", label: "Tournoi" },
  { value: "presentation", label: "Présentation / nouvelle discipline" },
  { value: "stage", label: "Stage" },
  { value: "portes_ouvertes", label: "Portes ouvertes" },
  { value: "evenement", label: "Événement association" },
  { value: "autre", label: "Autre" },
] as const;

export type NewsKind = (typeof NEWS_KIND_OPTIONS)[number]["value"];

export function newsKindLabel(kind: string): string {
  return NEWS_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? "Événement";
}

export function resolveNewsDisciplineLabel(
  disciplineId: string | null,
  disciplines: { id: string; name: string }[]
): string {
  if (!disciplineId) return "Association";
  return disciplines.find((discipline) => discipline.id === disciplineId)?.name ?? "Association";
}

export function formatNewsDate(date: string): string {
  if (!date) return "";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export type EventScheduleFields = Pick<SiteNewsItem, "date" | "startTime" | "endTime">;

export function formatEventSchedule(event: EventScheduleFields): string {
  const datePart = formatNewsDate(event.date);
  const timeParts: string[] = [];
  if (event.startTime) {
    timeParts.push(event.endTime ? `${event.startTime} – ${event.endTime}` : `à ${event.startTime}`);
  }
  const timePart = timeParts.join(" ");
  if (datePart && timePart) return `${datePart} · ${timePart}`;
  return datePart || timePart || "";
}

export function emptySiteNewsItem(): SiteNewsItem {
  return {
    id: "",
    title: "",
    date: "",
    description: "",
    kind: "evenement",
    location: "",
    startTime: "",
    endTime: "",
    disciplineId: null,
  };
}

export function sortNewsByDateDesc(items: SiteNewsItem[]): SiteNewsItem[] {
  return [...items].sort((a, b) => b.date.localeCompare(a.date));
}

export function normalizeNewsDisciplineId(disciplineId: string | null | undefined): string | null {
  if (!disciplineId || disciplineId === ASSOCIATION_GENERAL_NEWS) return null;
  return disciplineId;
}
