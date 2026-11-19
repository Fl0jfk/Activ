import { NextRequest, after } from "next/server";
import { abortWrite, runClubTransaction } from "@/lib/club-data-tx";
import { readClubData } from "@/lib/club-data";
import {
  buildMembershipBulletinRecord,
  validateMembershipBulletinPayload,
} from "@/lib/membership-bulletin";
import {
  buildMembershipActivityCatalog,
  resolveMembershipDisciplineIds,
} from "@/lib/membership-activities";
import { BulletinPdfError, buildMembershipBulletinPdf } from "@/lib/membership-bulletin-pdf";
import { isBulletinRevalidationTokenActive } from "@/lib/bulletin-revalidation-email";
import { sendEmail } from "@/lib/mailer";
import { buildBulletinRevalidatedEmail } from "@/lib/registration-emails";
import { MINUTE, apiError, apiOk, limitByIp, readJsonBody } from "@/lib/request-guard";
import { inspectSignatureDataUrl } from "@/lib/signature-image";
import { readSiteData } from "@/lib/site-data";
import { deleteStoredDocument, uploadBytesToS3 } from "@/lib/s3-upload";
import { slugify } from "@/lib/slug";
import { findByToken, isPlausibleToken } from "@/lib/token-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BODY_BYTES = 1_500_000;
const INVALID_LINK = "Ce lien n'est pas valide.";
const USED_LINK = "Ce lien a déjà été utilisé.";
const EXPIRED_LINK = "Ce lien a expiré. Demandez-en un nouveau au bureau de l'association.";
const CLOSED_MESSAGE = "Ce dossier n'est plus ouvert. Contactez le bureau de l'association.";

function readToken(request: NextRequest): string {
  return request.nextUrl.searchParams.get("token")?.trim() ?? "";
}

export async function GET(request: NextRequest) {
  const limited = limitByIp(request, "bulletin-revalidate-get", { limit: 30, windowMs: 10 * MINUTE });
  if (limited) return limited;

  const token = readToken(request);
  if (!isPlausibleToken(token)) return apiError(INVALID_LINK, 400);

  const data = await readClubData();
  const tokenEntry = findByToken(data.bulletinRevalidationTokens, token);
  if (!tokenEntry) return apiError(INVALID_LINK, 404);
  if (tokenEntry.usedAt) return apiError(USED_LINK, 410);
  if (!isBulletinRevalidationTokenActive(tokenEntry)) return apiError(EXPIRED_LINK, 410);

  const application = data.applications.find((entry) => entry.id === tokenEntry.applicationId);
  if (!application) return apiError("Dossier introuvable.", 404);

  // Uniquement ce dont le formulaire a besoin pour être prérempli.
  const bulletin = application.membershipBulletin;
  return apiOk({
    firstName: application.firstName,
    lastName: application.lastName,
    phone: application.phone,
    address: application.address,
    postalCode: application.postalCode,
    city: application.city,
    email: application.email,
    birthDate: bulletin?.birthDate ?? "",
    emergencyContactName: bulletin?.emergencyContactName ?? "",
    emergencyContactPhone: bulletin?.emergencyContactPhone ?? "",
    selectedSlots: bulletin?.selectedSlots ?? [],
    paymentPlan: bulletin?.paymentPlan ?? "once",
    imageRights: bulletin?.imageRights ?? "authorize",
    signedPlace: bulletin?.signedPlace ?? "Sainte-Croix",
  });
}

type RevalidateOutcome =
  | { kind: "ok"; email: string; firstName: string }
  | { kind: "invalid" | "used" | "expired" | "closed" };

export async function POST(request: NextRequest) {
  const limited = limitByIp(request, "bulletin-revalidate-post", { limit: 8, windowMs: 10 * MINUTE });
  if (limited) return limited;

  const parsed = await readJsonBody(request, MAX_BODY_BYTES);
  if (!parsed.ok) return parsed.response;

  const token = typeof parsed.body.token === "string" ? parsed.body.token.trim() : "";
  if (!isPlausibleToken(token)) return apiError(INVALID_LINK, 400);

  let uploadedUrl: string | null = null;
  try {
    const current = await readClubData();
    const precheck = findByToken(current.bulletinRevalidationTokens, token);
    if (!precheck) return apiError(INVALID_LINK, 400);
    if (precheck.usedAt) return apiError(USED_LINK, 400);
    if (!isBulletinRevalidationTokenActive(precheck)) return apiError(EXPIRED_LINK, 410);
    const precheckApplication = current.applications.find((entry) => entry.id === precheck.applicationId);
    if (!precheckApplication) return apiError("Dossier introuvable.", 404);
    if (precheckApplication.status === "rejected" || precheckApplication.status === "cancelled") {
      return apiError(CLOSED_MESSAGE, 410);
    }

    // L'adresse e-mail du dossier ne peut pas être changée avec ce lien : celle envoyée par le navigateur est ignorée.
    const siteData = await readSiteData();
    const activityOptions = buildMembershipActivityCatalog(siteData);
    const validation = validateMembershipBulletinPayload(
      { ...parsed.body, email: precheckApplication.email },
      { requirePassword: false, activityOptions },
    );
    if (!validation.ok) {
      return apiError(validation.message, 400, { code: "validation", fieldErrors: validation.fieldErrors });
    }
    const payload = validation.payload;

    const signature = inspectSignatureDataUrl(payload.signatureDataUrl);
    if (!signature.ok) {
      return apiError(signature.message, 400, {
        code: "validation",
        fieldErrors: { signature: signature.message },
      });
    }

    const pdfBytes = await buildMembershipBulletinPdf(payload, { activityOptions });
    const uploadedPdf = await uploadBytesToS3({
      body: pdfBytes,
      keyPrefix: "data/club-documents/bulletins",
      fileName: `bulletin-adhesion-${slugify(payload.lastName) || "adherent"}.pdf`,
      contentType: "application/pdf",
      userSegment: precheckApplication.clerkUserId || precheckApplication.id,
    });
    uploadedUrl = uploadedPdf.url;

    // Jeton consommé et dossier modifié dans la même opération, sur des données relues.
    const outcome = await runClubTransaction<RevalidateOutcome>((data) => {
      const tokenEntry = findByToken(data.bulletinRevalidationTokens, token);
      if (!tokenEntry) abortWrite({ kind: "invalid" });
      if (tokenEntry.usedAt) abortWrite({ kind: "used" });
      if (!isBulletinRevalidationTokenActive(tokenEntry)) abortWrite({ kind: "expired" });

      const application = data.applications.find((entry) => entry.id === tokenEntry.applicationId);
      if (!application) abortWrite({ kind: "invalid" });
      if (application.status === "rejected" || application.status === "cancelled") {
        abortWrite({ kind: "closed" });
      }

      application.firstName = payload.firstName;
      application.lastName = payload.lastName;
      application.fullName = `${payload.firstName} ${payload.lastName}`.trim();
      application.phone = payload.phone;
      application.address = payload.address;
      application.postalCode = payload.postalCode;
      application.city = payload.city;
      application.membershipBulletin = buildMembershipBulletinRecord(payload, { activityOptions });
      const disciplineIds = resolveMembershipDisciplineIds(payload.selectedSlots, activityOptions);
      if (disciplineIds.length > 0 && !application.disciplinesSetByBureau) {
        application.disciplineIds = disciplineIds;
        application.disciplineId = disciplineIds[0]!;
      }
      application.documents.push(uploadedPdf);
      tokenEntry.usedAt = new Date().toISOString();

      return { kind: "ok", email: application.email, firstName: application.firstName };
    });

    if (outcome.kind !== "ok") {
      await deleteStoredDocument(uploadedPdf.url);
      uploadedUrl = null;
      if (outcome.kind === "used") return apiError(USED_LINK, 409);
      if (outcome.kind === "expired") return apiError(EXPIRED_LINK, 410);
      if (outcome.kind === "closed") return apiError(CLOSED_MESSAGE, 410);
      return apiError(INVALID_LINK, 400);
    }
    uploadedUrl = null;

    after(async () => {
      try {
        const result = await sendEmail({
          to: outcome.email,
          ...buildBulletinRevalidatedEmail({ firstName: outcome.firstName }),
          attachments: [
            { filename: uploadedPdf.name, content: pdfBytes, contentType: "application/pdf" },
          ],
        });
        if (!result.sent) {
          console.error("Revalidation du bulletin : e-mail de confirmation non envoyé", result.reason);
        }
      } catch (error) {
        console.error("Revalidation du bulletin : e-mail de confirmation en erreur", error);
      }
    });

    return apiOk({ ok: true, message: "Bulletin revalidé avec succès." });
  } catch (error) {
    if (uploadedUrl) await deleteStoredDocument(uploadedUrl);
    if (error instanceof BulletinPdfError) {
      return apiError(error.message, 400, { code: "validation", fieldErrors: { signature: error.message } });
    }
    console.error("Revalidation du bulletin impossible", error instanceof Error ? error.name : "erreur");
    return apiError("Une erreur est survenue. Réessayez dans un instant.", 500);
  }
}
