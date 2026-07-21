import type { RegistrationApplication, TrialSlot } from "@/lib/club-data";
import { escapeHtml } from "@/lib/email-html";
import { sendEmail } from "@/lib/mailer";
import { readSiteData } from "@/lib/site-data";
import { formatTrialSlotDate } from "@/lib/trial-slots";

function bureauNotifyEmail(): string | null {
  const smtpUser = process.env.SMTP_USER?.trim();
  return smtpUser || null;
}

export async function notifyBureauNewPreinscription(params: {
  application: RegistrationApplication;
  trialSlots?: TrialSlot[];
}): Promise<void> {
  try {
    const to = bureauNotifyEmail();
    if (!to) {
      console.warn("notifyBureauNewPreinscription skipped: SMTP_USER missing");
      return;
    }

    const { application, trialSlots = [] } = params;
    let disciplineName = application.disciplineId;
    try {
      const siteData = await readSiteData();
      disciplineName =
        siteData.disciplines.find((entry) => entry.id === application.disciplineId)?.name ??
        application.disciplineId;
    } catch (error) {
      console.error("notifyBureauNewPreinscription: unable to resolve discipline name", error);
    }

    const trialSlot = application.trialSlotId
      ? trialSlots.find((slot) => slot.id === application.trialSlotId)
      : null;
    const trialLabel = trialSlot
      ? `${trialSlot.title} — ${formatTrialSlotDate(trialSlot.startsAt)}`
      : application.trialSlotId
        ? "Créneau demandé"
        : "Aucun (pré-inscription seule)";

    const subject = `[Activ'] Nouvelle pré-inscription — ${application.fullName}`;
    const text = [
      "Nouvelle demande de pré-inscription reçue.",
      "",
      `Nom : ${application.fullName}`,
      `E-mail : ${application.email}`,
      `Téléphone : ${application.phone}`,
      `Adresse : ${application.address}, ${application.postalCode} ${application.city}`,
      `Discipline : ${disciplineName}`,
      `Créneau d'essai : ${trialLabel}`,
      application.motivation ? `Motivation : ${application.motivation}` : null,
      `Documents joints : ${application.documents.length}`,
      "",
      "Connectez-vous à l'espace bureau pour traiter la demande.",
    ]
      .filter(Boolean)
      .join("\n");

    const html = `
    <p><strong>Nouvelle demande de pré-inscription</strong> reçue sur le site.</p>
    <ul>
      <li><strong>Nom :</strong> ${escapeHtml(application.fullName)}</li>
      <li><strong>E-mail :</strong> ${escapeHtml(application.email)}</li>
      <li><strong>Téléphone :</strong> ${escapeHtml(application.phone)}</li>
      <li><strong>Adresse :</strong> ${escapeHtml(`${application.address}, ${application.postalCode} ${application.city}`)}</li>
      <li><strong>Discipline :</strong> ${escapeHtml(disciplineName)}</li>
      <li><strong>Créneau d'essai :</strong> ${escapeHtml(trialLabel)}</li>
      ${
        application.motivation
          ? `<li><strong>Motivation :</strong> ${escapeHtml(application.motivation)}</li>`
          : ""
      }
      <li><strong>Documents joints :</strong> ${application.documents.length}</li>
    </ul>
    <p>Connectez-vous à l'espace bureau pour traiter la demande.</p>
  `;

    const result = await sendEmail({
      to,
      subject,
      text,
      html,
      replyTo: application.email,
    });

    if (!result.sent) {
      console.error("notifyBureauNewPreinscription failed", result.reason);
    }
  } catch (error) {
    console.error("notifyBureauNewPreinscription unexpected error", error);
  }
}
