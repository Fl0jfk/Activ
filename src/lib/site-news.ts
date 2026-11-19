import type { SiteNewsItem } from "@/lib/site-data-types";

export const ASSOCIATION_GENERAL_NEWS = "";

export const NEWS_KIND_OPTIONS = [
  { value: "tournoi", label: "Tournoi" },
  { value: "presentation", label: "Présentation / nouvelle discipline" },
  { value: "stage", label: "Stage" },
  { value: "portes_ouvertes", label: "Portes ouvertes" },
  { value: "sondage", label: "Sondage" },
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
    ctaLabel: "Lire la suite",
    imageUrl: "",
    galleryImages: [],
  };
}

export function sortNewsByDateDesc(items: SiteNewsItem[]): SiteNewsItem[] {
  return [...items].sort((a, b) => b.date.localeCompare(a.date));
}

/** Une actualité est « archivée » quand sa date remonte à plus d’un mois. */
export function isNewsArchived(date: string, now: Date = new Date()): boolean {
  const threshold = new Date(now);
  threshold.setMonth(threshold.getMonth() - 1);
  threshold.setHours(0, 0, 0, 0);
  const itemDate = new Date(`${date}T23:59:59`);
  return !Number.isNaN(itemDate.getTime()) && itemDate < threshold;
}

/** Date du jour au format AAAA-MM-JJ (heure locale), pour préremplir un champ date. */
export function todayIsoLocal(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function normalizeNewsDisciplineId(disciplineId: string | null | undefined): string | null {
  if (!disciplineId || disciplineId === ASSOCIATION_GENERAL_NEWS) return null;
  return disciplineId;
}

export function truncateNewsDescription(text: string, maxLength = 140): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= maxLength) return cleaned;
  const sliced = cleaned.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");
  const base = lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced;
  return `${base.trim()}…`;
}
