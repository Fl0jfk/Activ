import { NextResponse } from "next/server";
import { requireClubOps, requireUser } from "@/lib/api-auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { canAccessClubOperations } from "@/lib/clerk";
import { readClubData } from "@/lib/club-data";
import { hasRecordedPayment } from "@/lib/dossier-transitions";
import {
  loadApplicationWithReceipt,
  receiptFailureSentence,
  sendPaymentReceipt,
} from "@/lib/payment-receipt-notify";
import { buildPaymentReceiptPdf } from "@/lib/payment-receipt-pdf";
import { checkRateLimit } from "@/lib/rate-limit";
import { readSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

function receiptFileName(application: { fullName: string; firstName: string; lastName: string }): string {
  const base =
    application.fullName.trim() ||
    `${application.firstName} ${application.lastName}`.trim() ||
    "adherent";
  const slug = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "adherent";
  return `attestation-paiement-${slug}.pdf`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }

  const { applicationId } = await context.params;

  try {
    const data = await readClubData();
    const existing = data.applications.find((entry) => entry.id === applicationId);
    if (!existing) {
      return jsonError("Demande introuvable.", 404);
    }

    const isAdmin = canAccessClubOperations(auth.value);
    const isOwner =
      Boolean(existing.clerkUserId) && existing.clerkUserId === auth.value.userId;
    if (!isAdmin && !isOwner) {
      return jsonError("Non autorisé.", 401);
    }

    if (!hasRecordedPayment(existing)) {
      return jsonError("Aucun paiement encaissé pour ce dossier.", 409);
    }

    // Date et numéro d'attestation figés une fois pour toutes (dossiers anciens compris).
    const application = (await loadApplicationWithReceipt(applicationId)) ?? existing;

    const siteData = await readSiteData();
    const pdfBytes = await buildPaymentReceiptPdf({ application, siteData });
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${receiptFileName(application)}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
        "X-Accel-Expires": "0",
      },
    });
  } catch (error) {
    console.error("Failed to build payment attestation", error);
    return jsonError("Impossible de générer l'attestation de paiement.", 500);
  }
}

/** Renvoie l'attestation de paiement à l'adhérent (action du bureau). */
export async function POST(
  _request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  const { applicationId } = await context.params;
  const limit = checkRateLimit(`receipt-resend:${auth.value.userId}:${applicationId}`, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return jsonError(
      "Trop d’envois pour ce dossier. Patientez quelques minutes avant de renvoyer l’attestation.",
      429,
    );
  }

  try {
    const result = await sendPaymentReceipt(applicationId);
    if (result.sent) {
      return jsonOk({ message: `Attestation envoyée à ${result.to}.`, sent: true });
    }
    const status =
      result.reason === "not_found" ? 404 : result.reason === "pdf_failed" || result.reason === "smtp_failed" ? 502 : 409;
    return jsonError(
      status === 502 ? receiptFailureSentence(result) : result.message,
      status,
    );
  } catch (error) {
    console.error("Failed to resend payment attestation", error);
    return jsonError("Impossible de renvoyer l’attestation. Réessayez dans un instant.", 500);
  }
}
