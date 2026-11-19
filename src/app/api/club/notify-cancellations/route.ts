import { NextRequest } from "next/server";
import { requireClubOps } from "@/lib/api-auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { notifySessionCancelledSafely } from "@/lib/session-cancel-notify";
import { readSiteData } from "@/lib/site-data";

/**
 * Renvoie l'e-mail d'annulation pour des séances DÉJÀ annulées (nouvel essai après un échec d'envoi).
 * Le motif est celui enregistré : on ne peut pas envoyer de texte libre aux adhérents depuis ici.
 */
export async function POST(request: NextRequest) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  let payload: {
    cancellations?: {
      scheduleSlotId?: string;
      date?: string;
    }[];
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Requête invalide.", 400);
  }

  const cancellations = Array.isArray(payload.cancellations) ? payload.cancellations : [];
  if (cancellations.length === 0) {
    return jsonOk({ message: "Aucune notification à envoyer.", notified: 0, failed: 0, recipientCount: 0 });
  }

  try {
    const siteData = await readSiteData();
    let notified = 0;
    let failed = 0;
    let recipientCount = 0;
    let processed = 0;
    let notifyError: string | undefined;

    for (const item of cancellations) {
      const scheduleSlotId = item.scheduleSlotId?.trim() ?? "";
      const date = item.date?.trim() ?? "";
      if (!scheduleSlotId || !date) continue;

      const slot = siteData.schedule.find((entry) => entry.id === scheduleSlotId);
      const exception = siteData.scheduleExceptions.find(
        (entry) => entry.scheduleSlotId === scheduleSlotId && entry.date === date,
      );
      if (!slot || !exception) continue;

      const outcome = await notifySessionCancelledSafely({
        disciplineId: slot.disciplineId,
        sessionDate: date,
        reason: exception.reason,
      });
      processed += 1;
      notified += outcome.notified;
      failed += outcome.failed;
      recipientCount += outcome.recipientCount;
      notifyError = notifyError ?? outcome.notifyError;
    }

    if (processed === 0) {
      return jsonError("Cette séance n'est pas annulée : aucun e-mail n'a été envoyé.", 404);
    }

    return jsonOk({
      message:
        recipientCount === 0
          ? "Aucun adhérent à prévenir pour cette activité."
          : `${notified} adhérent${notified > 1 ? "s" : ""} prévenu${notified > 1 ? "s" : ""} par e-mail.`,
      notified,
      failed,
      recipientCount,
      ...(notifyError ? { notifyError } : {}),
    });
  } catch (error) {
    console.error("Failed to notify cancellations", error);
    return jsonError("Erreur serveur : les e-mails n'ont pas pu être envoyés.", 500);
  }
}
