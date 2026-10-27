import type { AssociationData, Discipline, ScheduleSlot } from "@/lib/site-data-types";
import {
  DAY_LABELS,
  parseDayOfWeek,
  type DayOfWeek,
} from "@/lib/schedule-constants";
import { MEMBERSHIP_ACTIVITY_SLOTS, type MembershipActivitySlot } from "@/lib/membership-bulletin";

/**
 * Activité proposée dans le bulletin d'adhésion.
 *
 * L'identifiant des créneaux historiques (ex. `renforcement-jeudi`) est conservé
 * lorsqu'un créneau du planning y correspond, afin que les bulletins déjà signés
 * restent valides. Les nouveaux créneaux utilisent `slot:<id du planning>`.
 */
export type MembershipActivityOption = {
  id: string;
  day: string;
  dayOfWeek: DayOfWeek;
  time: string;
  activity: string;
  disciplineId: string | null;
  scheduleSlotId: string | null;
  matchKeywords: string[];
};

export type MembershipActivityCatalogSource = Pick<AssociationData, "disciplines" | "schedule">;

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2})\s*[h:]\s*(\d{0,2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || "0");
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatTimeFr(value: string): string {
  const minutes = timeToMinutes(value);
  if (minutes === null) return value.trim();
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

function formatTimeRange(startTime: string, endTime: string): string {
  const start = formatTimeFr(startTime);
  const end = formatTimeFr(endTime);
  if (start && end) return `${start}-${end}`;
  return start || end;
}

function timeRangeKey(startTime: string, endTime: string): string {
  return `${timeToMinutes(startTime) ?? ""}-${timeToMinutes(endTime) ?? ""}`;
}

function legacyTimeRangeKey(slot: MembershipActivitySlot): string {
  const [start, end] = slot.time.split("-");
  return timeRangeKey(start ?? "", end ?? "");
}

function matchScore(discipline: Pick<Discipline, "name" | "slug">, keywords: string[]): number {
  const haystack = normalizeText(`${discipline.name} ${discipline.slug}`);
  return keywords.reduce(
    (score, keyword) => (haystack.includes(normalizeText(keyword)) ? score + 1 : score),
    0,
  );
}

function findBestDiscipline(
  disciplines: Pick<Discipline, "id" | "name" | "slug">[],
  keywords: string[],
): Pick<Discipline, "id" | "name" | "slug"> | null {
  let best: { discipline: Pick<Discipline, "id" | "name" | "slug">; score: number } | null = null;
  for (const discipline of disciplines) {
    const score = matchScore(discipline, keywords);
    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = { discipline, score };
    }
  }
  return best?.discipline ?? null;
}

function sortOptions(options: MembershipActivityOption[]): MembershipActivityOption[] {
  return [...options].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    const aMinutes = timeToMinutes(a.time.split("-")[0] ?? "") ?? 24 * 60;
    const bMinutes = timeToMinutes(b.time.split("-")[0] ?? "") ?? 24 * 60;
    if (aMinutes !== bMinutes) return aMinutes - bMinutes;
    return a.activity.localeCompare(b.activity, "fr");
  });
}

function dedupeById(options: MembershipActivityOption[]): MembershipActivityOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
}

function staticFallbackOptions(
  disciplines: Pick<Discipline, "id" | "name" | "slug">[],
): MembershipActivityOption[] {
  return MEMBERSHIP_ACTIVITY_SLOTS.map((slot) => {
    const discipline = findBestDiscipline(disciplines, slot.matchKeywords);
    return {
      id: slot.id,
      day: slot.day,
      dayOfWeek: parseDayOfWeek(slot.day),
      time: slot.time,
      activity: slot.activity,
      disciplineId: discipline?.id ?? null,
      scheduleSlotId: null,
      matchKeywords: slot.matchKeywords,
    };
  });
}

/**
 * Construit la liste des activités du bulletin à partir du planning du site.
 * Les créneaux ajoutés dans « Semaine et exceptions » apparaissent donc
 * automatiquement dans le formulaire d'adhésion.
 */
export function buildMembershipActivityCatalog(
  source: MembershipActivityCatalogSource,
): MembershipActivityOption[] {
  const disciplines = source.disciplines.filter((discipline) => discipline.active);
  const activeSlots = (source.schedule ?? []).filter((slot: ScheduleSlot) => slot.active);
  const usedLegacyIds = new Set<string>();
  const options: MembershipActivityOption[] = [];

  for (const slot of activeSlots) {
    const discipline = disciplines.find((entry) => entry.id === slot.disciplineId);
    if (!discipline) continue;

    const dayOfWeek = parseDayOfWeek(slot.dayOfWeek ?? slot.day);
    const time = formatTimeRange(slot.startTime, slot.endTime);
    const rangeKey = timeRangeKey(slot.startTime, slot.endTime);

    let legacy: MembershipActivitySlot | null = null;
    let bestScore = 0;
    for (const candidate of MEMBERSHIP_ACTIVITY_SLOTS) {
      if (usedLegacyIds.has(candidate.id)) continue;
      if (parseDayOfWeek(candidate.day) !== dayOfWeek) continue;
      if (legacyTimeRangeKey(candidate) !== rangeKey) continue;
      const score = matchScore(discipline, candidate.matchKeywords);
      if (score > bestScore) {
        bestScore = score;
        legacy = candidate;
      }
    }

    if (legacy) usedLegacyIds.add(legacy.id);

    options.push({
      id: legacy?.id ?? `slot:${slot.id}`,
      day: DAY_LABELS[dayOfWeek],
      dayOfWeek,
      time,
      activity: discipline.name,
      disciplineId: discipline.id,
      scheduleSlotId: slot.id,
      matchKeywords: legacy?.matchKeywords ?? [discipline.name, discipline.slug],
    });
  }

  // Conserver les activités historiques du bulletin qui ne sont pas encore
  // présentes dans le planning, tant qu'une discipline active y correspond.
  for (const legacy of MEMBERSHIP_ACTIVITY_SLOTS) {
    if (usedLegacyIds.has(legacy.id)) continue;
    const discipline = findBestDiscipline(disciplines, legacy.matchKeywords);
    if (!discipline) continue;
    options.push({
      id: legacy.id,
      day: legacy.day,
      dayOfWeek: parseDayOfWeek(legacy.day),
      time: legacy.time,
      activity: legacy.activity,
      disciplineId: discipline.id,
      scheduleSlotId: null,
      matchKeywords: legacy.matchKeywords,
    });
  }

  const deduped = dedupeById(sortOptions(options));
  if (deduped.length > 0) return deduped;

  // Site encore vide / planning non renseigné : ne pas casser le formulaire.
  return staticFallbackOptions(disciplines);
}

export function findMembershipActivityOption(
  catalog: MembershipActivityOption[],
  activityId: string,
): MembershipActivityOption | null {
  return catalog.find((option) => option.id === activityId) ?? null;
}

/** Identifiants de discipline correspondant aux activités cochées, sans doublon. */
export function resolveMembershipDisciplineIds(
  selectedActivityIds: string[],
  catalog: MembershipActivityOption[],
): string[] {
  const ids: string[] = [];
  for (const activityId of selectedActivityIds) {
    const option = findMembershipActivityOption(catalog, activityId);
    if (option?.disciplineId && !ids.includes(option.disciplineId)) {
      ids.push(option.disciplineId);
    }
  }
  return ids;
}

export function membershipActivityLabels(
  selectedActivityIds: string[],
  catalog: MembershipActivityOption[],
): string[] {
  return selectedActivityIds.map((activityId) => {
    const option = findMembershipActivityOption(catalog, activityId);
    if (option) {
      return option.time ? `${option.day} ${option.time} — ${option.activity}` : `${option.day} — ${option.activity}`;
    }
    return legacyMembershipActivityLabel(activityId) ?? activityId;
  });
}

export function legacyMembershipActivityLabel(activityId: string): string | null {
  const legacy = MEMBERSHIP_ACTIVITY_SLOTS.find((slot) => slot.id === activityId);
  if (!legacy) return null;
  return `${legacy.day} ${legacy.time} — ${legacy.activity}`;
}
