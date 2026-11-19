import { after } from "next/server";
import { resolveBureauRecipient } from "@/lib/bureau-recipient";
import { abortWrite, runClubTransaction } from "@/lib/club-data-tx";
import { readClubData } from "@/lib/club-data";
import { applyDocumentUploadResume } from "@/lib/dossier-transitions";
import { buildDocumentReceivedBureauEmail, isTokenActive } from "@/lib/document-request-email";
import { singleLine } from "@/lib/email-html";
import { sendEmail } from "@/lib/mailer";
import {
  MINUTE,
  apiError,
  apiOk,
  limitByIp,
  rejectOversizedUpload,
} from "@/lib/request-guard";
import {
  MAX_DOCUMENT_FILE_SIZE,
  deleteStoredDocument,
  isInvalidDocumentError,
  uploadDocumentFile,
  validateDocumentFile,
} from "@/lib/s3-upload";
import { findByToken, isPlausibleToken } from "@/lib/token-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const INVALID_LINK = "Ce lien n'est pas valide.";
const USED_LINK = "Ce lien a déjà été utilisé.";
const EXPIRED_LINK = "Ce lien a expiré. Demandez-en un nouveau au bureau de l'association.";

function readToken(request: Request): string {
  return new URL(request.url).searchParams.get("token")?.trim() ?? "";
}

export async function GET(request: Request) {
  const limited = limitByIp(request, "document-upload-get", { limit: 30, windowMs: 10 * MINUTE });
  if (limited) return limited;

  const token = readToken(request);
  if (!isPlausibleToken(token)) {
    return apiError(INVALID_LINK, 400);
  }

  const data = await readClubData();
  const tokenEntry = findByToken(data.documentRequestTokens, token);
  if (!tokenEntry) {
    return apiError(INVALID_LINK, 404);
  }
  if (tokenEntry.usedAt) {
    return apiError(USED_LINK, 410);
  }
  if (!isTokenActive(tokenEntry)) {
    return apiError(EXPIRED_LINK, 410);
  }

  return apiOk({
    label: tokenEntry.requestedDocumentLabel,
    expiresAt: tokenEntry.expiresAt,
  });
}

type UploadOutcome =
  | { kind: "ok"; memberName: string; memberEmail: string; documentLabel: string; documentName: string }
  | { kind: "invalid" | "used" | "expired" | "closed" };

export async function POST(request: Request) {
  const limited = limitByIp(request, "document-upload-post", { limit: 10, windowMs: 15 * MINUTE });
  if (limited) return limited;

  const oversized = rejectOversizedUpload(request, MAX_DOCUMENT_FILE_SIZE + 1024 * 1024);
  if (oversized) return oversized;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Requête invalide.", 400);
  }

  const tokenValue = formData.get("token");
  const token = typeof tokenValue === "string" ? tokenValue.trim() : "";
  const file = formData.get("file");

  if (!isPlausibleToken(token)) {
    return apiError(INVALID_LINK, 400);
  }

  const validated = validateDocumentFile(file instanceof File ? file : null);
  if (!validated.ok) {
    return apiError(validated.message, 400);
  }

  let uploadedUrl: string | null = null;
  try {
    // Contrôle préalable (lecture seule) pour ne rien envoyer vers le stockage avec un lien inutilisable.
    const current = await readClubData();
    const precheck = findByToken(current.documentRequestTokens, token);
    if (!precheck || precheck.usedAt) {
      return apiError(precheck ? USED_LINK : INVALID_LINK, 400);
    }
    if (!isTokenActive(precheck)) {
      return apiError(EXPIRED_LINK, 410);
    }
    const precheckApplication = current.applications.find((entry) => entry.id === precheck.applicationId);
    if (!precheckApplication) {
      return apiError("Dossier introuvable.", 404);
    }

    const uploaded = await uploadDocumentFile(validated.file, {
      keyPrefix: "data/club-documents/public",
      userSegment: precheckApplication.id,
    });
    uploadedUrl = uploaded.url;

    // Jeton consommé et dossier mis à jour dans la même opération : deux envois simultanés ne peuvent pas réutiliser le lien.
    const outcome = await runClubTransaction<UploadOutcome>((data) => {
      const tokenEntry = findByToken(data.documentRequestTokens, token);
      if (!tokenEntry) abortWrite({ kind: "invalid" });
      if (tokenEntry.usedAt) abortWrite({ kind: "used" });
      if (!isTokenActive(tokenEntry)) abortWrite({ kind: "expired" });

      const application = data.applications.find((entry) => entry.id === tokenEntry.applicationId);
      if (!application) abortWrite({ kind: "invalid" });
      if (application.status === "rejected" || application.status === "cancelled") {
        abortWrite({ kind: "closed" });
      }

      const documentName = singleLine(tokenEntry.requestedDocumentLabel, 150) || uploaded.name;
      application.documents.push({ name: documentName, url: uploaded.url, uploadedAt: uploaded.uploadedAt });

      // Le dossier ne change d'étape que s'il attend encore cette pièce ; le paiement n'est jamais modifié.
      applyDocumentUploadResume(application, tokenEntry);

      tokenEntry.usedAt = new Date().toISOString();
      return {
        kind: "ok",
        memberName: application.fullName || application.email,
        memberEmail: application.email,
        documentLabel: tokenEntry.requestedDocumentLabel,
        documentName,
      };
    });

    if (outcome.kind !== "ok") {
      await deleteStoredDocument(uploaded.url);
      uploadedUrl = null;
      if (outcome.kind === "used") return apiError(USED_LINK, 409);
      if (outcome.kind === "expired") return apiError(EXPIRED_LINK, 410);
      if (outcome.kind === "closed") {
        return apiError("Ce dossier n'est plus ouvert. Contactez le bureau de l'association.", 410);
      }
      return apiError(INVALID_LINK, 400);
    }
    uploadedUrl = null;

    after(async () => {
      try {
        const to = await resolveBureauRecipient();
        if (!to) {
          console.warn("public-document-upload : aucune adresse bureau pour la notification");
          return;
        }
        const result = await sendEmail({
          to,
          ...buildDocumentReceivedBureauEmail({
            memberName: outcome.memberName,
            memberEmail: outcome.memberEmail,
            documentLabel: outcome.documentLabel,
            fileName: outcome.documentName,
          }),
        });
        if (!result.sent) {
          console.error("public-document-upload : notification du bureau non envoyée", result.reason);
        }
      } catch (error) {
        console.error("public-document-upload : notification du bureau en erreur", error);
      }
    });

    return apiOk({ ok: true, message: "Document reçu, merci." });
  } catch (error) {
    if (uploadedUrl) await deleteStoredDocument(uploadedUrl);
    if (isInvalidDocumentError(error)) {
      return apiError(error.message, 400);
    }
    console.error("public-document-upload : échec", error instanceof Error ? error.name : "erreur");
    return apiError("Une erreur est survenue. Réessayez dans un instant.", 500);
  }
}
