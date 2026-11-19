import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requirePresident } from "@/lib/api-auth";
import { randomId } from "@/lib/ids";
import { DAY_LABELS, type DayOfWeek } from "@/lib/schedule-constants";
import { normalizeScheduleTime } from "@/lib/schedule-week";
import { readSiteData, writeSiteData } from "@/lib/site-data";
import type { Discipline, ScheduleSlot } from "@/lib/site-data-types";
import { slugify } from "@/lib/slug";

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

function parseDay(value: unknown): DayOfWeek | null {
  const day = typeof value === "string" ? Number(value) : value;
  if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 7) return null;
  return day as DayOfWeek;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Ajoute un créneau hebdomadaire au planning.
 * - `disciplineId` : activité existante (obligatoire sauf création explicite) ;
 * - `createDiscipline: true` + `disciplineName` : crée une nouvelle activité (jamais implicite) ;
 * - `reactivate: true` : confirme la réactivation d'une activité désactivée.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePresident();
  if (!auth.ok) {
    return auth.response;
  }

  let payload: {
    disciplineId?: unknown;
    disciplineName?: unknown;
    createDiscipline?: unknown;
    reactivate?: unknown;
    annualFee?: unknown;
    dayOfWeek?: unknown;
    startTime?: unknown;
    endTime?: unknown;
    location?: unknown;
    teacherName?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Requête invalide.", 400);
  }

  const dayOfWeek = parseDay(payload.dayOfWeek);
  if (!dayOfWeek) {
    return jsonError("Choisissez un jour de la semaine.", 400);
  }
  const startTime = normalizeScheduleTime(text(payload.startTime));
  const endTime = normalizeScheduleTime(text(payload.endTime));
  if (!startTime || !endTime) {
    return jsonError("Renseignez des heures de début et de fin valides (ex. 18:30).", 400);
  }
  if (startTime >= endTime) {
    return jsonError("L'heure de fin doit être après l'heure de début.", 400);
  }

  try {
    const siteData = await readSiteData();
    const disciplineId = text(payload.disciplineId);
    const disciplineName = text(payload.disciplineName);
    const annualFee = text(payload.annualFee);
    let discipline: Discipline | undefined;
    let createdDiscipline = false;
    let reactivatedDiscipline = false;

    if (disciplineId) {
      discipline = siteData.disciplines.find((entry) => entry.id === disciplineId);
      if (!discipline) {
        return jsonError("Cette activité n'existe plus. Actualisez la page.", 404);
      }
      if (!discipline.active) {
        if (payload.reactivate !== true) {
          return jsonError(
            "Cette activité est désactivée. Confirmez sa réactivation pour y ajouter un créneau.",
            409,
          );
        }
        discipline.active = true;
        reactivatedDiscipline = true;
      }
    } else {
      if (payload.createDiscipline !== true) {
        return jsonError(
          "Choisissez une activité existante, ou confirmez la création d'une nouvelle activité.",
          400,
        );
      }
      if (!disciplineName) {
        return jsonError("Indiquez le nom de la nouvelle activité.", 400);
      }
      const sameName = siteData.disciplines.find(
        (entry) => entry.name.trim().toLowerCase() === disciplineName.toLowerCase(),
      );
      if (sameName) {
        return jsonError(
          `L'activité « ${sameName.name} » existe déjà : choisissez-la dans la liste.`,
          409,
        );
      }
      discipline = newDiscipline({
        existing: siteData.disciplines,
        name: disciplineName,
        annualFee,
        contactEmail: siteData.association.contactEmail,
      });
      siteData.disciplines.push(discipline);
      createdDiscipline = true;
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
      teacherName: text(payload.teacherName),
      day: DAY_LABELS[dayOfWeek],
      dayOfWeek,
      startTime,
      endTime,
      location: text(payload.location),
      active: true,
    };
    siteData.schedule.push(slot);
    await writeSiteData(siteData);

    const extra = createdDiscipline
      ? " La nouvelle activité est visible sur le site."
      : reactivatedDiscipline
        ? " L'activité a été réactivée."
        : "";
    return jsonOk(
      {
        message: `Créneau ajouté : ${discipline.name}, ${DAY_LABELS[dayOfWeek].toLowerCase()} de ${startTime} à ${endTime}.${extra}`,
        discipline,
        slot,
      },
      201,
    );
  } catch (error) {
    console.error("Failed to create schedule slot", error);
    return jsonError("Erreur serveur : le créneau n'a pas pu être ajouté.", 500);
  }
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

  try {
    const siteData = await readSiteData();
    const exists = siteData.schedule.some((slot) => slot.id === slotId);
    if (!exists) {
      return jsonError("Créneau introuvable ou déjà supprimé.", 404);
    }

    siteData.schedule = siteData.schedule.filter((slot) => slot.id !== slotId);
    siteData.scheduleExceptions = siteData.scheduleExceptions.filter(
      (exception) => exception.scheduleSlotId !== slotId,
    );
    await writeSiteData(siteData);

    return jsonOk({ message: "Créneau supprimé du planning." });
  } catch (error) {
    console.error("Failed to delete schedule slot", error);
    return jsonError("Erreur serveur : le créneau n'a pas pu être supprimé.", 500);
  }
}
