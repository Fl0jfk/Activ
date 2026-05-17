import { dayLabelFromOfWeek, parseDayOfWeek } from "@/lib/schedule-constants";
import { readJsonFromS3, readLocalJsonFile, writeJsonToS3 } from "@/lib/s3-client";
import { slugify } from "@/lib/slug";
import type { AssociationData, ScheduleSlot } from "@/lib/site-data-types";

export type { DayOfWeek } from "@/lib/schedule-constants";
export { DAY_LABELS, dayLabelFromOfWeek, parseDayOfWeek } from "@/lib/schedule-constants";
export type {
  AssociationData,
  Discipline,
  DisciplineEvent,
  ScheduleException,
  ScheduleSlot,
} from "@/lib/site-data-types";

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

export function normalizeSiteData(data: AssociationData): AssociationData {
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
      events: (discipline.events ?? []).map((event) => ({
        id: event.id,
        title: event.title ?? "",
        date: event.date ?? "",
        description: event.description ?? "",
        featuredOnHome: event.featuredOnHome ?? false,
      })),
      active: discipline.active ?? true,
    })),
    schedule: data.schedule.map((slot) => normalizeScheduleSlot(slot)),
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
