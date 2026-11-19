import { jsonError, jsonOk } from "@/lib/api-response";
import { requireClubOps } from "@/lib/api-auth";
import { actorName, rejectionResponse } from "@/lib/application-route-utils";
import { readClubData, updateClubData } from "@/lib/club-data";
import type { RegistrationApplication } from "@/lib/club-data";
import {
  TransitionRejection,
  applyDocumentAddedByStaff,
  isClosedApplication,
} from "@/lib/dossier-transitions";
import { syncClerkForApplication } from "@/lib/registration-clerk-sync";
import type { AppRole } from "@/lib/roles";
import { uploadDocumentFile, validateDocumentFile } from "@/lib/s3-upload";

type UploadOutcome = {
  application: RegistrationApplication;
  mine: RegistrationApplication[];
  role: AppRole;
  resumed: boolean;
  document: RegistrationApplication["documents"][number];
};

const CLOSED_MESSAGE =
  "Ce dossier est clos (refusé ou désinscrit) : aucune pièce ne peut être ajoutée.";

/**
 * Ajout d'une pièce par le bureau. Ne fait jamais avancer le dossier ; si une pièce était
 * demandée à l'adhérent, la demande est close et le dossier reprend l'état d'avant la demande.
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

  try {
    const { applicationId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    const label = String(formData.get("label") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    const validated = validateDocumentFile(file instanceof File ? file : null);
    if (!validated.ok) {
      return jsonError(validated.message, 400);
    }

    // Vérification avant l'envoi du fichier (évite un fichier orphelin sur un dossier clos).
    const current = (await readClubData()).applications.find((entry) => entry.id === applicationId);
    if (!current) {
      return jsonError("Demande introuvable.", 404);
    }
    if (isClosedApplication(current)) {
      return jsonError(CLOSED_MESSAGE, 409);
    }

    const uploaded = await uploadDocumentFile(validated.file, {
      keyPrefix: "data/club-documents/staff",
      userSegment: applicationId,
    });
    const document = {
      name: label || uploaded.name,
      url: uploaded.url,
      uploadedAt: uploaded.uploadedAt,
    };

    const outcome = await updateClubData<UploadOutcome>((data) => {
      const application = data.applications.find((entry) => entry.id === applicationId);
      if (!application) {
        throw new TransitionRejection("Demande introuvable.", 404);
      }
      const { resumed } = applyDocumentAddedByStaff(data, application, document, { actor });
      const member = data.members.find((entry) => entry.clerkUserId === application.clerkUserId);
      return {
        application: structuredClone(application),
        mine: structuredClone(
          data.applications.filter(
            (entry) => entry.clerkUserId !== null && entry.clerkUserId === application.clerkUserId,
          ),
        ),
        role: member?.role ?? "member",
        resumed,
        document,
      };
    });

    let warning: string | undefined;
    if (outcome.resumed) {
      const sync = await syncClerkForApplication(outcome.application, {
        applications: outcome.mine,
        role: outcome.role,
      });
      if (!sync.ok) warning = sync.warning;
    }

    return jsonOk({
      message: outcome.resumed
        ? "Pièce ajoutée : la demande de pièce est close et le dossier reprend son cours."
        : "Pièce jointe ajoutée.",
      document: outcome.document,
      warning,
    });
  } catch (error) {
    const rejection = rejectionResponse(error);
    if (rejection) {
      return rejection;
    }
    console.error("Failed to upload application document", error);
    return jsonError("Impossible d’ajouter la pièce. Réessayez dans un instant.", 500);
  }
}
