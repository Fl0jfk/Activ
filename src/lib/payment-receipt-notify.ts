import type { RegistrationApplication } from "@/lib/club-data";
import { paymentMethodLabel } from "@/lib/dossier-workflow";
import { escapeHtml } from "@/lib/email-html";
import { sendEmail } from "@/lib/mailer";
import { buildPaymentReceiptPdf } from "@/lib/payment-receipt-pdf";
import { readSiteData } from "@/lib/site-data";

function slugifyName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "adherent";
}

export async function notifyMemberPaymentReceipt(
  application: RegistrationApplication,
): Promise<{ sent: boolean }> {
  try {
    const to = application.email?.trim();
    if (!to) {
      console.warn("notifyMemberPaymentReceipt skipped: missing member email");
      return { sent: false };
    }

    const siteData = await readSiteData();
    const pdfBytes = await buildPaymentReceiptPdf({
      application,
      siteData,
      paidAt: new Date().toISOString(),
    });
    const associationName = siteData.association.name || "l'association";
    const method = paymentMethodLabel(application.paymentMethod);
    const memberName = application.fullName.trim() || "adhérent";
    const filename = `recu-paiement-${slugifyName(memberName)}.pdf`;

    const subject = `[${associationName}] Reçu de paiement`;
    const text = [
      `Bonjour ${memberName},`,
      "",
      `${associationName} certifie avoir bien reçu votre paiement (${method}).`,
      "Vous trouverez le reçu officiel en pièce jointe de cet e-mail.",
      "",
      "Sportivement,",
      associationName,
    ].join("\n");

    const html = `
      <p>Bonjour ${escapeHtml(memberName)},</p>
      <p><strong>${escapeHtml(associationName)}</strong> certifie avoir bien reçu votre paiement
      (${escapeHtml(method)}).</p>
      <p>Vous trouverez le <strong>reçu officiel en pièce jointe</strong> de cet e-mail
      (date, informations de l'association, mode de paiement).</p>
      <p>Sportivement,<br/>${escapeHtml(associationName)}</p>
    `;

    const result = await sendEmail({
      to,
      subject,
      text,
      html,
      attachments: [
        {
          filename,
          content: pdfBytes,
          contentType: "application/pdf",
        },
      ],
    });

    if (!result.sent) {
      console.error("notifyMemberPaymentReceipt failed", result.reason);
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error("notifyMemberPaymentReceipt unexpected error", error);
    return { sent: false };
  }
}
