import { jsonError, jsonOk } from "@/lib/api-response";
import { readClubData, writeClubData } from "@/lib/club-data";
import {
  buildDocumentReceivedBureauEmail,
  isTokenActive,
} from "@/lib/document-request-email";
import { sendEmail } from "@/lib/mailer";
import { readSiteData } from "@/lib/site-data";
import { uploadDocumentFile, validateDocumentFile } from "@/lib/s3-upload";

function readToken(request: Request): string {
  return new URL(request.url).searchParams.get("token")?.trim() ?? "";
}

export async function GET(request: Request) {
  const token = readToken(request);
  if (!token) {
    return jsonError("Lien invalide.", 400);
  }

  const data = await readClubData();
  const tokenEntry = data.documentRequestTokens.find((entry) => entry.token === token);
  if (!tokenEntry) {
    return jsonError("Lien invalide.", 404);
  }
  if (tokenEntry.usedAt) {
    return jsonError("Ce lien a déjà été utilisé.", 410);
  }
  if (!isTokenActive(tokenEntry)) {
    return jsonError("Lien expiré.", 410);
  }

  return jsonOk({
    label: tokenEntry.requestedDocumentLabel,
    expiresAt: tokenEntry.expiresAt,
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();
  const file = formData.get("file");

  if (!token) {
    return jsonError("Requete invalide.", 400);
  }

  const validated = validateDocumentFile(file instanceof File ? file : null);
  if (!validated.ok) {
    return jsonError(validated.message, 400);
  }

  const data = await readClubData();
  const tokenEntry = data.documentRequestTokens.find((entry) => entry.token === token);
  if (!tokenEntry || tokenEntry.usedAt) {
    return jsonError("Lien invalide ou deja utilise.", 400);
  }
  if (!isTokenActive(tokenEntry)) {
    return jsonError("Lien expire.", 400);
  }

  const application = data.applications.find((entry) => entry.id === tokenEntry.applicationId);
  if (!application) {
    return jsonError("Demande introuvable.", 404);
  }

  try {
    const uploaded = await uploadDocumentFile(validated.file, {
      keyPrefix: "data/club-documents/public",
      userSegment: application.id,
    });

    const documentName = tokenEntry.requestedDocumentLabel.trim() || uploaded.name;
    application.documents.push({
      name: documentName,
      url: uploaded.url,
      uploadedAt: uploaded.uploadedAt,
    });

    if (tokenEntry.resumeAfterUpload) {
      application.status = tokenEntry.resumeAfterUpload.status;
      application.dossierPhase = tokenEntry.resumeAfterUpload.dossierPhase;
      application.paymentStatus = tokenEntry.resumeAfterUpload.paymentStatus;
    } else if (application.status === "awaiting_document") {
      application.status = "pending";
    }

    tokenEntry.usedAt = new Date().toISOString();
    await writeClubData(data);

    const siteData = await readSiteData();
    const bureauEmail = siteData.association.contactEmail?.trim();
    if (bureauEmail) {
      const bureauMail = buildDocumentReceivedBureauEmail({
        memberName: application.fullName || application.email,
        memberEmail: application.email,
        documentLabel: tokenEntry.requestedDocumentLabel,
        fileName: documentName,
      });
      await sendEmail({ to: bureauEmail, ...bureauMail });
    }

    return jsonOk({ message: "Document recu, merci." });
  } catch (error) {
    console.error("Failed public document upload", error);
    if (error instanceof Error && error.message.includes("BUCKET_NAME")) {
      return jsonError("Bucket non configure.", 500);
    }
    return jsonError("Erreur serveur.", 500);
  }
}
