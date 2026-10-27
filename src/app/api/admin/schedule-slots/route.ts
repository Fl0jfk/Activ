import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requirePresident } from "@/lib/api-auth";
import { randomId } from "@/lib/ids";
import { DAY_LABELS, parseDayOfWeek, type DayOfWeek } from "@/lib/schedule-constants";
import { readSiteData, writeSiteData } from "@/lib/site-data";
import type { Discipline, ScheduleSlot } from "@/lib/site-data-types";
import { slugify } from "@/lib/slug";

function normalizeTime(value: string | undefined): string | null {
  const raw = value?.trim() ?? "";
  const match = /^(\d{1,2})\s*[h:]\s*(\d{0,2})$/.exec(raw);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || "0");
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function uniqueSlug(existing: Discipline[], base: string): string {
  const cleanBase = slugify(base) || "activite";
  let candidate = cleanBase;
  let index = 2;
  while (existing.some((discipline) => discipline.slug === candidate)) {
    candidate = `${cleanBase}-${index}`;
    index += 1;
  }
  return candidate;
}

function newDiscipline(params: {
  existing: Discipline[];
  name: string;
  annualFee: string;
  contactEmail: string;
}): Discipline {
  return {
    id: randomId("discipline"),
    name: params.name,
    slug: uniqueSlug(params.existing, params.name),
    description: "",
    teacher: "",
    teachers: [],
    coachBio: "",
    coachPhotoUrl: "/logo.png",
    imageUrl: "/logo.png",
    galleryImages: [],
    whatToBring: [],
    providedItems: [],
    priceInfo: params.annualFee ? `${params.annualFee} / an` : "",
    annualFee: params.annualFee,
    contactEmail: params.contactEmail,
    ctaText: "Demander un essai",
    allowTrialRequest: true,
    highlights: [],
    active: true,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requirePresident();
  if (!auth.ok) {
    return auth.response;
  }

  let payload: {
    disciplineId?: string;
    disciplineName?: string;
    annualFee?: string;
    dayOfWeek?: number | string;
    startTime?: string;
    endTime?: string;
    location?: string;
    teacherName?: string;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Corps de requête invalide.", 400);
  }

  const siteData = await readSiteData();
  const disciplineName = payload.disciplineName?.trim() ?? "";
  const annualFee = payload.annualFee?.trim() ?? "";
  let discipline = payload.disciplineId
    ? siteData.disciplines.find((entry) => entry.id === payload.disciplineId)
    : undefined;

  if (!discipline) {
    if (!disciplineName) {
      return jsonError("Indiquez le nom de l'activité.", 400);
    }
    const existingByName = siteData.disciplines.find(
      (entry) => entry.name.trim().toLowerCase() === disciplineName.toLowerCase(),
    );
    if (existingByName) {
      discipline = existingByName;
    } else {
      discipline = newDiscipline({
        existing: siteData.disciplines,
        name: disciplineName,
        annualFee,
        contactEmail: siteData.association.contactEmail,
      });
      siteData.disciplines.push(discipline);
    }
  }

  if (!discipline) {
    return jsonError("Activité introuvable.", 404);
  }
  if (!discipline.active) {
    discipline.active = true;
  }
  if (annualFee) {
    discipline.annualFee = annualFee;
  }

  const dayOfWeek: DayOfWeek = parseDayOfWeek(payload.dayOfWeek);
  const startTime = normalizeTime(payload.startTime);
  const endTime = normalizeTime(payload.endTime);
  if (!startTime || !endTime) {
    return jsonError("Renseignez des heures de début et de fin valides (ex. 18:30).", 400);
  }
  if (startTime >= endTime) {
    return jsonError("L'heure de fin doit être après l'heure de début.", 400);
  }

  const duplicate = siteData.schedule.some(
    (slot) =>
      slot.disciplineId === discipline.id &&
      slot.dayOfWeek === dayOfWeek &&
      slot.startTime === startTime &&
      slot.endTime === endTime,
  );
  if (duplicate) {
    return jsonError("Ce créneau existe déjà pour cette activité.", 409);
  }

  const slot: ScheduleSlot = {
    id: randomId("slot"),
    disciplineId: discipline.id,
    teacherName: payload.teacherName?.trim() ?? "",
    day: DAY_LABELS[dayOfWeek],
    dayOfWeek,
    startTime,
    endTime,
    location: payload.location?.trim() ?? "",
    active: true,
  };
  siteData.schedule.push(slot);
  await writeSiteData(siteData);

  return jsonOk(
    {
      message: `Activité « ${discipline.name} » et créneau ajoutés au planning.`,
      discipline,
      slot,
    },
    201,
  );
}

export async function DELETE(request: NextRequest) {
  const auth = await requirePresident();
  if (!auth.ok) {
    return auth.response;
  }

  const slotId =
    request.nextUrl.searchParams.get("slotId")?.trim() ||
    ((await request.json().catch(() => ({}))) as { slotId?: string }).slotId?.trim() ||
    "";
  if (!slotId) {
    return jsonError("Créneau introuvable.", 400);
  }

  const siteData = await readSiteData();
  const exists = siteData.schedule.some((slot) => slot.id === slotId);
  if (!exists) {
    return jsonError("Créneau introuvable.", 404);
  }

  siteData.schedule = siteData.schedule.filter((slot) => slot.id !== slotId);
  siteData.scheduleExceptions = siteData.scheduleExceptions.filter(
    (exception) => exception.scheduleSlotId !== slotId,
  );
  await writeSiteData(siteData);

  return jsonOk({ message: "Créneau supprimé du planning." });
}
