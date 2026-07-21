import { NextRequest } from "next/server";
import { requireClubOps } from "@/lib/api-auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { readClubData } from "@/lib/club-data";
import { escapeHtml } from "@/lib/email-html";
import { isMailConfigured, sendEmailToMany } from "@/lib/mailer";
import { collectApprovedMemberEmails, countApprovedMemberEmails } from "@/lib/member-emails";
import { readSiteData } from "@/lib/site-data";

export async function GET(request: NextRequest) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  const disciplineId = request.nextUrl.searchParams.get("disciplineId")?.trim() || null;
  const clubData = await readClubData();
  const recipientCount = countApprovedMemberEmails(clubData, { disciplineId });

  return jsonOk({ recipientCount, disciplineId });
}

export async function POST(request: NextRequest) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  if (!isMailConfigured()) {
    return jsonError("L'envoi d'e-mails n'est pas configuré sur le serveur.", 503);
  }

  let payload: {
    disciplineId?: string | null;
    subject?: string;
    message?: string;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Corps de requête invalide.", 400);
  }

  const subject = payload.subject?.trim() ?? "";
  const message = payload.message?.trim() ?? "";
  const disciplineId = payload.disciplineId?.trim() || null;

  if (!subject || !message) {
    return jsonError("L'objet et le message sont obligatoires.", 400);
  }
  if (subject.length > 200) {
    return jsonError("L'objet est trop long.", 400);
  }
  if (message.length > 8000) {
    return jsonError("Le message est trop long.", 400);
  }

  if (disciplineId) {
    const siteData = await readSiteData();
    const exists = siteData.disciplines.some((entry) => entry.id === disciplineId);
    if (!exists) {
      return jsonError("Discipline introuvable.", 404);
    }
  }

  const clubData = await readClubData();
  const recipients = collectApprovedMemberEmails(clubData, { disciplineId });

  if (recipients.length === 0) {
    return jsonError("Aucun adhérent approuvé pour ce destinataire.", 400);
  }

  const text = `${message}\n\n—\nL'équipe Activ'`;
  const html = `
    <div style="white-space:pre-wrap;font-family:sans-serif;line-height:1.5">${escapeHtml(message)}</div>
    <p style="margin-top:1.5rem;color:#64748b">—<br/>L'équipe Activ'</p>
  `;

  const result = await sendEmailToMany(recipients, { subject, text, html });

  return jsonOk({
    message:
      result.failed === 0
        ? `E-mail envoyé à ${result.sent} destinataire${result.sent > 1 ? "s" : ""}.`
        : `Envoi terminé : ${result.sent} réussi(s), ${result.failed} échec(s).`,
    sent: result.sent,
    failed: result.failed,
    recipientCount: recipients.length,
  });
}
