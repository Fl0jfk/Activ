import { NextRequest, NextResponse } from "next/server";
import { canAccessClubOperations, getCurrentUserContext } from "@/lib/clerk";
import { readClubData, writeClubData } from "@/lib/club-data";
import { getApplicationDossierPhase } from "@/lib/dossier-workflow";
import {
  buildDocumentRequestEmail,
  buildDocumentUploadUrl,
} from "@/lib/document-request-email";
import { sendEmail } from "@/lib/mailer";

function randomToken() {
  return `doc_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> },
) {
  const currentUser = await getCurrentUserContext();
  if (!currentUser || !canAccessClubOperations(currentUser)) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }

  const { applicationId } = await context.params;
  const payload = (await request.json()) as { documentLabel?: string };
  const documentLabel = payload.documentLabel?.trim() || "piece justificative";

  const data = await readClubData();
  const application = data.applications.find((entry) => entry.id === applicationId);
  if (!application) {
    return NextResponse.json({ message: "Demande introuvable." }, { status: 404 });
  }

  if (!application.email?.trim()) {
    return NextResponse.json({ message: "Aucune adresse e-mail sur ce dossier." }, { status: 400 });
  }

  const previousPhase = getApplicationDossierPhase(application);
  const resumeAfterUpload = {
    status: application.status,
    dossierPhase: previousPhase,
    paymentStatus: application.paymentStatus,
  };

  const token = randomToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

  for (const entry of data.documentRequestTokens) {
    if (entry.applicationId === applicationId && !entry.usedAt) {
      entry.usedAt = new Date().toISOString();
    }
  }

  data.documentRequestTokens.push({
    token,
    applicationId,
    email: application.email.trim(),
    requestedDocumentLabel: documentLabel,
    createdAt: new Date().toISOString(),
    expiresAt,
    usedAt: null,
    resumeAfterUpload,
  });

  application.status = "awaiting_document";
  if (previousPhase !== "finalized") {
    application.dossierPhase = "documents";
  }

  await writeClubData(data);

  const secureLink = buildDocumentUploadUrl(token);
  const emailContent = buildDocumentRequestEmail({
    documentLabel,
    secureLink,
    expiresAt,
    memberName: application.fullName,
  });
  const sendResult = await sendEmail({
    to: application.email.trim(),
    ...emailContent,
  });

  return NextResponse.json({
    message: sendResult.sent
      ? `E-mail envoyé à ${application.email.trim()} avec le lien de dépôt.`
      : "Lien généré (SMTP non configuré). Copiez-le et transmettez-le à l'adhérent.",
    secureLink,
    emailSent: sendResult.sent,
  });
}
