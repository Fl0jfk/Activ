import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireClubOps } from "@/lib/api-auth";
import { readClubData, writeClubData } from "@/lib/club-data";
import { randomId } from "@/lib/ids";
import { readSiteData } from "@/lib/site-data";
import {
  countTrialSlotRegistrations,
  parseTrialSlotStartsAt,
  trialSlotInstantIso,
  trialSlotTime,
} from "@/lib/trial-slots";

const MAX_CAPACITY = 200;
const MAX_TITLE_LENGTH = 120;

export async function GET() {
  const data = await readClubData();
  return jsonOk(
    data.trialSlots
      .filter((slot) => slot.active)
      .map((slot) => ({ ...slot, startsAt: trialSlotInstantIso(slot.startsAt) }))
      .sort((a, b) => trialSlotTime(a.startsAt) - trialSlotTime(b.startsAt)),
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  let payload: {
    disciplineId?: unknown;
    title?: unknown;
    startsAt?: unknown;
    capacity?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Requête invalide.", 400);
  }

  try {
    const disciplineId = typeof payload.disciplineId === "string" ? payload.disciplineId.trim() : "";
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    if (!disciplineId) {
      return jsonError("Choisissez une discipline.", 400);
    }
    if (!title) {
      return jsonError("Indiquez un titre pour le créneau.", 400);
    }
    if (title.length > MAX_TITLE_LENGTH) {
      return jsonError(`Le titre ne doit pas dépasser ${MAX_TITLE_LENGTH} caractères.`, 400);
    }

    const capacity = payload.capacity;
    if (
      typeof capacity !== "number" ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > MAX_CAPACITY
    ) {
      return jsonError(
        `La capacité doit être un nombre entier entre 1 et ${MAX_CAPACITY}.`,
        400,
      );
    }

    const startsAt = parseTrialSlotStartsAt(payload.startsAt);
    if (!startsAt.ok) {
      return jsonError(startsAt.message, 400);
    }

    const siteData = await readSiteData();
    if (!siteData.disciplines.some((discipline) => discipline.id === disciplineId)) {
      return jsonError("Cette discipline n'existe pas.", 400);
    }

    const data = await readClubData();
    data.trialSlots.push({
      id: randomId("trial"),
      disciplineId,
      title,
      startsAt: startsAt.startsAt,
      capacity,
      active: true,
    });

    await writeClubData(data);
    return jsonOk({ message: "Créneau créé." }, 201);
  } catch (error) {
    console.error("Failed to create trial slot", error);
    return jsonError("Erreur serveur : le créneau n'a pas pu être créé.", 500);
  }
}

/** Retire un créneau d'essai de la liste publique (les dossiers déjà inscrits sont conservés). */
export async function DELETE(request: NextRequest) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  const slotId =
    request.nextUrl.searchParams.get("id")?.trim() ||
    ((await request.json().catch(() => ({}))) as { id?: string }).id?.trim() ||
    "";
  if (!slotId) {
    return jsonError("Créneau introuvable.", 400);
  }

  try {
    const data = await readClubData();
    const slot = data.trialSlots.find((entry) => entry.id === slotId && entry.active);
    if (!slot) {
      return jsonError("Créneau introuvable ou déjà supprimé.", 404);
    }

    const registered = countTrialSlotRegistrations(data.applications, slot.id);
    slot.active = false;
    await writeClubData(data);

    return jsonOk({
      message:
        registered > 0
          ? `Créneau supprimé. ${registered} personne${registered > 1 ? "s étaient inscrites" : " était inscrite"} : pensez à les prévenir.`
          : "Créneau supprimé.",
      registered,
    });
  } catch (error) {
    console.error("Failed to delete trial slot", error);
    return jsonError("Erreur serveur : le créneau n'a pas pu être supprimé.", 500);
  }
}
