import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { readClubData, writeClubData } from "@/lib/club-data";
import {
  isValidEmail,
  normalizeVerificationEmail,
  verifyEmailCode,
} from "@/lib/email-verification";

export const dynamic = "force-dynamic";

/** Valide le code reçu par e-mail et renvoie un identifiant de vérification. */
export async function POST(request: NextRequest) {
  let payload: { email?: string; code?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Corps de requête invalide.", 400);
  }

  const email = normalizeVerificationEmail(payload.email ?? "");
  const code = (payload.code ?? "").trim();

  if (!isValidEmail(email)) {
    return jsonError("Adresse e-mail invalide.", 400);
  }
  if (!/^\d{6}$/.test(code)) {
    return jsonError("Le code doit contenir 6 chiffres.", 400);
  }

  const data = await readClubData();
  const result = verifyEmailCode(data, email, code);
  await writeClubData(data);

  if (!result.ok) {
    return jsonError(result.message, 400);
  }

  return jsonOk({
    message: "Adresse e-mail vérifiée. Vous pouvez terminer votre inscription.",
    verificationId: result.record.id,
  });
}
