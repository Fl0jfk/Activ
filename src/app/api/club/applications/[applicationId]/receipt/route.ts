import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { canAccessClubOperations } from "@/lib/clerk";
import { loadClubData, requireApplication } from "@/lib/club-repository";
import { buildPaymentReceiptPdf } from "@/lib/payment-receipt-pdf";
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
  const data = await loadClubData();
  const applicationResult = requireApplication(data, applicationId);
  if (applicationResult instanceof NextResponse) {
    return applicationResult;
  }
  const application = applicationResult;

  const isAdmin = canAccessClubOperations(auth.value);
  const isOwner =
    Boolean(application.clerkUserId) && application.clerkUserId === auth.value.userId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  if (application.paymentStatus !== "paid") {
    return NextResponse.json(
      { message: "Aucun paiement encaissé pour ce dossier." },
      { status: 409 },
    );
  }

  try {
    const siteData = await readSiteData();
    const pdfBytes = await buildPaymentReceiptPdf({ application, siteData });
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${receiptFileName(application)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to build payment attestation", error);
    return NextResponse.json(
      { message: "Impossible de générer l'attestation de paiement." },
      { status: 500 },
    );
  }
}
