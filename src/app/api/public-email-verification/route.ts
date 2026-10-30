import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { readClubData, writeClubData } from "@/lib/club-data";
import {
  EMAIL_CODE_TTL_MINUTES,
  createEmailVerificationCode,
  isValidEmail,
  normalizeVerificationEmail,
} from "@/lib/email-verification";
import { sendEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

/** Envoie un code à 6 chiffres pour confirmer l'adresse avant création du compte. */
export async function POST(request: NextRequest) {
  let payload: { email?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Corps de requête invalide.", 400);
  }

  const email = normalizeVerificationEmail(payload.email ?? "");
  if (!isValidEmail(email)) {
    return jsonError("Adresse e-mail invalide.", 400);
  }

  const data = await readClubData();
  const created = createEmailVerificationCode(data, email);
  if (!created.ok) {
    return jsonError(created.message, 429);
  }

  const result = await sendEmail({
    to: email,
    subject: "[Activ'] Votre code de vérification",
    text: `Bonjour,\n\nVoici votre code de vérification : ${created.code}\n\nIl est valable ${EMAIL_CODE_TTL_MINUTES} minutes et ne peut être utilisé qu'une fois.\nSi vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.\n\nSportivement,\nL'équipe Activ'`,
    html: `<p>Bonjour,</p><p>Voici votre code de vérification :</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${created.code}</p><p>Il est valable ${EMAIL_CODE_TTL_MINUTES} minutes et ne peut être utilisé qu'une fois.</p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.</p><p>Sportivement,<br/>L'équipe Activ'</p>`,
  });

  if (!result.sent) {
    return jsonError(
      result.reason === "smtp_not_configured"
        ? "L'envoi d'e-mails n'est pas configuré sur le serveur. Contactez le bureau."
        : `Impossible d'envoyer le code à cette adresse (${result.detail}). Vérifiez l'adresse saisie.`,
      502,
    );
  }

  await writeClubData(data);

  return jsonOk({
    message: `Un code à 6 chiffres vient d'être envoyé à ${email}. Il est valable ${EMAIL_CODE_TTL_MINUTES} minutes.`,
    expiresInMinutes: EMAIL_CODE_TTL_MINUTES,
  });
}
