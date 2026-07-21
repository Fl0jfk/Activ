import { dayLabelFromOfWeek, parseDayOfWeek } from "@/lib/schedule-constants";
import { readJsonFromS3, readLocalJsonFile, writeJsonToS3 } from "@/lib/s3-client";
import { slugify } from "@/lib/slug";
import { normalizeNewsDisciplineId } from "@/lib/site-news";
import type { AssociationData, ScheduleSlot, SiteNewsItem } from "@/lib/site-data-types";

export type { DayOfWeek } from "@/lib/schedule-constants";
export { DAY_LABELS, dayLabelFromOfWeek, parseDayOfWeek } from "@/lib/schedule-constants";
export type {
  AssociationData,
  Discipline,
  ScheduleException,
  ScheduleSlot,
  SiteNewsItem,
} from "@/lib/site-data-types";

type LegacyDisciplineEvent = {
  id: string;
  title?: string;
  date?: string;
  description?: string;
  featuredOnHome?: boolean;
  kind?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
};

type LegacyDiscipline = AssociationData["disciplines"][number] & {
  events?: LegacyDisciplineEvent[];
};

type RawAssociationData = Omit<AssociationData, "news" | "disciplines"> & {
  news?: SiteNewsItem[];
  disciplines: LegacyDiscipline[];
};

function normalizeSiteNewsItem(item: SiteNewsItem): SiteNewsItem {
  return {
    id: item.id,
    title: item.title ?? "",
    date: item.date ?? "",
    description: item.description ?? "",
    kind: item.kind ?? "evenement",
    location: item.location ?? "",
    startTime: item.startTime ?? "",
    endTime: item.endTime ?? "",
    disciplineId: normalizeNewsDisciplineId(item.disciplineId),
    imageUrl: item.imageUrl ?? "",
  };
}

function migrateLegacyDisciplineEvents(disciplines: LegacyDiscipline[]): SiteNewsItem[] {
  const migrated: SiteNewsItem[] = [];
  for (const discipline of disciplines) {
    for (const event of discipline.events ?? []) {
      migrated.push(
        normalizeSiteNewsItem({
          id: event.id,
          title: event.title ?? "",
          date: event.date ?? "",
          description: event.description ?? "",
          kind: event.kind ?? "evenement",
          location: event.location ?? "",
          startTime: event.startTime ?? "",
          endTime: event.endTime ?? "",
          disciplineId: discipline.id,
          imageUrl: "",
        })
      );
    }
  }
  return migrated;
}

function resolveNews(data: RawAssociationData): SiteNewsItem[] {
  const explicit = (data.news ?? []).map(normalizeSiteNewsItem);
  if (explicit.length > 0) return explicit;
  return migrateLegacyDisciplineEvents(data.disciplines);
}

const defaultSiteDataPath = `${process.cwd()}/data/site-data.json`;
const defaultSiteDataKey = "data/site-data.json";

function siteDataKey(): string {
  return process.env.SITE_DATA_KEY || defaultSiteDataKey;
}

async function readDefaultLocalData(): Promise<AssociationData> {
  try {
    return normalizeSiteData(await readLocalJsonFile<AssociationData>(defaultSiteDataPath));
  } catch {
    return normalizeSiteData({
      association: {
        name: "Activ Sainte-Croix",
        tagline: "Association sportive",
        city: "Sainte-Croix",
        contactEmail: "contact@activ-saintecroix.fr",
        facebookUrl: "https://facebook.com",
        address: "Mairie de Sainte-Croix",
        organisation: {
          boardMembers: [],
          notes: "Organigramme a completer.",
        },
      },
      news: [],
      disciplines: [],
      schedule: [],
      scheduleExceptions: [],
    });
  }
}

function normalizeScheduleSlot(slot: ScheduleSlot): ScheduleSlot {
  const dayOfWeek = parseDayOfWeek(
    (slot as ScheduleSlot & { dayOfWeek?: number }).dayOfWeek ?? slot.day
  );
  return {
    ...slot,
    teacherName: slot.teacherName ?? "",
    dayOfWeek,
    day: dayLabelFromOfWeek(dayOfWeek),
    active: slot.active ?? true,
  };
}

export function normalizeSiteData(data: AssociationData | RawAssociationData): AssociationData {
  const raw = data as RawAssociationData;
  return {
    association: {
      ...data.association,
      organisation: {
        boardMembers: data.association.organisation?.boardMembers ?? [
          {
            id: "presidence",
            fullName: "Presidence a definir",
            role: "President(e)",
            email: data.association.contactEmail,
          },
        ],
        notes:
          data.association.organisation?.notes ?? "L'organigramme peut etre ajuste depuis les donnees JSON.",
      },
    },
    disciplines: data.disciplines.map((discipline) => ({
      id: discipline.id,
      name: discipline.name,
      slug: discipline.slug ?? slugify(discipline.name || discipline.id),
      description: discipline.description ?? "",
      teacher: discipline.teacher ?? "",
      teachers:
        Array.isArray(discipline.teachers) && discipline.teachers.length > 0
          ? discipline.teachers.filter((name): name is string => typeof name === "string" && name.trim().length > 0)
          : discipline.teacher
            ? [discipline.teacher]
            : [],
      coachBio: discipline.coachBio ?? "",
      coachPhotoUrl: discipline.coachPhotoUrl ?? discipline.imageUrl ?? "/logo.png",
      imageUrl: discipline.imageUrl ?? "/logo.png",
      galleryImages: discipline.galleryImages ?? [],
      whatToBring: discipline.whatToBring ?? [],
      providedItems: discipline.providedItems ?? [],
      priceInfo: discipline.priceInfo ?? "Tarif sur demande.",
      annualFee: discipline.annualFee ?? "",
      contactEmail: discipline.contactEmail ?? data.association.contactEmail,
      ctaText: discipline.ctaText ?? "Demander un cours d'essai",
      allowTrialRequest: discipline.allowTrialRequest ?? true,
      highlights: discipline.highlights ?? [],
      active: discipline.active ?? true,
    })),
    news: resolveNews(raw),
    schedule: raw.schedule.map((slot) => normalizeScheduleSlot(slot)),
    scheduleExceptions: (data.scheduleExceptions ?? []).map((exception) => ({
      id: exception.id,
      scheduleSlotId: exception.scheduleSlotId,
      date: exception.date,
      status: "cancelled" as const,
      reason: exception.reason ?? "",
    })),
  };
}

export async function readSiteData(): Promise<AssociationData> {
  try {
    const raw = await readJsonFromS3<AssociationData>(siteDataKey());
    return normalizeSiteData(raw);
  } catch {
    const seedData = await readDefaultLocalData();
    try {
      await writeSiteData(seedData);
    } catch {
      // S3 may be unavailable in build/deploy environments; keep local fallback.
    }
    return seedData;
  }
}

export async function writeSiteData(data: AssociationData): Promise<void> {
  const normalizedData = normalizeSiteData(data);
  await writeJsonToS3(siteDataKey(), normalizedData);
}
