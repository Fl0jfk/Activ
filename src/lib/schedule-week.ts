import type { DayOfWeek } from "@/lib/schedule-constants";
import type { AssociationData, ScheduleSlot } from "@/lib/site-data-types";

export type WeekScheduleEntry = {
  id: string;
  scheduleSlotId: string;
  date: string;
  dayLabel: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  location: string;
  teacherName: string;
  disciplineId: string;
  disciplineName: string;
  cancelled: boolean;
  cancelReason?: string;
};

const PARIS_TZ = "Europe/Paris";

export function todayParisIso(reference = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PARIS_TZ }).format(reference);
}

export function weekdayParis(reference = new Date()): DayOfWeek {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS_TZ,
    weekday: "short",
  }).format(reference);
  const map: Record<string, DayOfWeek> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[short] ?? 1;
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

export function getCurrentWeekRangeParis(reference = new Date()): {
  monday: string;
  sunday: string;
} {
  const today = todayParisIso(reference);
  const weekday = weekdayParis(reference);
  const monday = addDaysToIsoDate(today, -(weekday - 1));
  const sunday = addDaysToIsoDate(monday, 6);
  return { monday, sunday };
}

export function isoDateForDayOfWeek(mondayIso: string, dayOfWeek: DayOfWeek): string {
  return addDaysToIsoDate(mondayIso, dayOfWeek - 1);
}

export function formatDayLabelFr(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    weekday: "long",
  }).format(date);
  const rest = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    day: "numeric",
    month: "long",
  }).format(date);
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalized} ${rest}`;
}

function compareTime(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

export function buildWeekSchedule(
  data: AssociationData,
  reference = new Date()
): WeekScheduleEntry[] {
  const { monday } = getCurrentWeekRangeParis(reference);
  const activeSlots = data.schedule.filter((slot) => slot.active);
  const disciplineById = new Map(data.disciplines.map((d) => [d.id, d]));
  const exceptionByKey = new Map(
    (data.scheduleExceptions ?? []).map((ex) => [`${ex.scheduleSlotId}:${ex.date}`, ex])
  );

  const entries: WeekScheduleEntry[] = activeSlots.map((slot: ScheduleSlot) => {
    const date = isoDateForDayOfWeek(monday, slot.dayOfWeek);
    const exception = exceptionByKey.get(`${slot.id}:${date}`);
    const discipline = disciplineById.get(slot.disciplineId);

    return {
      id: `${slot.id}-${date}`,
      scheduleSlotId: slot.id,
      date,
      dayLabel: formatDayLabelFr(date),
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      location: slot.location,
      teacherName: slot.teacherName,
      disciplineId: slot.disciplineId,
      disciplineName: discipline?.name ?? "A definir",
      cancelled: exception?.status === "cancelled",
      cancelReason: exception?.reason,
    };
  });

  return entries.sort((a, b) => {
    const dayDiff = a.dayOfWeek - b.dayOfWeek;
    if (dayDiff !== 0) return dayDiff;
    return compareTime(a.startTime, b.startTime);
  });
}

export function formatWeekRangeLabel(reference = new Date()): string {
  const { monday, sunday } = getCurrentWeekRangeParis(reference);
  const start = formatDayLabelFr(monday);
  const end = formatDayLabelFr(sunday);
  return `Semaine du ${start} au ${end}`;
}

export function normalizeCoachName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function coachNameMatches(slotTeacher: string, coachFullName: string): boolean {
  const slot = normalizeCoachName(slotTeacher);
  const coach = normalizeCoachName(coachFullName);
  if (!slot || !coach) return false;
  return slot === coach || slot.includes(coach) || coach.includes(slot);
}

/** Prochaines séances du coach sur ~horizonDays (défaut 28 j). */
export function buildCoachUpcomingSessions(
  data: AssociationData,
  coachName: string,
  horizonDays = 28
): WeekScheduleEntry[] {
  const today = todayParisIso();
  const lastDay = addDaysToIsoDate(today, horizonDays);
  const seen = new Set<string>();
  const entries: WeekScheduleEntry[] = [];

  const weekCount = Math.ceil(horizonDays / 7) + 1;
  for (let weekOffset = 0; weekOffset < weekCount; weekOffset++) {
    const reference = new Date();
    reference.setDate(reference.getDate() + weekOffset * 7);
    for (const entry of buildWeekSchedule(data, reference)) {
      if (!coachNameMatches(entry.teacherName, coachName)) continue;
      if (entry.date < today || entry.date > lastDay) continue;
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      entries.push(entry);
    }
  }

  return entries.sort(
    (a, b) => a.date.localeCompare(b.date) || compareTime(a.startTime, b.startTime)
  );
}

export function buildDisciplineWeekSchedule(
  data: AssociationData,
  disciplineId: string,
  reference = new Date()
): WeekScheduleEntry[] {
  return buildWeekSchedule(data, reference).filter((entry) => entry.disciplineId === disciplineId);
}

export function buildMistralActivitiesContext(data: AssociationData, reference = new Date()): string {
  const weekEntries = buildWeekSchedule(data, reference);
  const activeDisciplines = data.disciplines.filter((d) => d.active);

  const payload = activeDisciplines.map((discipline) => {
    const slots = weekEntries
      .filter((e) => e.disciplineId === discipline.id)
      .map((e) => ({
        jour: e.dayLabel,
        horaire: `${e.startTime} - ${e.endTime}`,
        lieu: e.location,
        enseignant: e.teacherName || discipline.teachers[0] || discipline.teacher,
        annule: e.cancelled,
        motifAnnulation: e.cancelReason ?? null,
      }));

    return {
      nom: discipline.name,
      description: discipline.description,
      coach: discipline.teachers.length > 0 ? discipline.teachers : [discipline.teacher],
      bioCoach: discipline.coachBio,
      materielApporter: discipline.whatToBring,
      materielFourni: discipline.providedItems,
      tarif: discipline.priceInfo,
      licence: discipline.annualFee,
      creneauxCetteSemaine: slots,
    };
  });

  return JSON.stringify(payload, null, 2);
}
