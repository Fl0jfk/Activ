import { dayLabelFromOfWeek, parseDayOfWeek } from "@/lib/schedule-constants";
import { readJsonFromS3, readLocalJsonFile, writeJsonToS3 } from "@/lib/s3-client";
import { slugify } from "@/lib/slug";
import { normalizeNewsDisciplineId } from "@/lib/site-news";
import { FALLBACK_SITE_IMAGE, resolveSiteImageSrc } from "@/lib/site-image";
import type {
  AssociationData,
  HomeGallery,
  HomeGallerySlide,
  ScheduleSlot,
  SiteNewsItem,
  SitePoll,
  SitePollOption,
} from "@/lib/site-data-types";

export type { DayOfWeek } from "@/lib/schedule-constants";
export { DAY_LABELS, dayLabelFromOfWeek, parseDayOfWeek } from "@/lib/schedule-constants";
export type {
  AssociationData,
  Discipline,
  HomeGallery,
  HomeGallerySlide,
  ScheduleException,
  ScheduleSlot,
  SiteNewsItem,
  SitePoll,
  SitePollOption,
} from "@/lib/site-data-types";

export const DEFAULT_HOME_GALLERY: HomeGallery = {
  title: "La vie de l'association",
  slides: [],
};

function normalizeHomeGallerySlide(slide: Partial<HomeGallerySlide> | null | undefined): HomeGallerySlide | null {
  if (!slide || typeof slide !== "object") return null;
  const imageUrl = resolveSiteImageSrc(typeof slide.imageUrl === "string" ? slide.imageUrl : "", "");
  if (!imageUrl) return null;
  return {
    id: typeof slide.id === "string" && slide.id.trim() ? slide.id : `slide-${Math.random().toString(36).slice(2, 10)}`,
    imageUrl,
    caption: typeof slide.caption === "string" ? slide.caption : "",
  };
}

function normalizeHomeGallery(raw: unknown): HomeGallery {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_HOME_GALLERY, slides: [] };
  }
  const gallery = raw as Partial<HomeGallery>;
  const slides = Array.isArray(gallery.slides)
    ? gallery.slides
        .map((slide) => normalizeHomeGallerySlide(slide))
        .filter((slide): slide is HomeGallerySlide => slide !== null)
    : [];
  const title =
    typeof gallery.title === "string" && gallery.title.trim()
      ? gallery.title.trim()
      : DEFAULT_HOME_GALLERY.title;
  return { title, slides };
}

function normalizePollOption(option: Partial<SitePollOption> | null | undefined): SitePollOption | null {
  if (!option || typeof option !== "object") return null;
  const label = typeof option.label === "string" ? option.label.trim() : "";
  if (!label) return null;
  const votes = typeof option.votes === "number" && Number.isFinite(option.votes) ? Math.max(0, Math.round(option.votes)) : 0;
  return {
    id: typeof option.id === "string" && option.id.trim() ? option.id : `opt-${Math.random().toString(36).slice(2, 10)}`,
    label,
    votes,
  };
}

function normalizePoll(poll: Partial<SitePoll> | null | undefined): SitePoll | null {
  if (!poll || typeof poll !== "object") return null;
  const question = typeof poll.question === "string" ? poll.question.trim() : "";
  const options = Array.isArray(poll.options)
    ? poll.options.map((option) => normalizePollOption(option)).filter((option): option is SitePollOption => option !== null)
    : [];
  if (!question || options.length < 2) return null;
  return {
    id: typeof poll.id === "string" && poll.id.trim() ? poll.id : `poll-${Math.random().toString(36).slice(2, 10)}`,
    question,
    options,
    newsId: typeof poll.newsId === "string" && poll.newsId.trim() ? poll.newsId : null,
    status: poll.status === "closed" ? "closed" : "open",
    createdAt: typeof poll.createdAt === "string" && poll.createdAt ? poll.createdAt : new Date().toISOString(),
    closedAt: typeof poll.closedAt === "string" && poll.closedAt ? poll.closedAt : null,
    voterHashes: Array.isArray(poll.voterHashes)
      ? poll.voterHashes.filter((hash): hash is string => typeof hash === "string" && hash.length > 0)
      : [],
  };
}

function normalizePolls(raw: unknown): SitePoll[] {
  if (!Array.isArray(raw)) return [];
  const polls = raw
    .map((poll) => normalizePoll(poll as Partial<SitePoll>))
    .filter((poll): poll is SitePoll => poll !== null);

  // Une actualité ne peut avoir qu'un seul sondage lié : garder le plus récent.
  const seenNewsIds = new Set<string>();
  const deduped: SitePoll[] = [];
  const sorted = [...polls].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const poll of sorted) {
    if (poll.newsId) {
      if (seenNewsIds.has(poll.newsId)) continue;
      seenNewsIds.add(poll.newsId);
    }
    deduped.push(poll);
  }
  return deduped;
}

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

type RawAssociationData = Omit<AssociationData, "news" | "disciplines" | "homeGallery" | "polls"> & {
  news?: SiteNewsItem[];
  homeGallery?: HomeGallery | unknown;
  polls?: SitePoll[] | unknown;
  disciplines: LegacyDiscipline[];
  schedule?: ScheduleSlot[];
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
    ctaLabel: typeof item.ctaLabel === "string" && item.ctaLabel.trim() ? item.ctaLabel.trim() : "Lire la suite",
    imageUrl: resolveSiteImageSrc(item.imageUrl, ""),
    galleryImages: Array.isArray(item.galleryImages)
      ? item.galleryImages
          .map((url) => resolveSiteImageSrc(url, ""))
          .filter((url): url is string => url.length > 0)
      : [],
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
          galleryImages: [],
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
        stampImageUrl: "",
        organisation: {
          boardMembers: [],
          notes: "Organigramme a completer.",
        },
      },
      news: [],
      homeGallery: { ...DEFAULT_HOME_GALLERY, slides: [] },
      polls: [],
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
      stampImageUrl: resolveSiteImageSrc(data.association.stampImageUrl, ""),
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
      coachPhotoUrl: resolveSiteImageSrc(
        typeof discipline.coachPhotoUrl === "string" && discipline.coachPhotoUrl.trim()
          ? discipline.coachPhotoUrl
          : discipline.imageUrl,
        FALLBACK_SITE_IMAGE,
      ),
      imageUrl: resolveSiteImageSrc(discipline.imageUrl, FALLBACK_SITE_IMAGE),
      galleryImages: Array.isArray(discipline.galleryImages)
        ? discipline.galleryImages
            .map((url) => resolveSiteImageSrc(url, ""))
            .filter((url) => url.length > 0)
        : [],
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
    homeGallery: normalizeHomeGallery(raw.homeGallery),
    polls: normalizePolls(raw.polls),
    schedule: (raw.schedule ?? []).map((slot) => normalizeScheduleSlot(slot)),
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
