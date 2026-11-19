import { readClubData, updateClubData } from "@/lib/club-data";
import type { RegistrationApplication } from "@/lib/club-data";
import { ensureReceiptRecord, hasRecordedPayment } from "@/lib/dossier-transitions";
import { paymentMethodLabel } from "@/lib/dossier-workflow";
import { escapeHtml } from "@/lib/email-html";
import {
  associationContact,
  emphasis,
  formatEuroAmount,
  memberGreetingName,
  paragraph,
  renderEmailShell,
} from "@/lib/lifecycle-emails";
import { formatLicenseEndDateFr } from "@/lib/license-renewal";
import { sendEmail } from "@/lib/mailer";
import { buildPaymentReceiptPdf } from "@/lib/payment-receipt-pdf";
import { readSiteData } from "@/lib/site-data";

export type ReceiptSendFailureReason =
  | "not_found"
  | "not_paid"
  | "no_email"
  | "pdf_failed"
  | "smtp_failed";

export type ReceiptSendResult =
  | { sent: true; to: string }
  | { sent: false; reason: ReceiptSendFailureReason; message: string };

function slugifyName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "adherent";
}

/**
 * Charge le dossier payé en s'assurant que la date, le numéro et le montant de l'attestation sont
 * enregistrés (dossiers antérieurs à ces champs, adhérents papier) : ils sont fixés une fois pour
 * toutes ici, jamais recalculés d'un téléchargement à l'autre.
 */
export async function loadApplicationWithReceipt(
  applicationId: string,
): Promise<RegistrationApplication | null> {
  const data = await readClubData();
  const found = data.applications.find((entry) => entry.id === applicationId);
  if (!found) return null;
  if (!hasRecordedPayment(found)) return structuredClone(found);

  const probe = structuredClone(found);
  if (!ensureReceiptRecord(data.applications, probe)) return structuredClone(found);

  return updateClubData((fresh) => {
    const application = fresh.applications.find((entry) => entry.id === applicationId);
    if (!application) return null;
    ensureReceiptRecord(fresh.applications, application);
    return structuredClone(application);
  });
}

/**
 * Génère l'attestation PDF et l'envoie à l'adhérent (e-mail « Votre inscription est finalisée »).
 * Distingue l'absence d'adresse, l'échec de génération du PDF et l'échec d'envoi, et ne note
 * `receiptSentAt` qu'après un envoi réussi.
 */
export async function sendPaymentReceipt(applicationId: string): Promise<ReceiptSendResult> {
  let application: RegistrationApplication | null;
  try {
    application = await loadApplicationWithReceipt(applicationId);
  } catch (error) {
    console.error("sendPaymentReceipt: unable to load application", { applicationId, error });
    return {
      sent: false,
      reason: "not_found",
      message: "Le dossier n’a pas pu être relu pour préparer l’attestation.",
    };
  }
  if (!application) {
    return { sent: false, reason: "not_found", message: "Dossier introuvable." };
  }
  if (!hasRecordedPayment(application)) {
    return { sent: false, reason: "not_paid", message: "Aucun paiement encaissé pour ce dossier." };
  }
  const to = application.email?.trim();
  if (!to) {
    return {
      sent: false,
      reason: "no_email",
      message: "Aucune adresse e-mail n’est enregistrée sur ce dossier.",
    };
  }

  let pdfBytes: Uint8Array;
  let content: { subject: string; html: string; text: string };
  try {
    const siteData = await readSiteData();
    pdfBytes = await buildPaymentReceiptPdf({ application, siteData });

    const contact = associationContact(siteData);
    const method = paymentMethodLabel(application.paymentMethod);
    const memberName = memberGreetingName(application);
    const amount =
      typeof application.amountPaid === "number" ? formatEuroAmount(application.amountPaid) : "";
    const licenseEnd = application.licenseEndDate
      ? formatLicenseEndDateFr(application.licenseEndDate)
      : "";
    const detailParts = [
      `mode de paiement : ${method}`,
      amount ? `montant : ${amount}` : "",
      application.receiptNumber ? `attestation n° ${application.receiptNumber}` : "",
    ].filter(Boolean);

    const title = "Votre inscription est finalisée";
    const body = [
      paragraph(`Bonjour ${escapeHtml(memberName)},`),
      paragraph(
        `Nous avons bien reçu votre paiement (${escapeHtml(detailParts.join(" · "))}) : <strong>votre inscription est finalisée</strong>. Bienvenue !`,
      ),
      licenseEnd ? paragraph(`Votre licence est valable jusqu’au ${emphasis(licenseEnd)}.`) : "",
      paragraph(
        `Vous trouverez votre <strong>attestation de paiement en pièce jointe</strong>, avec le cachet de l’association. Elle peut être transmise à votre employeur, votre mutuelle ou tout organisme de remboursement.`,
      ),
    ].join("\n");

    content = {
      subject: `[${contact.name}] ${title}`,
      html: renderEmailShell({ contact, heading: title, bodyHtml: body }),
      text: [
        `Bonjour ${memberName},`,
        "",
        `${contact.name} a bien reçu votre paiement (${detailParts.join(" · ")}) : votre inscription est finalisée. Bienvenue !`,
        licenseEnd ? `Votre licence est valable jusqu’au ${licenseEnd}.` : "",
        "",
        "Vous trouverez votre attestation de paiement en pièce jointe, avec le cachet de l’association. Elle peut être transmise à votre employeur, votre mutuelle ou tout organisme de remboursement.",
        "",
        "Sportivement,",
        contact.name,
      ].join("\n"),
    };
  } catch (error) {
    console.error("sendPaymentReceipt: PDF generation failed", { applicationId, error });
    return {
      sent: false,
      reason: "pdf_failed",
      message: "L’attestation PDF n’a pas pu être générée.",
    };
  }

  const filename = `attestation-paiement-${slugifyName(application.fullName || "adherent")}.pdf`;
  const result = await sendEmail({
    to,
    ...content,
    attachments: [{ filename, content: pdfBytes, contentType: "application/pdf" }],
  });
  if (!result.sent) {
    console.error("sendPaymentReceipt: e-mail not sent", { applicationId, reason: result.reason });
    return {
      sent: false,
      reason: "smtp_failed",
      message:
        result.reason === "smtp_not_configured"
          ? "L’envoi d’e-mails n’est pas configuré sur le serveur."
          : "La messagerie n’a pas pu envoyer le message (adresse refusée ou service indisponible).",
    };
  }

  try {
    const receiptNumber = application.receiptNumber ?? null;
    await updateClubData((fresh) => {
      const current = fresh.applications.find((entry) => entry.id === applicationId);
      if (current && (current.receiptNumber ?? null) === receiptNumber) {
        current.receiptSentAt = new Date().toISOString();
      }
    });
  } catch (error) {
    console.error("sendPaymentReceipt: unable to record receiptSentAt", { applicationId, error });
  }
  return { sent: true, to };
}

/** Compatibilité : ancien point d'entrée (création d'adhérents papier). */
export async function notifyMemberPaymentReceipt(
  application: Pick<RegistrationApplication, "id">,
): Promise<{ sent: boolean }> {
  const result = await sendPaymentReceipt(application.id);
  return { sent: result.sent };
}

/** Phrase destinée au bureau pour un échec d'envoi (sans jargon technique). */
export function receiptFailureSentence(result: Extract<ReceiptSendResult, { sent: false }>): string {
  return `L’attestation n’a pas pu être envoyée par e-mail : ${result.message.charAt(0).toLowerCase()}${result.message.slice(1)} Vous pouvez la télécharger depuis le dossier, puis utiliser « Renvoyer l’attestation ».`;
}
