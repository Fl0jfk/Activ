import { jsonError, jsonOk } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { readJsonBody, rejectionResponse } from "@/lib/application-route-utils";
import { updateClubData } from "@/lib/club-data";
import type { DocumentRequestToken, RegistrationApplication } from "@/lib/club-data";
import {
  buildDocumentRequestEmail,
  buildDocumentUploadUrl,
} from "@/lib/document-request-email";
import { TransitionRejection, reissueDocumentToken } from "@/lib/dossier-transitions";
import { sendEmail } from "@/lib/mailer";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Adhérent dont le lien de dépôt a expiré : génère un lien neuf pour la pièce déjà demandée par le
 * bureau (les anciens liens sont invalidés) et l'envoie à l'adresse e-mail du dossier. Le lien est
 * aussi renvoyé dans la réponse (réservée au propriétaire du dossier) si la messagerie est en panne.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }
  const user = auth.value;

  const limit = checkRateLimit(`resend-document-link:${user.userId}`, {
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return jsonError(
      "Vous avez déjà demandé plusieurs liens. Patientez un peu avant d’en demander un nouveau, ou contactez le bureau.",
      429,
    );
  }

  const body = await readJsonBody(request);
  const requestedId =
    body && typeof body === "object" && !Array.isArray(body) && typeof (body as { applicationId?: unknown }).applicationId === "string"
      ? (body as { applicationId: string }).applicationId
      : null;

  try {
    const { application, token } = await updateClubData<{
      application: RegistrationApplication;
      token: DocumentRequestToken;
    }>((data) => {
      const mine = data.applications.filter(
        (entry) =>
          entry.clerkUserId === user.userId &&
          entry.status === "awaiting_document" &&
          (!requestedId || entry.id === requestedId),
      );
      const target = mine.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!target) {
        throw new TransitionRejection(
          "Aucune pièce n’est actuellement demandée sur votre dossier.",
          404,
        );
      }
      const created = reissueDocumentToken(data, target);
      return { application: structuredClone(target), token: structuredClone(created) };
    });

    const uploadUrl = buildDocumentUploadUrl(token.token);
    const emailContent = buildDocumentRequestEmail({
      documentLabel: token.requestedDocumentLabel,
      secureLink: uploadUrl,
      expiresAt: token.expiresAt,
      memberName: application.fullName,
    });
    const sendResult = await sendEmail({ to: application.email.trim(), ...emailContent });

    return jsonOk({
      message: sendResult.sent
        ? "Un nouveau lien vous a été envoyé par e-mail. Vous pouvez aussi l’utiliser directement avec le bouton ci-dessous."
        : "Votre nouveau lien est prêt, mais l’e-mail n’a pas pu partir. Utilisez le bouton « Déposer le document ».",
      uploadUrl,
      label: token.requestedDocumentLabel,
      emailSent: sendResult.sent,
    });
  } catch (error) {
    const rejection = rejectionResponse(error);
    if (rejection) {
      return rejection;
    }
    console.error("Failed to resend document link", error);
    return jsonError("Impossible de générer un nouveau lien. Réessayez dans un instant.", 500);
  }
}
