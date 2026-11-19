import { jsonError, jsonOk } from "@/lib/api-response";
import { requireClubOps } from "@/lib/api-auth";
import { actorName, readJsonBody, rejectionResponse } from "@/lib/application-route-utils";
import { updateClubData } from "@/lib/club-data";
import type { DocumentRequestToken, RegistrationApplication } from "@/lib/club-data";
import { TransitionRejection, applyDocumentRequest } from "@/lib/dossier-transitions";
import {
  buildDocumentRequestEmail,
  buildDocumentUploadUrl,
} from "@/lib/document-request-email";
import { sendEmail } from "@/lib/mailer";
import { checkRateLimit } from "@/lib/rate-limit";
import { syncClerkForApplication } from "@/lib/registration-clerk-sync";
import type { AppRole } from "@/lib/roles";

const DEFAULT_LABEL = "pièce justificative";

type RequestOutcome = {
  application: RegistrationApplication;
  mine: RegistrationApplication[];
  role: AppRole;
  token: DocumentRequestToken;
};

/**
 * Demande une pièce à l'adhérent : le dossier passe en « pièce demandée » (étape Pièces) et un lien
 * de dépôt neuf est envoyé ; les liens précédents sont invalidés. Le dossier reprendra l'état qu'il
 * avait avant la PREMIÈRE demande (jamais le paiement, jamais « pièce demandée »).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }
  const actor = actorName(auth.value);

  const body = await readJsonBody(request);
  const rawLabel =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { documentLabel?: unknown }).documentLabel
      : undefined;
  const documentLabel =
    (typeof rawLabel === "string" ? rawLabel.replace(/\s+/g, " ").trim().slice(0, 120) : "") || DEFAULT_LABEL;

  try {
    const { applicationId } = await context.params;

    const limit = checkRateLimit(`request-document:${applicationId}`, {
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (!limit.allowed) {
      return jsonError(
        "Trop de demandes pour ce dossier. Patientez quelques minutes avant d’envoyer une nouvelle demande.",
        429,
      );
    }

    const outcome = await updateClubData<RequestOutcome>((data) => {
      const application = data.applications.find((entry) => entry.id === applicationId);
      if (!application) {
        throw new TransitionRejection("Demande introuvable.", 404);
      }
      if (!application.email?.trim()) {
        throw new TransitionRejection("Aucune adresse e-mail sur ce dossier.", 400);
      }
      const token = applyDocumentRequest(data, application, { label: documentLabel }, { actor });
      const member = data.members.find((entry) => entry.clerkUserId === application.clerkUserId);
      return {
        application: structuredClone(application),
        mine: structuredClone(
          data.applications.filter(
            (entry) => entry.clerkUserId !== null && entry.clerkUserId === application.clerkUserId,
          ),
        ),
        role: member?.role ?? "member",
        token: structuredClone(token),
      };
    });

    const sync = await syncClerkForApplication(outcome.application, {
      applications: outcome.mine,
      role: outcome.role,
    });

    const to = outcome.application.email.trim();
    const secureLink = buildDocumentUploadUrl(outcome.token.token);
    const emailContent = buildDocumentRequestEmail({
      documentLabel,
      secureLink,
      expiresAt: outcome.token.expiresAt,
      memberName: outcome.application.fullName,
    });
    const sendResult = await sendEmail({ to, ...emailContent });

    return jsonOk({
      message: sendResult.sent
        ? `E-mail envoyé à ${to} avec le lien de dépôt.`
        : "La demande est enregistrée, mais l’e-mail n’a pas pu être envoyé. Copiez le lien et transmettez-le à l’adhérent.",
      secureLink,
      emailSent: sendResult.sent,
      warning: sync.ok ? undefined : sync.warning,
    });
  } catch (error) {
    const rejection = rejectionResponse(error);
    if (rejection) {
      return rejection;
    }
    console.error("Failed to request document", error);
    return jsonError("Impossible d’envoyer la demande. Réessayez dans un instant.", 500);
  }
}
