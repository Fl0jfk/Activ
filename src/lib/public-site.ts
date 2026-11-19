import { DAY_LABELS } from "@/lib/schedule-constants";
import {
  addDaysToIsoDate,
  buildWeekSchedule,
  getCurrentWeekRangeParis,
  parseScheduleTimeToMinutes,
  todayParisIso,
  type WeekScheduleEntry,
} from "@/lib/schedule-week";
import type { AssociationData, ScheduleSlot, SiteNewsItem } from "@/lib/site-data-types";

function formatWeekShortLabel(mondayIso: string, sundayIso: string): string {
  const toDate = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12));
  };
  const monday = toDate(mondayIso);
  const sunday = toDate(sundayIso);
  const month = (date: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", month: "long" }).format(date);
  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth();
  return sameMonth
    ? `${monday.getUTCDate()} – ${sunday.getUTCDate()} ${month(sunday)}`
    : `${monday.getUTCDate()} ${month(monday)} – ${sunday.getUTCDate()} ${month(sunday)}`;
}

/** Semaines affichables sur le site (la semaine de référence puis les suivantes). */
export function buildPlannerWeeks(
  data: AssociationData,
  referenceDate: Date,
  count = 4,
): { startIso: string; label: string; entries: WeekScheduleEntry[] }[] {
  const { monday } = getCurrentWeekRangeParis(referenceDate);
  return Array.from({ length: count }, (_, index) => {
    const startIso = addDaysToIsoDate(monday, index * 7);
    const reference = index === 0 ? referenceDate : new Date(`${startIso}T12:00:00Z`);
    return {
      startIso,
      label: formatWeekShortLabel(startIso, addDaysToIsoDate(startIso, 6)),
      entries: buildWeekSchedule(data, reference),
    };
  });
}

/** Actualités à venir (la plus proche d'abord) et passées (la plus récente d'abord). */
export function splitNewsByDate(news: SiteNewsItem[]): { upcoming: SiteNewsItem[]; past: SiteNewsItem[] } {
  const today = todayParisIso();
  const upcoming = news
    .filter((item) => item.date && item.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const past = news
    .filter((item) => !item.date || item.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, past };
}

/** Sélection pour l'accueil : d'abord les rendez-vous à venir, puis les plus récents. */
export function pickHomeNews(news: SiteNewsItem[], count = 3): SiteNewsItem[] {
  const { upcoming, past } = splitNewsByDate(news);
  return [...upcoming, ...past].slice(0, count);
}

export function formatHourLabel(value: string): string {
  const minutes = parseScheduleTimeToMinutes(value);
  if (minutes === null) return value.trim();
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/** Ex. « Lundi 14 h 30 · Jeudi 18 h 30 » pour la carte d'une discipline. */
export function describeDisciplineSessions(disciplineId: string, schedule: ScheduleSlot[], max = 2): string {
  const slots = schedule
    .filter((slot) => slot.active && slot.disciplineId === disciplineId)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime, undefined, { numeric: true }));
  if (slots.length === 0) return "";

  const labels = slots.slice(0, max).map((slot) => {
    const day = DAY_LABELS[slot.dayOfWeek];
    if (slot.startTime.trim()) return `${day} ${formatHourLabel(slot.startTime)}`;
    return /mois/i.test(slot.location) ? "Une fois par mois" : day;
  });
  const unique = [...new Set(labels)];
  return slots.length > max ? `${unique.join(" · ")} …` : unique.join(" · ");
}
