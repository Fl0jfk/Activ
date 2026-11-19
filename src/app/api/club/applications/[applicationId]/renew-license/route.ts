import { jsonError, jsonOk } from "@/lib/api-response";
import { requireClubOps } from "@/lib/api-auth";
import { actorName, readJsonBody, rejectionResponse } from "@/lib/application-route-utils";
import { updateClubData } from "@/lib/club-data";
import {
  PAYMENT_METHOD_VALUES,
  TransitionRejection,
  applyLicenseRenewal,
  parseAmountField,
} from "@/lib/dossier-transitions";
import { formatLicenseEndDateFr } from "@/lib/license-renewal";
import { receiptFailureSentence, sendPaymentReceipt } from "@/lib/payment-receipt-notify";
import { isValidIsoDate } from "@/lib/schedule-week";

/**
 * Renouvelle la licence d'un dossier finalisé et enregistre le paiement correspondant (nouvelle
 * attestation numérotée envoyée à l'adhérent).
 *
 * Corps : `{ paymentMethod, amountPaid?, expectedLicenseEndDate }`. `expectedLicenseEndDate` est la
 * fin de licence affichée au bureau : si elle ne correspond plus (double clic, autre poste), la
 * requête est refusée en 409 — un renouvellement ne peut donc jamais être appliqué deux fois.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }
  const actor = actorName(auth.value);

  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Corps de requête invalide.", 400);
  }
  const input = body as Record<string, unknown>;

  try {
    const paymentMethod = PAYMENT_METHOD_VALUES.find((method) => method === input.paymentMethod);
    if (!paymentMethod) {
      return jsonError("Choisissez le mode de paiement reçu.", 400);
    }
    const amountPaid = parseAmountField(input.amountPaid);

    const expected = input.expectedLicenseEndDate;
    if (expected !== null && !(typeof expected === "string" && isValidIsoDate(expected))) {
      return jsonError("Requête invalide : fin de licence actuelle manquante.", 400);
    }

    const { applicationId } = await context.params;
    const outcome = await updateClubData((data) => {
      const application = data.applications.find((entry) => entry.id === applicationId);
      if (!application) {
        throw new TransitionRejection("Demande introuvable.", 404);
      }
      const { licenseEndDate } = applyLicenseRenewal(
        data,
        application,
        { expectedLicenseEndDate: expected, paymentMethod, amountPaid },
        { actor },
      );
      return { applicationId: application.id, licenseEndDate };
    });

    const receipt = await sendPaymentReceipt(outcome.applicationId);
    const base = `Licence renouvelée jusqu’au ${formatLicenseEndDateFr(outcome.licenseEndDate)}.`;
    if (receipt.sent) {
      return jsonOk({
        message: `${base} Une attestation de paiement a été envoyée à l’adhérent.`,
        licenseEndDate: outcome.licenseEndDate,
        receipt: { sent: true },
      });
    }
    const warning = receiptFailureSentence(receipt);
    return jsonOk({
      message: `${base} ${warning}`,
      warning,
      licenseEndDate: outcome.licenseEndDate,
      receipt: { sent: false, reason: receipt.reason },
    });
  } catch (error) {
    const rejection = rejectionResponse(error);
    if (rejection) {
      return rejection;
    }
    console.error("Failed to renew license", error);
    return jsonError("Impossible de renouveler la licence. Réessayez dans un instant.", 500);
  }
}
