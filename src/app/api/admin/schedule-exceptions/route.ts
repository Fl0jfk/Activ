import { NextRequest } from "next/server";
import { requireClubOps } from "@/lib/api-auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { randomId } from "@/lib/ids";
import { isValidIsoDate, todayParisIso, weekdayOfIsoDate } from "@/lib/schedule-week";
import { notifySessionCancelledSafely } from "@/lib/session-cancel-notify";
import { readSiteData, writeSiteData } from "@/lib/site-data";

const MAX_REASON_LENGTH = 300;

type ExceptionPayload = {
  scheduleSlotId?: unknown;
  date?: unknown;
  reason?: unknown;
  notify?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function readPayload(request: NextRequest): Promise<ExceptionPayload | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" ? (body as ExceptionPayload) : null;
  } catch {
    return null;
  }
}

/**
 * Annule une séance précise (un créneau à une date donnée).
 * Les exceptions sont ajoutées à la version la plus récente des données, sans réécrire le reste du planning.
 */
export async function POST(request: NextRequest) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  const payload = await readPayload(request);
  if (!payload) {
    return jsonError("Requête invalide.", 400);
  }

  const scheduleSlotId = text(payload.scheduleSlotId);
  const date = text(payload.date);
  const reason = text(payload.reason);
  const notify = payload.notify === true;

  if (!scheduleSlotId || !isValidIsoDate(date)) {
    return jsonError("Séance introuvable.", 400);
  }
  if (!reason) {
    return jsonError("Indiquez le motif de l'annulation.", 400);
  }
  if (reason.length > MAX_REASON_LENGTH) {
    return jsonError(`Le motif ne doit pas dépasser ${MAX_REASON_LENGTH} caractères.`, 400);
  }
  if (date < todayParisIso()) {
    return jsonError("Cette séance est déjà passée : elle ne peut plus être annulée.", 400);
  }

  try {
    const siteData = await readSiteData();
    const slot = siteData.schedule.find((entry) => entry.id === scheduleSlotId);
    if (!slot || !slot.active) {
      return jsonError("Ce créneau n'existe plus. Actualisez la page.", 404);
    }
    if (weekdayOfIsoDate(date) !== slot.dayOfWeek) {
      return jsonError("Cette date ne correspond pas au jour de ce créneau.", 400);
    }
    const alreadyCancelled = siteData.scheduleExceptions.some(
      (exception) => exception.scheduleSlotId === scheduleSlotId && exception.date === date,
    );
    if (alreadyCancelled) {
      return jsonError("Cette séance est déjà annulée.", 409);
    }

    siteData.scheduleExceptions.push({
      id: randomId("exception"),
      scheduleSlotId,
      date,
      status: "cancelled",
      reason,
    });
    await writeSiteData(siteData);

    if (!notify) {
      return jsonOk({
        saved: true,
        notified: 0,
        recipientCount: 0,
        message: "Annulation enregistrée.",
      });
    }

    const outcome = await notifySessionCancelledSafely({
      disciplineId: slot.disciplineId,
      sessionDate: date,
      reason,
    });
    return jsonOk({
      saved: true,
      notified: outcome.notified,
      failed: outcome.failed,
      recipientCount: outcome.recipientCount,
      ...(outcome.notifyError ? { notifyError: outcome.notifyError } : {}),
      message: "Annulation enregistrée.",
    });
  } catch (error) {
    console.error("Failed to cancel session", error);
    return jsonError("Erreur serveur : l'annulation n'a pas pu être enregistrée.", 500);
  }
}

/** Rétablit une séance annulée (supprime l'exception). */
export async function DELETE(request: NextRequest) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  const payload = await readPayload(request);
  if (!payload) {
    return jsonError("Requête invalide.", 400);
  }
  const scheduleSlotId = text(payload.scheduleSlotId);
  const date = text(payload.date);
  if (!scheduleSlotId || !isValidIsoDate(date)) {
    return jsonError("Séance introuvable.", 400);
  }

  try {
    const siteData = await readSiteData();
    const remaining = siteData.scheduleExceptions.filter(
      (exception) => !(exception.scheduleSlotId === scheduleSlotId && exception.date === date),
    );
    if (remaining.length === siteData.scheduleExceptions.length) {
      return jsonError("Cette séance n'est pas annulée.", 404);
    }
    siteData.scheduleExceptions = remaining;
    await writeSiteData(siteData);
    return jsonOk({ saved: true, message: "Séance rétablie." });
  } catch (error) {
    console.error("Failed to restore session", error);
    return jsonError("Erreur serveur : la séance n'a pas pu être rétablie.", 500);
  }
}
