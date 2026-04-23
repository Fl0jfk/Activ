import { NextRequest, NextResponse } from "next/server";
import { canAccessAdminSpace, getCurrentUserContext } from "@/lib/clerk";
import { readClubData, writeClubData } from "@/lib/club-data";
import { sendEmail } from "@/lib/mailer";

function randomToken() {
  return `doc_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> },
) {
  const currentUser = await getCurrentUserContext();
  if (!currentUser || !canAccessAdminSpace(currentUser.publicFunctions)) {
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

  const token = randomToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  data.documentRequestTokens.push({
    token,
    applicationId,
    email: application.email,
    requestedDocumentLabel: documentLabel,
    createdAt: new Date().toISOString(),
    expiresAt,
    usedAt: null,
  });
  application.status = "awaiting_document";
  await writeClubData(data);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const secureLink = `${appUrl}/piece-jointe?token=${encodeURIComponent(token)}`;
  const sendResult = await sendEmail({
    to: application.email,
    subject: "Demande de document - pre-inscription",
    text: `Bonjour,\n\nMerci de deposer votre ${documentLabel} via ce lien securise: ${secureLink}\nCe lien expire le ${new Date(expiresAt).toLocaleDateString("fr-FR")}.\n`,
    html: `<p>Bonjour,</p><p>Merci de deposer votre <strong>${documentLabel}</strong> via ce lien securise :</p><p><a href="${secureLink}">${secureLink}</a></p><p>Ce lien expire le ${new Date(expiresAt).toLocaleDateString("fr-FR")}.</p>`,
  });

  return NextResponse.json({
    message: sendResult.sent
      ? "Demande de document envoyee par email."
      : "Lien genere (SMTP non configure). Envoie ce lien manuellement.",
    secureLink,
  });
}
