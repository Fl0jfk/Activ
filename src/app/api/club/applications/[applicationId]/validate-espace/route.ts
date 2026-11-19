import { jsonError, jsonOk } from "@/lib/api-response";
import { requireClubOps } from "@/lib/api-auth";
import { actorName, rejectionResponse } from "@/lib/application-route-utils";
import { updateClubData } from "@/lib/club-data";
import type { RegistrationApplication } from "@/lib/club-data";
import {
  TransitionRejection,
  applyEspaceValidation,
  planEspaceValidation,
} from "@/lib/dossier-transitions";
import { claimLifecycleEmail, queueLifecycleEmail } from "@/lib/lifecycle-emails";
import { computeClerkAccessState, syncClerkForApplication } from "@/lib/registration-clerk-sync";
import { isBureauRole, type AppRole } from "@/lib/roles";

type ValidationOutcome = {
  application: RegistrationApplication;
  mine: RegistrationApplication[];
  role: AppRole;
  validated: boolean;
  sendEmail: boolean;
};

/**
 * Ouvre l'accès de l'adhérent à son espace. Ordre : 1) enregistrement du dossier, 2) mise à jour du
 * compte de connexion, 3) e-mail « espace activé ». Un échec de l'étape 2 ou 3 ne fait jamais
 * perdre l'étape 1 : le bureau voit un avertissement. Rejouer l'action sur un dossier déjà validé
 * resynchronise simplement le compte (sans nouvel e-mail).
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }
  const actor = actorName(auth.value);

  try {
    const { applicationId } = await context.params;

    const outcome = await updateClubData<ValidationOutcome>((data) => {
      const application = data.applications.find((entry) => entry.id === applicationId);
      if (!application) {
        throw new TransitionRejection("Demande introuvable.", 404);
      }
      const mode = planEspaceValidation(application);
      if (mode === "validate") {
        applyEspaceValidation(application, { actor });
      }

      const mine = data.applications.filter((entry) => entry.clerkUserId === application.clerkUserId);
      const member = data.members.find((entry) => entry.clerkUserId === application.clerkUserId);
      if (member) {
        // Les rôles bureau/coach restent « approved » : pas d'attente d'espace membre.
        member.membershipStatus = isBureauRole(member.role)
          ? "approved"
          : computeClerkAccessState(mine).membershipStatus;
        member.updatedAt = new Date().toISOString();
      }

      return {
        application: structuredClone(application),
        mine: structuredClone(mine),
        role: member?.role ?? "member",
        validated: mode === "validate",
        sendEmail: mode === "validate" && claimLifecycleEmail(application, "espace_activated"),
      };
    });

    const sync = await syncClerkForApplication(outcome.application, {
      applications: outcome.mine,
      role: outcome.role,
    });

    if (outcome.sendEmail) {
      queueLifecycleEmail("espace_activated", outcome.application);
    }

    const base = outcome.validated
      ? "Espace adhérent validé : l’adhérent peut maintenant se connecter."
      : "L’espace adhérent était déjà validé : l’accès de l’adhérent a été revérifié.";
    if (!sync.ok) {
      return jsonOk({
        message: `${base} ${sync.warning} Pour réessayer, revenez à l’étape précédente puis validez de nouveau l’espace.`,
        warning: sync.warning,
      });
    }
    return jsonOk({ message: base });
  } catch (error) {
    const rejection = rejectionResponse(error);
    if (rejection) {
      return rejection;
    }
    console.error("Failed to validate member space", error);
    return jsonError("Impossible de valider l’espace adhérent. Réessayez dans un instant.", 500);
  }
}
