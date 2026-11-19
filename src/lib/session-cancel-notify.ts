import { readClubData } from "@/lib/club-data";
import { escapeHtml } from "@/lib/email-html";
import { collectApprovedMemberEmails } from "@/lib/member-emails";
import { sendEmailToMany } from "@/lib/mailer";
import { formatDayLabelFr } from "@/lib/schedule-week";
import { readSiteData } from "@/lib/site-data";

export async function notifyDisciplineSessionCancelled(params: {
  disciplineId: string;
  sessionDate: string;
  reason: string;
}): Promise<{ sent: number; failed: number; recipientCount: number }> {
  const [clubData, siteData] = await Promise.all([readClubData(), readSiteData()]);
  const discipline = siteData.disciplines.find((entry) => entry.id === params.disciplineId);
  const disciplineName = discipline?.name ?? "votre activité";
  const sessionLabel = formatDayLabelFr(params.sessionDate);
  const reason = params.reason.trim() || "Non précisé";

  const recipients = collectApprovedMemberEmails(clubData, {
    disciplineId: params.disciplineId,
  });

  if (recipients.length === 0) {
    return { sent: 0, failed: 0, recipientCount: 0 };
  }

  const subject = `Séance annulée — ${disciplineName}`;
  const text = [
    "Bonjour,",
    "",
    `La séance du ${sessionLabel} (${disciplineName}) est annulée.`,
    `Motif : ${reason}`,
    "",
    "Sportivement,",
    "L'équipe Activ'",
  ].join("\n");

  const html = `
    <p>Bonjour,</p>
    <p>La séance du <strong>${escapeHtml(sessionLabel)}</strong> (<strong>${escapeHtml(disciplineName)}</strong>) est annulée.</p>
    <p>Motif : ${escapeHtml(reason)}</p>
    <p>Sportivement,<br/>L'équipe Activ'</p>
  `;

  const result = await sendEmailToMany(recipients, { subject, text, html });
  return { ...result, recipientCount: recipients.length };
}

export type CancelNotifyOutcome = {
  /** Nombre d'adhérents pour lesquels l'e-mail est parti. */
  notified: number;
  failed: number;
  recipientCount: number;
  notifyError?: string;
};

/** Comme notifyDisciplineSessionCancelled, mais ne lève jamais : l'échec est décrit dans notifyError. */
export async function notifySessionCancelledSafely(params: {
  disciplineId: string;
  sessionDate: string;
  reason: string;
}): Promise<CancelNotifyOutcome> {
  try {
    const result = await notifyDisciplineSessionCancelled(params);
    const outcome: CancelNotifyOutcome = {
      notified: result.sent,
      failed: result.failed,
      recipientCount: result.recipientCount,
    };
    if (result.recipientCount > 0 && result.sent === 0) {
      outcome.notifyError = "Aucun e-mail n'a pu être envoyé.";
    } else if (result.failed > 0) {
      outcome.notifyError = `${result.failed} e-mail${result.failed > 1 ? "s" : ""} n'${result.failed > 1 ? "ont" : "a"} pas pu être envoyé${result.failed > 1 ? "s" : ""}.`;
    }
    return outcome;
  } catch (error) {
    console.error("notifySessionCancelledSafely failed", error);
    return {
      notified: 0,
      failed: 0,
      recipientCount: 0,
      notifyError: "Le service d'envoi d'e-mails ne répond pas.",
    };
  }
}