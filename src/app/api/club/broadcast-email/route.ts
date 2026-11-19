import { NextRequest } from "next/server";
import { requireClubOps } from "@/lib/api-auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import {
  BROADCAST_MESSAGE_MAX,
  BROADCAST_SUBJECT_MAX,
  type BroadcastAudienceResponse,
} from "@/lib/broadcast-types";
import { readClubData } from "@/lib/club-data";
import { escapeHtml } from "@/lib/email-html";
import { isMailConfigured, sendEmail, sendEmailToMany } from "@/lib/mailer";
import { collectApprovedMemberRecipients } from "@/lib/member-emails";
import { readSiteData } from "@/lib/site-data";

/** Envoi en CCI par lots : marge en cas de nouvel essai adresse par adresse. */
export const maxDuration = 120;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Empêche un double envoi du même message (double clic, deux onglets) à court terme. */
const DUPLICATE_WINDOW_MS = 30_000;
const recentSends = new Map<string, number>();

function claimSend(key: string): boolean {
  const now = Date.now();
  for (const [existingKey, sentAt] of recentSends) {
    if (now - sentAt > DUPLICATE_WINDOW_MS) {
      recentSends.delete(existingKey);
    }
  }
  if (recentSends.has(key)) {
    return false;
  }
  recentSends.set(key, now);
  return true;
}

/**
 * Destinataires pour un public donné : sans paramètre, tous les adhérents approuvés
 * (avec l'effectif par activité) ; `disciplineId` ou `recipientEmail` pour affiner.
 */
export async function GET(request: NextRequest) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  const disciplineId = request.nextUrl.searchParams.get("disciplineId")?.trim() || null;
  const recipientEmail =
    request.nextUrl.searchParams.get("recipientEmail")?.trim().toLowerCase() || null;

  const [clubData, siteData] = await Promise.all([readClubData(), readSiteData()]);

  if (disciplineId && !recipientEmail) {
    const exists = siteData.disciplines.some((entry) => entry.id === disciplineId);
    if (!exists) {
      return jsonError("Activité introuvable.", 404);
    }
  }

  const recipients = collectApprovedMemberRecipients(clubData, { disciplineId, recipientEmail });
  const body: BroadcastAudienceResponse & { disciplineId: string | null; recipientEmail: string | null } = {
    recipientCount: recipients.length,
    recipients,
    disciplineId,
    recipientEmail,
  };

  if (!disciplineId && !recipientEmail) {
    const disciplineCounts: Record<string, number> = {};
    for (const discipline of siteData.disciplines) {
      disciplineCounts[discipline.id] = collectApprovedMemberRecipients(clubData, {
        disciplineId: discipline.id,
      }).length;
    }
    body.disciplineCounts = disciplineCounts;
  }

  return jsonOk(body);
}

export async function POST(request: NextRequest) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  if (!isMailConfigured()) {
    return jsonError("L’envoi d’e-mails n’est pas configuré sur le serveur.", 503);
  }

  let payload: {
    disciplineId?: string | null;
    recipientEmail?: string | null;
    subject?: string;
    message?: string;
    testToSelf?: boolean;
    expectedRecipientCount?: number | null;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Corps de requête invalide.", 400);
  }

  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const disciplineId =
    typeof payload.disciplineId === "string" ? payload.disciplineId.trim() || null : null;
  const recipientEmail =
    typeof payload.recipientEmail === "string"
      ? payload.recipientEmail.trim().toLowerCase() || null
      : null;
  const testToSelf = payload.testToSelf === true;

  if (!subject || !message) {
    return jsonError("L’objet et le message sont obligatoires.", 400);
  }
  if (recipientEmail && !EMAIL_PATTERN.test(recipientEmail)) {
    return jsonError("L’adresse e-mail du destinataire est invalide.", 400);
  }
  if (subject.length > BROADCAST_SUBJECT_MAX) {
    return jsonError("L’objet est trop long.", 400);
  }
  if (message.length > BROADCAST_MESSAGE_MAX) {
    return jsonError("Le message est trop long.", 400);
  }

  const text = `${message}\n\n—\nL’équipe Activ’`;
  const html = `
    <div style="white-space:pre-wrap;font-family:sans-serif;line-height:1.5">${escapeHtml(message)}</div>
    <p style="margin-top:1.5rem;color:#64748b">—<br/>L’équipe Activ’</p>
  `;

  if (testToSelf) {
    const ownEmail = auth.value.email?.trim().toLowerCase();
    if (!ownEmail || !EMAIL_PATTERN.test(ownEmail)) {
      return jsonError("Votre compte n’a pas d’adresse e-mail : le test est impossible.", 400);
    }
    const notice = "Ceci est un message de test : personne d’autre ne l’a reçu.";
    const result = await sendEmail({
      to: ownEmail,
      subject: `[TEST] ${subject}`,
      text: `${notice}\n\n${text}`,
      html: `<p style="font-family:sans-serif;color:#b45309;font-weight:bold">${escapeHtml(notice)}</p>${html}`,
    });
    if (!result.sent) {
      return jsonError(
        `Le test n’a pas pu être envoyé à ${ownEmail}. Réessayez dans quelques instants.`,
        502,
      );
    }
    return jsonOk({
      message: `Test envoyé à ${ownEmail}. Pensez à regarder aussi vos courriers indésirables.`,
      sent: 1,
      failed: 0,
      failures: [],
      recipientCount: 1,
      test: true,
    });
  }

  if (disciplineId && !recipientEmail) {
    const siteData = await readSiteData();
    const exists = siteData.disciplines.some((entry) => entry.id === disciplineId);
    if (!exists) {
      return jsonError("Activité introuvable.", 404);
    }
  }

  const clubData = await readClubData();
  const recipients = collectApprovedMemberRecipients(clubData, {
    disciplineId: recipientEmail ? null : disciplineId,
    recipientEmail,
  });

  if (recipients.length === 0) {
    return jsonError(
      recipientEmail
        ? "Cette adresse ne correspond pas à un adhérent approuvé."
        : "Aucun adhérent approuvé pour ce destinataire.",
      400,
    );
  }

  if (
    typeof payload.expectedRecipientCount === "number" &&
    payload.expectedRecipientCount !== recipients.length
  ) {
    return jsonError(
      `La liste des destinataires a changé depuis votre relecture (${recipients.length} personne${recipients.length > 1 ? "s" : ""} au lieu de ${payload.expectedRecipientCount}). Relisez avant d’envoyer.`,
      409,
      "recipients_changed",
    );
  }

  const duplicateKey = [
    auth.value.userId,
    recipientEmail ?? "",
    recipientEmail ? "" : (disciplineId ?? ""),
    subject,
    message,
  ].join("\u0000");
  if (!claimSend(duplicateKey)) {
    return jsonError(
      "Ce message vient d’être envoyé il y a quelques secondes. Patientez avant de le renvoyer.",
      429,
      "duplicate_send",
    );
  }

  const result = await sendEmailToMany(
    recipients.map((recipient) => recipient.email),
    { subject, text, html },
  );

  if (result.sent === 0) {
    recentSends.delete(duplicateKey);
  }

  return jsonOk({
    message:
      result.failed === 0
        ? `E-mail envoyé à ${result.sent} destinataire${result.sent > 1 ? "s" : ""}.`
        : `Envoi terminé : ${result.sent} réussi${result.sent > 1 ? "s" : ""}, ${result.failed} adresse${result.failed > 1 ? "s" : ""} en échec.`,
    sent: result.sent,
    failed: result.failed,
    failures: result.failures,
    recipientCount: recipients.length,
  });
}
