import { jsonError, jsonOk } from "@/lib/api-response";
import { requireClubOps } from "@/lib/api-auth";
import { rejectionResponse } from "@/lib/application-route-utils";
import {
  buildBulletinRevalidationEmail,
  buildBulletinRevalidationUrl,
} from "@/lib/bulletin-revalidation-email";
import { updateClubData } from "@/lib/club-data";
import type { BulletinRevalidationToken, RegistrationApplication } from "@/lib/club-data";
import { TransitionRejection, isClosedApplication } from "@/lib/dossier-transitions";
import { secureToken } from "@/lib/ids";
import { sendEmail } from "@/lib/mailer";
import { checkRateLimit } from "@/lib/rate-limit";

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Envoie à l'adhérent un lien neuf pour relire et signer de nouveau son bulletin (anciens liens invalidés). */
export async function POST(
  _request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { applicationId } = await context.params;

    const limit = checkRateLimit(`bulletin-revalidation:${applicationId}`, {
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (!limit.allowed) {
      return jsonError(
        "Trop de demandes pour ce dossier. Patientez quelques minutes avant d’en envoyer une nouvelle.",
        429,
      );
    }

    const { application, token } = await updateClubData<{
      application: RegistrationApplication;
      token: BulletinRevalidationToken;
    }>((data) => {
      const found = data.applications.find((entry) => entry.id === applicationId);
      if (!found) {
        throw new TransitionRejection("Demande introuvable.", 404);
      }
      if (isClosedApplication(found)) {
        throw new TransitionRejection(
          "Ce dossier est clos (refusé ou désinscrit) : le bulletin ne peut plus être renvoyé.",
          409,
          "dossier_closed",
        );
      }
      if (!found.email?.trim()) {
        throw new TransitionRejection("Aucune adresse e-mail sur ce dossier.", 400);
      }

      const now = new Date();
      for (const entry of data.bulletinRevalidationTokens) {
        if (entry.applicationId === applicationId && !entry.usedAt) {
          entry.usedAt = now.toISOString();
        }
      }
      const created: BulletinRevalidationToken = {
        token: `bulletin_${secureToken()}`,
        applicationId,
        email: found.email.trim(),
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
        usedAt: null,
      };
      data.bulletinRevalidationTokens.push(created);
      return { application: structuredClone(found), token: created };
    });

    const to = application.email.trim();
    const secureLink = buildBulletinRevalidationUrl(token.token);
    const emailContent = buildBulletinRevalidationEmail({
      secureLink,
      expiresAt: token.expiresAt,
      memberName: application.fullName,
    });
    const sendResult = await sendEmail({ to, ...emailContent });

    return jsonOk({
      message: sendResult.sent
        ? `E-mail envoyé à ${to} pour revalider le bulletin.`
        : "La demande est enregistrée, mais l’e-mail n’a pas pu être envoyé. Copiez le lien et transmettez-le à l’adhérent.",
      secureLink,
      emailSent: sendResult.sent,
    });
  } catch (error) {
    const rejection = rejectionResponse(error);
    if (rejection) {
      return rejection;
    }
    console.error("Failed to request bulletin revalidation", error);
    return jsonError("Impossible d’envoyer la demande. Réessayez dans un instant.", 500);
  }
}
