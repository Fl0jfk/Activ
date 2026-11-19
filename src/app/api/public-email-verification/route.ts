import { NextRequest } from "next/server";
import { runClubTransaction, abortWrite } from "@/lib/club-data-tx";
import {
  EMAIL_CODE_RESEND_SECONDS,
  EMAIL_CODE_TTL_MINUTES,
  discardEmailVerificationRecord,
  isEmailVerificationConfigured,
  isValidEmail,
  issueEmailVerificationCode,
  normalizeVerificationEmail,
  type IssueEmailCodeResult,
} from "@/lib/email-verification";
import { isMailConfigured, sendEmail } from "@/lib/mailer";
import { buildVerificationCodeEmail } from "@/lib/registration-emails";
import {
  HOUR,
  apiError,
  apiOk,
  limitByIp,
  limitByKey,
  rateLimitedResponse,
  readJsonBody,
} from "@/lib/request-guard";

export const dynamic = "force-dynamic";

const UNAVAILABLE_MESSAGE =
  "L'envoi du code de vérification n'est pas disponible pour le moment. Réessayez plus tard ou contactez le bureau.";

/** Envoie un code à 6 chiffres pour confirmer l'adresse avant création du compte. */
export async function POST(request: NextRequest) {
  const ipLimited = limitByIp(request, "email-code", { limit: 12, windowMs: HOUR });
  if (ipLimited) return ipLimited;

  const parsed = await readJsonBody(request, 2_000);
  if (!parsed.ok) return parsed.response;

  const email = normalizeVerificationEmail(parsed.body.email);
  if (!isValidEmail(email)) {
    return apiError("Adresse e-mail invalide.", 400, { fieldErrors: { email: "Adresse e-mail invalide." } });
  }

  const emailLimited = limitByKey("email-code", email, { limit: 8, windowMs: HOUR });
  if (emailLimited) return emailLimited;

  if (!isMailConfigured() || !isEmailVerificationConfigured()) {
    console.error("public-email-verification : e-mails ou EMAIL_VERIFICATION_SECRET non configurés");
    return apiError(UNAVAILABLE_MESSAGE, 503);
  }

  try {
    // Le code est enregistré (avec ses plafonds, sous verrou) avant d'être envoyé.
    const issued = await runClubTransaction<IssueEmailCodeResult>((data) => {
      const result = issueEmailVerificationCode(data, email);
      if (!result.ok) abortWrite(result);
      return result;
    });
    if (!issued.ok) {
      return rateLimitedResponse(issued.retryAfterSeconds, issued.message);
    }

    const content = buildVerificationCodeEmail({ code: issued.code, ttlMinutes: EMAIL_CODE_TTL_MINUTES });
    const result = await sendEmail({ to: email, ...content });

    if (!result.sent) {
      try {
        await runClubTransaction((data) => discardEmailVerificationRecord(data, issued.record.id));
      } catch (error) {
        console.error("public-email-verification : annulation du code impossible", error);
      }
      if (result.reason === "invalid_address" || result.reason === "mailbox_unavailable") {
        return apiError(
          "Cette adresse e-mail semble invalide ou injoignable. Vérifiez-la ou utilisez une autre adresse.",
          400,
          { fieldErrors: { email: "Adresse e-mail injoignable." } },
        );
      }
      return apiError(
        result.reason === "smtp_not_configured"
          ? UNAVAILABLE_MESSAGE
          : "Le code n'a pas pu être envoyé pour le moment. Réessayez dans quelques minutes.",
        result.reason === "smtp_not_configured" ? 503 : 502,
      );
    }

    return apiOk({
      message: `Un code à 6 chiffres vient d'être envoyé à ${email}. Il est valable ${EMAIL_CODE_TTL_MINUTES} minutes.`,
      retryAfterSeconds: EMAIL_CODE_RESEND_SECONDS,
      expiresInMinutes: EMAIL_CODE_TTL_MINUTES,
    });
  } catch (error) {
    console.error("public-email-verification : échec", error instanceof Error ? error.name : "erreur");
    return apiError("Une erreur est survenue. Réessayez dans un instant.", 500);
  }
}
