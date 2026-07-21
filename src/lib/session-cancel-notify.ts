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
