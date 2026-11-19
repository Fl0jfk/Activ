import { randomId } from "@/lib/ids";
import { DAY_LABELS, parseDayOfWeek } from "@/lib/schedule-constants";
import { slugify } from "@/lib/slug";
import { mergePollsKeepingVotes } from "@/lib/site-polls";
import type {
  AssociationData,
  Discipline,
  HomeGallery,
  HomeGallerySlide,
  ScheduleException,
  ScheduleSlot,
  SiteNewsItem,
} from "@/lib/site-data-types";

/** Sections du site modifiables depuis le bureau (une clé = une section indépendante). */
export const SITE_SECTION_KEYS = [
  "association",
  "disciplines",
  "schedule",
  "scheduleExceptions",
  "news",
  "polls",
  "homeGallery",
] as const;

export type SiteSectionKey = (typeof SITE_SECTION_KEYS)[number];
export type SiteSections = Partial<Pick<AssociationData, SiteSectionKey>>;

type Rec = Record<string, unknown>;
type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ITEMS = { disciplines: 100, schedule: 1000, exceptions: 5000, news: 2000, slides: 1000, board: 100 };

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail<T>(message: string): Parsed<T> {
  return { ok: false, message };
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function id(value: unknown, prefix: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : randomId(prefix);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function sanitizeAssociation(raw: unknown, current: AssociationData["association"]): Parsed<AssociationData["association"]> {
  if (!isRecord(raw)) return fail("Les informations de l’association sont invalides.");

  const next: AssociationData["association"] = { ...current };
  const simpleKeys = ["name", "tagline", "city", "contactEmail", "facebookUrl", "address"] as const;
  for (const key of simpleKeys) {
    if (typeof raw[key] === "string") next[key] = (raw[key] as string).trim();
  }
  if (!next.name) return fail("Le nom de l’association est obligatoire.");

  if (typeof raw.stampImageUrl === "string") next.stampImageUrl = raw.stampImageUrl.trim();
  if (typeof raw.signatureImageUrl === "string") next.signatureImageUrl = raw.signatureImageUrl.trim();
  if (typeof raw.siret === "string") next.siret = raw.siret.trim();
  if (typeof raw.rna === "string") next.rna = raw.rna.trim();

  if (raw.organisation !== undefined) {
    if (!isRecord(raw.organisation)) return fail("L’organigramme est invalide.");
    const organisation = { ...current.organisation };
    if (typeof raw.organisation.notes === "string") organisation.notes = raw.organisation.notes;
    if (raw.organisation.boardMembers !== undefined) {
      if (!Array.isArray(raw.organisation.boardMembers) || raw.organisation.boardMembers.length > MAX_ITEMS.board) {
        return fail("La liste des membres du bureau est invalide.");
      }
      const members: AssociationData["association"]["organisation"]["boardMembers"] = [];
      const seen = new Set<string>();
      for (const member of raw.organisation.boardMembers) {
        if (!isRecord(member)) return fail("La liste des membres du bureau est invalide.");
        let memberId = id(member.id, "board");
        if (seen.has(memberId)) memberId = randomId("board");
        seen.add(memberId);
        members.push({
          id: memberId,
          fullName: text(member.fullName).trim(),
          role: text(member.role).trim(),
          email: text(member.email).trim(),
        });
      }
      organisation.boardMembers = members;
    }
    next.organisation = organisation;
  }

  return { ok: true, value: next };
}

function sanitizeDisciplines(raw: unknown): Parsed<Discipline[]> {
  if (!Array.isArray(raw) || raw.length > MAX_ITEMS.disciplines) {
    return fail("La liste des disciplines est invalide.");
  }
  const disciplines: Discipline[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();

  for (const entry of raw) {
    if (!isRecord(entry)) return fail("La liste des disciplines est invalide.");
    const disciplineId = typeof entry.id === "string" ? entry.id.trim() : "";
    if (!disciplineId) return fail("Une discipline n’a pas d’identifiant. Rechargez la page puis réessayez.");
    const name = text(entry.name).trim();
    if (!name) return fail("Chaque discipline doit avoir un nom.");
    if (ids.has(disciplineId)) return fail(`La discipline « ${name} » apparaît deux fois.`);
    ids.add(disciplineId);

    const slug = slugify(text(entry.slug)) || slugify(name) || disciplineId;
    if (slugs.has(slug)) {
      return fail(`Deux disciplines ont la même adresse web (« ${slug} »). Modifiez l’une d’elles.`);
    }
    slugs.add(slug);

    const teachers = stringList(entry.teachers);
    disciplines.push({
      id: disciplineId,
      name,
      slug,
      description: text(entry.description),
      teacher: teachers[0] ?? text(entry.teacher).trim(),
      teachers,
      coachBio: text(entry.coachBio),
      coachPhotoUrl: text(entry.coachPhotoUrl),
      imageUrl: text(entry.imageUrl),
      galleryImages: stringList(entry.galleryImages),
      whatToBring: stringList(entry.whatToBring),
      providedItems: stringList(entry.providedItems),
      priceInfo: text(entry.priceInfo),
      annualFee: text(entry.annualFee),
      contactEmail: text(entry.contactEmail).trim(),
      ctaText: text(entry.ctaText),
      allowTrialRequest: entry.allowTrialRequest !== false,
      highlights: stringList(entry.highlights),
      active: entry.active !== false,
    });
  }
  return { ok: true, value: disciplines };
}

function sanitizeSchedule(raw: unknown, disciplineIds: Set<string>): Parsed<ScheduleSlot[]> {
  if (!Array.isArray(raw) || raw.length > MAX_ITEMS.schedule) {
    return fail("La liste des horaires est invalide.");
  }
  const slots: ScheduleSlot[] = [];
  const ids = new Set<string>();
  for (const entry of raw) {
    if (!isRecord(entry)) return fail("La liste des horaires est invalide.");
    const slotId = typeof entry.id === "string" ? entry.id.trim() : "";
    if (!slotId) return fail("Un horaire n’a pas d’identifiant. Rechargez la page puis réessayez.");
    if (ids.has(slotId)) continue;
    ids.add(slotId);

    const disciplineId = text(entry.disciplineId).trim();
    // Un horaire sans discipline n’a plus de sens (discipline supprimée) : on l’écarte.
    if (!disciplineIds.has(disciplineId)) continue;

    const rawDay = entry.dayOfWeek ?? entry.day;
    const dayOfWeek = parseDayOfWeek(typeof rawDay === "number" || typeof rawDay === "string" ? rawDay : undefined);
    slots.push({
      id: slotId,
      disciplineId,
      teacherName: text(entry.teacherName).trim(),
      day: DAY_LABELS[dayOfWeek],
      dayOfWeek,
      startTime: text(entry.startTime).trim(),
      endTime: text(entry.endTime).trim(),
      location: text(entry.location).trim(),
      active: entry.active !== false,
    });
  }
  return { ok: true, value: slots };
}

function sanitizeExceptions(raw: unknown, slotIds: Set<string>): Parsed<ScheduleException[]> {
  if (!Array.isArray(raw) || raw.length > MAX_ITEMS.exceptions) {
    return fail("La liste des annulations est invalide.");
  }
  const exceptions: ScheduleException[] = [];
  const ids = new Set<string>();
  for (const entry of raw) {
    if (!isRecord(entry)) return fail("La liste des annulations est invalide.");
    const exceptionId = typeof entry.id === "string" ? entry.id.trim() : "";
    const scheduleSlotId = text(entry.scheduleSlotId).trim();
    const date = text(entry.date).trim();
    if (!exceptionId || !scheduleSlotId) return fail("Une annulation est incomplète.");
    if (!ISO_DATE.test(date)) return fail("La date d’une annulation est invalide.");
    if (ids.has(exceptionId) || !slotIds.has(scheduleSlotId)) continue;
    ids.add(exceptionId);
    exceptions.push({ id: exceptionId, scheduleSlotId, date, status: "cancelled", reason: text(entry.reason) });
  }
  return { ok: true, value: exceptions };
}

function sanitizeNews(raw: unknown): Parsed<SiteNewsItem[]> {
  if (!Array.isArray(raw) || raw.length > MAX_ITEMS.news) {
    return fail("La liste des actualités est invalide.");
  }
  const items: SiteNewsItem[] = [];
  const ids = new Set<string>();
  for (const entry of raw) {
    if (!isRecord(entry)) return fail("La liste des actualités est invalide.");
    const newsId = typeof entry.id === "string" ? entry.id.trim() : "";
    if (!newsId) return fail("Une actualité n’a pas d’identifiant. Rechargez la page puis réessayez.");
    if (ids.has(newsId)) continue;
    ids.add(newsId);

    const disciplineId = typeof entry.disciplineId === "string" && entry.disciplineId.trim() ? entry.disciplineId.trim() : null;
    const ctaLabel = text(entry.ctaLabel).trim();
    items.push({
      id: newsId,
      title: text(entry.title).trim(),
      date: text(entry.date).trim(),
      description: text(entry.description),
      kind: text(entry.kind).trim() || "evenement",
      location: text(entry.location).trim(),
      startTime: text(entry.startTime).trim(),
      endTime: text(entry.endTime).trim(),
      disciplineId,
      ...(ctaLabel ? { ctaLabel } : {}),
      imageUrl: text(entry.imageUrl).trim(),
      galleryImages: stringList(entry.galleryImages),
    });
  }
  return { ok: true, value: items };
}

function sanitizeHomeGallery(raw: unknown): Parsed<HomeGallery> {
  if (!isRecord(raw) || !Array.isArray(raw.slides) || raw.slides.length > MAX_ITEMS.slides) {
    return fail("La galerie de l’accueil est invalide.");
  }
  const slides: HomeGallerySlide[] = [];
  const ids = new Set<string>();
  for (const entry of raw.slides) {
    if (!isRecord(entry)) return fail("La galerie de l’accueil est invalide.");
    let slideId = id(entry.id, "slide");
    if (ids.has(slideId)) slideId = randomId("slide");
    ids.add(slideId);
    slides.push({ id: slideId, imageUrl: text(entry.imageUrl).trim(), caption: text(entry.caption).trim() });
  }
  return { ok: true, value: { title: text(raw.title).trim(), slides } };
}

/**
 * Construit les nouvelles données du site en ne touchant QUE aux sections présentes dans la
 * demande ET autorisées (`allowedKeys`). `current` doit être lu juste avant l’écriture.
 */
export function buildSiteDataUpdate(
  payload: unknown,
  current: AssociationData,
  allowedKeys: readonly SiteSectionKey[],
): Parsed<{ next: AssociationData; touched: SiteSectionKey[] }> {
  if (!isRecord(payload)) return fail("Demande invalide.");

  const touched = allowedKeys.filter((key) => payload[key] !== undefined);
  if (touched.length === 0) return fail("Aucune donnée à enregistrer.");

  const next: AssociationData = { ...current };

  if (touched.includes("association")) {
    const result = sanitizeAssociation(payload.association, current.association);
    if (!result.ok) return result;
    next.association = result.value;
  }

  if (touched.includes("disciplines")) {
    const result = sanitizeDisciplines(payload.disciplines);
    if (!result.ok) return result;
    next.disciplines = result.value;

    // Une discipline supprimée emporte ses horaires, ses annulations ; ses actualités passent en « général ».
    const keptIds = new Set(result.value.map((discipline) => discipline.id));
    const removedIds = new Set(current.disciplines.map((discipline) => discipline.id).filter((value) => !keptIds.has(value)));
    if (removedIds.size > 0) {
      next.news = next.news.map((item) =>
        item.disciplineId && removedIds.has(item.disciplineId) ? { ...item, disciplineId: null } : item,
      );
      next.schedule = next.schedule.filter((slot) => !removedIds.has(slot.disciplineId));
    }
  }

  if (touched.includes("schedule")) {
    const result = sanitizeSchedule(payload.schedule, new Set(next.disciplines.map((discipline) => discipline.id)));
    if (!result.ok) return result;
    next.schedule = result.value;
  }

  if (touched.includes("disciplines") || touched.includes("schedule")) {
    const slotIds = new Set(next.schedule.map((slot) => slot.id));
    const removedSlotIds = new Set(current.schedule.map((slot) => slot.id).filter((value) => !slotIds.has(value)));
    if (removedSlotIds.size > 0) {
      next.scheduleExceptions = next.scheduleExceptions.filter((exception) => !removedSlotIds.has(exception.scheduleSlotId));
    }
  }

  if (touched.includes("scheduleExceptions")) {
    const result = sanitizeExceptions(payload.scheduleExceptions, new Set(next.schedule.map((slot) => slot.id)));
    if (!result.ok) return result;
    next.scheduleExceptions = result.value;
  }

  if (touched.includes("news")) {
    const result = sanitizeNews(payload.news);
    if (!result.ok) return result;
    const disciplineIds = new Set(next.disciplines.map((discipline) => discipline.id));
    next.news = result.value.map((item) =>
      item.disciplineId && !disciplineIds.has(item.disciplineId) ? { ...item, disciplineId: null } : item,
    );
  }

  if (touched.includes("polls")) {
    const result = mergePollsKeepingVotes(current.polls, payload.polls);
    if (!result.ok) return result;
    next.polls = result.polls;
  }

  if (touched.includes("homeGallery")) {
    const result = sanitizeHomeGallery(payload.homeGallery);
    if (!result.ok) return result;
    next.homeGallery = result.value;
  }

  return { ok: true, value: { next, touched } };
}
