import type { RegistrationApplication, TrialSlot } from "@/lib/club-data";
import { resolveBureauRecipient } from "@/lib/bureau-recipient";
import { getApplicationDisciplineNames } from "@/lib/dossier-workflow";
import { emailLayout, escapeHtml, singleLine } from "@/lib/email-html";
import { sendEmail } from "@/lib/mailer";
import { paymentPlanLabel } from "@/lib/membership-bulletin";
import { readSiteData } from "@/lib/site-data";
import { formatTrialSlotDate } from "@/lib/trial-slots";

/** Prévient le bureau d'une nouvelle inscription. Ne lève jamais d'erreur : un échec d'e-mail est seulement journalisé. */
export async function notifyBureauNewPreinscription(params: {
  application: RegistrationApplication;
  trialSlots?: TrialSlot[];
  pdfAttachment?: {
    filename: string;
    content: Buffer | Uint8Array;
  };
}): Promise<void> {
  try {
    const to = await resolveBureauRecipient();
    if (!to) {
      console.warn("notifyBureauNewPreinscription ignoré : aucune adresse de destination (CONTACT_TO, contact de l'association ou SMTP_USER).");
      return;
    }

    const { application, trialSlots = [], pdfAttachment } = params;
    let disciplineName = application.disciplineId;
    try {
      const siteData = await readSiteData();
      const names = getApplicationDisciplineNames(application, siteData.disciplines);
      if (names.length > 0) disciplineName = names.join(", ");
    } catch (error) {
      console.error("notifyBureauNewPreinscription: noms des disciplines indisponibles", error);
    }

    const bulletin = application.membershipBulletin;
    const trialSlot = application.trialSlotId
      ? trialSlots.find((slot) => slot.id === application.trialSlotId)
      : null;
    const trialLabel = trialSlot
      ? `${trialSlot.title} — ${formatTrialSlotDate(trialSlot.startsAt)}`
      : application.trialSlotId
        ? "Créneau demandé"
        : bulletin
          ? "Bulletin d'adhésion signé"
          : "Aucun (pré-inscription seule)";

    const rows: [string, string][] = [
      ["Nom", application.fullName],
      ["E-mail", application.email],
      ["Téléphone", application.phone],
      ["Adresse", `${application.address}, ${application.postalCode} ${application.city}`],
      ["Activités", bulletin?.selectedActivityLabels?.length ? bulletin.selectedActivityLabels.join(" ; ") : disciplineName],
      [bulletin ? "Dossier" : "Créneau d'essai", trialLabel],
    ];
    if (bulletin) {
      rows.push(["Total à régler", `${bulletin.grandTotal} €`]);
      rows.push(["Modalité de paiement", paymentPlanLabel(bulletin.paymentPlan)]);
    }
    if (application.motivation) rows.push(["Motivation", application.motivation]);
    if (!bulletin) rows.push(["Documents joints", String(application.documents.length)]);
    if (pdfAttachment) rows.push(["Bulletin d'adhésion", "PDF en pièce jointe"]);

    const subject = `[Activ'] Nouvelle pré-inscription — ${singleLine(application.fullName, 120)}`;
    const text = [
      "Nouvelle demande de pré-inscription reçue.",
      "",
      ...rows.map(([label, value]) => `${label} : ${value}`),
      "",
      "Connectez-vous à l'espace bureau pour traiter la demande.",
    ].join("\n");

    const html = emailLayout({
      title: "Nouvelle pré-inscription",
      bodyHtml: `<p style="margin:0 0 12px">Une nouvelle demande vient d'être reçue sur le site.</p>
<ul style="margin:0 0 12px;padding-left:20px">
${rows.map(([label, value]) => `<li><strong>${escapeHtml(label)}&nbsp;:</strong> ${escapeHtml(value)}</li>`).join("\n")}
</ul>
<p style="margin:0">Connectez-vous à l'espace bureau pour traiter la demande.</p>`,
    });

    const result = await sendEmail({
      to,
      subject,
      text,
      html,
      replyTo: application.email,
      attachments: pdfAttachment
        ? [
            {
              filename: pdfAttachment.filename,
              content: pdfAttachment.content,
              contentType: "application/pdf",
            },
          ]
        : undefined,
    });

    if (!result.sent) {
      console.error("notifyBureauNewPreinscription: envoi impossible", result.reason);
    }
  } catch (error) {
    console.error("notifyBureauNewPreinscription: erreur inattendue", error);
  }
}
