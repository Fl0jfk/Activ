import { NextRequest, NextResponse } from "next/server";
import { validateMembershipBulletinPayload } from "@/lib/membership-bulletin";
import { buildMembershipActivityCatalog } from "@/lib/membership-activities";
import { BulletinPdfError, buildMembershipBulletinPdf } from "@/lib/membership-bulletin-pdf";
import { MINUTE, apiError, limitByIp, readJsonBody } from "@/lib/request-guard";
import { inspectSignatureDataUrl } from "@/lib/signature-image";
import { readSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_500_000;

/** Aperçu du PDF : fonctionne sans mot de passe ni vérification d'adresse e-mail, et n'enregistre rien. */
export async function POST(request: NextRequest) {
  const limited = limitByIp(request, "bulletin-preview", { limit: 20, windowMs: 10 * MINUTE });
  if (limited) return limited;

  const parsed = await readJsonBody(request, MAX_BODY_BYTES);
  if (!parsed.ok) return parsed.response;

  try {
    const siteData = await readSiteData();
    const activityOptions = buildMembershipActivityCatalog(siteData);
    const validation = validateMembershipBulletinPayload(parsed.body, {
      requirePassword: false,
      activityOptions,
    });
    if (!validation.ok) {
      return apiError(validation.message, 400, { code: "validation", fieldErrors: validation.fieldErrors });
    }

    const signature = inspectSignatureDataUrl(validation.payload.signatureDataUrl);
    if (!signature.ok) {
      return apiError(signature.message, 400, {
        code: "validation",
        fieldErrors: { signature: signature.message },
      });
    }

    const pdfBytes = await buildMembershipBulletinPdf(validation.payload, { activityOptions });
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="bulletin-adhesion-apercu.pdf"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof BulletinPdfError) {
      return apiError(error.message, 400, { code: "validation", fieldErrors: { signature: error.message } });
    }
    console.error("Aperçu du bulletin impossible", error instanceof Error ? error.name : "erreur");
    return apiError("Impossible de générer l'aperçu du bulletin. Réessayez dans un instant.", 500);
  }
}
