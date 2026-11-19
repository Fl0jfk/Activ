import { NextRequest } from "next/server";
import { abortWrite, runClubTransaction } from "@/lib/club-data-tx";
import {
  checkEmailCode,
  isValidEmail,
  normalizeVerificationEmail,
  type CheckEmailCodeResult,
} from "@/lib/email-verification";
import { accountExistsForEmail } from "@/lib/public-registration";
import { MINUTE, apiError, apiOk, limitByIp, limitByKey, readJsonBody } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

/** Valide le code reçu par e-mail et renvoie un identifiant de vérification. */
export async function POST(request: NextRequest) {
  const ipLimited = limitByIp(request, "email-confirm", { limit: 30, windowMs: 15 * MINUTE });
  if (ipLimited) return ipLimited;

  const parsed = await readJsonBody(request, 2_000);
  if (!parsed.ok) return parsed.response;

  const email = normalizeVerificationEmail(parsed.body.email);
  const code = typeof parsed.body.code === "string" ? parsed.body.code.trim() : "";

  if (!isValidEmail(email)) {
    return apiError("Adresse e-mail invalide.", 400);
  }
  if (!/^\d{6}$/.test(code)) {
    return apiError("Le code doit contenir 6 chiffres.", 400);
  }

  const emailLimited = limitByKey("email-confirm", email, { limit: 15, windowMs: 15 * MINUTE });
  if (emailLimited) return emailLimited;

  try {
    // Le compteur d'essais est modifié sous verrou : des requêtes simultanées ne peuvent pas le contourner.
    const result = await runClubTransaction<CheckEmailCodeResult>((data) => {
      const check = checkEmailCode(data, email, code);
      if (!check.ok && !check.mutated) abortWrite(check);
      return check;
    });

    if (!result.ok) {
      return apiError(result.message, 400);
    }

    // La propriété de l'adresse est prouvée : on peut dire si un compte existe déjà.
    const accountExists = await accountExistsForEmail(email);
    return apiOk({
      message: accountExists
        ? "Adresse e-mail vérifiée. Un compte existe déjà avec cette adresse."
        : "Adresse e-mail vérifiée. Vous pouvez terminer votre inscription.",
      verificationId: result.record.id,
      accountExists,
    });
  } catch (error) {
    console.error("public-email-verification/confirm : échec", error instanceof Error ? error.name : "erreur");
    return apiError("Une erreur est survenue. Réessayez dans un instant.", 500);
  }
}
