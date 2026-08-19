import { NextRequest, NextResponse } from "next/server";
import { canAccessClubOperations, getCurrentUserContext } from "@/lib/clerk";
import { readClubData, writeClubData } from "@/lib/club-data";
import {
  buildBulletinRevalidationEmail,
  buildBulletinRevalidationUrl,
} from "@/lib/bulletin-revalidation-email";
import { sendEmail } from "@/lib/mailer";

function randomToken() {
  return `bulletin_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ applicationId: string }> },
) {
  const currentUser = await getCurrentUserContext();
  if (!currentUser || !canAccessClubOperations(currentUser)) {
    return NextResponse.json({ message: "Non autorise." }, { status: 401 });
  }

  const { applicationId } = await context.params;
  const data = await readClubData();
  const application = data.applications.find((entry) => entry.id === applicationId);
  if (!application) {
    return NextResponse.json({ message: "Demande introuvable." }, { status: 404 });
  }
  if (!application.email?.trim()) {
    return NextResponse.json({ message: "Aucune adresse e-mail sur ce dossier." }, { status: 400 });
  }

  for (const entry of data.bulletinRevalidationTokens) {
    if (entry.applicationId === applicationId && !entry.usedAt) {
      entry.usedAt = new Date().toISOString();
    }
  }

  const token = randomToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  data.bulletinRevalidationTokens.push({
    token,
    applicationId,
    email: application.email.trim(),
    createdAt: new Date().toISOString(),
    expiresAt,
    usedAt: null,
  });
  await writeClubData(data);

  const secureLink = buildBulletinRevalidationUrl(token);
  const emailContent = buildBulletinRevalidationEmail({
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
      ? `E-mail envoyé à ${application.email.trim()} pour revalider le bulletin.`
      : "Lien généré (SMTP non configuré). Copiez-le et transmettez-le à l'adhérent.",
    secureLink,
    emailSent: sendResult.sent,
  });
}
